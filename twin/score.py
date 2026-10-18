#!/usr/bin/env python3
"""Track 1 digital twin and scorer: design.json -> users served, 5-year cost, limits.

    python3 twin/score.py designs/B_earth_only.json          # human report
    python3 twin/score.py designs/B_earth_only.json --json   # machine-readable
    python3 twin/score.py --napkin                           # capacity per chip + case sizing
    python3 twin/score.py --breakeven                        # launch $/kg where orbit ties each site

Ranking (DECK s9): users served within every SLO and hard limit first, then the
lowest 5-year cost. Every constant lives in catalog.py.
"""
import argparse
import json
import math
import sys
from pathlib import Path

import catalog as C

SERVING_DEFAULTS = dict(easy_chat_share=0.0, subagent_share=0.0, spec_draft=0,
                        context_memory=False, bg_fill_valleys=False, autosize_util=0.95,
                        resilience=None)
VALLEY_PAIRS = (("agent_int", "agent_bg"), ("agent_int_sub", "agent_bg_sub"))
INF = float("inf")


# ---------------------------------------------------------------- per-session physics

def model_of(stream):
    return C.MODELS[C.STREAMS[stream]["model"]]


def session_kv_bytes(stream):
    """KV cache one decoding session re-reads every step (context + half the output)."""
    s, m = C.STREAMS[stream], model_of(stream)
    return m["kv"] * (s["ctx"] + s["out"] / 2) + m["state"]


def new_kv_bytes(stream):
    s, m = C.STREAMS[stream], model_of(stream)
    return m["kv"] * (s["ctx"] - s["cached"])


def spec_tokens_per_step(draft):
    """Expected tokens per decode step when drafting `draft` tokens."""
    if draft <= 0:
        return 1.0
    a = C.SPEC_ACCEPT
    return (1 - a ** (draft + 1)) / (1 - a)


def site_pue(cooling, site):
    st = C.SITES[site]
    if st["kind"] == "space":
        return 1.0
    p = C.COOLING[cooling]["pue"]
    if st["climate"] == "temperate":
        return (p["cold"] + p["desert"]) / 2
    return p[st["climate"]]


def replica_hw(chip, n):
    """Usable memory (after the reserve), effective bandwidth and FLOPS of n chips."""
    ch = C.CHIPS[chip]
    return (n * ch["mem"] * C.MEMORY_USABLE, n * ch["bw"] * C.BW_EFFICIENCY, n * ch["flops"] * C.FLOPS_EFFICIENCY)


def decode_replica(stream, chip, n, serving):
    """One replica of `n` chips decoding `stream`: sessions per step and tokens/s.

    step = sync + weight reads + sessions x (KV reads + math); the tok/s SLO fixes
    the step time and the batch fills what is left (DECK s17). Memory then caps
    how many sessions fit, including agents parked during tool calls (DECK s13).
    """
    s, m = C.STREAMS[stream], model_of(stream)
    mem, bw, flops = replica_hw(chip, n)
    weights = m["total"] * C.BYTES_PER_WEIGHT
    kv = session_kv_bytes(stream)
    draft = serving["spec_draft"]
    tau = spec_tokens_per_step(draft)
    budget = tau / s["rate"]
    sync = C.STEP_SYNC_S + C.SYNC_PER_DOUBLING_S * math.log2(n)
    fixed = (sync + C.WEIGHT_READ_FACTOR * m["active"] * C.BYTES_PER_WEIGHT / bw
             + draft * C.SPEC_DRAFT_OVERHEAD_S)
    per_session = kv / bw + (draft + 1) * (2 * m["active"] + C.ATTN_FLOPS_PER_KV_BYTE * kv) / flops
    b_bw = math.floor((budget - fixed) / per_session) if budget > fixed else 0

    free = mem - weights
    ctx = serving["context_memory"]

    def parked_per_active(b):
        """Sessions parked in tool calls per decoding session. A session that writes
        faster spends a larger share of its cycle parked, so use the real speed."""
        if s["tool_s"] <= 0:
            return 0.0
        rate = tau / (fixed + b * per_session)
        return rate * s["tool_s"] / s["out"]

    def fits(b):
        held = 1 if ctx else 1 + parked_per_active(b)
        if b * kv * held > free:
            return False
        if ctx and s["tool_s"] > 0:
            # every tool call parks the cache in the tier and loads it back: the tier
            # keeps last step's copy, so only the new tokens go out, the whole cache comes in
            cycles = b * tau / (fixed + b * per_session) / s["out"]
            moved = kv + m["kv"] * (s["ctx"] - s["cached"] + s["out"])
            if moved * cycles > n * C.CHIPS[chip]["ctx_link"]:
                return False
        return True

    lo, hi = 0, max(0, b_bw)                     # largest b that fits: memory and link grow with b
    while lo < hi:
        mid = (lo + hi + 1) // 2
        if fits(mid):
            lo = mid
        else:
            hi = mid - 1
    b = lo if free > 0 else 0
    r = dict(n=n, sessions=b, bound="bandwidth" if b == b_bw else ("context link" if ctx and b > 0 and
             b * kv <= free and not fits(b + 1) and (b + 1) * kv <= free else "memory"),
             weights_fit=weights <= mem, tps=0.0, step_s=budget, ctx_mem_bytes=0.0,
             mem_used=weights, mem=mem)
    if b < 1 or weights > mem:
        return r
    step = fixed + b * per_session
    parked = b * parked_per_active(b)
    r.update(tps=b * tau / step, step_s=step,
             mem_used=weights + b * kv + (0 if ctx else parked * kv),
             ctx_mem_bytes=parked * kv if ctx else 0.0)
    return r
    step = fixed + b * per_session
    r.update(tps=b * tau / step, step_s=step, mem_used=weights + b * kv * held,
             ctx_mem_bytes=b * (resident - 1) * kv if serving["context_memory"] else 0.0)
    return r


def prefill_replica(stream, chip, n):
    """One replica of `n` chips prefilling the uncached part of each request."""
    s, m = C.STREAMS[stream], model_of(stream)
    mem, bw, flops = replica_hw(chip, n)
    weights = m["total"] * C.BYTES_PER_WEIGHT
    new = s["ctx"] - s["cached"]
    avg_ctx = s["cached"] + new / 2
    work = new * (2 * m["active"] + C.ATTN_FLOPS_PER_KV_BYTE * m["kv"] * avg_ctx)
    t_req = work / flops + s["cached"] * m["kv"] / bw   # math + reading the cached prefix
    fits = weights <= mem
    return dict(n=n, t_req=t_req, tps=new / t_req if fits else 0.0, weights_fit=fits,
                mem_used=weights, mem=mem)


# ---------------------------------------------------------------- workload

def demand(cases, serving):
    """Peak tokens/s per stream: decode tokens out, uncached prefill tokens in."""
    easy, sub = serving["easy_chat_share"], serving["subagent_share"]
    out = {s: 0.0 for s in C.STREAMS}
    inp = {s: 0.0 for s in C.STREAMS}
    reqs = {s: 0.0 for s in C.STREAMS}          # average requests/s
    for case in cases:
        c = C.CASES[case]
        per_day = {"chat": c["chat"] * (1 - easy), "chat_easy": c["chat"] * easy,
                   "agent_int": c["agent_int"] * (1 - sub), "agent_int_sub": c["agent_int"] * sub,
                   "agent_bg": c["agent_bg"] * (1 - sub), "agent_bg_sub": c["agent_bg"] * sub}
        for s, n in per_day.items():
            st = C.STREAMS[s]
            rps = c["users"] * n * st["steps"] / 86400
            reqs[s] += rps
            out[s] += rps * st["out"] * st["peak"]
            inp[s] += rps * (st["ctx"] - st["cached"]) * st["peak"]
    return out, inp, reqs


def valley_shift(d_out, d_in, serving):
    """Off-peak shift: background agents (4 h deadline) run in the off-peak capacity of
    the interactive pools of the same model, so their own pools only cover what
    does not fit there. Interactive pools sized for peak P with daily average a
    have P - a of spare capacity on average; background work b beyond that still
    needs its own racks (DECK s21: flexible batch deadlines).
    Returns shifted demand and the average tokens/s moved into each interactive stream."""
    out, inp, moved_out, moved_in = dict(d_out), dict(d_in), {}, {}
    if not serving["bg_fill_valleys"]:
        return out, inp, moved_out, moved_in
    for it, bg in VALLEY_PAIRS:
        if out[bg] <= 0 or out[it] <= 0:
            continue
        spare = out[it] - out[it] / C.STREAMS[it]["peak"]
        moved = min(out[bg], spare)
        ratio = inp[bg] / out[bg]
        out[bg] -= moved
        inp[bg] -= moved * ratio
        moved_out[it], moved_in[it] = moved, moved * ratio
    return out, inp, moved_out, moved_in


def case_streams(case):
    c = C.CASES[case]
    streams = []
    if c["chat"]:
        streams += ["chat", "chat_easy"]
    if c["agent_int"]:
        streams += ["agent_int", "agent_int_sub"]
    if c["agent_bg"]:
        streams += ["agent_bg", "agent_bg_sub"]
    return streams


# ---------------------------------------------------------------- evaluation

def _one_way(site):
    return C.SITES[site]["rtt"] / 2


def _ttft(stream, p, d, rho_p):
    """TTFT = round trip + queue + prefill + first token (DECK s12), plus the
    KV hand-off when prefill and decode sit at different sites."""
    st = C.STREAMS[stream]
    user = _one_way(p["site"]) + _one_way(d["site"]) if st["rtt_per_step"] else 0.0
    link = 0.0
    if p["site"] != d["site"]:
        link = _one_way(p["site"]) + _one_way(d["site"]) + new_kv_bytes(stream) / C.KV_LINK_BYTES_S
    rho = min(rho_p, 0.98)
    queue = rho / (2 * (1 - rho)) * p["t_req"] + d["step_s"] / 2   # M/D/1 + join the batch
    return user + queue + p["t_req"] + link + d["step_s"]


def evaluate(design):
    """Score a design. An optional "satellite" block ({"kg_per_mw", "hw_factor", and optionally
    "launch_usd_per_kg"}) swaps in a what-if orbital megawatt for this evaluation only
    (twin/orbit_mass.py)."""
    sat = design.get("satellite")
    if not sat:
        return _evaluate(design)
    saved = C.SPACE_KG_PER_MW, C.SPACE_HW_USD_PER_MW, C.SITES["leo"]["launch_usd_per_kg"]
    try:
        C.SPACE_KG_PER_MW = sat["kg_per_mw"]
        C.SPACE_HW_USD_PER_MW = saved[1] * sat.get("hw_factor", 1.0)
        C.SITES["leo"]["launch_usd_per_kg"] = sat.get("launch_usd_per_kg", saved[2])   # planes share leo's dict
        r = _evaluate(design)
        r["satellite"] = dict(sat)
        return r
    finally:
        C.SPACE_KG_PER_MW, C.SPACE_HW_USD_PER_MW, C.SITES["leo"]["launch_usd_per_kg"] = saved


def _evaluate(design):
    errors = []
    serving = dict(SERVING_DEFAULTS, **design.get("serving", {}))
    if not 0 <= serving["easy_chat_share"] <= C.MAX_EASY_CHAT_SHARE:
        errors.append(f"easy_chat_share must be in [0, {C.MAX_EASY_CHAT_SHARE}]")
    if not 0 <= serving["subagent_share"] <= C.MAX_SUBAGENT_SHARE:
        errors.append(f"subagent_share must be in [0, {C.MAX_SUBAGENT_SHARE}]")
    if not (isinstance(serving["spec_draft"], int) and 0 <= serving["spec_draft"] <= C.SPEC_MAX_DRAFT):
        errors.append(f"spec_draft must be an integer in [0, {C.SPEC_MAX_DRAFT}]")
        serving["spec_draft"] = 0

    cases = design.get("cases") or []
    if isinstance(cases, str):
        cases = [cases]
    for c in cases:
        if c not in C.CASES:
            errors.append(f"unknown case {c!r}")
    cases = [c for c in cases if c in C.CASES]
    d_out, d_in, reqs = demand(cases, serving)
    margin = 1 + C.DEMAND_MARGIN       # size and check service against demand above the deck's
    d_out = {k: v * margin for k, v in d_out.items()}
    d_in = {k: v * margin for k, v in d_in.items()}
    raw_out = dict(d_out)
    d_out, d_in, moved_out, moved_in = valley_shift(d_out, d_in, serving)
    if serving["bg_fill_valleys"] and C.STREAMS["agent_bg"]["task_deadline"] < C.PEAK_WINDOW_H * 3600:
        errors.append("off-peak shift needs the background deadline to outlast the peak window")

    # ---- build pools
    pools = []
    for i, raw in enumerate(design.get("pools", [])):
        p = dict(raw)
        p.setdefault("name", f"pool{i}")
        p.setdefault("chips_per_replica", 1)
        where = f"pool {p['name']!r}"
        bad = [k for k in ("stream", "phase", "site", "chip") if k not in p]
        if bad:
            errors.append(f"{where}: missing {bad}")
            continue
        stream, phase, site, chip, n = p["stream"], p["phase"], p["site"], p["chip"], p["chips_per_replica"]
        if stream not in C.STREAMS or site not in C.SITES or chip not in C.CHIPS or phase not in ("prefill", "decode"):
            errors.append(f"{where}: unknown stream/site/chip/phase")
            continue
        if phase not in C.CHIPS[chip]["phases"]:
            errors.append(f"{where}: {chip} cannot do {phase} (DECK s9)")
        if not (isinstance(n, int) and n >= 1):
            errors.append(f"{where}: chips_per_replica must be a positive integer")
            continue
        space = C.SITES[site]["kind"] == "space"
        p.setdefault("cooling", "radiators" if space else "direct_liquid")
        if p["cooling"] not in C.COOLING:
            errors.append(f"{where}: unknown cooling {p['cooling']!r}")
            continue
        if space != (p["cooling"] == "radiators"):
            errors.append(f"{where}: radiators are for space sites only, and space sites need radiators")
        if C.CHIPS[chip]["rack_kw"] > C.COOLING[p["cooling"]]["max_rack_kw"]:
            errors.append(f"{where}: a {C.CHIPS[chip]['rack_kw']} kW rack needs liquid or immersion (DECK s14)")

        rep = decode_replica(stream, chip, n, serving) if phase == "decode" else prefill_replica(stream, chip, n)
        if not rep["weights_fit"]:
            errors.append(f"{where}: {C.STREAMS[stream]['model']} weights do not fit in {n} x {chip}")
        elif rep["tps"] <= 0:
            errors.append(f"{where}: no session fits the SLO on {n} x {chip}")
        survival = C.SPACE_CHIP_SURVIVAL if space else 1.0
        rack_chips = C.CHIPS[chip]["rack_chips"]
        if "racks" not in p:
            want = (d_out if phase == "decode" else d_in)[stream] * p.get("share", 1.0)
            per_rep = rep["tps"] * survival * serving["autosize_util"]
            p["racks"] = math.ceil(math.ceil(want / per_rep) * n / rack_chips) if per_rep > 0 and want > 0 else 0
            p["autosized"] = True
        replicas = (p["racks"] * rack_chips) // n
        p.update(rep=rep, replicas=replicas, space=space, survival=survival,
                 cap=replicas * rep["tps"] * survival, t_req=rep.get("t_req", 0.0),
                 step_s=rep.get("step_s", 0.0))
        pools.append(p)

    # ---- SLO checks: each decode pool against every prefill pool of its stream
    def by(stream, phase, ok_only=False):
        return [p for p in pools if p["stream"] == stream and p["phase"] == phase and p["cap"] > 0
                and (p.get("slo_ok", True) or not ok_only)]

    rho = {}
    for s in C.STREAMS:
        for phase, dem in (("prefill", d_in[s]), ("decode", d_out[s])):
            cap = sum(p["cap"] for p in by(s, phase))
            rho[(s, phase)] = dem / cap if cap > 0 else (INF if dem > 0 else 0.0)

    for p in pools:
        p["slo_ok"] = p["cap"] > 0
        p["ttft_s"] = None
    for d in [p for p in pools if p["phase"] == "decode" and p["cap"] > 0]:
        s, st = d["stream"], C.STREAMS[d["stream"]]
        pre = by(s, "prefill")
        if not pre:
            d["slo_ok"], d["slo_why"] = False, "no prefill pool for this stream"
            continue
        worst = max(_ttft(s, p, d, rho[(s, "prefill")]) for p in pre)
        d["ttft_s"] = worst
        rate_s = d["step_s"] / spec_tokens_per_step(serving["spec_draft"])   # seconds per token
        task = st["steps"] * (worst + st["out"] * rate_s + st["tool_s"])
        if not st["rtt_per_step"]:
            task += max(C.SITES[p["site"]]["rtt"] for p in pre + [d])
        d["task_s"] = task if st["steps"] > 1 else None
        if worst > st["ttft"]:
            d["slo_ok"], d["slo_why"] = False, f"TTFT {worst:.2f}s > {st['ttft']}s"
        elif st["task_deadline"] and task > st["task_deadline"]:
            d["slo_ok"], d["slo_why"] = False, f"task {task / 60:.0f} min > {st['task_deadline'] / 60:.0f} min"
    for p in [p for p in pools if p["phase"] == "prefill" and p["cap"] > 0]:
        decs = by(p["stream"], "decode")
        if decs and not any(d["slo_ok"] for d in decs):
            p["slo_ok"], p["slo_why"] = False, "every decode pool it feeds misses the SLO"

    # ---- service: share of each stream's peak demand met by SLO-passing pools
    def served(pool_filter=lambda p: True):
        frac = {}
        for s in C.STREAMS:
            if d_out[s] <= 0:
                frac[s] = 1.0 if raw_out[s] <= 0 or s in dict(VALLEY_PAIRS).values() else 0.0
                continue
            cap_d = sum(p["cap"] for p in by(s, "decode", True) if pool_filter(p))
            cap_p = sum(p["cap"] for p in by(s, "prefill", True) if pool_filter(p))
            frac[s] = min(1.0, cap_d / d_out[s], cap_p / d_in[s] if d_in[s] > 0 else 1.0)
        for it, bg in VALLEY_PAIRS:
            if it not in moved_out:
                continue
            # work moved into the interactive pools needs their average spare:
            # capacity left (after any outage) minus the interactive daily average
            share = []
            for phase, moved, dem in (("decode", moved_out[it], d_out[it]), ("prefill", moved_in[it], d_in[it])):
                cap = sum(p["cap"] for p in by(it, phase, True) if pool_filter(p))
                spare = cap - dem / C.STREAMS[it]["peak"]
                share.append(max(0.0, min(1.0, spare / moved)) if moved > 0 else 1.0)
            own = frac[bg] if raw_out[bg] > 0 else 1.0
            moved_share = moved_out[it] / raw_out[bg]
            frac[bg] = min(own if d_out[bg] > 0 else 1.0, 1.0) * (1 - moved_share) + min(share) * moved_share
            frac[bg] = min(frac[bg], frac[it])
        per_case = {c: min(frac[s] for s in case_streams(c)) for c in cases}
        users = sum(C.CASES[c]["users"] * f for c, f in per_case.items())
        return frac, per_case, users

    stream_frac, case_frac, users = served()

    # ---- power, energy, money
    totals = dict(chips=0.0, context_memory=0.0, facility=0.0, energy=0.0, carbon=0.0,
                  water=0.0, launch=0.0, space_hw=0.0)
    site_mw, site_it_mw = {}, {}
    co2_t = water_l = launch_kg = 0.0
    energy_by_stream = {s: 0.0 for s in C.STREAMS}   # kWh over 5 years
    for p in pools:
        ch = C.CHIPS[p["chip"]]
        ctx_gb = p["replicas"] * p["rep"].get("ctx_mem_bytes", 0.0) / 1e9
        it_mw = (p["racks"] * ch["rack_kw"] + ctx_gb * C.CONTEXT_MEM_W_PER_GB / 1000) / 1000
        pool_rho = min(1.0, rho[(p["stream"], p["phase"])] / margin) if p["slo_ok"] else 0.0   # bill real demand
        avg_util = pool_rho / C.STREAMS[p["stream"]]["peak"]
        extra = (moved_out if p["phase"] == "decode" else moved_in).get(p["stream"], 0.0)
        cap_total = sum(q["cap"] for q in by(p["stream"], p["phase"]))
        if extra and cap_total and p["slo_ok"]:
            avg_util = min(1.0, avg_util + extra / margin / cap_total)
        load = C.IDLE_POWER_FRACTION + (1 - C.IDLE_POWER_FRACTION) * avg_util
        pue = site_pue(p["cooling"], p["site"])
        mwh = it_mw * load * pue * C.HOURS
        cost = dict(chips=p["racks"] * ch["rack_usd"], context_memory=ctx_gb * C.CONTEXT_MEM_USD_PER_GB)
        st = C.SITES[p["site"]]
        if p["space"]:
            kg = it_mw * C.SPACE_KG_PER_MW
            cost.update(launch=kg * st["launch_usd_per_kg"], space_hw=it_mw * C.SPACE_HW_USD_PER_MW)
            launch_kg += kg
        else:
            t = mwh * st["g_co2_kwh"] / 1000
            liters = it_mw * load * C.HOURS * 1000 * C.EVAP_WATER_L_PER_KWH if C.COOLING[p["cooling"]]["water"] else 0.0
            cost.update(facility=it_mw * (C.FACILITY_USD_PER_MW + C.COOLING[p["cooling"]]["capex_per_mw"]),
                        energy=mwh * st["usd_per_mwh"], carbon=t * C.CARBON_USD_PER_T,
                        water=liters / 1000 * C.WATER_USD_PER_M3)
            co2_t += t
            water_l += liters
        for k, v in cost.items():
            totals[k] += v
        site_mw[p["site"]] = site_mw.get(p["site"], 0.0) + it_mw * pue
        site_it_mw[p["site"]] = site_it_mw.get(p["site"], 0.0) + it_mw
        energy_by_stream[p["stream"]] += mwh * 1000
        p.update(it_mw=it_mw, facility_mw=it_mw * pue, pue=pue, load=load, cost=cost,
                 cost_usd=sum(cost.values()), ctx_gb=ctx_gb)
    total_usd = sum(totals.values())

    # ---- hard limits
    earth_mw = sum(mw for s, mw in site_mw.items() if C.SITES[s]["kind"] == "earth")
    if earth_mw > C.EARTH_GRID_CAP_MW + 1e-9:
        errors.append(f"Earth grid {earth_mw:.0f} MW > {C.EARTH_GRID_CAP_MW} MW cap (DECK s9)")
    for s, mw in site_mw.items():
        cap = C.SITES[s].get("cap_mw")
        if cap is not None and mw > cap + 1e-9:
            errors.append(f"{s}: {mw:.0f} MW > site grid cap {cap} MW")
    if total_usd > C.BUDGET_USD:
        errors.append(f"cost ${total_usd / 1e9:.2f}B > ${C.BUDGET_USD / 1e9:.0f}B budget (DECK s9)")
    if not cases:
        errors.append("design serves no case")

    target = sum(C.CASES[c]["users"] for c in cases)

    # ---- failure test (DECK s21): lose any one site or orbital plane. "live" means
    # chat and interactive agents stay at 100% (background agents wait it out
    # inside their 4 h deadline); "all" means every stream stays at 100%.
    outage = {}
    for s in sorted({p["site"] for p in pools}):
        frac, _, _ = served(lambda p, s=s: p["site"] != s)
        outage[s] = frac
    if serving["resilience"] in ("live", "all"):
        protect = C.LIVE_STREAMS if serving["resilience"] == "live" else tuple(C.STREAMS)
        for s, frac in outage.items():
            short = [x for x in protect if raw_out[x] > 0 and frac[x] < 0.999]
            if short:
                errors.append(f"losing {s} drops {', '.join(short)} below 100% "
                              f"(resilience={serving['resilience']})")
    elif serving["resilience"] is not None:
        errors.append("resilience must be null, 'live' or 'all'")

    # ---- robustness: users served if the single most important site goes dark
    worst_site, worst_users = None, users
    for s in {p["site"] for p in pools}:
        _, _, u = served(lambda p, s=s: p["site"] != s)
        if u < worst_users:
            worst_site, worst_users = s, u

    valid = not errors

    # ---- joules per request (facility energy; orbit counts its solar-fed IT energy)
    seconds = C.HOURS * 3600
    j_per_req = {s: energy_by_stream[s] * 3.6e6 / (reqs[s] * stream_frac[s] * seconds)
                 for s in C.STREAMS if reqs[s] > 0 and stream_frac[s] > 0}

    return dict(
        name=design.get("name", "design"), cases=cases, serving=serving, valid=valid, errors=errors,
        users_target=target, users_served=users if valid else 0.0,
        served_fraction=(users / target if target else 0.0) if valid else 0.0,
        twin_users_served=users, case_fraction=case_frac, stream_fraction=stream_frac,
        cost_usd=total_usd, cost_breakdown=totals, budget_usd=C.BUDGET_USD,
        earth_grid_mw=earth_mw, site_facility_mw=site_mw, site_it_mw=site_it_mw,
        space_mass_t=launch_kg / 1000, co2_t=co2_t, water_m3=water_l / 1000,
        joules_per_request=j_per_req,
        resilience=dict(worst_site=worst_site,
                        served_fraction=worst_users / target if target else 0.0,
                        live_served_by_outage={s: min(f[x] for x in C.LIVE_STREAMS if d_out[x] > 0)
                                               for s, f in outage.items()} if any(d_out[x] > 0 for x in C.LIVE_STREAMS) else {}),
        demand_out_tps=d_out, demand_in_tps=d_in, pools=pools,
    )


def hill_metrics(result):
    """Leaderboard metrics in AutoLab hill form, ranked in this order."""
    return [dict(name="served_fraction", value=result["served_fraction"], direction="max"),
            dict(name="cost_busd", value=result["cost_usd"] / 1e9, direction="min")]


# ---------------------------------------------------------------- reports

def _b(x):
    return f"${x / 1e9:,.2f}B"


def print_report(r):
    sat = r.get("satellite")
    print(f"\n=== {r['name']}  |  cases {'+'.join(r['cases']) or '-'}  |  "
          f"{'VALID' if r['valid'] else 'INVALID'}"
          + (f"  |  what-if satellite {sat['kg_per_mw'] / 1000:.1f} t/MW" if sat else ""))
    for e in r["errors"]:
        print(f"  ! {e}")
    print(f"\nUsers served   {r['twin_users_served'] / 1e6:,.0f}M of {r['users_target'] / 1e6:,.0f}M "
          f"({r['twin_users_served'] / max(r['users_target'], 1):.1%})"
          + ("" if r["valid"] else "  -> scores 0 until the errors above are fixed"))
    print(f"5-year cost    {_b(r['cost_usd'])} of {_b(r['budget_usd'])}")
    print("  " + "  ".join(f"{k} {_b(v)}" for k, v in r["cost_breakdown"].items() if v > 0))
    print(f"Earth grid     {r['earth_grid_mw']:,.0f} / {C.EARTH_GRID_CAP_MW} MW   "
          f"space mass {r['space_mass_t']:,.0f} t   CO2 {r['co2_t'] / 1e6:,.2f} Mt   water {r['water_m3'] / 1e6:,.1f} Mm3")
    print("Sites (facility MW):  " + "  ".join(f"{s} {mw:,.0f}" for s, mw in sorted(r["site_facility_mw"].items())))
    res = r["resilience"]
    if res["worst_site"]:
        print(f"Lose {res['worst_site']}: {res['served_fraction']:.0%} of users still served")
    print("\nStream          served   peak out tok/s   J/request")
    for s in C.STREAMS:
        if r["demand_out_tps"][s] > 0:
            j = r["joules_per_request"].get(s)
            print(f"  {s:<14} {r['stream_fraction'][s]:>6.1%}   {r['demand_out_tps'][s]:>14.3e}   "
                  + (f"{j:,.0f}" if j else "-"))
    print("\nPool                       stream         phase   site        chip x n   racks    IT MW"
          "  sess/rep  tok/s/chip   TTFT     SLO")
    for p in r["pools"]:
        rep = p["rep"]
        per_chip = rep["tps"] / p["chips_per_replica"]
        ttft = f"{p['ttft_s']:.3f}s" if p.get("ttft_s") is not None else "-"
        sess = rep.get("sessions", "-")
        print(f"  {p['name']:<25} {p['stream']:<14} {p['phase']:<7} {p['site']:<11} "
              f"{p['chip']} x {p['chips_per_replica']:<3} {p['racks']:>6,} {p.get('it_mw', 0):>8.1f}"
              f"  {sess!s:>8}  {per_chip:>10,.0f}   {ttft:>7}  {'ok' if p['slo_ok'] else 'FAIL ' + p.get('slo_why', '')}")
    print()


def best_replica(stream, chip, phase, serving):
    """Chips-per-replica giving the most tokens/s per chip."""
    best = None
    for n in (1, 2, 3, 4, 6, 8, 12, 16, 24, 32, 48, 64, 96, 128):
        rep = decode_replica(stream, chip, n, serving) if phase == "decode" else prefill_replica(stream, chip, n)
        if rep["tps"] > 0 and (best is None or rep["tps"] / n > best["tps"] / best["n"]):
            best = rep
    return best


def print_napkin(serving):
    print(f"\nNapkin: best tokens/s per chip, serving = {serving}")
    print(f"{'stream':<14} {'phase':<7} {'chip':<4} {'n':>3} {'sess':>6} {'bound':>9} "
          f"{'tok/s/chip':>11} {'$/(tok/s)':>10} {'W/(tok/s)':>10}")
    for s in C.STREAMS:
        for phase in ("prefill", "decode"):
            for chip, ch in C.CHIPS.items():
                if phase not in ch["phases"]:
                    continue
                rep = best_replica(s, chip, phase, serving)
                if not rep:
                    print(f"{s:<14} {phase:<7} {chip:<4}   - does not fit")
                    continue
                per_chip = rep["tps"] / rep["n"]
                usd = ch["rack_usd"] / ch["rack_chips"] / per_chip
                watts = ch["rack_kw"] * 1000 / ch["rack_chips"] / per_chip
                print(f"{s:<14} {phase:<7} {chip:<4} {rep['n']:>3} {rep.get('sessions', '-')!s:>6} "
                      f"{rep.get('bound', 'compute'):>9} {per_chip:>11,.0f} {usd:>10.2f} {watts:>10.3f}")
    print("\nAll-GPU sizing to serve 100% of each case at peak (no headroom):")
    gpu = C.CHIPS["gpu"]
    for case in C.CASES:
        d_out, d_in, _ = demand([case], serving)
        chips = 0.0
        for s in C.STREAMS:
            if d_out[s] > 0:
                rep = best_replica(s, "gpu", "decode", serving)
                chips += d_out[s] / (rep["tps"] / rep["n"])
                chips += d_in[s] / prefill_replica(s, "gpu", 1)["tps"]
        racks = chips / gpu["rack_chips"]
        mw = racks * gpu["rack_kw"] / 1000
        print(f"  case {case} ({C.CASES[case]['label']}): {chips:,.0f} GPUs = {racks:,.0f} racks = "
              f"{mw:,.0f} MW IT = {_b(racks * gpu['rack_usd'])} of racks")
    print()


def breakeven_table():
    """Launch $/kg at which one MW in LEO costs the same as one MW at each Earth site
    (5 years at full load, direct liquid cooling, same racks)."""
    rows = []
    for chip in ("gpu", "lpu"):
        ch = C.CHIPS[chip]
        rack_usd_per_mw = ch["rack_usd"] / (ch["rack_kw"] / 1000)
        spares = rack_usd_per_mw * (1 / C.SPACE_CHIP_SURVIVAL - 1)
        for site, st in C.SITES.items():
            if st["kind"] != "earth":
                continue
            pue = site_pue("direct_liquid", site)
            mwh = pue * C.HOURS
            earth = (C.FACILITY_USD_PER_MW + C.COOLING["direct_liquid"]["capex_per_mw"]
                     + mwh * (st["usd_per_mwh"] + st["g_co2_kwh"] / 1000 * C.CARBON_USD_PER_T))
            rows.append(dict(chip=chip, site=site, earth_usd_per_mw=earth,
                             breakeven_usd_per_kg=(earth - C.SPACE_HW_USD_PER_MW - spares) / C.SPACE_KG_PER_MW))
    return rows


def radiator_w_per_m2(temp_k=None):
    r = C.RADIATOR
    t = temp_k or r["temp_k"]
    return r["emissivity"] * C.STEFAN_BOLTZMANN * (t ** 4 - r["sink_k"] ** 4) * r["sides"]


def print_breakeven():
    q = radiator_w_per_m2()
    print(f"\nRadiator {q:,.0f} W/m^2 at {C.RADIATOR['temp_k']} K -> {1e6 / q:,.0f} m^2 per MW. "
          f"LEO launch ${C.SITES['leo']['launch_usd_per_kg']}/kg x {C.SPACE_KG_PER_MW / 1000:.0f} t/MW "
          f"= ${C.SITES['leo']['launch_usd_per_kg'] * C.SPACE_KG_PER_MW / 1e6:.1f}M per MW")
    print("Break-even launch price (orbit = site), direct liquid cooling, full load:")
    for row in breakeven_table():
        print(f"  {row['chip']}  {row['site']:<11} earth ${row['earth_usd_per_mw'] / 1e6:5.2f}M/MW  "
              f"-> orbit ties at ${row['breakeven_usd_per_kg']:,.0f}/kg")
    print()


# ---------------------------------------------------------------- CLI

def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("design", nargs="?", help="design JSON file")
    ap.add_argument("--json", action="store_true", help="print the full result as JSON")
    ap.add_argument("--napkin", action="store_true", help="capacity per chip and all-GPU case sizing")
    ap.add_argument("--breakeven", action="store_true", help="orbit vs Earth break-even launch prices")
    ap.add_argument("--serving", default="{}", help="serving options for --napkin, as JSON")
    a = ap.parse_args(argv)
    if a.napkin:
        print_napkin(dict(SERVING_DEFAULTS, **json.loads(a.serving)))
    if a.breakeven:
        print_breakeven()
    if a.design:
        r = evaluate(json.loads(Path(a.design).read_text()))
        if a.json:
            for p in r["pools"]:
                p.pop("rep", None)
            print(json.dumps(r, indent=2, default=str))
        else:
            print_report(r)
        return 0 if r["valid"] else 1
    if not (a.napkin or a.breakeven):
        ap.print_help()
    return 0


if __name__ == "__main__":
    sys.exit(main())
