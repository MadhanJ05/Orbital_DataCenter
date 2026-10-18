#!/usr/bin/env python3
"""The 18-tonne problem: what does one orbital megawatt weigh, and how light can it get?

    python3 twin/orbit_mass.py             # mass ladder + re-optimized fleet for each step
    python3 twin/orbit_mass.py --sweep     # radiator temperature vs mass (the leakage trade)

The deck's megawatt (DECK s14) is 18 t: compute 5, solar 5, radiators 4, structure 4.
Each part gets a physical lever:

- radiators: area per watt falls with T^4 (Stefan-Boltzmann), but the chips run
  hotter to get there and leak more power, which needs more solar and more radiator.
  Memory (HBM) cannot run as hot as logic, so one coolant loop is capped by the HBM;
  two loops let the logic run hot while the memory stays cool.
- solar: watts per kilogram of the array.
- compute: racks stripped for space (no chassis, fans, AC power supplies).
- structure: a fraction of everything else; less if radiators and arrays carry load.

All masses are per "useful" MW: the power the deck's chips draw at the deck's
temperature, so a hotter, leakier chip doing the same work counts as more than 1 MW.
"""
import argparse
import json
from pathlib import Path

import catalog as C

# ---- deck baseline, decomposed (DECK s14 masses; temperatures ASSUMED)
BASE = dict(
    loops=1,                 # coolant loops: 1 = logic and memory share a radiator
    t_logic_k=358,           # ASSUMED: 85 C logic junction behind a 330 K radiator
    t_logic_max_k=398,       # ASSUMED: 125 C, automotive-grade logic limit
    t_mem_max_k=368,         # ASSUMED: 95 C HBM limit (Track 2's example runs HBM at 96 C)
    chain_dt_k=28,           # ASSUMED: junction -> radiator drop (cold plate, pumped loop)
    mem_heat_share=0.2,      # ASSUMED: share of rack heat from memory
    leak_share=0.15,         # ASSUMED: leakage share of chip power at 358 K
    leak_doubling_k=25,      # ASSUMED: leakage doubles every 25 K
    solar_w_per_kg=200,      # DECK s14: 5 t per MW
    radiator_kg_per_m2=None, # derived so the deck's radiator is 4 t/MW at 330 K
    compute_t=5.0,           # DECK s14
    structure_share=4 / 14,  # DECK s14: 4 t on top of 14 t of everything else
)


def radiator_w_per_m2(t_k):
    r = C.RADIATOR
    return r["emissivity"] * C.STEFAN_BOLTZMANN * (t_k ** 4 - r["sink_k"] ** 4) * r["sides"]


# Power overhead in orbit (array regulation, harness, rack converters, pumps, avionics): the deck's
# 1,080 m^2 of radiator for 1 MW of GPUs at 972 W/m^2 is 1.05 MW of heat, the same 1.05 that
# agents-in-orbit/model.py derives from components. Solar and radiators carry it.
OVERHEAD = 1080 * radiator_w_per_m2(C.RADIATOR["temp_k"]) / 1e6          # DERIVED from DECK s14: 1.05
BASE["solar_w_per_kg"] = 200 * OVERHEAD                                  # deck: 5 t of array for 1.05 MW
BASE["radiator_kg_per_m2"] = 4000 / 1080                                 # deck: 4 t for 1,080 m^2


def mass_per_mw(p):
    """Tonnes and power factor for one useful MW under parameters p."""
    p = dict(BASE, **p)
    t_logic = min(p["t_logic_k"], p["t_logic_max_k"])
    if p["loops"] == 1:                       # the shared loop must keep HBM cool
        t_logic = min(t_logic, p["t_mem_max_k"])
    t0 = BASE["t_logic_k"]
    leak = lambda t: (1 - p["leak_share"]) + p["leak_share"] * 2 ** ((t - t0) / p["leak_doubling_k"])
    logic_share = 1 - p["mem_heat_share"]
    if p["loops"] == 1:
        power = leak(t_logic)
        heat_at = [(power * OVERHEAD, t_logic - p["chain_dt_k"])]
    else:                                     # memory on its own cool loop
        t_mem = min(t_logic, p["t_mem_max_k"] - 10)
        p_logic, p_mem = logic_share * leak(t_logic), p["mem_heat_share"] * leak(t_mem)
        power = p_logic + p_mem
        heat_at = [(p_logic * OVERHEAD, t_logic - p["chain_dt_k"]), (p_mem * OVERHEAD, t_mem - p["chain_dt_k"])]
    radiator_t = sum(mw * 1e6 / radiator_w_per_m2(t) * p["radiator_kg_per_m2"] for mw, t in heat_at) / 1000
    solar_t = power * OVERHEAD * 1e6 / p["solar_w_per_kg"] / 1000
    compute_t = p["compute_t"]
    structure_t = p["structure_share"] * (radiator_t + solar_t + compute_t)
    return dict(total_t=radiator_t + solar_t + compute_t + structure_t, power_factor=power,
                t_logic_k=t_logic, radiator_t=radiator_t, solar_t=solar_t,
                compute_t=compute_t, structure_t=structure_t)


def orbit_usd_per_mw(m, launch_usd_per_kg):
    """5-year cost of one useful orbital MW, chips excluded except the 5% spares."""
    gpu = C.CHIPS["gpu"]
    spares = gpu["rack_usd"] / (gpu["rack_kw"] / 1000) * (1 / C.SPACE_CHIP_SURVIVAL - 1)
    return m["total_t"] * 1000 * launch_usd_per_kg + C.SPACE_HW_USD_PER_MW * m["power_factor"] + spares


def best_temperature(p, launch_usd_per_kg=200):
    """Logic temperature with the cheapest orbital MW: hotter shrinks radiators,
    but leaks, and the extra power needs more array (mass and hardware money)."""
    best = None
    for t in range(318, p.get("t_logic_max_k", BASE["t_logic_max_k"]) + 1):
        m = mass_per_mw(dict(p, t_logic_k=t))
        if best is None or orbit_usd_per_mw(m, launch_usd_per_kg) < orbit_usd_per_mw(best, launch_usd_per_kg):
            best = m
    return best


# Each step keeps the previous ones. Values are 2035 estimates (ASSUMED).
# "tune" steps pick the lightest logic temperature instead of a fixed one.
LADDER = [
    ("Deck satellite (85 C chips, one loop)", {}, False),
    ("Best chip temperature (cooler: less leakage, less solar)", {}, True),
    ("Two loops: HBM on its own cool loop (no gain when chips run cool)", dict(loops=2), True),
    ("Thin-film solar, 500 W/kg", dict(solar_w_per_kg=500), True),
    ("Carbon-fiber radiators, 2 kg/m^2", dict(radiator_kg_per_m2=2.0), True),
    ("Space-stripped racks (-30% compute mass)", dict(compute_t=3.5), True),
    ("Load-bearing arrays and radiators (structure 15%)", dict(structure_share=0.15), True),
]
LAUNCH_STEPS = [("+ Starship at $100/kg", 100), ("+ Starship at $50/kg", 50)]


def ladder():
    p, rows = {}, []
    for label, step, tune in LADDER:
        p = dict(p, **step)
        m = best_temperature(p) if tune else mass_per_mw(p)
        rows.append(dict(label=label, params=dict(p, t_logic_k=m["t_logic_k"]), launch_usd_per_kg=200, **m))
    for label, price in LAUNCH_STEPS:
        m = best_temperature(p, price)
        rows.append(dict(label=label, params=dict(p, t_logic_k=m["t_logic_k"]), launch_usd_per_kg=price, **m))
    return rows


def breakeven_usd_per_kg(total_t, power_factor, site="nordics"):
    """Launch price at which an orbital MW costs the same as one at `site`."""
    import score as S
    earth = next(r["earth_usd_per_mw"] for r in S.breakeven_table() if r["chip"] == "gpu" and r["site"] == site)
    gpu = C.CHIPS["gpu"]
    spares = gpu["rack_usd"] / (gpu["rack_kw"] / 1000) * (1 / C.SPACE_CHIP_SURVIVAL - 1)
    return (earth - C.SPACE_HW_USD_PER_MW * power_factor - spares) / (total_t * 1000)


def refleet(total_t, power_factor, launch_usd_per_kg=200, cases=("A", "B", "C")):
    """Re-optimize the full fleet with a lighter orbital megawatt (and launch price)."""
    import optimize as O
    saved = C.SPACE_KG_PER_MW, C.SPACE_HW_USD_PER_MW, C.SITES["leo"]["launch_usd_per_kg"]
    try:
        C.SPACE_KG_PER_MW = total_t * 1000
        C.SPACE_HW_USD_PER_MW = saved[1] * power_factor   # more power -> more array and radiator
        C.SITES["leo"]["launch_usd_per_kg"] = launch_usd_per_kg
        _, design, r = O.optimize(list(cases), verbose=False)
    finally:
        C.SPACE_KG_PER_MW, C.SPACE_HW_USD_PER_MW, C.SITES["leo"]["launch_usd_per_kg"] = saved
    return design, r


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--sweep", action="store_true", help="logic temperature sweep, two loops")
    ap.add_argument("--no-fleet", action="store_true", help="skip re-optimizing the fleet")
    a = ap.parse_args()

    if a.sweep:
        print("\nLogic temp   power   radiators   solar   total t/MW   (two loops)")
        for t in range(348, 429, 10):
            m = mass_per_mw(dict(loops=2, t_logic_k=t, t_logic_max_k=500))
            print(f"  {t - 273:>4} C    {m['power_factor']:5.2f}   {m['radiator_t']:8.2f}   {m['solar_t']:5.2f}   {m['total_t']:8.2f}")
        return

    root = Path(__file__).resolve().parent.parent
    out = []
    import score as S
    nordics = next(r["earth_usd_per_mw"] for r in S.breakeven_table() if r["chip"] == "gpu" and r["site"] == "nordics")
    print(f"\nThe 18-tonne problem: one orbital MW, step by step (Nordics, cheapest Earth site: ${nordics / 1e6:.2f}M/MW)")
    print(f"{'step':<52} {'logic':>6} {'power':>6} {'rad':>5} {'solar':>6} {'comp':>5} {'struct':>6} "
          f"{'total':>6}  {'orbit $/MW':>10}  {'fleet cost':>10} {'orbit MW':>8} {'Earth MW':>8}")
    for row in ladder():
        be = breakeven_usd_per_kg(row["total_t"], row["power_factor"])
        usd_mw = orbit_usd_per_mw(row, row["launch_usd_per_kg"])
        line = (f"{row['label']:<52} {row['t_logic_k'] - 273:>4} C {row['power_factor']:>6.2f} {row['radiator_t']:>5.1f} "
                f"{row['solar_t']:>6.1f} {row['compute_t']:>5.1f} {row['structure_t']:>6.1f} {row['total_t']:>6.1f}  "
                f"{'$' + format(usd_mw / 1e6, '.2f') + 'M':>10}")
        rec = dict(row, breakeven_nordics_usd_per_kg=be, orbit_usd_per_mw=usd_mw)
        if not a.no_fleet:
            design, r = refleet(row["total_t"], row["power_factor"], row["launch_usd_per_kg"])
            orbit = sum(mw for s, mw in r["site_facility_mw"].items() if C.SITES[s]["kind"] == "space")
            line += f"  ${r['cost_usd'] / 1e9:>8.2f}B {orbit:>8.0f} {r['earth_grid_mw']:>8.0f}"
            rec.update(fleet_cost_usd=r["cost_usd"], served_fraction=r["served_fraction"], valid=r["valid"],
                       orbit_mw=orbit, earth_mw=r["earth_grid_mw"], space_mass_t=r["space_mass_t"])
            design["name"] = f"whatif_{len(out)}"
            design["satellite"] = dict(kg_per_mw=round(row["total_t"] * 1000), hw_factor=round(row["power_factor"], 4),
                                       launch_usd_per_kg=row["launch_usd_per_kg"], note=row["label"])
            (root / "designs" / f"whatif_{len(out)}.json").write_text(json.dumps(design, indent=2) + "\n")
        print(line)
        out.append(rec)
    (root / "designs" / "whatif_ladder.json").write_text(json.dumps(out, indent=2, default=str) + "\n")
    print(f"\nwrote designs/whatif_ladder.json and designs/whatif_0..{len(out) - 1}.json")


if __name__ == "__main__":
    main()
