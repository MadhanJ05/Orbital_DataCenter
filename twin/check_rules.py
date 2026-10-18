#!/usr/bin/env python3
"""Rule-by-rule check of a design against the organizers' deck, with margins.

    python3 twin/check_rules.py                     # Design 1 and Design 2
    python3 twin/check_rules.py designs/x.json

Each line names the deck slide the rule comes from, the limit, the design's
value and whether it passes. It recomputes from the pools the scorer returns
rather than trusting the scorer's own pass/fail, so it doubles as a cross-check.
"""
import json
import sys
from pathlib import Path

import catalog as C
import score as S

ROOT = Path(__file__).resolve().parent.parent


def check(path):
    design = json.loads(Path(path).read_text())
    r = S.evaluate(design)
    sv = r["serving"]
    tau = S.spec_tokens_per_step(sv["spec_draft"])
    rows = []

    def add(slide, rule, limit, value, ok):
        rows.append((slide, rule, limit, value, ok))

    # ---- money and power (DECK s9, s14)
    add("s9", "5-year cost within budget", "$30.00B", f"${r['cost_usd'] / 1e9:.2f}B", r["cost_usd"] <= C.BUDGET_USD)
    add("s9", "Earth grid, all sites together", "500 MW", f"{r['earth_grid_mw']:.0f} MW", r["earth_grid_mw"] <= C.EARTH_GRID_CAP_MW)
    for site, mw in sorted(r["site_facility_mw"].items()):
        cap = C.SITES[site].get("cap_mw")
        if cap is not None:
            add("assumed", f"site grid cap: {site}", f"{cap} MW", f"{mw:.0f} MW", mw <= cap)
    want = (r.get("satellite") or {}).get("launch_usd_per_kg", 200)
    mass = r["space_mass_t"] * 1000
    charged = r["cost_breakdown"]["launch"] / mass if mass else 0      # price actually billed
    mass_no_comms = mass - r["comms"]["terminal_t"] * 1000
    add("s9" if want == 200 else "what-if", "launch price used for orbit", f"${want}/kg",
        f"${charged:.0f}/kg" if mass else "-", not mass or abs(charged - want) < 0.01)
    expect = (r.get("satellite") or {}).get("kg_per_mw", C.SPACE_KG_PER_MW)
    orbit_mw = sum(p["it_mw"] for p in r["pools"] if p["space"]) + sum(
        v["it_mw"] for s, v in r["sandbox"].get("by_site", {}).items() if C.SITES[s]["kind"] == "space")
    batt_kg = r["cost_breakdown"]["battery"] / C.ECLIPSE_BATTERY["usd_per_kwh"] * C.ECLIPSE_BATTERY["kg_per_kwh"]
    add("s14" if not r.get("satellite") else "what-if", "orbit mass = MW x t/MW + batteries + laser terminals",
        f"{expect / 1000:.1f} t/MW + {batt_kg / 1000:,.0f} t + {r['comms']['terminal_t']:,.0f} t", f"{mass / 1000:,.0f} t",
        not orbit_mw or abs(mass_no_comms - orbit_mw * expect - batt_kg) < 1)
    launch = r["cost_breakdown"]["launch"]
    add("s14", "launch bill = tonnes x $/kg", f"{mass / 1000:,.0f} t x ${want}", f"${launch / 1e9:.2f}B",
        abs(launch - mass * want) < 1e3)
    dead = all(abs(p["cap"] - p["replicas"] * p["rep"]["tps"] * C.SPACE_CHIP_SURVIVAL) < 1e-6 for p in r["pools"] if p["space"])
    add("s14", "space capacity counts only 95% of chips", "x 0.95", "applied" if dead else "missing", dead)
    add("s14", "carbon priced on Earth energy", "$100/t", f"${r['cost_breakdown']['carbon'] / 1e9:.2f}B for {r['co2_t'] / 1e6:.2f} Mt",
        abs(r["cost_breakdown"]["carbon"] - r["co2_t"] * 100) < 1e3)

    # ---- hardware rules (DECK s9, s12, s14)
    bad_phase = [p["name"] for p in r["pools"] if p["phase"] not in C.CHIPS[p["chip"]]["phases"]]
    add("s9", "prefill on GPU/air card, decode on GPU/LPU", "allowed chips", "all pools ok" if not bad_phase else ", ".join(bad_phase), not bad_phase)
    bad_cool = [p["name"] for p in r["pools"] if C.CHIPS[p["chip"]]["rack_kw"] > C.COOLING[p["cooling"]]["max_rack_kw"]
                or p["space"] != (p["cooling"] == "radiators")]
    add("s14", "racks over 50 kW use liquid or immersion; space uses radiators", "cooling fits rack", "all pools ok" if not bad_cool else ", ".join(bad_cool), not bad_cool)
    over_mem = [p["name"] for p in r["pools"] if p["rep"]["mem_used"] > p["rep"]["mem"] + 1]
    worst_mem = max(p["rep"]["mem_used"] / p["rep"]["mem"] for p in r["pools"])
    add("s13", "weights + caches fit in chip memory", "<= 100%", f"fullest replica {worst_mem:.0%}", not over_mem)

    # ---- serving rules (DECK s10)
    add("s10", "easy chat routed to gpt-oss-120b", "<= 50%", f"{sv['easy_chat_share']:.0%}", sv["easy_chat_share"] <= 0.5)
    add("s10", "agent steps done by sub-agents", "<= 50%", f"{sv['subagent_share']:.0%}", sv["subagent_share"] <= 0.5)

    # ---- speed (DECK s10, s12) per stream, worst pool
    for s, st in C.STREAMS.items():
        dec = [p for p in r["pools"] if p["stream"] == s and p["phase"] == "decode" and p["cap"] > 0]
        if not dec:
            continue
        ttft = max(p["ttft_s"] for p in dec)
        add("s10", f"{s}: time to first token", f"{st['ttft']} s", f"{ttft:.2f} s", ttft <= st["ttft"])
        speed = min(tau / p["step_s"] for p in dec)
        add("s10", f"{s}: tokens/s per user", f">= {st['rate']}", f"{speed:,.0f}", speed >= st["rate"] - 1e-9)
        if st["task_deadline"]:
            task = max(p["task_s"] for p in dec)
            add("s10", f"{s}: whole task", f"{st['task_deadline'] / 60:.0f} min", f"{task / 60:.0f} min", task <= st["task_deadline"])
        far = [p["site"] for p in dec if st["rtt_per_step"] and C.SITES[p["site"]]["rtt"] >= 1]
        if far:
            add("s12", f"{s}: no Moon/Mars for live work", "none", ", ".join(far), False)

    # ---- service and robustness (DECK s9, s21)
    add("s9", "users served", "100%", f"{r['twin_users_served'] / r['users_target']:.1%} of {r['users_target'] / 1e9:.2f}B",
        r["twin_users_served"] >= r["users_target"] * 0.999)
    worst = min(r["resilience"]["live_served_by_outage"].values()) if r["resilience"]["live_served_by_outage"] else 1
    add("s21", "failure test: lose any one site or plane", "100% live", f"{worst:.0%} live, {r['resilience']['served_fraction']:.0%} all", worst >= 0.999)
    d_out, _, _ = S.demand(r["cases"], sv)
    heads = []
    for s in C.LIVE_STREAMS:
        if d_out[s] > 0:
            cap = sum(p["cap"] for p in r["pools"] if p["stream"] == s and p["phase"] == "decode" and p["slo_ok"])
            heads.append(cap / d_out[s] - 1)
    add("s21", "demand bursts: spare above the peak hour (live)", "> 0%", f"min {min(heads):.0%}", min(heads) > 0)

    # ---- eclipses: worst eclipse day per plane group, alone and with every single outage
    import simulate as M
    _, _, sim_rows = M.run(path, outages=True, eclipse=True)
    ecl = [x for x in sim_rows if x.get("eclipse")]
    if ecl:
        ok_ecl = sum(x["ok"] for x in ecl)
        add("eclipse", f"worst eclipse day, alone and with any one outage ({design.get('eclipse_battery') or 'no'} batteries)",
            f"{len(ecl)} days OK", f"{ok_ecl} OK", ok_ecl == len(ecl))

    # ---- network (DECK s21): user text between Earth and each orbital plane at the busiest hour.
    # Cached context stays with the model; background agents run tools next to it, so only
    # interactive work sends its new input up.
    by_plane = {}
    for s, st in C.STREAMS.items():
        dec = [p for p in r["pools"] if p["stream"] == s and p["phase"] == "decode" and p["cap"] > 0]
        total = sum(p["cap"] for p in dec)
        steps = r["demand_out_tps"][s] / st["out"]
        per_step = ((st["ctx"] - st["cached"]) if st["rtt_per_step"] else 0) + st["out"]
        for p in dec:
            if p["space"]:
                by_plane[p["site"]] = by_plane.get(p["site"], 0) + steps * p["cap"] / total * per_step * C.TEXT_BYTES_PER_TOKEN * 8
    if by_plane:
        cm = C.COMMS
        cap = {s: r["comms"]["satellites"].get(s, 0) * cm["ground_link_gbps"] * 1e9 * cm["link_availability"] for s in by_plane}
        worst = max(by_plane, key=lambda s: by_plane[s] / cap[s] if cap[s] else 1e9)
        add("s21", "network: busiest plane's Earth links (satellites x 100 Gbps x 95%)", f"{cap[worst] / 1e12:.2f} Tbps",
            f"{by_plane[worst] / 1e12:.2f} Tbps", by_plane[worst] <= cap[worst])

    # ---- energy per task (DECK s21 asks for joules per task)
    j = r["joules_per_request"]
    _, _, reqs = S.demand(r["cases"], sv)
    total_kwh = sum(p["it_mw"] * p["load"] * p["pue"] * C.HOURS * 1000 for p in r["pools"]) + sum(
        v["mwh"] * 1000 for v in r["sandbox"].get("by_site", {}).values())
    booked = sum(j[x] * reqs[x] * C.HOURS * 3600 for x in j) / 3.6e6
    add("s21", "energy split across workloads adds up to the total", "100%", f"{booked / total_kwh:.2%}", abs(booked / total_kwh - 1) < 1e-6)
    steps = C.STREAMS["agent_int"]["steps"]
    task = lambda a, b: (j.get(a, 0) * (1 - sv["subagent_share"]) + j.get(b, 0) * sv["subagent_share"]) * steps
    add("s21", "energy per chat prompt / per agent task", "report",
        f"{j['chat'] / 3600:.3f} Wh / {task('agent_int', 'agent_int_sub') / 3600:.1f} Wh", True)

    name = design.get("name", Path(path).stem)
    print(f"\n=== {name}" + (f"  (what-if satellite {r['satellite']['kg_per_mw'] / 1000:.1f} t/MW)" if r.get("satellite") else ""))
    print(f"  {'deck':<8} {'rule':<58} {'limit':<18} {'design':<26} result")
    for slide, rule, limit, value, ok in rows:
        print(f"  {slide:<8} {rule:<58} {limit:<18} {value:<26} {'PASS' if ok else 'FAIL'}")
    fails = [x for x in rows if not x[4]]
    print(f"  -> {len(rows) - len(fails)} of {len(rows)} pass" + (f", scorer says {'VALID' if r['valid'] else 'INVALID'}"))
    check.rows = rows                     # for twin/prove.py
    return not fails and r["valid"]


if __name__ == "__main__":
    paths = sys.argv[1:] or [ROOT / "designs" / "final_resilient.json", ROOT / "designs" / "whatif_all_orbit_light.json"]
    ok = all([check(p) for p in paths])
    sys.exit(0 if ok else 1)
