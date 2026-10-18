# Orbital Data Center Twin (web app)

A design-level digital twin of one orbital AI data center. Pick a model, workload, accelerator and orbit; an animated walkthrough plays the design through each subsystem of the satellite, then scorecards and charts show compute, lifetime, mass and economics vs. the same chips on the ground.

It complements the fleet optimizer in [`../twin/`](../twin/): that decides **how many MW go to orbit vs. Earth**; this one answers **what an orbital MW costs and how long it lasts**. Shared constants live in [`../shared/assumptions.json`](../shared/assumptions.json).

**Engineering spec:** [ENGINEERING_SPEC.md](ENGINEERING_SPEC.md)

## Run locally
```bash
cd app
npm install
npm run dev        # http://localhost:5173
npm test           # unit tests + golden results
npm run baseline   # print every preset's results
```

## How the code is split

```
src/
├── core/                 shared plumbing: pipeline, types, module contract, fields, format
│   └── pipeline.ts       runs the modules in dependency order → Results
├── modules/
│   ├── index.ts          the module list (drives drawer, walkthrough, scorecards)
│   ├── compute/          workload, AI model and accelerator presets, throughput
│   ├── orbit/            period, eclipses, latency, atmosphere
│   ├── power/            solar arrays, batteries, availability
│   ├── thermal/          radiators (Stefan–Boltzmann)
│   ├── comms/            ground-link capacity
│   ├── mass/             mass budget, propulsion, drag, deorbit, launches
│   ├── lifetime/         monthly ageing: failures, radiation, wear, useful life
│   └── economics/        capex, cost per accelerator-hour, NPV, ground comparison, sensitivity
├── scenarios/presets.ts  named scenarios = module defaults + overrides
└── ui/                   App, input drawer, walkthrough player + satellite scene, detail charts
```

Every module folder has the same files:

| File | What it holds |
|---|---|
| `model.ts` | The module's inputs (type + defaults) and its physics (`run…()`), pure functions only |
| `model.test.ts` | Unit tests for that physics |
| `fields.ts` | Its input controls (label, range, unit, help) for the drawer |
| `stage.ts` | Its walkthrough step: caption, 4 live metrics, status |
| `Overlay.tsx` | Its animation layer on the satellite scene (particles + top-right panel) |
| `index.ts` | Plugs the above into the app (`ModuleDef`) |

Data flows one way: `orbit` + `compute` → `power` → `thermal` → `mass` → `comms` → `lifetime` → `economics`. See the diagram in `core/pipeline.ts`.

## Working on a module (team workflow)

1. Branch per module: `git checkout -b power/thermal-transients`.
2. Stay inside your folder. Changing a default or a formula only touches `modules/<name>/`.
3. Need a new input? Add it to your `…Inputs` type + defaults in `model.ts`, and a control in `fields.ts`. It shows up in the drawer and in shareable links automatically.
4. Need a new output another module uses? Return it from your `run…()` and pass it along in `core/pipeline.ts` (the only shared file most changes touch).
5. Run `npm test`. The **golden test** compares every preset's full results against `test/golden.json`:
   - unexpected diff → you broke something in another module's numbers;
   - intended change → run `npm run golden` and commit the updated `test/golden.json` so reviewers see exactly which numbers moved.
6. Open a PR; CI runs type-check, tests and build.

Adding a whole new module: create `modules/<name>/` with the files above, call its `run…()` in `core/pipeline.ts`, add its results to `Results` in `core/types.ts`, and register it in `modules/index.ts`.

## Suggested ownership

| Owner | Folders |
|---|---|
| A | `orbit/`, `comms/`, `mass/` |
| B | `power/`, `thermal/` |
| C | `compute/`, `lifetime/` |
| D | `economics/`, `ui/` |
