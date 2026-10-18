#!/usr/bin/env python3
"""Greedy planner: writes a valid starting design for the optimizer to improve.

    python3 twin/build.py B                     # case B, best serving, cheapest sites, rest in LEO
    python3 twin/build.py A B C --earth-only    # hybrid of all three cases, no orbit
    python3 twin/build.py C --out designs/C.json

It picks the chip and chips-per-replica with the lowest cost per token/s for each
stream, fills Earth sites from cheapest per MW up to their grid caps (and the
500 MW total), sends the remainder to LEO, then tries every speculative-decoding
depth and keeps the cheapest valid design.
"""
import argparse
import json
import math
from pathlib import Path

import catalog as C
import score as S

USD_PER_W_5Y = 10.0   # rough 5-year cost of a watt (facility + energy), only for ranking chips


def chip_choice(stream, phase, serving):
    best = None
    for chip, ch in C.CHIPS.items():
        if phase not in ch["phases"]:
            continue
        rep = S.best_replica(stream, chip, phase, serving)
        if not rep:
            continue
        per_chip = rep["tps"] / rep["n"]
        usd = (ch["rack_usd"] + ch["rack_kw"] * 1000 * USD_PER_W_5Y) / ch["rack_chips"] / per_chip
        if best is None or usd < best[0]:
            best = (usd, chip, rep["n"], per_chip)
    return best


def site_order(include_space):
    """Sites from cheapest to dearest per MW of GPU racks over 5 years."""
    earth = {r["site"]: r["earth_usd_per_mw"] for r in S.breakeven_table() if r["chip"] == "gpu"}
    gpu = C.CHIPS["gpu"]
    spares = gpu["rack_usd"] / (gpu["rack_kw"] / 1000) * (1 / C.SPACE_CHIP_SURVIVAL - 1)
    costs = dict(earth)
    if include_space:
        costs["leo"] = C.SITES["leo"]["launch_usd_per_kg"] * C.SPACE_KG_PER_MW + C.SPACE_HW_USD_PER_MW + spares
    return sorted(costs, key=costs.get)


def _pools(choices, split, cooling="direct_liquid", protected_split=None, protect=()):
    pools = []
    for (s, phase), (chip, n) in choices.items():
        sp = protected_split if protected_split and s in protect else split
        pools += [dict(name=f"{s}-{phase}-{site}", stream=s, phase=phase, site=site,
                       chip=chip, chips_per_replica=n, share=share,
                       cooling="radiators" if C.SITES[site]["kind"] == "space" else cooling)
                  for site, share in sp.items() if share > 0]
    return pools


def spread_over_planes(split, planes, resilient, margin=1.01):
    """Replace the single LEO share with `planes` equal planes. If resilient, add
    spare so that losing any one site or plane still leaves 100%: with Earth
    shares e (sum E, largest m) and plane share p, we need E + n p - max(m, p) >= 1."""
    out = {s: v for s, v in split.items() if s != "leo"}
    orbit = split.get("leo", 0.0)
    if planes <= 0:
        return dict(split)
    if not resilient:
        p = orbit / planes
    else:
        E, m = sum(out.values()), max(out.values(), default=0.0)
        p = (1 - E) / (planes - 1) if planes > 1 else INF
        if p < m:
            p = (1 - E + m) / planes
        p *= margin
    if p > 0:
        out.update({f"leo_p{i}": p for i in range(1, planes + 1)})
    return out


INF = float("inf")


def default_choices(cases, serving):
    d_out, _, _ = S.demand(cases, serving)
    choices = {}
    for s in C.STREAMS:
        if d_out[s] > 0:
            for phase in ("decode", "prefill"):
                _, chip, n, _ = chip_choice(s, phase, serving)
                choices[(s, phase)] = (chip, n)
    return choices


def plan(cases, serving, include_space=True, margin=0.98, choices=None, cooling="direct_liquid", planes=0,
         site_cap_share=1.0):
    choices = choices or default_choices(cases, serving)
    name = "+".join(cases) + ("" if include_space else "-earth-only")
    res = serving.get("resilience")
    protect = C.LIVE_STREAMS if res == "live" else tuple(C.STREAMS) if res == "all" else ()

    def design(split, final=False):
        if not final:
            return dict(name=name, cases=list(cases), serving=serving, pools=_pools(choices, split, cooling))
        return dict(name=name, cases=list(cases), serving=serving,
                    pools=_pools(choices, spread_over_planes(split, planes, False), cooling,
                                 spread_over_planes(split, planes, True), protect))

    # true IT MW of the whole fleet, autosized at one site
    it_mw = sum(p["it_mw"] for p in S.evaluate(design({"nordics": 1.0}))["pools"])

    # one split for the whole fleet: cheapest sites first, Earth limited by grid caps
    order = site_order(include_space)
    if site_cap_share < 1.0 and include_space:   # spread over every Earth site before orbit
        order = [x for x in order if x != "leo"] + ["leo"]
    split, left, earth_left = {}, it_mw, C.EARTH_GRID_CAP_MW * margin
    for site in order:
        if left <= 0:
            break
        st = C.SITES[site]
        if st["kind"] == "space":
            take = left
        else:
            pue = S.site_pue(cooling, site)
            take = min(left, min(st["cap_mw"] * margin, earth_left) / pue, site_cap_share * it_mw)
            earth_left -= take * pue
        if take > 0:
            split[site] = take / it_mw
            left -= take

    # rack rounding can still push a site over its cap: shrink it and move the rest
    # to the next site in cost order that has room (orbit always has room)
    for _ in range(10):
        r = S.evaluate(design(split))
        mw = r["site_facility_mw"]
        over = {s: C.SITES[s]["cap_mw"] * margin / mw[s] for s in mw
                if C.SITES[s]["kind"] == "earth" and mw[s] > C.SITES[s]["cap_mw"] * margin}
        grid_full = r["earth_grid_mw"] > C.EARTH_GRID_CAP_MW * margin
        if grid_full:
            f = C.EARTH_GRID_CAP_MW * margin / r["earth_grid_mw"]
            over = {s: min(over.get(s, 1.0), f) for s in split if C.SITES[s]["kind"] == "earth"}
        if not over:
            break
        for s, f in over.items():
            moved = split[s] * (1 - f)
            split[s] *= f
            room = [t for t in order[order.index(s) + 1:] if C.SITES[t]["kind"] == "space"
                    or (not grid_full and mw.get(t, 0.0) < C.SITES[t]["cap_mw"] * margin * 0.9)]
            if room:
                split[room[0]] = split.get(room[0], 0.0) + moved
    if planes and include_space:
        split.setdefault("leo", 0.0)
    return design(split, final=bool(planes))


def freeze(design):
    """Turn autosized shares into fixed rack counts so the file stands on its own."""
    r = S.evaluate(design)
    out = dict(design, pools=[])
    for p in r["pools"]:
        out["pools"].append({k: p[k] for k in ("name", "stream", "phase", "site", "chip",
                                               "chips_per_replica", "cooling", "racks")})
    return out, r


def best_design(cases, include_space=True):
    best = None
    for ctx in (True, False):
        for draft in range(C.SPEC_MAX_DRAFT + 1):
            serving = dict(S.SERVING_DEFAULTS, subagent_share=C.MAX_SUBAGENT_SHARE,
                           spec_draft=draft, context_memory=ctx)
            design, r = freeze(plan(cases, serving, include_space))
            key = (r["served_fraction"], -r["cost_usd"])
            if best is None or key > best[0]:
                best = (key, design, r)
    return best[1], best[2]


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("cases", nargs="+", choices=sorted(C.CASES))
    ap.add_argument("--earth-only", action="store_true")
    ap.add_argument("--out", help="where to write the design JSON")
    a = ap.parse_args()
    design, r = best_design(a.cases, include_space=not a.earth_only)
    S.print_report(r)
    out = Path(a.out or Path(__file__).resolve().parent.parent / "designs" / f"{design['name']}.json")
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(design, indent=2) + "\n")
    print(f"wrote {out}")


if __name__ == "__main__":
    main()
