# Track 1 twin, scorer and optimizer (technical notes)

A digital twin of the 2035 AI inference fleet for Sundai Hack 145, Track 1. You give it a
design (where racks go, which chips, how requests are served). It returns the users served
within every speed target, the 5-year cost, grid use, orbital mass, CO2, joules per request,
and what happens if a site goes dark.

Ranking follows the organizers' deck: users served within all SLOs and hard limits first
($30B budget, 500 MW Earth grid), then the lowest 5-year cost.

No dependencies beyond Python 3.

```bash
python3 twin/test_calibration.py              # twin reproduces the deck's own numbers
python3 twin/score.py --napkin                # tokens/s per chip, all-GPU sizing per case
python3 twin/score.py --breakeven             # launch $/kg where orbit ties each Earth site
python3 twin/build.py A B C                   # greedy valid starting design -> designs/A+B+C.json
python3 twin/optimize.py A B C                # search for the cheapest valid design -> designs/final_A+B+C.json
python3 twin/optimize.py A B C --planes 8 --resilience all --name final_resilient --out designs/final_resilient.json
python3 twin/score.py designs/final_A+B+C.json   # score a design (add --json for the full result)
```

## Files

| File | What it is |
|---|---|
| `twin/catalog.py` | Every constant. Each one is tagged `DECK sN` (from slide N), `ASSUMED`, or `CALIB` (tuned to reproduce a deck number). |
| `twin/score.py` | The model and the scorer. |
| `twin/build.py` | Greedy planner: best chip per stream, cheapest sites up to their grid caps, the rest in LEO. |
| `twin/orbit_mass.py` | The 18-tonne what-if: one orbital MW broken into compute, solar, radiators and structure, with physical levers (chip temperature vs leakage, two cooling loops, solar W/kg, radiator kg/m², stripped racks, structure share, launch price). It re-optimizes the whole fleet at each step and writes `designs/whatif_ladder.json`. |
| `twin/simulate.py` | Minute-by-minute day. Builds global demand curves from three regions in their own time zones, serves live work first, queues background work into what's left, and checks every background task against its 4 h deadline, on a normal day and with each site or plane lost. Writes `designs/sim_24h.json`. |
| `twin/check_rules.py` | Rule-by-rule check against the deck for Design 1 and Design 2 (or any design). Each line gives the slide, the limit, the design's value and PASS/FAIL. It recomputes from the pools instead of trusting the scorer. |
| `twin/handcheck.py` | Redoes 16 key Design 1 results with calculator arithmetic from deck numbers, without the scorer's physics, and compares: demand, sessions per chip, capacity, first-token time, one site's bill, launch, off-peak shift, outage margins. |
| `twin/stress.py` | Makes each ASSUMED/CALIB number 25% worse (`--pct`), one at a time and then all together. Re-scores the final design as built and re-optimizes from scratch. `--light` uses the 10.7 t/MW satellite; `--orbit-only` removes Earth sites (Design 2). Writes `designs/stress_25*.json`. |
| `twin/optimize.py` | Coordinate search over every lever. Keeps a change only if the design stays at 100% served, stays valid, and gets cheaper. |
| `twin/test_calibration.py` | Checks against the deck: ~960 chat and ~117 agent sessions per GPU, per-user peak tokens, 972 W/m² radiators, $3.6M/MW launch, orbit break-even with the Nordics at $95/kg and West Texas at $170/kg, Moon and Mars latency rules. |
| `twin/export_ui.py` | Scores every design in `designs/` and bundles the results with the 24-hour simulation, the stress ladders and the agents-in-orbit strand into `designs/ui.json`, the data behind `dashboard.html` (published copy: https://claude.ai/artifact/K2eTB3o7SGMvccLEJCppxL). The page has no model logic of its own. |
| `designs/*.json` | Saved designs. |

## Design format

```json
{
  "name": "my-design",
  "cases": ["A", "B", "C"],
  "serving": {"easy_chat_share": 0.0, "subagent_share": 0.5, "spec_draft": 5, "context_memory": true, "bg_fill_valleys": true},
  "pools": [
    {"name": "chat-decode-leo", "stream": "chat", "phase": "decode", "site": "leo",
     "chip": "lpu", "chips_per_replica": 12, "racks": 292}
  ]
}
```

- **Streams:** `chat`, `chat_easy` (routed to gpt-oss-120b), `agent_int`, `agent_int_sub`, `agent_bg`, `agent_bg_sub` (the `_sub` streams are Qwen3.5-122B sub-agents).
- **Phases:** `prefill` runs on `gpu` or `air`; `decode` runs on `gpu` or `lpu`.
- **Sites:** `n_virginia`, `midwest`, `west_texas`, `nordics`, `iceland`, `gulf`, `leo`, `moon`, `mars`.
- **Cooling:** Earth uses `direct_liquid` (default), `immersion`, `air_evap` or `air_chillers`. Space uses `radiators`.
- **Sizing:** give `"share": 0.4` instead of `racks` and the scorer sizes the pool for 40% of that stream's peak demand.

## Results (our assumptions)

| Design | Users served | 5-year cost | Earth grid | Orbit |
|---|---|---|---|---|
| A+B+C, optimized, no failure protection | 4.45B (100%) | $27.21B | 485 MW | 295 MW, 5,307 t |
| **Design 1: survives losing any one site or plane** | **4.45B (100%)** | **$29.05B** | **438 MW, 6 sites** | **8 planes x 66 MW, 9,515 t** |
| Design 1 layout with the 10.7 t/MW satellite | 4.45B (100%) | $28.02B | 438 MW | 8 x 66 MW, 5,676 t |
| **Design 2: 10.7 t/MW satellite, all orbit** | **4.45B (100%)** | **$29.22B** | **0 MW** | **8 x 126 MW, 10,790 t** |

All with the 5% memory reserve (`MEMORY_USABLE = 0.95`). `DEMAND_MARGIN` (default 0) makes
the scorer size and check service at that much above the deck's demand. Energy is still
billed at the real demand.

## Stress test (each assumption 25% worse)

| | Design 1 ($29.05B) | Design 2 ($29.22B) |
|---|---|---|
| Single assumptions that still fit the budget with every outage covered | **11 of 16** | 10 of 16 |
| Breaks it | chip FLOPS (-$3.7B), draft acceptance (-$5.6B), cross-chip sync (-$0.4B), attention math (-$0.1B) | chip FLOPS (-$4.1B), draft acceptance (-$5.8B), space hardware (-$0.6B), sync (-$0.2B), attention (-$0.2B) |
| All 16 worse at once | $52.8B | $52.2B |

Earth prices, carbon and grid caps barely move the cost. The two that matter are about chip
performance (prefill FLOPS, speculative-decoding acceptance). They change how many chips
everyone needs, wherever the chips sit.

## Deck interpretations (where the slides leave room)

- **Workloads:** the Kimi K3 / Qwen3.5 / gpt-oss set (slides 9-14, named on the Track 1 Challenge slide). The Sage/Titan slides later in the deck are an alternate version and are not used.
- **500 MW** is counted as facility power: IT plus cooling, at nameplate. That's the strict reading.
- **Virginia and the Midwest** use the midpoint of the deck's cold and desert PUE columns.
- **Air cards in orbit** are radiator-cooled like everything else in space. If that is disallowed and GPUs do the orbital prefill, Design 1 costs $29.65B and Design 2 $29.57B: both still valid.
- **Chip memory:** 5% is kept free for fragmentation and activations (`MEMORY_USABLE`).

## Model fixes from the code review

- **Off-peak shift during outages:** background work riding in the interactive pools must fit in
  their remaining average spare (capacity left after the outage, minus the interactive
  average). The resilience check covers every stream that has demand before off-peak shift.
- **Parked agents:** sessions waiting on tools are counted at the real decode speed. Chips
  run agents well above 100 tok/s, so about 8 caches are parked per decoding session, not 1.6.
  The context-memory tier grew from 17 to 74 PB.
- **Context-tier link:** each tool call loads the whole cache back from the tier and writes
  out only the new tokens. This is capped by a per-chip link (`ctx_link` in `catalog.py`:
  GPU 900 GB/s like today's NVLink-C2C, LPU 200 GB/s, air card 100 GB/s, all ASSUMED).
- **Burst headroom:** with outage protection on, the optimizer may drop the 5% sizing headroom,
  because the outage spare covers bursts on a normal day. `simulate.py` confirms no live
  shortfall, minute by minute, on a normal day and in every outage.

## Failure test

`serving.resilience` is `"live"` (chat and interactive agents stay at 100% when any one site
or orbital plane is lost; background agents wait inside their 4 h deadline) or `"all"`
(every stream stays at 100%). Orbit can be split into independent planes `leo_p1`..`leo_p8`.
Each plane is its own failure domain, with the same physics and prices as `leo`.

## Known simplifications

- Earth site prices, carbon and grid caps are our assumptions, because the deck gives only the round trips. The Nordics and West Texas values are tuned to the deck's break-even prices.
- Load is sized at the peak hour. With `bg_fill_valleys`, background agents use the interactive pools' off-peak spare capacity (peak minus daily average). This assumes the peak window is under 3 hours, shorter than the 4-hour background deadline. `twin/simulate.py` checks this minute by minute: interactive demand stays within 10% of its peak for only 1.5 h a day, and the longest background wait is 35 min on a normal day (58 min in the worst outage) against 228 min allowed.
- Chat prefix caches are treated as free to store. Agent caches parked during tool calls are charged to HBM, or to the context-memory tier when it is on.
