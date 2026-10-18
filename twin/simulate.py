#!/usr/bin/env python3
"""Minute-by-minute day of the fleet: does off-peak shift really work?

    python3 twin/simulate.py                       # final designs, normal day + every outage
    python3 twin/simulate.py designs/x.json        # any design

The scorer sizes for the peak hour and assumes background agents fit in the
interactive pools' off-peak spare capacity. This replaces that assumption with
a simulation: global demand curves built from three regions in their own time
zones, live work (chat, interactive agents) served first every minute,
background work queued first-in-first-out into whatever capacity is left, and
every background task checked against its 4 h deadline.
"""
import argparse
import json
import math
from collections import deque
from pathlib import Path

import catalog as C
import score as S

MINUTES = 1440
DAYS = 3                       # run to steady state, report the last day

# ASSUMED: where users are. UTC offset and share of users.
REGIONS = [("Americas", -5, 0.25), ("Europe+Africa", 1, 0.30), ("Asia+Oceania", 7.5, 0.45)]
LOCAL_PEAK_HOUR = 14           # ASSUMED: local activity peaks early afternoon


def local_activity(hour, sharpness):
    """Activity at a local hour: a floor at night, a smooth daytime hump."""
    return 0.05 + max(0.0, math.cos(2 * math.pi * (hour - LOCAL_PEAK_HOUR) / 24)) ** sharpness


def global_profile(peak):
    """Demand per minute (UTC), mean 1, max = the deck's peak factor (DECK s16)."""
    if peak <= 1.0:
        return [1.0] * MINUTES
    for sharpness in (1, 2, 3, 4, 6, 8, 12, 16):
        g = [sum(w * local_activity(((m / 60) + off) % 24, sharpness) for _, off, w in REGIONS)
             for m in range(MINUTES)]
        mean = sum(g) / MINUTES
        g = [x / mean for x in g]
        if max(g) <= 1:
            continue
        k = (peak - 1) / (max(g) - 1)
        f = [1 + k * (x - 1) for x in g]
        if min(f) >= 0.02:
            return f
    raise ValueError(f"no smooth global curve reaches peak {peak}")


def capacities(result, lost_site=None, eclipse=None, battery=None):
    """Work capacity per stream in decode tokens/s: limited by decode pools and by
    prefill pools (prefill tokens per decode token is fixed per stream). eclipse="06:00"
    darkens the planes flying at that local time (their worst eclipse day)."""
    cap = {}
    for s in C.STREAMS:
        st = C.STREAMS[s]
        ratio = (st["ctx"] - st["cached"]) / st["out"]
        ok = [p for p in result["pools"] if p["stream"] == s and p["slo_ok"] and p["site"] != lost_site]
        on_battery = battery == "all" or (battery == "live" and s in C.LIVE_STREAMS)
        lit = lambda p: 1 - C.ECLIPSE_DARK_SHARE if eclipse and not on_battery and C.plane_ltan(p["site"]) == eclipse else 1.0
        d = sum(p["cap"] * lit(p) for p in ok if p["phase"] == "decode")
        pf = sum(p["cap"] * lit(p) for p in ok if p["phase"] == "prefill")
        cap[s] = min(d, pf / ratio)
    return cap


def simulate(design, lost_site=None, eclipse=None):
    r = S.evaluate(design)
    raw_out, _, _ = S.demand(r["cases"], r["serving"])
    cap = capacities(r, lost_site, eclipse, design.get("eclipse_battery", C.ECLIPSE_BATTERY_DEFAULT))
    curves = {s: global_profile(C.STREAMS[s]["peak"]) for s in C.STREAMS}
    avg = {s: raw_out[s] / C.STREAMS[s]["peak"] for s in C.STREAMS}

    report = dict(lost_site=lost_site, eclipse=eclipse, live_shortfall_pct=0.0, streams={}, hourly={})
    live = [s for s in C.STREAMS if s not in dict(S.VALLEY_PAIRS).values()]
    for s in live:                          # live work must fit every minute
        worst = max(avg[s] * curves[s][m] - cap[s] for m in range(MINUTES))
        if avg[s] > 0 and worst > 0:
            report["live_shortfall_pct"] = max(report["live_shortfall_pct"],
                                               100 * worst / max(avg[s] * curves[s][m] for m in range(MINUTES)))

    for it, bg in S.VALLEY_PAIRS:
        if avg[bg] <= 0:
            continue
        st = C.STREAMS[bg]
        task_s = max((p.get("task_s") or 0) for p in r["pools"] if p["stream"] == bg) or 0
        allowance_min = (st["task_deadline"] - task_s) / 60     # time a task may wait in queue
        backlog, waits = deque(), []
        hourly = []
        for t in range(DAYS * MINUTES):
            m = t % MINUTES
            live_load = avg[it] * curves[it][m] if r["serving"]["bg_fill_valleys"] else 0.0
            spare = max(0.0, cap[it] - live_load) if r["serving"]["bg_fill_valleys"] else 0.0
            budget = (cap[bg] + spare) * 60                     # tokens this minute
            backlog.append([t, avg[bg] * curves[bg][m] * 60])
            used = 0.0
            while backlog and budget > 1e-9:
                take = min(budget, backlog[0][1])
                backlog[0][1] -= take
                budget -= take
                used += take
                if backlog[0][1] <= 1e-9:
                    arrived = backlog.popleft()[0]
                    if t >= (DAYS - 1) * MINUTES:
                        waits.append(t - arrived)
            if t >= (DAYS - 1) * MINUTES and m % 60 == 0:
                queued = sum(b[1] for b in backlog)
                hourly.append(dict(utc_hour=m // 60,
                                   live_tps=round(live_load), live_capacity_tps=round(cap[it]),
                                   bg_capacity_tps=round(cap[bg]), bg_served_tps=round(used / 60),
                                   bg_queue_minutes=round(queued / (avg[bg] * 60), 1)))
        unfinished = [(DAYS * MINUTES - b[0]) for b in backlog]
        max_wait = max(waits + unfinished) if (waits or unfinished) else 0
        report["streams"][bg] = dict(max_wait_min=max_wait, allowance_min=round(allowance_min),
                                     meets_deadline=max_wait <= allowance_min)
        report["hourly"][bg] = hourly
    report["ok"] = report["live_shortfall_pct"] == 0 and all(v["meets_deadline"] for v in report["streams"].values())
    return report, r


def run(path, outages=True, eclipse=False):
    design = json.loads(Path(path).read_text())
    base, r = simulate(design)
    rows = [base]
    sites = sorted({p["site"] for p in r["pools"]})
    if outages:
        for site in sites:
            rows.append(simulate(design, site)[0])
    if eclipse and any(C.plane_ltan(s) for s in sites):
        for ltan in ("06:00", "18:00"):
            rows.append(simulate(design, None, ltan)[0])
            if outages:
                for site in sites:
                    rows.append(simulate(design, site, ltan)[0])
    return design, r, rows


def print_rows(name, r, rows):
    print(f"\n=== {name}  (${r['cost_usd'] / 1e9:.2f}B, off-peak shift {'on' if r['serving']['bg_fill_valleys'] else 'off'})")
    print(f"  {'scenario':<32} {'live short':>10} {'bg wait (max)':>14} {'sub wait (max)':>15} {'allowed':>8}  result")
    for row in rows:
        bg = row["streams"].get("agent_bg", {})
        sub = row["streams"].get("agent_bg_sub", {})
        label = ("lose " + row["lost_site"]) if row["lost_site"] else "normal day"
        if row.get("eclipse"):
            label = f"{row['eclipse']} eclipse" + (f" + lose {row['lost_site']}" if row["lost_site"] else "")
        print(f"  {label:<32} "
              f"{row['live_shortfall_pct']:>9.1f}% {bg.get('max_wait_min', 0):>11} min {sub.get('max_wait_min', 0):>12} min "
              f"{bg.get('allowance_min', 0):>5} min  {'OK' if row['ok'] else 'MISSES'}")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("designs", nargs="*")
    ap.add_argument("--eclipse", action="store_true", help="also run each plane group's worst eclipse day")
    a = ap.parse_args()
    root = Path(__file__).resolve().parent.parent
    paths = a.designs or [root / "designs" / "final_resilient.json", root / "designs" / "final_A+B+C.json"]
    out = {}
    for path in paths:
        design, r, rows = run(path, eclipse=a.eclipse)
        print_rows(design.get("name", str(path)), r, rows)
        out[design.get("name", str(path))] = rows
    curves = {s: [round(x, 3) for x in global_profile(C.STREAMS[s]["peak"])[::60]] for s in ("chat", "agent_int", "agent_bg")}
    for s, f in curves.items():
        peak_hours = sum(1 for x in global_profile(C.STREAMS[s]["peak"]) if x > 0.9 * C.STREAMS[s]["peak"]) / 60
        print(f"  {s} demand curve: peak {max(f):.2f}x, within 10% of peak for {peak_hours:.1f} h/day")
    (root / "designs" / "sim_24h.json").write_text(json.dumps(dict(curves_hourly=curves, runs=out), indent=1) + "\n")
    print("\nwrote designs/sim_24h.json")


if __name__ == "__main__":
    main()
