#!/usr/bin/env python3
"""Coordinate search for the cheapest valid design that serves 100% of the chosen cases.

    python3 twin/optimize.py A B C            # -> designs/final_A+B+C.json

Levers searched, one at a time, until nothing improves: speculative-decoding depth,
context memory, Earth cooling, and for every stream and phase the chip type and
chips per replica. Site split is the greedy planner's (cheapest first, rest in LEO).
"""
import argparse
import json
from pathlib import Path

import catalog as C
import score as S
import build as B

N_CHOICES = (1, 2, 3, 4, 5, 6, 8, 10, 12, 14, 16, 20, 24, 28, 32, 40, 48, 56, 64, 80, 96, 112, 128)
CAP_CHOICES = (0.03, 0.035, 0.04, 0.045, 0.05, 0.055, 0.06, 0.065, 0.07, 0.075, 0.08, 0.09, 0.1, 0.12, 0.15, 0.2, 1.0)


def run(cases, serving, choices, cooling, planes=0, cap=1.0):
    design, r = B.freeze(B.plan(cases, serving, choices=dict(choices), cooling=cooling, planes=planes,
                                site_cap_share=cap))
    target = r["users_target"] or 1
    key = (round(r["twin_users_served"] / target, 6), r["valid"], -r["cost_usd"])
    return key, design, r


def from_design(design):
    """Recover the levers a design file was built with, so a search can start from it."""
    choices = {(p["stream"], p["phase"]): (p["chip"], p["chips_per_replica"]) for p in design["pools"]}
    earth = [p["cooling"] for p in design["pools"] if C.SITES[p["site"]]["kind"] == "earth"]
    return dict(design["serving"]), choices, (earth[0] if earth else "direct_liquid"), design.get("plan", {}).get("site_cap_share", 1.0)


def optimize(cases, verbose=True, planes=0, resilience=None, start=None, restarts=0):
    """Coordinate search. start=(serving, choices, cooling, cap) seeds it (e.g. from_design());
    restarts adds fresh starts with different speculative depth and site caps; the best wins."""
    if start:
        serving, choices, cooling, cap = start
        serving = dict(S.SERVING_DEFAULTS, **dict(serving, resilience=resilience))
    else:
        serving = dict(S.SERVING_DEFAULTS, subagent_share=C.MAX_SUBAGENT_SHARE, spec_draft=3,
                       context_memory=True, resilience=resilience)
        choices = B.default_choices(cases, serving)
        cooling, cap = "direct_liquid", 1.0
    best = _climb(cases, verbose, planes, serving, choices, cooling, cap)
    for k in range(restarts):
        sv = dict(serving, spec_draft=(2, 4, 6, 3, 5)[k % 5])
        cp = (0.05, 0.08, 1.0, 0.06, 0.1)[k % 5] if planes else 1.0
        cand = _climb(cases, False, planes, sv, B.default_choices(cases, sv), cooling, cp)
        if cand[0] > best[0]:
            best = cand
    return best


def _climb(cases, verbose, planes, serving, choices, cooling, cap):
    best = run(cases, serving, choices, cooling, planes, cap)
    improved = True
    while improved:
        improved = False
        trials = [("spec_draft", d) for d in range(C.SPEC_MAX_DRAFT + 1)]
        trials += [("context_memory", v) for v in (True, False)]
        trials += [("bg_fill_valleys", v) for v in (True, False)]
        trials += [("sandbox_snapshot", v) for v in (True, False)]
        trials += [("cooling", c) for c in ("direct_liquid", "immersion")]
        if serving.get("resilience"):
            # the outage spare already covers bursts on a normal day; simulate.py must confirm
            trials += [("autosize_util", v) for v in (0.95, 0.97, 1.0)]
        if planes:
            trials += [("site_cap_share", v) for v in CAP_CHOICES]
        for key in list(choices):
            stream, phase = key
            for chip, ch in C.CHIPS.items():
                if phase in ch["phases"]:
                    trials += [(key, (chip, n)) for n in N_CHOICES]
        for lever, value in trials:
            sv, ch, co, cp = dict(serving), dict(choices), cooling, cap
            if lever == "cooling":
                co = value
            elif lever == "site_cap_share":
                cp = value
            elif isinstance(lever, tuple):
                ch[lever] = value
            else:
                sv[lever] = value
            try:
                cand = run(cases, sv, ch, co, planes, cp)
            except (ZeroDivisionError, TypeError):
                continue
            if cand[0] > best[0]:
                best, serving, choices, cooling, cap = cand, sv, ch, co, cp
                improved = True
                if verbose:
                    r = cand[2]
                    print(f"  {lever!s:<28} -> {value!s:<14} served {r['twin_users_served'] / 1e9:.2f}B  "
                          f"cost ${r['cost_usd'] / 1e9:.2f}B  valid {r['valid']}")
    key, design, r = best
    design["plan"] = dict(site_cap_share=cap, planes=planes)   # so a later search can start from it
    return key, design, r


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("cases", nargs="+", choices=sorted(C.CASES))
    ap.add_argument("--planes", type=int, default=0, help="split orbit into N independent planes")
    ap.add_argument("--resilience", choices=("live", "all"), help="survive losing any one site or plane")
    ap.add_argument("--name")
    ap.add_argument("--out")
    a = ap.parse_args()
    _, design, r = optimize(a.cases, planes=a.planes, resilience=a.resilience)
    design["name"] = a.name or "final_" + "+".join(a.cases)
    S.print_report(r)
    out = Path(a.out or Path(__file__).resolve().parent.parent / "designs" / f"{design['name']}.json")
    out.write_text(json.dumps(design, indent=2) + "\n")
    print(f"wrote {out}")


if __name__ == "__main__":
    main()
