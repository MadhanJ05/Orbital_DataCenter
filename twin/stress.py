#!/usr/bin/env python3
"""Stress test: make each number we assumed 25% worse and see if the plan survives.

    python3 twin/stress.py              # every assumption, then all of them at once
    python3 twin/stress.py --pct 30

For each scenario: (1) re-score the final design as built (same racks), and
(2) re-optimize from scratch under the worse numbers (8 planes, survive any
single loss). Only ASSUMED and CALIB constants are stressed; DECK numbers are
the organizers' and fixed for every team.
"""
import argparse
import copy
import json
from contextlib import contextmanager
from pathlib import Path

import catalog as C
import score as S
import optimize as O

ROOT = Path(__file__).resolve().parent.parent
SNAPSHOT = ("SITES", "CHIPS", "COOLING", "FLOPS_EFFICIENCY", "WEIGHT_READ_FACTOR", "ATTN_FLOPS_PER_KV_BYTE",
            "SPEC_ACCEPT", "SPEC_DRAFT_OVERHEAD_S", "SYNC_PER_DOUBLING_S", "CONTEXT_MEM_USD_PER_GB",
            "CONTEXT_MEM_W_PER_GB", "IDLE_POWER_FRACTION", "KV_LINK_BYTES_S", "FACILITY_USD_PER_MW",
            "SPACE_HW_USD_PER_MW", "SPACE_KG_PER_MW", "MEMORY_USABLE", "DEMAND_MARGIN", "ECLIPSE_BATTERY_DEFAULT")


@contextmanager
def patched(fn):
    saved = copy.deepcopy({k: getattr(C, k) for k in SNAPSHOT})   # keeps leo planes sharing one dict
    try:
        fn()
        yield
    finally:
        for k, v in saved.items():
            setattr(C, k, v)


def scale_sites(key, f, kind="earth"):
    def go():
        for s in C.SITES.values():
            if s["kind"] == kind and key in s:
                s[key] *= f
    return go


def scale_chips(key, f):
    def go():
        for ch in C.CHIPS.values():
            ch[key] *= f
    return go


def scale(name, f):
    return lambda: setattr(C, name, getattr(C, name) * f)


def scenarios(pct):
    up, down = 1 + pct / 100, 1 - pct / 100
    single = [
        ("Earth power prices", scale_sites("usd_per_mwh", up)),
        ("Earth grid carbon", scale_sites("g_co2_kwh", up)),
        ("Earth site grid caps", scale_sites("cap_mw", down)),
        ("Earth building cost", scale("FACILITY_USD_PER_MW", up)),
        ("Space solar+radiator hardware", scale("SPACE_HW_USD_PER_MW", up)),
        ("Chip compute (FLOPS)", scale_chips("flops", down)),
        ("Achievable FLOPS share", scale("FLOPS_EFFICIENCY", down)),
        ("Air-card memory bandwidth", lambda: C.CHIPS["air"].__setitem__("bw", C.CHIPS["air"]["bw"] * down)),
        ("Weight reads per step (calib)", scale("WEIGHT_READ_FACTOR", up)),
        ("Attention math", scale("ATTN_FLOPS_PER_KV_BYTE", up)),
        ("Draft-token acceptance", scale("SPEC_ACCEPT", down)),
        ("Cross-chip sync cost", scale("SYNC_PER_DOUBLING_S", up)),
        ("Context-memory price", scale("CONTEXT_MEM_USD_PER_GB", up)),
        ("Context-tier link bandwidth", scale_chips("ctx_link", down)),
        ("Idle power draw", scale("IDLE_POWER_FRACTION", up)),
        ("Earth-orbit link bandwidth", scale("KV_LINK_BYTES_S", down)),
    ]
    everything = lambda: [fn() for _, fn in single]
    return single + [(f"ALL of the above at once", everything)]


def light_satellite():
    """The what-if satellite (10.7 t/MW, space-stripped racks step of orbit_mass)."""
    import orbit_mass as M
    row = M.ladder()[5]
    C.SPACE_KG_PER_MW = row["total_t"] * 1000
    C.SPACE_HW_USD_PER_MW = C.SPACE_HW_USD_PER_MW * row["power_factor"]


def space_only():
    for s in C.SITES.values():
        if s["kind"] == "earth":
            s["cap_mw"] = 0


def run(pct, design_path, light=False, orbit_only=False):
    design = json.loads(design_path.read_text())
    design.pop("satellite", None)        # the scenario patches the catalog itself
    rows = []
    saved_kg = C.SPACE_KG_PER_MW
    for label, fn in [("Baseline (our numbers)", lambda: None)] + scenarios(pct):
        def apply(fn=fn):
            if light:
                light_satellite()
            if orbit_only:
                space_only()
            fn()
        with patched(apply):
            asbuilt = S.evaluate(design)
            _, _, best = O.optimize(["A", "B", "C"], verbose=False, planes=8, resilience="all")
            if asbuilt["valid"] and (not best["valid"] or asbuilt["cost_usd"] < best["cost_usd"]):
                best = asbuilt
            live = best
            if not best["valid"]:
                _, _, live = O.optimize(["A", "B", "C"], verbose=False, planes=8, resilience="live")
        C.SPACE_KG_PER_MW = saved_kg
        rows.append(dict(scenario=label,
                         asbuilt_valid=asbuilt["valid"], asbuilt_cost_busd=asbuilt["cost_usd"] / 1e9,
                         asbuilt_served=asbuilt["twin_users_served"] / asbuilt["users_target"],
                         asbuilt_errors=asbuilt["errors"][:2],
                         best_valid=best["valid"], best_cost_busd=best["cost_usd"] / 1e9,
                         best_errors=best["errors"][:2],
                         live_only_valid=live["valid"], live_only_cost_busd=live["cost_usd"] / 1e9))
        r = rows[-1]
        fallback = "" if r["best_valid"] else (
            f"   live-only protection: {'ok' if r['live_only_valid'] else 'NO'} ${r['live_only_cost_busd']:.2f}B")
        print(f"  {label:<32} as built: {'ok ' if r['asbuilt_valid'] else 'NO '} ${r['asbuilt_cost_busd']:6.2f}B   "
              f"best: {'ok ' if r['best_valid'] else 'NO '} ${r['best_cost_busd']:6.2f}B "
              f"(margin ${30 - r['best_cost_busd']:+.2f}B){fallback}", flush=True)
    return rows


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--pct", type=float, default=25)
    ap.add_argument("--design")
    ap.add_argument("--light", action="store_true", help="use the 10.7 t/MW what-if satellite")
    ap.add_argument("--orbit-only", action="store_true", help="no Earth sites (Design 2)")
    ap.add_argument("--battery", choices=("live", "all"), help="eclipse batteries the re-optimized designs fly")
    a = ap.parse_args()
    default = ("whatif_all_orbit_light.json" if a.orbit_only else "whatif_resilient_light.json") if a.light else "final_resilient.json"
    design = Path(a.design or ROOT / "designs" / default)
    print(f"\nStress test: each assumption {a.pct:.0f}% worse ({design.name}, budget $30B)")
    C.ECLIPSE_BATTERY_DEFAULT = a.battery or json.loads(design.read_text()).get("eclipse_battery")
    rows = run(a.pct, design, a.light, a.orbit_only)
    tag = f"stress_{int(a.pct)}" + ("_light" if a.light else "") + ("_orbit_only" if a.orbit_only else "")
    (ROOT / "designs" / f"{tag}.json").write_text(json.dumps(rows, indent=1) + "\n")
    print(f"\nwrote designs/{tag}.json")


if __name__ == "__main__":
    main()
