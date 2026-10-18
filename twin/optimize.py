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

N_CHOICES = (1, 2, 3, 4, 6, 8, 12, 16, 24, 32, 48, 64, 96, 128)


def run(cases, serving, choices, cooling):
    design, r = B.freeze(B.plan(cases, serving, choices=dict(choices), cooling=cooling))
    target = r["users_target"] or 1
    key = (round(r["twin_users_served"] / target, 6), r["valid"], -r["cost_usd"])
    return key, design, r


def optimize(cases, verbose=True):
    serving = dict(S.SERVING_DEFAULTS, subagent_share=C.MAX_SUBAGENT_SHARE, spec_draft=3, context_memory=True)
    choices = B.default_choices(cases, serving)
    cooling = "direct_liquid"
    best = run(cases, serving, choices, cooling)
    improved = True
    while improved:
        improved = False
        trials = [("spec_draft", d) for d in range(C.SPEC_MAX_DRAFT + 1)]
        trials += [("context_memory", v) for v in (True, False)]
        trials += [("bg_fill_valleys", v) for v in (True, False)]
        trials += [("cooling", c) for c in ("direct_liquid", "immersion")]
        for key in list(choices):
            stream, phase = key
            for chip, ch in C.CHIPS.items():
                if phase in ch["phases"]:
                    trials += [(key, (chip, n)) for n in N_CHOICES]
        for lever, value in trials:
            sv, ch, co = dict(serving), dict(choices), cooling
            if lever == "cooling":
                co = value
            elif isinstance(lever, tuple):
                ch[lever] = value
            else:
                sv[lever] = value
            try:
                cand = run(cases, sv, ch, co)
            except (ZeroDivisionError, TypeError):
                continue
            if cand[0] > best[0]:
                best, serving, choices, cooling = cand, sv, ch, co
                improved = True
                if verbose:
                    r = cand[2]
                    print(f"  {lever!s:<28} -> {value!s:<14} served {r['twin_users_served'] / 1e9:.2f}B  "
                          f"cost ${r['cost_usd'] / 1e9:.2f}B  valid {r['valid']}")
    return best


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("cases", nargs="+", choices=sorted(C.CASES))
    ap.add_argument("--out")
    a = ap.parse_args()
    _, design, r = optimize(a.cases)
    design["name"] = "final_" + "+".join(a.cases)
    S.print_report(r)
    out = Path(a.out or Path(__file__).resolve().parent.parent / "designs" / f"{design['name']}.json")
    out.write_text(json.dumps(design, indent=2) + "\n")
    print(f"wrote {out}")


if __name__ == "__main__":
    main()
