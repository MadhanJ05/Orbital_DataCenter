# Orbital Data Center: Project Brief for Research

*Status as of Oct 18, 2026 · Sundai Hack 145, Track 1 ("Build the AI data center of 2035")*

## Goal
Write a systems, engineering and business plan for an **orbital AI data center in 2035**. It's backed by a digital twin: you put in an AI model, a workload, hardware and an orbit, and it outputs performance, infrastructure lifetime and economics, compared against a data center on the ground.

## What exists so far
Repo: `github.com/MadhanJ05/Orbital_DataCenter`. Three tracks are merged on `main` (PRs #1, #2 and #3 are all merged). Evidence labels, competitor checks and deferred items are in `docs/ARCHITECTURE_NOTES.md`.

| Track | Owner | What it does | Where |
|---|---|---|---|
| **Fleet twin** (Python) | Madhan | Optimizes the 2035 inference fleet against the organizer rules ($30B over 5 years, 500 MW Earth grid cap, $200/kg launch, 0.6 s chat / 2 s agent targets). **Design 1** (Earth + orbit) $28.78B; **Design 2** (all-orbit) $28.79B. Includes a rule checker and hand checks | `twin/`, `designs/` |
| **Case B all-space model** (Python + HTML) | Andrey | Serviceable-module case B, all in space: **$16.7B**, derived PUE 1.0495, geometry-derived eclipses 4.6%/yr, one-year simulation. Includes explorer, 3D node and the scored-designs dashboard (`dashboard.html`, fed by `designs/ui.json` via `twin/export_ui.py`) | `agents-in-orbit/`, `dashboard.html` |
| **Single-satellite twin** (web app) | Alfred + Claude | Modular React/TypeScript satellite twin: walkthrough, scorecards, charts, sensitivity tornado | `app/` |
| **Shared constants** | all | Launch cost, radiator, mass splits | `shared/assumptions.json` |
| **Engineering spec** | Alfred + Claude | Spec for the baseline 81-satellite cluster (numbers to be refreshed at integration) | `app/ENGINEERING_SPEC.md` |

`dashboard.html` is the front door and links to the explorer, 3D node and app.

## How the web app's simulation is built
Pure TypeScript and fully in the browser; the whole scenario is encoded in the URL. One `simulate(inputs)` call chains the modules:

```
orbit + compute → power → thermal → mass & propulsion → comms → lifetime → economics
```

Each module is a folder `app/src/modules/<name>/` containing:
- `model.ts`: inputs, defaults, physics
- `model.test.ts`
- `fields.ts`: UI controls
- `stage.ts`: walkthrough caption
- `Overlay.tsx`: animation

`app/test/golden.json` snapshots every preset's results; `npm run golden` accepts intended changes.

## Current model, module by module (with known simplifications)

| Module | Current approach | Key assumptions / gaps |
|---|---|---|
| **Orbit** | Circular orbit; shadow-fraction formula; dawn-dusk SSO modeled as ~1.5% average shadow with ≤18 min eclipses; round-trip latency = 2h/c + 20 ms | No constellation geometry, no ground-station contact schedule, no collision avoidance |
| **Compute** | Peak PFLOPS × utilization (MFU) × (1 − soft-error overhead). Training compute = 6·params·tokens; inference = 2·active params per token. Presets: H100, B200, Rubin-class, "2035 accelerator" (2 kW, 50 PFLOPS FP8 — **a team projection**); models: Qwen3.5-397B, 70B dense, Kimi-K3, 2T frontier | Inference is compute-bound only (no memory bandwidth / KV-cache limits, unlike Madhan's twin); no satellite-to-satellite interconnect for training |
| **Power** | Array sized for load + eclipse recharge + 20% margin; 30% cells, 1.5%/yr degradation, 200 W/kg, $10/W; Li-ion batteries at 300 Wh/kg, 40% depth of discharge | Fixed-pointing losses; no solar-max radiation degradation spikes |
| **Thermal** | Stefan–Boltzmann radiator: 330 K, 220 K sink, ε 0.9, two-sided ≈ 972 W/m² (matches deck), 4 kg/m², 0.7%/yr loss | Steady state only; no temperature swings within an orbit; no pumped-loop or heat-pipe mass detail; no chip leakage vs temperature trade-off (Madhan found running chips hotter doesn't pay) |
| **Mass & propulsion** | Bottom-up mass budget; exponential atmosphere for drag; Hall thrusters (Isp 1,500 s); deorbit reserve; passive decay time | Baseline ≈ 28 t per MW of IT vs deck 18 t/MW vs Design 2 10.7 t/MW (PR #2 adds presets for both) |
| **Comms** | Ground-link Gbps per satellite × availability vs required throughput | No optical inter-satellite links, no weather outages at optical ground stations, no relay constellation model |
| **Lifetime** | Monthly, 25 years, no repair: random failures (4%/yr × 1.5 in space) with cold spares; radiation dose (150 rad/yr, which assumes ~10 mm Al shielding, against a 2 krad reference; ~2 krad is where HBM stress tests first showed irregularities, not a failure threshold); array/radiator wear; battery cycles; propellant | Failure rates are guesses; no single-event latch-up, debris strikes or Monte Carlo spread |
| **Economics** | Capex (chips, launch, bus, solar, batteries, insurance, ground segment); levelized cost per accelerator-hour and per M tokens; NPV; payback; ground comparison at $12M/MW facility, $0.09/kWh, PUE 1.2 | Flat pricing; no grid-scarcity premium on Earth; no financing or tax; no learning curves |

**Headline results (old training baseline, 81 satellites, 6.7 MW IT):**
- $7.24 per accelerator-hour in orbit vs $3.76 on the ground.
- Useful life 7.4 years, limited by chip failures.
- 187 t to orbit (2 launches).
- Bull case: $4.71/hr.
- GEO is not viable with today's chip radiation tolerance (useful life ~1.3 years).

## Sources used so far
- Google Research, Project Suncatcher (Nov 2025): 650 km dawn-dusk SSO cluster; TPU radiation tests (HBM irregularities from ~2 krad in stress tests, not a failure threshold; no TID hard failures to 15 krad; the 150 rad/yr dose assumes ~10 mm Al shielding, per arXiv 2511.19468); launch below ~$200/kg as the viability threshold.
- Starcloud: H100 launched 2 Nov 2025; small demos only (see `docs/ARCHITECTURE_NOTES.md`).
- NVIDIA H100/B200 datasheets.
- Vallado, *Fundamentals of Astrodynamics* (atmosphere table).
- Sundai Track 1 organizer deck (via Madhan's `twin/catalog.py`).

## Open research questions (where outside research would help most)
1. **Accelerators in orbit:** realistic 2030–2035 failure rates for high-power accelerators in space; radiation tolerance of HBM vs logic; shielding mass trade-offs; how much compute soft-error checking really costs.
2. **Thermal:** state of the art in deployable radiators (kg/m², maximum temperature, micrometeoroid resistance); pumped-loop vs heat-pipe vs droplet radiators; best chip temperature once leakage is included.
3. **Power:** 2035 solar array specific power and cost (roll-out arrays, perovskite or thin-film cells); degradation in SSO; whether batteries can be dropped in dawn-dusk SSO.
4. **Interconnect & comms:** Tbps optical links between satellites flying in formation (needed for training); optical ground-station networks and weather availability; latency for live chat.
5. **Launch & mass:** credible Starship $/kg trajectory to 2035; payload volume vs mass limits for large arrays; in-orbit assembly vs monolithic satellites.
6. **Orbit & debris:** SSO crowding, regulation (FCC 5-year disposal rule, ITU), collision-avoidance Δv, how large arrays change reentry risk.
7. **Economics & market:** grid power scarcity and data center permitting by 2035 (the real case for orbit); price per GPU-hour forecasts; insurance rates for large constellations; who buys orbital compute first (inference vs training, sovereign or defense customers).
8. **Competitors & analogs:** Starcloud, Google Suncatcher, Aetherflux, Lonestar (lunar), Axiom/Kepler orbital data nodes, China's Three-Body Computing Constellation; what each has demonstrated vs claimed.

## How research results can feed back
Each finding maps to a module's defaults in `app/src/modules/<module>/model.ts`, or to `shared/assumptions.json` if Madhan's twin should use it too. Cite the source next to the value, then run `npm test` / `npm run golden`.
