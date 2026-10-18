"""Export everything the dashboard shows into one JSON file, from the scorer's own numbers.

    python3 twin/export_ui.py                 # -> designs/ui.json
    python3 twin/export_ui.py --out some.json

The dashboard (dashboard.html) has no model logic of its own: it reads this file. Re-run after
re-building or re-optimizing designs, re-running the 24-hour simulation or the stress test.

What goes in:
- every design in designs/ (files with a "pools" list), scored with score.evaluate(): users served,
  cost breakdown, grid MW per site and plane, launch mass, resilience under each outage, joules per
  request by stream, and a compact pool table;
- designs/sim_24h.json (hourly demand curves and the night-shift runs), the stress ladders and the
  satellite ladder, passed through;
- the agents-in-orbit strand (agents-in-orbit/model.py): its case-B all-space design, scored with its
  own model, labelled as such so the dashboard never mixes the two models' numbers.
"""
import argparse
import importlib.util
import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
sys.path.insert(0, str(HERE))
import catalog as C   # noqa: E402
import score as S     # noqa: E402

FEATURED = {           # what the README calls them
    "final_resilient": dict(role="Design 1", label="Design 1: the safest (Earth + orbit)", stress="stress_25.json"),
    "whatif_all_orbit_light": dict(role="Design 2", label="Design 2: our what-if (all orbit)", stress="stress_25_light_orbit_only.json"),
}
POOL_KEYS = ("name", "stream", "phase", "site", "chip", "chips_per_replica", "cooling", "racks", "replicas",
             "space", "it_mw", "facility_mw", "pue", "load", "cost_usd", "ttft_s", "task_s", "slo_ok", "slo_why", "autosized")


def load_json(path):
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def score_design(path):
    design = load_json(path)
    r = S.evaluate(design)
    pools = []
    for p in r["pools"]:
        q = {k: p.get(k) for k in POOL_KEYS if k in p}
        q["cost_usd"] = p.get("cost_usd", sum(p.get("cost", {}).values()) if isinstance(p.get("cost"), dict) else None)
        pools.append(q)
    sites = {}
    for s, mw in r["site_facility_mw"].items():
        info = C.SITES.get(s, {})
        sites[s] = dict(facility_mw=mw, it_mw=r["site_it_mw"].get(s, 0.0), kind=info.get("kind"), rtt_s=info.get("rtt"),
                        cap_mw=info.get("cap_mw"), racks=sum(p["racks"] for p in pools if p["site"] == s))
    ttft = {}
    for p in pools:
        if p.get("phase") == "decode" and p.get("ttft_s") is not None:
            ttft[p["stream"]] = max(ttft.get(p["stream"], 0.0), p["ttft_s"])
    out = dict(
        file=path.name, name=r["name"], cases=r["cases"], serving=r["serving"], valid=r["valid"], errors=r["errors"],
        users_target=r["users_target"], users_served=r["users_served"], served_fraction=r["served_fraction"],
        case_fraction=r["case_fraction"], stream_fraction=r["stream_fraction"],
        cost_usd=r["cost_usd"], cost_breakdown=r["cost_breakdown"], budget_usd=r["budget_usd"],
        earth_grid_mw=r["earth_grid_mw"], earth_grid_cap_mw=C.EARTH_GRID_CAP_MW, sites=sites,
        space_mass_t=r["space_mass_t"], co2_t=r["co2_t"], water_m3=r["water_m3"],
        joules_per_request=r["joules_per_request"], ttft_s=ttft, resilience=r["resilience"],
        demand_out_tps=r["demand_out_tps"], demand_in_tps=r["demand_in_tps"], pools=pools,
        satellite=design.get("satellite"),
    )
    out.update(FEATURED.get(out["name"], {}))
    return out


def strand_agents_in_orbit():
    """Headline numbers of the agents-in-orbit case-B strand, from its own model (different satellite and
    cost model from the catalog; shown side by side, never added together)."""
    path = ROOT / "agents-in-orbit" / "model.py"
    if not path.exists():
        return None
    spec = importlib.util.spec_from_file_location("aio_model", path)
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    case = m.CASES["B agent devs"]
    sz = m.size(case, m.OPT)
    year = m.simulate_year(m.OPT, margin=m.size_background_by_sim(m.OPT, pooled=True), pooled=True, step_min=30)
    ri, rb = year["racks"]["agent_i"], year["racks"]["agent_b"]
    l_thr, parts_thr, mass_thr, d_thr = m.leo_rack_cost()
    l_bat, parts_bat, mass_bat, d_bat = m.leo_rack_cost(eclipse="battery")
    cost = ri * l_bat + rb * l_thr
    kj = {n: m.energy_per_task(n, m.OPT) for n in ("agent_i", "agent_b")}
    steps = m.WORKLOADS["agent_b"]["steps"]
    return dict(
        name="agents-in-orbit case B, all in space (own model)",
        model="agents-in-orbit/model.py", cases=["B"], users_target=case["users"], served_fraction=1.0,
        cost_usd=cost, budget_usd=30e9, earth_grid_mw=0.0, leo_it_mw=(ri + rb) * m.GPU["rack_kw"] / 1000,
        racks=dict(interactive_battery=ri, background=rb, total=ri + rb, nodes_of_8=-(-int(ri + rb) // 8)),
        space_mass_t=(ri * mass_bat + rb * mass_thr) / 1000, gwh_per_year=year["gwh"],
        pue=dict(leo=m.LEO["pue"], leo_battery=m.leo_pue(battery=True)[0], earth_reference=m.EARTH["pue"]),
        eclipse=dict(days=m.ECL["days"], max_min=m.ECL["max_min"], frac=m.ECL["frac"], battery_min=m.LEO["batt_full_min"]),
        levers=dict(spec=m.OPT.spec, subagent_share=m.OPT.multi_agent, context_memory=m.OPT.ctx_mem, background_tps=m.OPT.tps_b, snapshot=m.OPT.snapshot, pooled=True),
        kj_per_task={n: dict(busy=kj[n]["leo_kj"], fleet=year["kj"][n], gpu_s=kj[n]["gpu_s"]) for n in kj},
        joules_per_step={"agent_int": kj["agent_i"]["leo_kj"] * 1000 / steps, "agent_bg": kj["agent_b"]["leo_kj"] * 1000 / steps},
        rack=dict(background_usd=l_thr, background_t=mass_thr / 1000, interactive_usd=l_bat, interactive_t=mass_bat / 1000,
                  parts_usd=parts_thr, kg=d_thr["kg"]),
        notes="Satellite costed per 792 kW rack after two design-review passes (sandbox, shielding, propulsion, comms, power conditioning, loop, ACS, ops, NRE); "
              "PUE from components; eclipses from orbit geometry; fleet sized by a one-year simulation with background work pooled onto idle interactive racks.",
    )


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--out", default=str(ROOT / "designs" / "ui.json"))
    a = ap.parse_args(argv)
    designs = []
    for path in sorted((ROOT / "designs").glob("*.json")):
        if path.name == Path(a.out).name:
            continue
        try:
            j = load_json(path)
        except Exception as e:  # noqa: BLE001
            print(f"skip {path.name}: {e}")
            continue
        if isinstance(j, dict) and isinstance(j.get("pools"), list):
            designs.append(score_design(path))
            d = designs[-1]
            print(f"{d['name']:28s} {'valid' if d['valid'] else 'INVALID':7s} served {d['served_fraction'] * 100:5.1f}%  ${d['cost_usd'] / 1e9:5.2f}B  grid {d['earth_grid_mw']:4.0f} MW  orbit {d['space_mass_t']:7.0f} t")
    featured = [d for d in designs if d.get("role")]
    featured.sort(key=lambda d: d["role"])
    passthrough = {}
    for name in ("sim_24h.json", "stress_25.json", "stress_25_light.json", "stress_25_light_orbit_only.json", "whatif_ladder.json"):
        p = ROOT / "designs" / name
        if p.exists():
            passthrough[name.replace(".json", "")] = load_json(p)
    strand = strand_agents_in_orbit()
    ui = dict(
        generated_by="twin/export_ui.py", budget_usd=C.BUDGET_USD, earth_grid_cap_mw=C.EARTH_GRID_CAP_MW,
        slo=dict(chat_ttft_s=C.STREAMS["chat"].get("ttft_s"), agent_ttft_s=C.STREAMS["agent_int"].get("ttft_s"),
                 bg_deadline_h=C.STREAMS["agent_bg"].get("task_deadline", 0) / 3600),
        cases={k: dict(users=v["users"], label=v.get("label", k)) for k, v in C.CASES.items()},
        sites={k: dict(kind=v.get("kind"), rtt_s=v.get("rtt"), cap_mw=v.get("cap_mw"), usd_per_mwh=v.get("usd_per_mwh")) for k, v in C.SITES.items()},
        featured=[d["name"] for d in featured], designs=designs, strand=strand, **passthrough,
    )
    Path(a.out).write_text(json.dumps(ui, default=str), encoding="utf-8")
    print(f"wrote {a.out} ({Path(a.out).stat().st_size / 1e3:.0f} kB): {len(designs)} designs, featured {ui['featured']}, strand {'yes' if strand else 'no'}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
