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
| `twin/optimize.py` | Coordinate search over every lever. Keeps a change only if the design stays at 100% served, stays valid, and gets cheaper. |
| `twin/test_calibration.py` | Checks against the deck: ~960 chat and ~117 agent sessions per GPU, per-user peak tokens, 972 W/m² radiators, $3.6M/MW launch, orbit break-even with the Nordics at $95/kg and West Texas at $170/kg, Moon and Mars latency rules. |
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
| Case A, prompters | 4.0B (100%) | $13.1B | 386 MW | none |
| Case B, agent developers | 50M (100%) | $8.5B | 240 MW | none |
| Case C, knowledge workers | 400M (100%) | $8.3B | 234 MW | none |
| A+B+C, Earth only | 2.6B of 4.45B (58%) | $16.8B | 488 MW (full) | none |
| A+B+C, with orbit (greedy) | 4.45B (100%) | $30.8B (over budget) | 490 MW | 370 MW, 6,656 t |
| A+B+C, optimized, no failure protection | 4.45B (100%) | $26.3B | 487 MW | 264 MW, 4,745 t |
| **A+B+C, final: survives losing any one site or plane** | **4.45B (100%)** | **$29.7B** | **449 MW, 6 sites** | **8 planes x 68 MW, 9,727 t** |
| Same, with the 10.7 t/MW satellite | 4.45B (100%) | $28.7B | 394 MW | 8 x 74 MW, 6,391 t |

## Failure test

`serving.resilience` is `"live"` (chat and interactive agents stay at 100% when any one site
or orbital plane is lost; background agents wait inside their 4 h deadline) or `"all"`
(every stream stays at 100%). Orbit can be split into independent planes `leo_p1`..`leo_p8`.
Each plane is its own failure domain, with the same physics and prices as `leo`.

## Known simplifications

- Earth site prices, carbon and grid caps are our assumptions, because the deck gives only the round trips. The Nordics and West Texas values are tuned to the deck's break-even prices.
- Load is sized at the peak hour. With `bg_fill_valleys`, background agents use the interactive pools' off-peak spare capacity (peak minus daily average). This assumes the peak window is under 3 hours, shorter than the 4-hour background deadline. There is no hour-by-hour simulation yet.
- Chat prefix caches are treated as free to store. Agent caches parked during tool calls are charged to HBM, or to the context-memory tier when it is on.
