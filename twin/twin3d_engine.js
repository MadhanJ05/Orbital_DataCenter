// The 3D twin's live engine: the Sun, Earth's rotation, our 12 dawn-dusk planes, and simulate.py's
// minute-by-minute fleet model, so the page computes the fleet's state for any moment instead of
// replaying a stored day. twin/build_twin_page.py inlines this file; twin/check_twin3d.js runs its
// reference checks under Node. Nothing here invents a number: model inputs come from designs/twin.json
// (twin/physical.py live_inputs), orbit constants are standard values, and the few placement choices
// (LTAN spread, phasing, ground-station sites, elevation mask) are marked CHOICE.
var TwinEngine = (function () {
  var MIN = 1440, DEG = Math.PI / 180;
  var MU = 398600.4418, RE = 6378.137, J2 = 1.08262668e-3;   // km^3/s^2, km (WGS-84), Earth's oblateness
  var ALT = 650;                                             // km: the model's dawn-dusk orbit (catalog.py)
  var EPOCH = Date.UTC(2035, 0, 1);                          // CHOICE: phase reference for every satellite

  function pymod(x, m) { var r = x % m; return r !== 0 && (r < 0) !== (m < 0) ? r + m : r; }   // Python's %
  function pyround(x, nd) {                                  // Python's round(): halves to even
    var f = Math.pow(10, nd || 0), y = x * f, r = Math.round(y);
    if (Math.abs(y % 1) === 0.5) r = 2 * Math.round(y / 2);
    return r / f;
  }

  // ------------------------------------------------------------ demand (simulate.py global_profile)
  function localActivity(hour, sharp, peakHour) { return 0.05 + Math.pow(Math.max(0, Math.cos(2 * Math.PI * (hour - peakHour) / 24)), sharp); }
  function globalProfile(peak, regions, peakHour) {
    var f = [], m;
    if (peak <= 1) { for (m = 0; m < MIN; m++) f.push(1); return f; }
    var sharps = [1, 2, 3, 4, 6, 8, 12, 16];
    for (var k = 0; k < sharps.length; k++) {
      var g = [], sum = 0;
      for (m = 0; m < MIN; m++) {
        var v = 0;
        for (var r = 0; r < regions.length; r++) v += regions[r][2] * localActivity(pymod((m / 60) + regions[r][1], 24), sharps[k], peakHour);
        g.push(v);
      }
      for (m = 0; m < MIN; m++) sum += g[m];
      var mean = sum / MIN, gmax = -Infinity;
      for (m = 0; m < MIN; m++) { g[m] = g[m] / mean; if (g[m] > gmax) gmax = g[m]; }
      if (gmax <= 1) continue;
      var kk = (peak - 1) / (gmax - 1), fmin = Infinity; f = [];
      for (m = 0; m < MIN; m++) { var x = 1 + kk * (g[m] - 1); f.push(x); if (x < fmin) fmin = x; }
      if (fmin >= 0.02) return f;
    }
    throw new Error("no smooth global curve reaches peak " + peak);
  }

  // ------------------------------------------------------------ one design's model (simulate.py + physical.py)
  function Model(L) {
    var self = { L: L, streams: Object.keys(L.streams), curves: {} };
    self.streams.forEach(function (s) { self.curves[s] = globalProfile(L.streams[s].peak, L.regions, L.local_peak_hour); });
    self.bgOf = {}; L.valley_pairs.forEach(function (vp) { self.bgOf[vp[1]] = vp[0]; });
    self.onBattery = function (s) { return L.battery === "all" || (L.battery === "live" && L.streams[s].live); };
    self.demand = function (s, m) { return L.streams[s].avg * self.curves[s][m]; };
    // capacity per stream (simulate.py capacities); lit(pool, stream) is the share of a pool not dark in Earth's shadow
    self.capacities = function (lost, lit) {
      var cap = {};
      self.streams.forEach(function (s) {
        var d = 0, pf = 0;
        L.pools.forEach(function (p) {
          if (p.stream !== s || !p.ok || lost === p.site) return;
          var v = p.cap * lit(p, s);
          if (p.phase === "decode") d += v; else if (p.phase === "prefill") pf += v;
        });
        cap[s] = Math.min(d, pf / L.streams[s].ratio);
      });
      return cap;
    };
    self.allowance = function (bg) { var st = L.streams[bg]; return (st.deadline_s - st.task_s) / 60; };
    // one minute of the fleet: live work first, background FIFO into what is left (simulate.py, inner loop)
    self.newState = function () { var q = {}; L.valley_pairs.forEach(function (vp) { q[vp[1]] = { items: [], head: 0, served: 0, waits: [] }; }); return { q: q }; };
    self.step = function (state, t, cap, record) {
      var m = pymod(t, MIN);
      L.valley_pairs.forEach(function (vp) {
        var it = vp[0], bg = vp[1], Q = state.q[bg];
        if (L.streams[bg].avg <= 0) return;
        var live = L.bg_fill_valleys ? self.demand(it, m) : 0;
        var spare = L.bg_fill_valleys ? Math.max(0, cap[it] - live) : 0;
        var budget = (cap[bg] + spare) * 60, used = 0;
        Q.items.push([t, self.demand(bg, m) * 60]);
        while (Q.head < Q.items.length && budget > 1e-9) {
          var first = Q.items[Q.head], take = Math.min(budget, first[1]);
          first[1] -= take; budget -= take; used += take;
          if (first[1] <= 1e-9) { Q.head++; if (record) Q.waits.push(t - first[0]); }
        }
        if (Q.head > 4096) { Q.items = Q.items.slice(Q.head); Q.head = 0; }
        Q.served = used / 60;
      });
    };
    self.queued = function (Q) { var s = 0; for (var i = Q.head; i < Q.items.length; i++) s += Q.items[i][1]; return s; };
    // share of each stream's capacity in use this minute (physical.py hourly_utilization, per minute)
    self.utilization = function (state, cap, m, roundServed) {
      var u = {};
      self.streams.forEach(function (s) { u[s] = cap[s] ? Math.min(1, self.demand(s, m) / cap[s]) : 0; });
      L.valley_pairs.forEach(function (vp) {
        var it = vp[0], bg = vp[1];
        if (!cap[bg]) return;
        var served = roundServed ? pyround(state.q[bg].served) : state.q[bg].served, own = Math.min(served, cap[bg]);
        u[bg] = own / cap[bg];
        if (cap[it]) u[it] = Math.min(1, u[it] + (served - own) / cap[it]);
      });
      var bgq = state.q.agent_bg, sb = bgq ? (roundServed ? pyround(bgq.served) : bgq.served) : 0;
      u._sandbox = L.streams.agent_bg && L.streams.agent_bg.avg ? sb / L.streams.agent_bg.avg / L.sandbox_peak : 0;
      return u;
    };
    // electric power per site, MW at the meter (physical.py site_power)
    self.sitePower = function (u, lost, lit) {
      var row = {};
      L.pools.forEach(function (p) {
        if (p.site === lost) return;
        var uu = u[p.stream] || 0;
        var mw = p.it_mw * lit(p, p.stream) * (L.idle + (1 - L.idle) * uu) * p.pue;
        row[p.site] = (row[p.site] || 0) + mw;
      });
      Object.keys(L.sandbox).forEach(function (site) {
        if (site === lost) return;
        var sb = L.sandbox[site], uu = Math.min(1, u._sandbox);
        row[site] = (row[site] || 0) + sb.it_mw * (L.idle + (1 - L.idle) * uu) * sb.pue;
      });
      return row;
    };
    // a whole stored day, exactly as simulate.py runs it: steady eclipse share on the in-season planes
    self.simulateDay = function (lost, eclipse) {
      var lit = function (p, s) { return eclipse && !self.onBattery(s) && ltanOf(p.site) === eclipse ? 1 - L.dark_share : 1; };
      var cap = self.capacities(lost || null, lit), state = self.newState(), days = L.warmup_days, last = (days - 1) * MIN;
      var out = { live_shortfall_pct: 0, streams: {}, hourly_power: [], hourly_queue: [] };
      self.streams.forEach(function (s) {
        if (self.bgOf[s]) return;
        var st = L.streams[s], worst = -Infinity, peakD = -Infinity;
        for (var m = 0; m < MIN; m++) { var dd = st.avg * self.curves[s][m]; worst = Math.max(worst, dd - cap[s]); peakD = Math.max(peakD, dd); }
        if (st.avg > 0 && worst > 0) out.live_shortfall_pct = Math.max(out.live_shortfall_pct, 100 * worst / peakD);
      });
      for (var t = 0; t < days * MIN; t++) {
        self.step(state, t, cap, t >= last);
        var m = t % MIN;
        if (t >= last && m % 60 === 0) {
          var u = self.utilization(state, cap, m, true), bgq = state.q.agent_bg;
          out.hourly_power.push(self.sitePower(u, lost || null, lit));
          out.hourly_queue.push(bgq ? pyround(self.queued(bgq) / (L.streams.agent_bg.avg * 60), 1) : 0);
        }
      }
      L.valley_pairs.forEach(function (vp) {
        var bg = vp[1], Q = state.q[bg]; if (L.streams[bg].avg <= 0) return;
        var w = Q.waits.slice(); for (var i = Q.head; i < Q.items.length; i++) w.push(days * MIN - Q.items[i][0]);
        var mx = w.length ? Math.max.apply(null, w) : 0, allow = self.allowance(bg);
        out.streams[bg] = { max_wait_min: mx, allowance_min: pyround(allow), meets_deadline: mx <= allow };
      });
      out.ok = out.live_shortfall_pct === 0 && Object.keys(out.streams).every(function (k) { return out.streams[k].meets_deadline; });
      return out;
    };
    return self;
  }
  function ltanOf(site) { var m = /^leo_p(\d+)$/.exec(site); return m ? (+m[1] % 2 ? "06:00" : "18:00") : null; }   // catalog.py plane_ltan

  // the page's self-check: re-run every stored day of the Python twin and compare
  function check(design) {
    var mdl = Model(design.live), bad = [], n = 0;
    design.outages.forEach(function (o) {
      var r = mdl.simulateDay(o.lost, o.eclipse), w = r.streams.agent_bg || {};
      n++;
      if (r.ok !== o.ok || (o.bg_wait_min != null && w.max_wait_min !== o.bg_wait_min) || Math.abs(pyround(r.live_shortfall_pct, 2) - o.live_short_pct) > 1e-9)
        bad.push((o.lost || "normal") + (o.eclipse ? " + " + o.eclipse + " eclipse" : "") + ": wait " + w.max_wait_min + " vs " + o.bg_wait_min);
    });
    [["normal", null], ["eclipse", "06:00"], ["eclipse18", "18:00"]].forEach(function (k) {
      var day = design.days[k[0]]; if (!day) return;
      var r = mdl.simulateDay(null, k[1]); n++;
      for (var h = 0; h < 24; h++) {
        var want = day.power_mw[h] || day.power_mw[String(h)], got = r.hourly_power[h];
        Object.keys(want).forEach(function (site) { if (Math.abs(got[site] - want[site]) > 0.0051) bad.push(k[0] + " " + h + ":00 " + site + " " + got[site].toFixed(3) + " vs " + want[site]); });
        if (day.bg_queue_min && Math.abs(r.hourly_queue[h] - day.bg_queue_min[h]) > 0.051) bad.push(k[0] + " " + h + ":00 queue " + r.hourly_queue[h] + " vs " + day.bg_queue_min[h]);
      }
    });
    if (design.days.normal.demand) Object.keys(design.days.normal.demand).forEach(function (s) {
      design.days.normal.demand[s].forEach(function (v, h) { if (Math.abs(pyround(mdl.curves[s][h * 60], 3) - v) > 1e-9) bad.push("demand " + s + " " + h); });
    });
    return { days: n, mismatches: bad };
  }

  // ------------------------------------------------------------ Sun, Earth rotation, orbits
  function jd(ms) { return ms / 86400000 + 2440587.5; }
  function sunEci(ms) {                                      // Astronomical Almanac low-precision Sun, unit vector, ~0.01 deg
    var n = jd(ms) - 2451545.0;
    var Lm = (280.460 + 0.9856474 * n) * DEG, g = (357.528 + 0.9856003 * n) * DEG;
    var lam = Lm + 1.915 * DEG * Math.sin(g) + 0.020 * DEG * Math.sin(2 * g), eps = (23.439 - 4e-7 * n) * DEG;
    return [Math.cos(lam), Math.cos(eps) * Math.sin(lam), Math.sin(eps) * Math.sin(lam)];
  }
  function gmst(ms) { return pymod(280.46061837 + 360.98564736629 * (jd(ms) - 2451545.0), 360) * DEG; }   // radians
  var A = RE + ALT, N_MOTION = Math.sqrt(MU / (A * A * A));     // rad/s
  var INC = Math.acos(-(2 * Math.PI / (365.2422 * 86400)) / (1.5 * N_MOTION * J2 * Math.pow(RE / A, 2)));   // sun-synchronous
  var PERIOD_MIN = 2 * Math.PI / N_MOTION / 60;
  // CHOICE: the six planes of each group fan out by 4 minutes of local time (05:50 to 06:10, 17:50 to 18:10),
  // all at 650 km, satellites evenly spaced and staggered between planes so no two share a slot
  function planes(sites) {
    var orb = sites.filter(function (s) { return s.kind === "space"; }), count = { "06:00": 0, "18:00": 0 }, P = orb.length;
    return orb.map(function (s, i) {
      var base = ltanOf(s.site) || s.ltan, k = count[base]++, per = Math.ceil(P / 2);
      var ltanH = (base === "06:00" ? 6 : 18) + (k - (per - 1) / 2) * 4 / 60;
      return { site: s.site, ltan: base, ltanH: ltanH, n: s.satellites, index: i, P: P };
    });
  }
  function raan(pl, ms) { var ut = pymod(ms / 3600000, 24); return gmst(ms) + (pl.ltanH - ut) * 15 * DEG; }   // node at local mean time LTAN
  function satEci(pl, j, ms, out) {                          // circular two-body orbit, km
    var O = raan(pl, ms), u = 2 * Math.PI * (j / pl.n + pl.index / (pl.P * pl.n)) + N_MOTION * (ms - EPOCH) / 1000;
    var cO = Math.cos(O), sO = Math.sin(O), cu = Math.cos(u), su = Math.sin(u), ci = Math.cos(INC), si = Math.sin(INC);
    out = out || {};
    out.p = [A * (cO * cu - sO * su * ci), A * (sO * cu + cO * su * ci), A * su * si];
    out.v = [-cO * su - sO * cu * ci, -sO * su + cO * cu * ci, cu * si];
    return out;
  }
  function inShadow(p, s) {                                  // cylindrical shadow, as agents-in-orbit/model.py
    var along = p[0] * s[0] + p[1] * s[1] + p[2] * s[2]; if (along >= 0) return false;
    return p[0] * p[0] + p[1] * p[1] + p[2] * p[2] - along * along < RE * RE;
  }
  function beta(pl, ms, s) {                                 // Sun angle above the orbit plane, radians
    var O = raan(pl, ms), h = [Math.sin(INC) * Math.sin(O), -Math.sin(INC) * Math.cos(O), Math.cos(INC)];
    return Math.asin(h[0] * s[0] + h[1] * s[1] + h[2] * s[2]);
  }
  function eclipseMinutes(b) {                               // longest shadow on one lap at this beta
    var c = Math.sqrt(ALT * ALT + 2 * RE * ALT) / (A * Math.cos(b));
    return c < 1 ? Math.acos(c) / Math.PI * PERIOD_MIN : 0;
  }
  function darkShares(pls, ms) {                             // share of each plane's satellites in Earth's shadow now
    var s = sunEci(ms), out = {}, tmp = {};
    pls.forEach(function (pl) { var d = 0; for (var j = 0; j < pl.n; j++) if (inShadow(satEci(pl, j, ms, tmp).p, s)) d++; out[pl.site] = d / pl.n; });
    return out;
  }
  // CHOICE: 16 optical ground stations at existing optical, observatory and polar ground-station sites;
  // the model only counts 16 stations, so where they sit is ours. A link needs 20 deg of elevation (CHOICE).
  var STATIONS = [
    ["Tenerife, Spain", 28.30, -16.51], ["Table Mountain, California", 34.38, -117.68], ["White Sands, New Mexico", 32.50, -106.61],
    ["Haleakala, Hawaii", 20.71, -156.26], ["Mount Stromlo, Australia", -35.32, 149.00], ["Koganei, Japan", 35.71, 139.49],
    ["Oberpfaffenhofen, Germany", 48.08, 11.28], ["Matera, Italy", 40.65, 16.70], ["Atacama, Chile", -24.63, -70.40],
    ["Sutherland, South Africa", -32.38, 20.81], ["Hanle, India", 32.78, 78.96], ["Fairbanks, Alaska", 64.86, -147.85],
    ["Svalbard, Norway", 78.23, 15.41], ["Troll, Antarctica", -72.01, 2.53], ["Punta Arenas, Chile", -52.94, -70.85], ["Abu Dhabi, UAE", 24.43, 54.65]];
  var MIN_ELEV = 20 * DEG;
  function stationEci(st, ms) {
    var lat = st[1] * DEG, lon = st[2] * DEG + gmst(ms);
    return [RE * Math.cos(lat) * Math.cos(lon), RE * Math.cos(lat) * Math.sin(lon), RE * Math.sin(lat)];
  }
  function bestStation(p, ms) {                              // highest station above the mask, or null
    var best = null;
    STATIONS.forEach(function (st, i) {
      var g = stationEci(st, ms), d = [p[0] - g[0], p[1] - g[1], p[2] - g[2]], r = Math.hypot(d[0], d[1], d[2]);
      var el = Math.asin((d[0] * g[0] + d[1] * g[1] + d[2] * g[2]) / (r * RE));
      if (el >= MIN_ELEV && (!best || el > best.el)) best = { i: i, el: el, km: r };
    });
    return best;
  }
  function latLon(p, ms) {
    var lon = Math.atan2(p[1], p[0]) - gmst(ms);
    return [Math.asin(p[2] / Math.hypot(p[0], p[1], p[2])) / DEG, pymod(lon / DEG + 180, 360) - 180];
  }

  // ------------------------------------------------------------ the live fleet: the model, minute by minute, on real geometry
  function Live(design) {
    var mdl = Model(design.live), pls = planes(design.sites), self = { mdl: mdl, planes: pls };
    self.lit = function (dark) { return function (p, s) { return dark[p.site] != null && !mdl.onBattery(s) ? 1 - dark[p.site] : 1; }; };
    self.lostAt = function (events, t) { var l = null; events.forEach(function (e) { if (e.t <= t) l = e.site || null; }); return l; };
    // run from `from` to `to` (minute numbers since 1970), return the state at `to` and optional hourly rows
    self.run = function (events, from, to, hourly) {
      var state = mdl.newState(), rows = [], cap, dark, lost;
      for (var t = from; t <= to; t++) {
        dark = darkShares(pls, t * 60000); lost = self.lostAt(events, t);
        cap = mdl.capacities(lost, self.lit(dark));
        mdl.step(state, t, cap, false);
        if (hourly && t >= hourly && (t - hourly) % 60 === 0) rows.push(self.snapshot(state, t, cap, dark, lost));
      }
      return { state: state, cap: cap, dark: dark, lost: lost, rows: rows };
    };
    self.snapshot = function (state, t, cap, dark, lost) {
      var m = pymod(t, MIN), u = mdl.utilization(state, cap, m, false), power = mdl.sitePower(u, lost, self.lit(dark));
      var liveD = 0, liveCap = 0, short = 0;
      mdl.streams.forEach(function (s) {
        if (mdl.bgOf[s]) return; var d = mdl.demand(s, m); liveD += d; liveCap += cap[s];
        if (d > cap[s] + 1e-6) short = Math.max(short, (d - cap[s]) / d);
      });
      var q = state.q.agent_bg, oldest = q && q.head < q.items.length ? t - q.items[q.head][0] : 0;
      return { t: t, u: u, power: power, liveDemand: liveD, liveCap: liveCap, liveShort: short,
               queueMin: q ? mdl.queued(q) / (design.live.streams.agent_bg.avg * 60) : 0, oldestWait: oldest,
               allowance: mdl.allowance("agent_bg"), bgServed: q ? q.served : 0, cap: cap, dark: dark, lost: lost };
    };
    return self;
  }

  return { Model: Model, Live: Live, check: check, globalProfile: globalProfile, sunEci: sunEci, gmst: gmst, planes: planes, raan: raan,
           satEci: satEci, inShadow: inShadow, beta: beta, eclipseMinutes: eclipseMinutes, darkShares: darkShares, STATIONS: STATIONS,
           stationEci: stationEci, bestStation: bestStation, latLon: latLon, ltanOf: ltanOf, pyround: pyround,
           ALT: ALT, RE: RE, A: A, INC: INC, PERIOD_MIN: PERIOD_MIN, MIN_ELEV: MIN_ELEV };
})();
if (typeof module !== "undefined") module.exports = TwinEngine;
