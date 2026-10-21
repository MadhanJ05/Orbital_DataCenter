#!/usr/bin/env node
// Checks the 3D twin's live engine (twin/twin3d_engine.js) against the Python twin and against known geometry.
//
//     node twin/check_twin3d.js
//
// 1. Every day simulate.py stored in designs/twin.json (normal, each outage, both eclipse groups, eclipse
//    plus outage) re-run in JavaScript: same background waits, same live shortfall, same hourly power per site.
// 2. Orbit and Sun: sun-synchronous inclination at 650 km, the June-solstice subsolar point, and which
//    plane group gets its eclipse season when (06:00 planes around December, as PROBA2 does).
var path = require("path"), fs = require("fs");
var E = require("./twin3d_engine.js");
var twin = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "designs", "twin.json"), "utf8"));
var fails = 0;
function ok(cond, msg) { console.log((cond ? "  ok   " : "  FAIL ") + msg); if (!cond) fails++; }

console.log("1. The live engine reproduces the Python twin's simulated days");
twin.designs.forEach(function (d) {
  var t0 = Date.now(), r = E.check(d);
  ok(r.mismatches.length === 0, d.name + ": " + r.days + " days re-run, " + r.mismatches.length + " mismatches (" + (Date.now() - t0) + " ms)" +
     (r.mismatches.length ? "\n         " + r.mismatches.slice(0, 5).join("\n         ") : ""));
});

console.log("2. Orbit and Sun");
ok(Math.abs(E.INC * 180 / Math.PI - 97.99) < 0.01, "sun-synchronous inclination at 650 km: " + (E.INC * 180 / Math.PI).toFixed(2) + " deg");
ok(Math.abs(E.PERIOD_MIN - 97.73) < 0.01, "one lap: " + E.PERIOD_MIN.toFixed(2) + " min");
var ms = Date.UTC(2026, 5, 21, 12), s = E.sunEci(ms), ra = Math.atan2(s[1], s[0]), dec = Math.asin(s[2]) * 180 / Math.PI;
var lon = ((ra - E.gmst(ms)) * 180 / Math.PI + 540) % 360 - 180;
// the equation of time is about -1.7 min on 21 June: the Sun reaches Greenwich at 12:01.7 UTC, so at 12:00 it is ~0.4 deg east
ok(Math.abs(dec - 23.44) < 0.05 && Math.abs(lon - 0.43) < 0.1, "Sun overhead at 12:00 UTC on 21 June 2026: " + dec.toFixed(2) + " deg N, " + lon.toFixed(2) + " deg E (expected ~23.44 N, ~0.43 E)");
var pls = E.planes(twin.designs[0].sites);
function season(pl) {
  var days = [];
  for (var dd = 0; dd < 365; dd++) { var t = Date.UTC(2035, 0, 1, 12) + dd * 86400000; if (E.eclipseMinutes(E.beta(pl, t, E.sunEci(t))) > 0) days.push(new Date(t).getUTCMonth()); }
  return days;
}
var dawn = pls.filter(function (p) { return p.ltan === "06:00"; })[2], dusk = pls.filter(function (p) { return p.ltan === "18:00"; })[2];
var sd = season(dawn), sk = season(dusk);
ok(sd.indexOf(11) >= 0 && sd.indexOf(5) < 0, "06:00 planes: " + sd.length + " eclipse days a year, in Nov-Feb (December), not June");
ok(sk.indexOf(5) >= 0 && sk.indexOf(11) < 0, "18:00 planes: " + sk.length + " eclipse days a year, in May-Aug (June)");
var longest = 0; for (var dd = 0; dd < 365; dd++) { var t = Date.UTC(2035, 0, 1, 12) + dd * 86400000; longest = Math.max(longest, E.eclipseMinutes(E.beta(dusk, t, E.sunEci(t)))); }
ok(Math.abs(longest - 19.7) < 0.2, "longest eclipse: " + longest.toFixed(1) + " min (README: 19.6 at 650 km; the model plans for 21)");

console.log(fails ? "\n" + fails + " check(s) failed" : "\nall checks pass");
process.exit(fails ? 1 : 0);
