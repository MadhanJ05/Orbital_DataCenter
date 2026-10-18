# Orbital Data Center Twin

A digital twin of a 2035 orbital AI data center. Plug in orbit, hardware, workload and cost assumptions; get compute output, infrastructure lifetime, mass, and economics, compared against the same chips in a ground data center.

**Live app:** https://madhanj05.github.io/Orbital_DataCenter/ (after GitHub Pages is enabled)
**Engineering spec:** [ENGINEERING_SPEC.md](ENGINEERING_SPEC.md)

## What it models
- **Orbit:** period, eclipse fraction, latency, drag, station-keeping fuel, passive decay (SSO / LEO / GEO)
- **Power & thermal:** solar array and battery sizing, radiator area (Stefan–Boltzmann)
- **Compute & workload:** effective EFLOPS, training time or inference tokens/s, ground-link load
- **Lifetime (monthly, 25 yr):** accelerator failures with cold spares, radiation dose, array/radiator degradation, battery cycles, propellant → useful life and limiting subsystem
- **Economics:** capex breakdown, levelized cost per accelerator-hour and per M tokens, NPV, payback, sensitivity tornado, terrestrial comparison

Scenarios are shareable: every input is encoded in the URL (use **Copy scenario link**).

## Run locally
```bash
npm install
npm run dev        # http://localhost:5173
npm run baseline   # print all preset scenarios' results to the terminal
```

## Code map
- `src/sim/engine.ts` — all physics and economics (pure functions, no UI)
- `src/sim/presets.ts` — scenarios and accelerator presets
- `src/fields.ts` — input definitions (ranges, units, help text)
- `src/stages.ts` — the 8 walkthrough steps and their live metrics
- `src/components/PipelineVideo.tsx` — animated walkthrough of the design through each subsystem
- `src/App.tsx`, `src/components/` — quick setup, module scorecards, all-inputs drawer, detailed charts (React + Recharts)

## Deploy
Pushing to `main` runs `.github/workflows/pages.yml`. One-time setup by a repo admin: **Settings → Pages → Source: GitHub Actions**.
