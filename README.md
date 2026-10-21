# 🛰️ Orbital Data Center: our 2035 AI fleet

**Sundai Hack 145, Track 1: Build the AI data center of 2035**

## The problem, simply

By 2035 billions of people use AI every day, and AI agents do hours of work for developers.
Our job is to build the computers that answer all of them quickly, for the lowest cost.

The rules from the organizers:
- 💰 **$30 billion** total budget for 5 years
- ⚡ Only **500 MW** of power from Earth's grid, across all our sites
- 🚀 Space has free sunlight, but every kilogram costs **$200** to launch
- ⏱️ Answers must start fast: chat in **0.6 s**, AI agents in **2 s**

## The catch

All three user groups together are 4.45 billion people: chat users, agent developers and
office workers. **Earth runs out of power first.** If we stay on Earth, the grid is full when
only 58% of them are served.

**Presenting?** Use the [deck](https://madhanj05.github.io/Orbital_DataCenter/explained.html) or the [briefing dashboard](https://madhanj05.github.io/Orbital_DataCenter/briefing.html), and run `python3 twin/prove.py` to show every check live (about 6 seconds).

## 🛰️ The digital twin

**The presentation:** [`explained.html`](https://madhanj05.github.io/Orbital_DataCenter/explained.html) is our 15-slide deck, and [`briefing.html`](https://madhanj05.github.io/Orbital_DataCenter/briefing.html) tells the same story as one dashboard. Every estimate on them is checked against a cited source. Both are built from [`present/`](present/): edit `present/deck_page.html`, `present/briefing_page.html` or `present/sources.py` and push; the site rebuilds them (`python3 present/build.py` builds them locally).

**[`twin3d.html`](https://madhanj05.github.io/Orbital_DataCenter/twin3d.html)** is the twin in 3D, seen from space, with two views:
- **One satellite** (`#satellite`): a single satellite drawn to scale. Sliders change its size, chip temperature, cooling loops, solar W/kg, radiator kg/m², rack weight, structure, batteries and launch price; the wings, radiator and battery resize live, and it shows tonnes per MW, launches, and cost per MW against the Nordics. It runs the same physics as `twin/orbit_mass.py` and checks itself against Python's answers on every load.
- **Realistic rendering:** Earth uses NASA's Blue Marble (day), Black Marble (city lights at night) and cloud imagery (public domain, `twin/assets/`). It adds an atmosphere glow, sunlight glinting off the oceans, the Sun with a lens flare, and a starfield with the Milky Way. It opens on the whole fleet; add `#satellite` to the link to open straight on the one-satellite view.
- **Whole fleet:**
- Earth turns with real UTC time, under real sunlight.
- Our six Earth sites glow with the power they draw.
- Twelve dawn-dusk orbital planes of satellites circle the planet; one dot is an 8 MW satellite.
- On a June or December eclipse day, that half of the planes tilts into Earth's shadow, and you can watch satellites switch to batteries or pause.
- Switch off any site or plane. Camera views: overview, from the Sun, ride along with a satellite, Earth sites.

**[`twin.html`](https://madhanj05.github.io/Orbital_DataCenter/twin.html)** (build it locally and it opens straight in a browser, no server needed) is the same twin as flat charts and tables:
- **Pick a design and a day** (normal, or the worst eclipse day).
- **Switch off any site or orbital plane.**
- **Scrub or play the 24 hours.**

It shows, for every Earth site and orbital plane:
- power drawn hour by hour, and where it comes from (grid or solar arrays);
- solar-array and radiator area, chip and radiator temperature, and eclipse batteries;
- link traffic to Earth;
- energy per chat and per agent task, and where 5 years of energy goes (sunlight to chips to heat);
- all 96 days we simulate (57 for Design 1, 39 for Design 2): normal, every outage, eclipses.

The HTML pages aren't committed: the site builds `twin.html`, `twin3d.html`, `explained.html` and `briefing.html` on every push. After a model change, run `python3 twin/physical.py` and commit `designs/twin.json`. To open the pages locally, run `python3 twin/build_twin_page.py && python3 present/build.py`.

## Our answer: two designs

| | 🏁 **Design 1: the safest (Earth + orbit)** | 💡 **Design 2: our what-if (all orbit)** |
|---|---|---|
| What it is | The organizers' catalog exactly as given (18-tonne satellite), 6 Earth sites + 12 orbital planes | Our lighter satellite (11.0 tonnes per MW); the whole fleet in 12 orbital planes, no Earth grid at all |
| 💰 Budget ($30B) | ✅ $29.88B | ✅ $29.44B |
| ⚡ Earth grid (500 MW) | ✅ 323 MW | ✅ 0 MW |
| 🚀 Launch ($200/kg) | ✅ 11,661 t = $2.33B | ✅ 11,452 t = $2.29B |
| 📡 Communications | 84 satellites x 3 laser terminals + 16 ground stations = $0.37B | 120 satellites x 3 terminals + 16 stations = $0.42B |
| ⏱️ Speed (chat 0.6 s, agents 2 s) | ✅ 0.22 s / 0.26 s | ✅ 0.14 s / 0.16 s |
| 👥 Users served | ✅ 100% of 4.45 billion | ✅ 100% of 4.45 billion |
| 🛡️ Lose any one site or plane | ✅ still 100% served | ✅ still 100% served |
| 🌑 Worst eclipse day, even with an outage | ✅ batteries on live racks | ✅ batteries on every rack |
| File | `designs/final_resilient.json` | `designs/whatif_all_orbit_light.json` |

**Design 1 is our entry and the safest.** It uses the organizers' numbers exactly, and it mixes
Earth and orbit, which fail for different reasons (grid outages vs solar storms). **Design 2 is our
idea:** the organizers invite each team to change one assumption, and ours is the satellite's
weight. With an 11.0-tonne satellite, the entire fleet can leave Earth's grid and still fit the
budget. Design 2 is also faster, because orbit is only 40 ms from everyone.

**Where we are:** both fit the budget again after two cost cuts. Sandboxes are snapshotted between
tool calls, and the fleet uses 12 smaller orbital planes instead of 8, so less spare is needed to
survive losing one. Design 2 is $0.4B cheaper than Design 1, but it
depends on one kind of place (orbit), so a big solar storm hitting every plane at once is its
worst case. Design 1 mixes two kinds of place that fail for different reasons.

## ⚠️ Known limits

Both designs fit the rules with our 2035 estimates. Some of those estimates are kinder than
today's published figures. Here is what today's figures do to each design, re-scored as built
(same racks; `python3 twin/today_prices.py`). Every figure's source is on the deck's
[sources slide](https://madhanj05.github.io/Orbital_DataCenter/explained.html#s14) and in
[`present/sources.py`](present/sources.py).

| Using today's figure instead of ours | Design 1 | Design 2 |
|---|---|---|
| Our 2035 estimates (the designs above) | ✅ $29.88B | ✅ $29.44B |
| Earth electricity: $32–101 per MWh by site (ours $25–70) | ❌ $30.07B | not used |
| Earth building cost: $10.7M per MW (ours $7M; $1M for cooling on top of both) | ❌ $30.96B | not used |
| Electricity, grid carbon and building cost together | ❌ $31.22B | not used |
| Solar arrays: best flown about 200 W/kg (ours 500) | not used | ❌ $30.12B (14.8 t per MW) |
| Radiators: flown deployables 3.5 kg/m² (ours 2) | not used | ✅ $29.94B (13.1 t per MW) |
| Arrays and radiators together | not used | ❌ $30.63B (17.0 t per MW) |

So **Design 1 needs Earth costs below today's, and Design 2 needs solar arrays that don't fly
yet.** Each goes over the $30B by 0.2–4%. These rows keep the same racks; re-planning under the
new figures could claw a little of that back.

Other things the numbers rest on:
- **2035 chips.** The organizers' 2035 GPU (3 TB of memory, 120 TB/s, slide 13) has about 10×
  the memory and 6× the bandwidth of [NVIDIA's Rubin](https://www.nvidia.com/en-us/data-center/vera-rubin-nvl72/)
  (288 GB, 19.2 TB/s). Making chip speed, the usable share of it, attention maths, cross-chip sync
  or draft acceptance 25% worse breaks both designs (`twin/stress.py`).
- **Guessing ahead.** We assume 70% of drafted words are accepted, inside what
  [EAGLE](https://arxiv.org/abs/2401.15077) reports (64–79%). But published speedups shrink at
  big batch sizes: [EAGLE-3](https://arxiv.org/abs/2503.01840) gets 1.38× at batch 64.
- **Pausing tool sandboxes.** We pause each background agent's sandbox while the AI writes,
  about 17 seconds (500 words at 30 per second). Pausing takes about 4 s per GiB of memory today
  ([E2B](https://docs.e2b.dev/sandbox/persistence)), so this only works for small sandboxes.
- **Prices with no public source:** $0.5M per laser terminal (past units cost about
  [$10M](https://aerospace.org/sites/default/files/2023-05/FY23_12205_SOP_Lasercom%20Ppr_r10.pdf)),
  $300/kWh space batteries (ground packs are $108/kWh), $3/GB pooled memory (about $30/GB during
  the 2026 shortage), and $2M sandbox racks.
- **Launch at $200/kg** is the organizers' figure. SpaceX targets it with Starship; Falcon 9 is
  about $2,700/kg today.

## Design 1: the safest (Earth + orbit)

- 🌍 **Earth:** all 6 sites (Nordics, Iceland, West Texas, Virginia, Midwest, Gulf), 323 of 500 MW
- 🛰️ **Orbit:** 12 separate orbital planes of 50 MW each, half at 06:00 and half at 18:00 local time, 11,661 tonnes launched
- 🔋 **Eclipse batteries** on the racks that serve live users, so they keep working in Earth's shadow
- 📡 **Comms:** 84 satellites with 3 laser terminals each (2 to neighbours for relaying, 1 to the ground) and 16 optical ground stations: $0.37B
- 💰 **$29.88B:** chips and tool-sandbox racks $20.2B, satellite hardware $3.6B, launch $2.3B, buildings $2.3B, power and carbon $0.7B, comms $0.37B, agent memory store $0.2B, batteries $0.06B

**Why not put everything in orbit?** Space has unlimited power, but with the organizers'
18-tonne satellite, an orbital megawatt costs about $11.2M over 5 years, against $9.3M in the
Nordics. So we use Earth where it's cheap, and orbit where Earth runs out. All-orbit with this
satellite would cost $31.1B, over budget.

**Why 12 planes and 6 Earth sites?** If everything sat in one place, one outage would take
down everyone. We spread the fleet so no single site or plane holds more than about 1/12 of
it, and carry just enough spare capacity that losing any one is a non-event. That insurance
costs about $3.0B. Without it the fleet is $26.9B, but losing the orbit section would leave 37% of
live users without service and background jobs waiting 33 hours (`designs/final_A+B+C.json`).

Why orbit and not the Moon or Mars? The Moon is 2.6 s away and Mars 25 minutes, which is too
slow for chat. Orbit is only 40 ms away, about as close as a data center in Virginia.

## Our orbits, explained

- **12 separate orbital planes.** Each plane is its own ring of satellites, about 7 satellites of
  8 MW in Design 1 and about 10 in Design 2. Each plane is also its own failure zone: losing
  one doesn't affect the others.
- **A plane is a family of satellites, not one satellite.** Each plane is a ring of 8 MW
  satellites spaced evenly and following one another around the same orbit. At about 650 km,
  one lap is about 44,100 km and takes about 98 minutes.

  | | Satellites per plane | Total satellites | Spacing within a plane |
  |---|---|---|---|
  | Design 1 (~50 MW per plane) | ~7 | ~84 | ~6,300 km apart, one every ~14 minutes |
  | Design 2 (~75 MW per plane) | ~10 | ~120 | ~4,400 km apart, one every ~10 minutes |

- **How far apart the planes are:** the model doesn't fix their exact positions. It treats them
  only as independent failure zones. In the 3D twin they are turned about 2° to 10° from the
  exact day/night line and stepped 20 km apart in height, from 550 to 770 km. That's realistic in
  kind, because dawn-dusk planes can only fan out a little (within about an hour of 06:00 or 18:00
  local time) before they see more shadow. The exact numbers are a drawing choice.
- **Spread out, not clustered:** Google's Suncatcher flies 81 satellites 100-200 m apart so they
  can link to each other at very high speed, which training needs. Answering questions doesn't
  need that, so each of our satellites talks straight to the ground.
- **They are all dawn-dusk sun-synchronous orbits (dawn-dusk SSO)** at about 650 km.
  *Sun-synchronous* means the orbit turns about 1° a day, so it keeps the same angle to the Sun
  all year. *Dawn-dusk* means that angle keeps it riding along the line between day and night,
  so its satellites see sunlight almost all the time.
- **"06:00" and "18:00" are local solar time, not UTC.** The space industry calls this the
  *local time of the ascending node*: the local time on the ground directly below when a
  satellite crosses the equator heading north. A 06:00 plane always crosses at local dawn, and
  an 18:00 plane always crosses at local dusk, wherever that is and whatever UTC says.
- **Half our planes fly at 06:00 and half at 18:00.** Both follow the day/night line, in
  opposite directions, and their short eclipse seasons fall in opposite halves of the year (June
  and December). So only half the fleet is ever in eclipse season at once.
- **Why every plane is dawn-dusk:** a tilted orbit like Starlink's passes through Earth's
  shadow on almost every lap, for about 35 of every 95 minutes, so every rack would need
  batteries. Dawn-dusk orbits are only shadowed up to about 20 minutes per orbit, on about 95
  days a year.
- **In the 3D twin,** the clock shows UTC (world time, for demand and Earth's rotation). The
  06:00 rings are solid and the 18:00 rings are dashed. The planes are drawn between 550 and
  770 km so you can tell them apart; the model treats them all as about 650 km.

## The five tricks that made it fit

1. **🕑 Off-peak shift.** Background agents have 4 hours to finish their work. They run in the quiet
   hours of the racks that serve live agents, so we don't buy separate racks for them. "Quiet"
   means quiet for the whole world: demand worldwide is below average 13 hours a day.
   This one trick saves about $4.8B. We checked it with a minute-by-minute simulation of a full
   day: the longest any background job waits is 55 minutes in Design 1 and 44 minutes in
   Design 2 (under 1.5 hours even with a site down), well inside the 4-hour deadline.
2. **🧠 Small helpers.** Half of each agent's steps go to a smaller sub-agent model, which is
   about 10x cheaper per step.
3. **⚡ Guess ahead (speculative decoding).** The AI drafts a few words ahead and checks them in
   one go, so every chip writes 2-3x more words.
4. **🔧 The right chip for each job.** "Reading" the question (prefill) runs on cheap "air cards".
   "Writing" the answer (decode) runs on fast-memory LPU chips.
5. **📍 Many small zones, not one big one.** Spread over every Earth site and 12 orbital planes,
   so the spare capacity we need for an outage stays small.

## Design 2: all orbit, with a lighter satellite (the 18-tonne problem)

- 🛰️ **Orbit only:** 12 orbital planes of 75 MW each (half at 06:00, half at 18:00), 11,452 tonnes launched, **0 MW of Earth grid**
- 🔋 **Eclipse batteries on every rack**, so the whole fleet keeps working in Earth's shadow
- 📡 **Comms:** 120 satellites with 3 laser terminals each and 16 optical ground stations: $0.42B
- 💰 **$29.44B:** chips and tool-sandbox racks $21.4B, satellite hardware $5.0B, launch $2.3B, comms $0.42B, agent memory store $0.2B, batteries $0.11B
- ⏱️ **Faster:** chat starts in 0.14 s, because orbit is only 40 ms from everyone

The organizers' orbital megawatt weighs 18 tonnes. Lighter solar panels, carbon-fiber
radiators and racks stripped down for space bring it to **11.0 tonnes** (including the 5% of
power lost in conversion, pumps and avionics that the organizers' 18 tonnes already includes).
At 11.0 tonnes an orbital megawatt costs **about the same as the cheapest place on Earth** (the
Nordics), and the whole fleet fits in orbit, with no Earth grid, for **$29.44B**
(`designs/whatif_all_orbit_light.json`). One more step, letting the arrays and radiators carry the
structure, makes orbit cheaper. Kept as a mix of Earth and orbit, the lighter satellite would
cost $28.75B (`designs/whatif_resilient_light.json`).

| Satellite upgrade (each step adds to the one before) | Tonnes per MW | Cost per MW in orbit |
|---|---|---|
| Organizers' satellite | 18.0 | $11.18M |
| Thin-film solar panels (500 W/kg) | 15.3 | $10.31M |
| Carbon-fiber radiators (2 kg/m²) | 12.9 | $9.69M |
| **Racks stripped down for space (Design 2)** | **11.0** | **$9.30M**, the same as the Nordics ($9.29M) |
| Arrays and radiators carry the structure | 9.9 | $9.07M, cheaper than anywhere on Earth |

Surprise: running chips *hotter* to shrink the radiators doesn't pay. Hot chips leak power,
and in space every extra watt needs more solar panels.

## What if our guesses are wrong?

The organizers didn't give every number (for example local electricity prices), so we guessed
some. We made each of our 16 guesses 25% worse, one at a time:

- **Prices, carbon and site power limits hardly matter**: under $0.2B each.
- **Design 1 still fits in 9 of 16 cases; Design 2 in 10 of 16.** Each has $0.1–0.6B to spare
  after batteries, tool sandboxes and communications, thanks to two cost cuts: sandboxes are
  snapshotted between tool calls, and the fleet uses 12 smaller orbital planes.
- What breaks both designs is mostly **how good 2035 chips are** (compute speed, the share of it
  we can use, attention maths, cross-chip sync, and how often the AI's drafted words are right),
  plus the price of satellite hardware. Weaker chips mean every team needs more of them, which
  makes Earth's power limit tighter and orbit *more* necessary.
- Today's published Earth prices and flown satellite hardware are further off than 25% for some
  inputs; see **Known limits** above.

## How we checked it

| Check | What it does | Result |
|---|---|---|
| 🎯 Matches the organizers | Our model reproduces the deck's own numbers: 960 chat users per chip, 117 agents per chip, $3.6M to launch a megawatt, orbit breaking even with the Nordics at $95/kg | 11 of 11 tests pass |
| 🛡️ Safety rules | We keep 5% of every chip's memory free, as real systems do (see below) | Included in both designs |
| 🌑 Eclipses | Real orbit geometry (from Alfred's app and Andrey's model): Earth's shadow up to about 20 minutes per orbit, about 95 days a year (the model uses the teammates' 21 minutes, a little longer than the 19.6 at our 650 km). Worst eclipse day simulated alone and with every possible outage | Design 1: 38 of 38 days OK. Design 2: 26 of 26 |
| 🧰 Tool sandboxes | Background agents run their tools on CPU racks next to the model (from Andrey's model). We buy, power and launch them, and pause idle ones to disk between tool calls | 198 racks (Design 1), 192 (Design 2): $0.53–0.59B with power, buildings and launch |
| 📡 Communications | 3 laser terminals per 8 MW satellite (50 kg, $0.5M each, from Andrey's model) and 16 optical ground stations ($10M each + $1M/yr); each plane's Earth capacity = satellites x 100 Gbps x 95% weather availability (from Alfred's app) | $0.37–0.42B; busiest plane uses 0.09 of 0.67 Tbps (D1), 0.13 of 0.95 Tbps (D2) |
| 📋 Every rule, one by one | Budget, grid, launch, chip and cooling rules, every speed target, users served, outages, Earth-orbit network traffic, energy bookkeeping. Each is recalculated from the raw design | Design 1: 39 of 39. Design 2: 33 of 33 |
| 🕐 A full day, minute by minute | Users in 3 time zones, live users first, background jobs fill the gaps. Run on a normal day, once per possible outage, and on the worst eclipse day with and without each outage | 96 days simulated: no live user ever waits. Longest background wait: 200 min (limit 228) |
| 🔥 What if our guesses are wrong | Each guessed number made 25% worse | Design 1 fits 9 of 16; Design 2 fits 10 of 16 |
| 🧮 Hand calculation | 16 key numbers for Design 1 (demand, users per chip, first-reply time, one site's bill, launch, outage spare) redone with plain arithmetic, without our code | All match exactly |
| 🔍 Code review | We read the model line by line and fixed 4 bugs that made designs look better than they were | Both designs re-optimized after the fixes and still pass |

**Energy per answer:** a chat reply uses about **0.05 Wh** (0.049 in Design 1, 0.054 in Design 2), and a full
AI-agent task (80 steps) about **2.0–2.7 Wh**. For comparison, Google reported 0.24 Wh for a typical
Gemini prompt in 2025.

## Questions a judge might ask

- **"Air cards are air-cooled. How do they work in space?"** In orbit every rack, air cards
  included, is cooled through radiators. If air cards weren't allowed in space, GPUs would do the
  reading up there instead, at about $0.6–0.8B more: Design 1 $30.63B, Design 2 $30.06B. That's
  over budget, so this is a real dependency of ours.
- **"Why not put everything in orbit with the organizers' satellite?"** It would cost $31.1B,
  over budget. An orbital megawatt costs $11.2M against $9.3M in the Nordics, so Earth is still
  cheaper where it's available.
- **"What if a solar storm hits every satellite at once?"** That's Design 2's worst case, and why
  Design 1 is our entry: it keeps 323 MW on Earth, which fails for different reasons.
- **"What happens when satellites pass through Earth's shadow?"** Half our planes fly at 06:00 and
  half at 18:00 local time, so their eclipse seasons fall in June and December and never overlap.
  Racks serving live users carry batteries for the longest eclipse plus 20%. We simulated the
  worst eclipse day alone and combined with every possible outage: no live user goes unserved.
- **"How do the satellites talk to each other and to Earth?"** They don't need to share work:
  one copy of a model fits inside one satellite. Each satellite has 3 laser terminals: one to the
  ground, and two to its neighbours in the same plane so it can relay to a satellite that sees a
  clear-sky ground station. We pay for 16 optical ground stations spread worldwide. At the busiest
  hour, a plane uses about a seventh of its Earth link capacity.
- **"Why not put satellites where they're always in sunlight?"** We checked. Above about 1,400 km,
  a dawn-dusk orbit never enters Earth's shadow (at our 650 km, the longest eclipse is 19.6
  minutes). But eclipses only cost us $0.06B (Design 1) or $0.11B (Design 2) in batteries. The
  higher orbit sits in the inner Van Allen radiation belt, is dearer to reach, and leaves dead
  satellites up for centuries instead of years. The Sun-Earth L1 point is always sunny too, but
  it is a 10-second round trip and priced like the Moon (6x launch cost). So 650 km, half the
  planes on the opposite schedule, plus batteries, is cheaper and safer.

  | Altitude | Eclipses? | Longest eclipse | Extra one-way delay |
  |---|---|---|---|
  | 650 km (ours) | yes, about 95 days a year | 19.6 min | 2.2 ms |
  | 1,000 km | yes | 12.9 min | 3.3 ms |
  | 1,300 km | yes | 5.5 min | 4.3 ms |
  | 1,400 km | never | none | 4.7 ms |
- **"Someone is always awake somewhere. Are there really quiet hours worldwide?"** Yes. Our
  simulation adds up the Americas, Europe/Africa and Asia, each busy in its own afternoon. Most
  people live in Asia and almost nobody over the Pacific, so world demand is below average for
  13 of 24 hours, matching the organizers' figure that the busiest hour is 2.5x the average. Even
  if demand were perfectly flat, Design 1 would cost about the same ($30.08B, within our search's
  ±$0.2B noise): with no peaks, you
  don't buy extra racks for the peak in the first place.
- **"What if demand is 5% higher than the organizers say?"** On a normal day the spare we keep
  for outages absorbs it: at the busiest hour there is at least 8% spare (Design 1) and 11%
  (Design 2). Only a 5% surge *during* an outage would fall short. Guaranteeing that too would
  cost about $1.2B more, which doesn't fit the budget.
- **"What does 500 MW include?"** We count IT power plus cooling, at full power. That's the strict
  reading.
- **"How sure are the numbers?"** Every number the organizers gave is used exactly. Where they
  gave none (local electricity prices, some chip details), we guessed, labeled the guess in
  the code, and stress-tested it.

## Safety rules we tried

Costs below are from when we chose the rule, before batteries, tool sandboxes and communications were
added. With all of those, the final designs cost $29.88B and $29.44B.

| Rule | Design 1 | Design 2 | Decision |
|---|---|---|---|
| None (chip memory filled to 100%) | $28.78B | $28.79B | Too optimistic |
| **Keep 5% of chip memory free** | **$29.05B** | **$29.22B** | ✅ **Used** |
| Keep 10% of chip memory free | $29.86B | $29.95B | Fits, but only $0.05–0.14B to spare |
| Serve 100% at 5% above the organizers' demand, even during an outage | $30.20B | $30.13B | ❌ Over budget |

## Why we don't train AI in space (yet)

Answering questions is the easy first job for orbit: every copy of the model works on its
own, little data flows up and down, and a broken chip just means users move to another copy.
Training needs thousands of chips working as one machine with very fast links. It also
suffers more from radiation errors, and needs petabytes of data sent up. That comes later.

## Things we learned

- Sending easy questions to a smaller AI **does not** save money. The slow part is reading the
  conversation memory, and the small model's memory per word is actually bigger.
- For AI agents, *reading* the question needs as much hardware as *writing* the answer.
- Earth runs out of **power** before it runs out of **money**. That's why orbit matters.
- Unlimited power is not the same as cheap power. Orbit only matches the best Earth sites once
  the satellite gets much lighter, and beats them only with one step more.
- Chips are about 75% of the cost wherever they are, so the chips you pick matter more than
  where you put them.

## Try it yourself (just Python, nothing to install)

```bash
git clone https://github.com/MadhanJ05/Orbital_DataCenter
cd Orbital_DataCenter
python3 twin/score.py designs/final_resilient.json         # check Design 1
python3 twin/score.py designs/whatif_all_orbit_light.json  # check Design 2
python3 twin/simulate.py designs/final_resilient.json designs/whatif_all_orbit_light.json   # a full day, every outage
python3 twin/stress.py                                     # Design 1 with every guess 25% worse
python3 twin/stress.py --light --orbit-only                # Design 2 with every guess 25% worse
python3 twin/today_prices.py                               # both designs with today's published figures (Known limits)
python3 twin/test_calibration.py                           # our model matches the organizers' numbers
python3 twin/check_rules.py                                # every deck rule, both designs, PASS/FAIL
python3 twin/handcheck.py                                  # key numbers redone by hand
python3 twin/export_ui.py                                  # dashboard data -> designs/ui.json; then open dashboard.html (serve the folder, e.g. python3 -m http.server)
```

Technical details, assumptions and the design file format are in [`twin/README.md`](twin/README.md).

## 🖥️ Web app: zoom in on one satellite

The Python twin decides how many megawatts go to orbit. The web app in [`app/`](app/) zooms in on
**one orbital data center**: pick an AI model, a workload (training or inference), a chip and an
orbit, and an animation walks your design through every part of the satellite (compute, power,
cooling, orbit and comms, mass and launch, lifetime, cost) with live numbers, then compares the
cost with the same chips on the ground.

```bash
cd app
npm install
npm run dev    # opens on http://localhost:5173
```

Each part of the satellite is its own folder in `app/src/modules/`, so teammates can work on
different parts at once. Shared numbers (like the $200/kg launch price) live in
[`shared/assumptions.json`](shared/assumptions.json). Details: [`app/README.md`](app/README.md).
