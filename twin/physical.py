#!/usr/bin/env python3
"""Physical layer of the digital twin: power, heat, batteries, links and energy, per site and plane.

    python3 twin/physical.py                      # Design 1 and Design 2 -> designs/twin.json
    python3 twin/physical.py designs/x.json ...

Everything is derived from the scored design (score.py), the satellite model (orbit_mass.py)
and the minute-by-minute day (simulate.py). Nothing here changes a design or its cost; it
explains where each watt comes from and where it goes.
"""
import json
import sys
from pathlib import Path

import catalog as C
import orbit_mass as OM
import score as S
import simulate as M

ROOT = Path(__file__).resolve().parent.parent
SOLAR_CONSTANT = 1361            # W/m^2 above the atmosphere
CELL_EFFICIENCY = 0.30           # team_projection (app/ power module): 2035 space cells, end of life

FEATURED = {"final_resilient": "Design 1: the safest (Earth + orbit)",
            "whatif_all_orbit_light": "Design 2: our what-if (all orbit)"}


def satellite_physics(result):
    """Per-MW physics of this design's satellite: mass split, radiator temperature and area."""
    sat = result.get("satellite")
    if not sat:                                   # the organizers' 18 t/MW satellite
        m = OM.mass_per_mw({})
        kg_m2 = OM.BASE["radiator_kg_per_m2"]
    else:                                         # the what-if satellite: ladder step that matches its mass
        step = min(OM.ladder(), key=lambda r: abs(r["total_t"] * 1000 - sat["kg_per_mw"]))
        m = step
        kg_m2 = dict(OM.BASE, **step["params"])["radiator_kg_per_m2"]
    radiator_m2 = m["radiator_t"] * 1000 / kg_m2
    radiator_k = m["t_logic_k"] - OM.BASE["chain_dt_k"]
    return dict(mass_t=dict(compute=m["compute_t"], solar=m["solar_t"], radiators=m["radiator_t"],
                            structure=m["structure_t"], total=m["total_t"]),
                chip_c=m["t_logic_k"] - 273.15, radiator_c=radiator_k - 273.15,
                radiator_m2_per_mw=radiator_m2, power_factor=m["power_factor"], overhead=OM.OVERHEAD,
                array_m2_per_mw=1e6 * m["power_factor"] * OM.OVERHEAD / (SOLAR_CONSTANT * CELL_EFFICIENCY))


def hourly_utilization(design, result, lost_site=None, eclipse=None):
    """Share of each pool's capacity in use, per UTC hour, from the simulated day."""
    report, _ = M.simulate(design, lost_site, eclipse)
    raw_out, _, _ = S.demand(result["cases"], result["serving"])
    cap = M.capacities(result, lost_site, eclipse, design.get("eclipse_battery", C.ECLIPSE_BATTERY_DEFAULT))
    curves = {s: M.global_profile(C.STREAMS[s]["peak"]) for s in C.STREAMS}
    avg = {s: raw_out[s] / C.STREAMS[s]["peak"] for s in C.STREAMS}
    util = {}
    for h in range(24):
        u = {}
        for s in C.STREAMS:
            u[s] = min(1.0, avg[s] * curves[s][h * 60] / cap[s]) if cap.get(s) else 0.0
        for it, bg in S.VALLEY_PAIRS:                 # background work: own racks first, then the spare
            rows = report["hourly"].get(bg)
            if not rows or not cap.get(bg):
                continue
            served = rows[h]["bg_served_tps"]
            own = min(served, cap[bg])
            u[bg] = own / cap[bg]
            if cap.get(it):
                u[it] = min(1.0, u[it] + (served - own) / cap[it])
        bg_rows = report["hourly"].get("agent_bg")
        u["_sandbox"] = (bg_rows[h]["bg_served_tps"] / avg["agent_bg"] / C.SANDBOX_PEAK) if bg_rows and avg["agent_bg"] else 0.0
        util[h] = u
    return util, report


def site_power(design, result, util, lost_site=None, eclipse=None):
    """Electric power drawn per site per hour (MW at the meter: IT x load x PUE)."""
    batt = design.get("eclipse_battery", C.ECLIPSE_BATTERY_DEFAULT)
    out = {}
    for h in range(24):
        row = {}
        for p in result["pools"]:
            if p["site"] == lost_site:
                continue
            u = util[h].get(p["stream"], 0.0)
            on_batt = batt == "all" or (batt == "live" and p["stream"] in C.LIVE_STREAMS)
            lit = 1 - C.ECLIPSE_DARK_SHARE if eclipse and not on_batt and C.plane_ltan(p["site"]) == eclipse else 1.0
            mw = p["it_mw"] * lit * (C.IDLE_POWER_FRACTION + (1 - C.IDLE_POWER_FRACTION) * u) * p["pue"]
            row[p["site"]] = row.get(p["site"], 0.0) + mw
        for site, sb in result["sandbox"].get("by_site", {}).items():
            if site == lost_site:
                continue
            pue = 1.0 if C.SITES[site]["kind"] == "space" else S.site_pue("direct_liquid", site)
            u = min(1.0, util[h]["_sandbox"])
            row[site] = row.get(site, 0.0) + sb["it_mw"] * (C.IDLE_POWER_FRACTION + (1 - C.IDLE_POWER_FRACTION) * u) * pue
        out[h] = {k: round(v, 2) for k, v in row.items()}
    return out


def plane_traffic(result):
    """Busiest-hour Earth link traffic per orbital plane, Tbps (same rule as check_rules.py)."""
    by_plane = {}
    for s, st in C.STREAMS.items():
        dec = [p for p in result["pools"] if p["stream"] == s and p["phase"] == "decode" and p["cap"] > 0]
        total = sum(p["cap"] for p in dec)
        steps = result["demand_out_tps"][s] / st["out"]
        per_step = ((st["ctx"] - st["cached"]) if st["rtt_per_step"] else 0) + st["out"]
        for p in dec:
            if p["space"]:
                by_plane[p["site"]] = by_plane.get(p["site"], 0) + steps * p["cap"] / total * per_step * C.TEXT_BYTES_PER_TOKEN * 8 / 1e12
    return by_plane


def twin(path):
    design = json.loads(Path(path).read_text())
    r = S.evaluate(design)
    phys = satellite_physics(r)
    batt = design.get("eclipse_battery", C.ECLIPSE_BATTERY_DEFAULT)
    traffic = plane_traffic(r)

    sites = []
    for site in sorted(r["site_facility_mw"], key=lambda s: (C.SITES[s]["kind"], s)):
        st = C.SITES[site]
        pools = [p for p in r["pools"] if p["site"] == site]
        sb = r["sandbox"].get("by_site", {}).get(site, {})
        it = sum(p["it_mw"] for p in pools) + sb.get("it_mw", 0.0)
        racks = {}
        for p in pools:
            racks[p["chip"]] = racks.get(p["chip"], 0) + p["racks"]
        if sb.get("racks"):
            racks["sandbox"] = sb["racks"]
        row = dict(site=site, kind=st["kind"], rtt_ms=st["rtt"] * 1000, it_mw=round(it, 2),
                   facility_mw=round(r["site_facility_mw"][site], 2), racks=racks,
                   cost_busd=round((sum(p["cost_usd"] for p in pools) + sb.get("cost_usd", 0.0)) / 1e9, 3))
        if st["kind"] == "earth":
            row.update(power="grid", climate=st["climate"], pue=round(r["site_facility_mw"][site] / it, 3),
                       cooling=pools[0]["cooling"], usd_per_mwh=st["usd_per_mwh"], g_co2_kwh=st["g_co2_kwh"],
                       grid_cap_mw=st["cap_mw"])
        else:
            batt_mw = sum(p["it_mw"] for p in pools if batt == "all" or (batt == "live" and p["stream"] in C.LIVE_STREAMS))
            row.update(power="solar", ltan=C.plane_ltan(site),
                       eclipse_season="June" if C.plane_ltan(site) == "06:00" else "December",
                       array_km2=round(it * phys["array_m2_per_mw"] / 1e6, 3),
                       radiator_km2=round(it * phys["radiator_m2_per_mw"] / 1e6, 3),
                       radiator_c=round(phys["radiator_c"], 1), chip_c=round(phys["chip_c"], 1),
                       mass_t=round(it * phys["mass_t"]["total"] + batt_mw * 1000 * C.ECLIPSE_BATTERY["min"] / 60
                                    * C.ECLIPSE_BATTERY["kg_per_kwh"] / 1000, 0),
                       battery_mwh=round(batt_mw * C.ECLIPSE_BATTERY["min"] / 60, 2),
                       battery_mw=round(batt_mw, 2), link_tbps=round(traffic.get(site, 0.0), 3),
                       link_cap_tbps=C.PLANE_LINK_BPS / 1e12)
        sites.append(row)

    # hour by hour: a normal day, and the worst eclipse day for the 06:00 planes
    util, rep = hourly_utilization(design, r)
    normal = site_power(design, r, util)
    days = dict(normal=dict(label="Normal day", power_mw=normal,
                            bg_queue_min=[x["bg_queue_minutes"] for x in rep["hourly"].get("agent_bg", [])],
                            demand=dict((s, [round(x, 3) for x in M.global_profile(C.STREAMS[s]["peak"])[::60]])
                                        for s in ("chat", "agent_int", "agent_bg"))))
    if any(row["kind"] == "space" for row in sites):
        for key, ltan in (("eclipse", "06:00"), ("eclipse18", "18:00")):
            util_e, rep_e = hourly_utilization(design, r, eclipse=ltan)
            days[key] = dict(label=f"Worst eclipse day ({ltan} planes in Earth's shadow 22% of the time)",
                             power_mw=site_power(design, r, util_e, eclipse=ltan),
                             bg_queue_min=[x["bg_queue_minutes"] for x in rep_e["hourly"].get("agent_bg", [])])

    # outages: what each single loss does on a normal day and on the eclipse day
    _, _, rows = M.run(path, outages=True, eclipse=True)
    outages = [dict(lost=x["lost_site"], eclipse=x.get("eclipse"), ok=x["ok"],
                    live_short_pct=round(x["live_shortfall_pct"], 2),
                    bg_wait_min=x["streams"].get("agent_bg", {}).get("max_wait_min"),
                    allowed_min=x["streams"].get("agent_bg", {}).get("allowance_min")) for x in rows]

    # energy flow over 5 years, GWh: source -> overhead -> chips -> heat
    earth_it = sum(p["it_mw"] * p["load"] for p in r["pools"] if not p["space"]) * C.HOURS / 1000
    earth_meter = sum(p["it_mw"] * p["load"] * p["pue"] for p in r["pools"] if not p["space"]) * C.HOURS / 1000
    space_it = sum(p["it_mw"] * p["load"] for p in r["pools"] if p["space"]) * C.HOURS / 1000
    for site, sb in r["sandbox"].get("by_site", {}).items():
        if C.SITES[site]["kind"] == "space":
            space_it += sb["mwh"] / 1000
        else:
            earth_meter += sb["mwh"] / 1000
            earth_it += sb["mwh"] / 1000 / S.site_pue("direct_liquid", site)
    space_bus = space_it * phys["overhead"]
    energy = dict(earth_grid_gwh=round(earth_meter, 1), earth_it_gwh=round(earth_it, 1),
                  earth_cooling_and_losses_gwh=round(earth_meter - earth_it, 1),
                  orbit_sunlight_on_arrays_gwh=round(space_bus / CELL_EFFICIENCY, 1),
                  orbit_array_output_gwh=round(space_bus, 1), orbit_conversion_losses_gwh=round(space_bus - space_it, 1),
                  orbit_it_gwh=round(space_it, 1), heat_radiated_to_space_gwh=round(space_bus, 1))

    j = r["joules_per_request"]
    sv = r["serving"]
    steps = C.STREAMS["agent_int"]["steps"]
    task = lambda a, b: (j.get(a, 0) * (1 - sv["subagent_share"]) + j.get(b, 0) * sv["subagent_share"]) * steps
    name = design.get("name", Path(path).stem)
    return dict(
        name=name, label=FEATURED.get(name, name), valid=r["valid"], errors=r["errors"],
        cost_busd=round(r["cost_usd"] / 1e9, 3), cost_breakdown_busd={k: round(v / 1e9, 3) for k, v in r["cost_breakdown"].items() if v},
        users_served=r["twin_users_served"], users_target=r["users_target"],
        earth_grid_mw=round(r["earth_grid_mw"], 1), space_mass_t=round(r["space_mass_t"], 0),
        eclipse_battery=batt, satellite=phys, sites=sites, days=days, outages=outages, energy_5yr=energy,
        sandbox=dict(racks=r["sandbox"]["racks"], mw=round(r["sandbox"]["mw"], 1),
                     concurrent_tasks_m=round(r["sandbox"].get("concurrent_tasks", 0) / 1e6, 1)),
        energy_per=dict(chat_wh=round(j["chat"] / 3600, 4), agent_task_wh=round(task("agent_int", "agent_int_sub") / 3600, 2),
                        background_task_wh=round(task("agent_bg", "agent_bg_sub") / 3600, 2)),
        latency_s={s: round(max(p["ttft_s"] for p in r["pools"] if p["stream"] == s and p.get("ttft_s")), 3)
                   for s in ("chat", "agent_int", "agent_bg")},
        slo=dict(chat_ttft_s=C.STREAMS["chat"]["ttft"], agent_ttft_s=C.STREAMS["agent_int"]["ttft"],
                 bg_deadline_min=C.STREAMS["agent_bg"]["task_deadline"] / 60),
    )


def main():
    paths = sys.argv[1:] or [ROOT / "designs" / f"{n}.json" for n in FEATURED]
    out = dict(about="Physical layer of the fleet digital twin, from twin/physical.py. Every number is derived "
                     "from the scored designs; nothing on the twin page is computed in the browser.",
               designs=[twin(p) for p in paths])
    dest = ROOT / "designs" / "twin.json"
    dest.write_text(json.dumps(out, indent=1) + "\n")
    for d in out["designs"]:
        orbit = [s for s in d["sites"] if s["kind"] == "space"]
        print(f"{d['label']}: ${d['cost_busd']:.2f}B, {len(d['sites'])} sites, "
              f"arrays {sum(s['array_km2'] for s in orbit):.2f} km2, radiators {sum(s['radiator_km2'] for s in orbit):.2f} km2, "
              f"batteries {sum(s['battery_mwh'] for s in orbit):.0f} MWh, energy {d['energy_per']}")
        print(f"   5-yr energy GWh: {d['energy_5yr']}")
        print(f"   outages/eclipses OK: {sum(o['ok'] for o in d['outages'])} of {len(d['outages'])}")
    print(f"wrote {dest}")


if __name__ == "__main__":
    main()
