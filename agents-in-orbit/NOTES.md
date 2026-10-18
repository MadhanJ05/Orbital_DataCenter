# Data centers in space: napkin math (2026-10-18)

Goal (from the brief): a digital twin of the data centre that minimises joules per task at the best PUE, and the
whole thing in space: no Earth sites. The twin is `explorer.html` (fleet, joules per task, cost, with the Earth
design kept as the reference) plus `node3d.html` / `node.scad` (the orbital node).

## The all-in-space design (case B; `python model.py` prints every block below)
- Everything in a 575 km dawn-dusk sun-synchronous orbit (06:00 node). The 40 ms round trip sits inside the 2 s
  interactive TTFT, so interactive steps fly too; chat would as well (0.6 s TTFT).
- Twin-optimised fleet: **261 racks** (120 interactive with eclipse batteries + 141 background) = 207 MW of IT,
  33 nodes of 8 racks, 6.8 kt, about 69 launches of 100 t, 0.29 GW of arrays. **$16.7B** over 5 years, inside
  the $30B budget, 100% of the 50M developers served, 0 MW from any grid. Energy **1,837 GWh/yr**, 3.0 Wh per
  task fleet-wide with idle time counted.
- The same fleet with the slides' levers and no pooling was 401 racks and $25.5B; the all-Earth reference is
  $15.5B at 306-398 MW of grid. All-space ends up 1.08x all-Earth, not 1.6x, once the twin is used to design it.
- Without the software levers the all-space fleet is 1,087 racks, 28.1 kt and $69.3B: it serves 43% of the users.

## Closing the gaps: what is now derived instead of assumed
1. PUE from components (component values ASSUMED, the PUE DERIVED):
   - Orbit 1.0495 = 1 + conversion 4.64% (array regulator 98.5% x HV harness 99% x rack converter 98%)
     + pumps 0.08% (ammonia two-phase loop, 200 kPa over the 280 m loop, latent heat carries 933 kW at 0.9 kg/s)
     + housekeeping 0.22% (2 kW of avionics, CMGs, laser terminals per rack). Battery racks 1.0535.
   - Earth 1.1475 = 1 + conversion 5.75% (UPS 96%, PDU 98.5%) + cooling 8% (CDU pumps, dry coolers) + misc 1%.
   - The first-pass guesses (1.05 / 1.15) were close; the bare rows still use them so they stay reproducible.
2. Eclipses from the orbit geometry (beta = asin(sin(i + solar declination)) for a 06:00 LTAN plane):
   beta bottoms at 59 deg in June, below the 66.5 deg shadow limit at 575 km, so eclipses up to 21.0 min of a
   96 min orbit on 96 days a year: 4.6% of the year, not the ~1% guessed. Consequences, all derived:
   interactive battery = 21 min + 20% = 26 min = 436 kWh, 1.7 t, 27.4 t per rack ($64.2M); background racks
   that go dark need x1.067 (the worst day must still clear its work: (1 - 0.22) x 1.2 headroom = 0.937).
3. Joules-per-task optimiser over the variables the slides leave open:
   | setting | bg tok/s | bg GPU-s | bg kJ | int kJ | all-space cost | racks |
   |---|---:|---:|---:|---:|---:|---:|
   | slides' levers | 30 | 1.85 | 12.0 | 8.1 | $25.5B | 401 |
   | background at the bandwidth/memory balance | 67 | 1.23 | 8.0 | 8.1 | $19.8B | 311 |
   | + snapshot idle sandboxes | 67 | 1.23 | 7.6 | 7.9 | $19.8B | 311 |
   The finding: at 30 tok/s a background GPU is memory-bound (664 users fill HBM while bandwidth could serve
   1,500), so every token served slower than the balance point BW_eff x spec / (0.9 x HBM) = 67 tok/s wastes
   GPU-seconds. Serving background work 2.2x faster cuts its decode energy 2.2x and the fleet by 90 racks, and
   tasks finish in 23 min instead of 36. Interactive work is already bandwidth-bound at 100 tok/s, so it stays.
   Snapshotting sandboxes between tool calls (resident only while a tool runs, 37% of wall time) takes another 0.5 kJ.
4. One year in orbit (10-minute steps; diurnal cosine demand at the slides' peak factors, idle racks at 30% GPU /
   50% sandbox power, ASSUMED):
   | design | racks | GWh/yr | int kJ | bg kJ | util int | util bg | worst backlog |
   |---|---:|---:|---:|---:|---:|---:|---:|
   | peak-sized, no eclipse margin, no pooling | 299 | 1,931 | 10.8 | 8.4 | 50% | 83% | 3 days |
   | background racks x1.067, no pooling | 311 | 1,961 | 10.8 | 8.6 | 50% | 78% | 1.5 h |
   | pooled onto idle interactive racks, background x0.79 | 261 | 1,837 | 9.8 | 8.2 | 65% | 92% | 3.0 h |
   Two things only a time simulation shows: (a) sized for peak with no margin, the background backlog grows for
   weeks in June because 21-minute eclipses exceed the 1.2x headroom; (b) interactive demand peaks at 2x its
   mean, so those racks sit half idle, and fleet-level kJ/task with idle time is 37% above the busy-only number.
   Pooling the queued background work onto idle interactive racks (which have batteries, so they run through
   eclipses too) lets the background fleet shrink to 0.79x peak sizing: 261 racks, 13% of background work done
   on interactive racks, 3 h worst backlog. Interactive batteries cycle ~940 times a year at 26 min full load.

Model: `model.py` (run `python model.py`). Slide numbers are used as given; everything tagged ASSUMED
in the file should be replaced with the starter catalog once we have it.

## What the slides pin down
- Per-GPU decode is bandwidth-bound: ~1,100 chat users (Qwen3.5-397B, 64k) or ~140 interactive agent users
  (Kimi K3, 256k) per 2035 GPU. Background agents at 30 tok/s get ~400 per GPU.
- Every case naively needs ~850 MW of IT and ~$37B. All three are ~2x over both caps.
- The software levers (speculative decoding 2.5x, half the agent steps on Qwen3.5-122B at 32k, half of chat on
  gpt-oss-120b, context memory) roughly halve the fleet. With all of them, every case fits on Earth:
  A $17.7B / 463 MW grid, B $13.5B / 353 MW, C $13.9B / 364 MW.
- With moderate levers (spec 1.8x, multi-agent 30%), case A no longer fits: Earth alone serves 88% of
  prompters, and 60 MW of LEO capacity takes it to 100% for +$0.6B. B and C still fit on Earth.

## Earth rack vs LEO rack, 5 years (one 792 kW GPU rack; PUE now derived, see above)
- Earth: $34.9M = $23.8M rack + $9.1M building/power at $10M/MW + $2.0M energy at $50/MWh.
- LEO, bare first pass: $42.8M, 15.0 t = $28.6M rack with 20% spares + $8.4M solar at $10/W + $0.8M radiators
  + $2M bus + $3.0M launch at $200/kg. `python model.py` still prints this row next to the complete one.
- Earth, complete: $40.1M. Background agents need the same tool-sandbox rack on Earth ($2M, 115 kW of building
  and energy) plus 1%/yr ops; the first pass had charged the sandbox to orbit only.
- LEO, complete (after two review passes): **$63.6M, 24.9 t**, or $67.8M per delivered rack once the derived
  eclipse margin (x1.067) is counted; the pooled design avoids that margin. Everything added is tagged ASSUMED in `model.py` with a one-line rationale:
  - Tool sandbox: one 100 kW CPU/NVMe rack per GPU rack (1.5 t, $2M). ~170k background tasks run against each
    GPU rack at once and make 80 tool calls each; their mostly idle microVMs have to sit next to the model.
  - Shielding: 600 kg of 5 mm-Al-equivalent over the HBM stacks and power electronics only ($0.06M).
  - Eclipse: a 30 kWh housekeeping battery (120 kg, ~$0.01M) for avionics, pumps and sandbox state, plus a 0.99
    capacity factor because the interruptible background work is throttled during the ~1% of the year in eclipse
    instead of flying a GPU-sized battery. The array is no longer oversized for eclipse.
  - Deorbit propulsion: 350 kg and $1.0M per rack of electric propulsion, ~200 m/s over 5 years for drag make-up
    and the end-of-life perigee lowering the 5-year rule needs at 550-600 km.
  - Comms: 150 kg and $1.5M per rack for two laser ring terminals plus a share of a relay/gateway terminal.
  - Radiators: 14% Earth-IR derate on the Earth-facing face, 7% more panel over the two faces.
  - Second pass, masses the 1.5x structure factor had been carrying silently: power conditioning and harness at
    1.5 kg/kW (1.4 t), pumps, fluid, cold plates and a redundant loop (750 kg), attitude control share (50 kg),
    and arrays sized for 85% end-of-life output (+17% array).
  - Second pass, costs orbit had none of: ops at 2.5%/yr of hardware capex ($5.9M over 5 yr) and $1.5B of
    spacecraft NRE spread over the 270-rack fleet ($5.6M per rack).
  - Breakdown: chips + spares $28.6M, solar $11.0M (937 kW electrical, 1,102 kW array), radiators $1.0M
    (1,007 m2), bus $2.0M, sandbox $2.0M, propulsion $1.0M, comms $1.5M, ops $5.9M, NRE $5.6M,
    shielding + battery $0.1M, launch $5.0M.
  - Mass: rack 3.0 t + solar 3.7 + radiator 5.0 + sandbox 1.5 + power conditioning 1.4 + loop 0.75 + shield 0.6
    + propulsion 0.35 + comms 0.15 + battery 0.12 + ACS 0.05 = 16.6 t, x1.5 structure = 24.9 t.
- The review items add $20.8M (+49%) and 9.9 t (+66%) per orbital rack. Complete LEO is 59% above complete Earth
  (bare was 23% above bare). Launch is 8% of the orbital rack; ops + NRE are 18%; chips/spares and solar the rest.
- Break-even: at $50/MWh Earth power no solar price rescues the complete rack. Earth power has to reach
  ~$570/MWh at $10M/MW, or ~$450/MWh at $15M/MW, before the complete orbital rack is cheaper.
  (Bare rack: break-even solar ~$0.60/W at $200/kg, ~$3.3/W at $50/kg.)
- $30B buys 592 MW of IT on Earth (complete rack), 555 MW in LEO with the bare rack, 370 MW delivered with the
  complete rack. Earth's 500 MW grid cap is worth ~435 MW of IT, ~386 MW once agent racks carry sandboxes.

## Joules per task and PUE (the digital-twin metric; `python model.py` prints the table)
Joules per task = GPU-seconds (decode shared by the users one GPU serves, plus prefill) x 5.5 kW per GPU,
plus the sandbox slot's share of its 100 kW rack over the task's wall time (one of ~170k slots), x site PUE.
PUE is 1.15 on Earth (direct liquid cooling) and 1.05 in orbit (2.5% power conversion, 1% pumps, 1.5%
avionics and comms; itemised, ASSUMED).

| task | GPU-s | sandbox kJ | IT kJ | Earth kJ | LEO kJ | no levers, Earth kJ |
|---|---:|---:|---:|---:|---:|---:|
| chat turn | 0.03 | 0 | 0.1 | 0.2 | 0.2 | 0.4 |
| interactive agent task, 80 steps | 1.25 | 0.88 | 7.7 | 8.9 | 8.1 | 27.0 |
| background agent task, 80 steps (slides' 30 tok/s) | 1.85 | 1.25 | 11.4 | 13.1 | 12.0 | 30.1 |
| background agent task, optimised (67 tok/s, snapshot) | 1.23 | 0.47 | 7.2 | 8.3 | 7.6 | |

- Case B is 2.1B tasks a day: 2,533 GWh/yr all on Earth busy-only; the optimised all-space fleet runs on
  1,837 GWh/yr with idle time counted.
- Where joules per task are won: the software levers cut GPU-seconds per background task 2.5x (speculative
  decoding and the small sub-agent model do most of it). PUE moves the bill only 9%, orbit vs Earth.
- Where they are lost: prefill of 6k new tokens per step is ~60% of the GPU-seconds for agents; the sandbox adds
  10 to 11% on top of the IT energy. Snapshotting idle sandboxes between tool calls is the next lever.

## Case B with background agents in orbit (all levers, complete racks on both sites; `python model.py` prints this)
| bg capacity in LEO | Earth grid MW (incl. sandbox) | LEO IT MW | LEO racks | to launch | 5-yr cost | bare racks |
|---:|---:|---:|---:|---:|---:|---:|
| 0% | 398 | 0 | 0 | 0 | $15.5B | $13.5B |
| 25% | 329 | 53 | 67 | 1.7 kt | $17.2B | $14.1B |
| 50% | 261 | 106 | 135 | 3.4 kt | $18.8B | $14.6B |
| 75% | 192 | 159 | 202 | 5.1 kt | $20.4B | $15.1B |
| 100% | 124 | 212 | 270 | 6.7 kt | $22.0B | $15.6B |

Moving half of case B's background capacity to orbit (the explorer's default) costs $3.2B more than all-Earth
over 5 years and frees 137 MW of grid. Everything still fits the $30B budget.

## Where space wins (the pitch)
1. Capacity past the grid cap: Earth tops out at 108% of case A, 142% of B, 138% of C (all levers).
   Anything above that, or any lever that underdelivers, has to go to orbit.
2. Chat is orbit-eligible: LEO round trip is 40 ms, inside the 0.6 s TTFT. Background agents are
   Moon/Mars-eligible (one round trip per task).
3. Energy price hedge: slide 2 says PJM capacity prices rose 10x in two years. At $200/MWh and $15M/MW,
   a complete Earth rack is ~$51M; the bare LEO rack at $42.8M would already be cheaper, the complete rack at
   $63.6M needs Earth power at ~$450/MWh. The hedge is real but thin once the spacecraft is costed honestly.
4. PUE: 1.05 in orbit against 1.15 on Earth is the one metric where orbit wins outright, but it is worth 9%
   of the energy per task, not the 2.5x the software levers are worth.
5. All in space removes the grid question entirely: 207 MW of IT with 0 MW drawn from any grid, and the budget,
   not the cap, is the only limit (serves 100% at $16.7B).
6. The twin pays for itself: deriving the eclipse season, serving background work at the memory/bandwidth balance
   point and pooling it onto idle interactive racks took the all-space design from $25.5B to $16.7B and from
   2,316 to 1,837 GWh/yr with no new hardware assumptions.

## Recommendation
Case A (prompters). It is the case where the 500 MW cap bites first, chat latency works from LEO, and
"serve all 4 billion" is the headline. Design: 6 Earth sites filled to 500 MW with prefill + decode,
LEO constellation for the overflow, and a what-if slider on launch $/kg, solar $/W and Earth power price.

## Open items
- The sandbox is the biggest new assumption: one CPU rack per GPU rack at ~10 microVMs per core. If sandboxes
  can be snapshotted and parked between tool calls (the same trick as context memory for KV), it shrinks a lot.
- NRE ($1.5B over 270 racks) and ops (2.5%/yr) are the largest orbital line items after chips and solar and the
  least grounded; a smaller fleet makes the NRE share worse, a bigger one better.
- An interactive node of 8 battery-backed racks is 219 t, three launches; 7 racks per interactive node fit two.
- All nodes share one orbit plane, so all eclipse at once. Interactive capacity could instead be spread over
  planes with different eclipse seasons, trading the 1.7 t battery per rack for more gateway stations. An 18:00
  LTAN plane eclipses in December instead; mixing the two halves the seasonal backlog.
- Still assumed, not derived: idle power fractions (30% GPU, 50% sandbox), the diurnal demand shape and its
  14:00 peak, converter efficiencies, and the 3 h backlog tolerance used to size the pooled fleet.
- Not modelled: array and radiator degradation over the 5 years beyond the EOL margin, node failures, and the
  queueing of interactive requests at peak (sized for peak, so none, but no headroom either).
- Node geometry fixed in this pass: thruster pods moved from the aft manifold (plume into the radiator) to the
  solar booms, canted 20 deg outboard; ring laser terminals moved 6 m off the spine so they see past the radiator
  wings; the gateway terminal hangs under the racks, below the array plane. Still unverified: deployed-wing
  stiffness and CMG sizing for a 440 m span, and MMOD risk to the single radiator loop per wing.
- Propulsion assumes the arrays and radiators fly edge-on to the velocity vector in a dawn-dusk orbit, so drag
  area is small; a different attitude multiplies the drag make-up.
- Starter catalog: real 2035 GPU FLOPS, LPU and air-card specs, context-memory tier, the 6 Earth sites'
  prices, and any orbit cooling/launch numbers the organisers define.
- LPU: with 160 GB it is memory-capped for long contexts (~135 chat users per chip); only useful with
  context memory. Not modelled yet.
- Prefill KV traffic in a prefill/decode split is ~10 PB/s fleet-wide for agents; keep KV resident on
  the decode replica across steps.
