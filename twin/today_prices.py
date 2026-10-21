#!/usr/bin/env python3
"""Re-score Design 1 with today's published Earth prices instead of our 2035 estimates.

    python3 twin/today_prices.py                 # as built (same racks), one input group at a time, then all
    python3 twin/today_prices.py --reoptimize    # also let the search re-plan under all of them (a few minutes)

The values are the ones quoted on the deck's sources slide (present/sources.py, keys in brackets).
Design 2 uses none of these inputs, so it is unaffected.
"""
import argparse
import copy
import json
from pathlib import Path

import catalog as C
import score as S
import optimize as O

ROOT = Path(__file__).resolve().parent.parent
PRICE = dict(n_virginia=101, midwest=91, west_texas=35, nordics=40, iceland=43, gulf=32)    # $/MWh [eia, potomac, ssb, landsvirkjun, saudi]
CO2 = dict(n_virginia=269, midwest=415, west_texas=333, nordics=30, iceland=28, gulf=692)   # g/kWh [egrid, owid]
FACILITY = 10.7e6                                                                           # $/MW shell and core, 2025 [jll]
GROUPS = (("electricity", ("price",)), ("grid carbon", ("co2",)), ("building cost", ("build",)),
          ("all three", ("price", "co2", "build")))


def apply(which):
    for site in PRICE:
        if "price" in which:
            C.SITES[site]["usd_per_mwh"] = PRICE[site]
        if "co2" in which:
            C.SITES[site]["g_co2_kwh"] = CO2[site]
    if "build" in which:
        C.FACILITY_USD_PER_MW = FACILITY


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--reoptimize", action="store_true")
    a = ap.parse_args()
    design = json.loads((ROOT / "designs" / "final_resilient.json").read_text())
    base = S.evaluate(design)["cost_usd"]
    sites, facility = copy.deepcopy(C.SITES), C.FACILITY_USD_PER_MW
    print(f"Design 1 with our 2035 estimates: ${base / 1e9:.2f}B")
    for label, which in GROUPS:
        for k, v in sites.items():
            C.SITES[k].update(v)
        C.FACILITY_USD_PER_MW = facility
        apply(which)
        r = S.evaluate(design)
        print(f"  today's {label:<14} ${r['cost_usd'] / 1e9:.2f}B  ({(r['cost_usd'] - base) / 1e9:+.2f}B)  "
              f"{'fits $30B' if r['valid'] else 'over budget'}")
    if a.reoptimize:
        _, _, r = O.optimize(["A", "B", "C"], verbose=False, planes=12, resilience="all", start=O.from_design(design))
        print(f"  re-optimized under all three: ${r['cost_usd'] / 1e9:.2f}B, {'fits' if r['valid'] else 'over budget'}, "
              f"{r['earth_grid_mw']:.0f} MW of Earth grid")


if __name__ == "__main__":
    main()
