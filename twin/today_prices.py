#!/usr/bin/env python3
"""Re-score both designs with today's published figures instead of our 2035 estimates:
Earth prices for Design 1, and flown solar-array and radiator weights for Design 2's lighter satellite.

    python3 twin/today_prices.py                 # as built (same racks), one input group at a time, then all
    python3 twin/today_prices.py --reoptimize    # also let the search re-plan Design 1 under all of them (a few minutes)

The values are the ones quoted on the deck's sources slide (present/sources.py, keys in brackets).
Each design uses only one of the two groups, so the other is unaffected.
"""
import argparse
import copy
import json
from pathlib import Path

import catalog as C
import score as S
import optimize as O
import orbit_mass as M

ROOT = Path(__file__).resolve().parent.parent
PRICE = dict(n_virginia=101, midwest=91, west_texas=35, nordics=40, iceland=43, gulf=32)    # $/MWh [eia, potomac, ssb, landsvirkjun, saudi]
CO2 = dict(n_virginia=269, midwest=415, west_texas=333, nordics=30, iceland=28, gulf=692)   # g/kWh [egrid, owid]
FACILITY = 10.7e6                                                                           # $/MW shell and core, 2025 [jll]
GROUPS = (("electricity", ("price",)), ("grid carbon", ("co2",)), ("building cost", ("build",)),
          ("all three", ("price", "co2", "build")))
FLOWN = (("best flown arrays, 200 W/kg", dict(solar_w_per_kg=200)),               # ours 500 [nasasoa]
         ("flown radiators, 3.5 kg/m^2", dict(radiator_kg_per_m2=3.5)),           # ours 2 [redwire]
         ("both", dict(solar_w_per_kg=200, radiator_kg_per_m2=3.5)))


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
    for k, v in sites.items():
        C.SITES[k].update(v)
    C.FACILITY_USD_PER_MW = facility

    design = json.loads((ROOT / "designs" / "whatif_all_orbit_light.json").read_text())
    print(f"Design 2 with our {design['satellite']['kg_per_mw'] / 1000:.1f} t/MW satellite: ${S.evaluate(design)['cost_usd'] / 1e9:.2f}B")
    light = M.ladder()[5]["params"]              # the "space-stripped racks" step Design 2 flies
    for label, change in FLOWN:
        m = M.best_temperature(dict(light, **change))
        d = copy.deepcopy(design)
        d["satellite"].update(kg_per_mw=round(m["total_t"] * 1000), hw_factor=round(m["power_factor"], 4))
        r = S.evaluate(d)
        print(f"  today's {label:<28} {m['total_t']:5.1f} t/MW  ${r['cost_usd'] / 1e9:.2f}B  "
              f"{'fits $30B' if r['valid'] else 'over budget'}")


if __name__ == "__main__":
    main()
