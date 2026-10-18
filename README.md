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

## Our answer: two designs

| | 🏁 **Design 1: the safest (Earth + orbit)** | 💡 **Design 2: our what-if (all orbit)** |
|---|---|---|
| What it is | The organizers' catalog exactly as given (18-tonne satellite), 6 Earth sites + 8 orbital planes | Our lighter satellite (10.7 tonnes); the whole fleet in 8 orbital planes, no Earth grid at all |
| 💰 Budget ($30B) | ✅ $28.78B | ✅ $28.79B |
| ⚡ Earth grid (500 MW) | ✅ 435 MW | ✅ 0 MW |
| 🚀 Launch ($200/kg) | ✅ 9,442 t = $1.89B | ✅ 10,660 t = $2.13B |
| ⏱️ Speed (chat 0.6 s, agents 2 s) | ✅ 0.24 s / 0.25 s | ✅ 0.13 s / 0.12 s |
| 👥 Users served | ✅ 100% of 4.45 billion | ✅ 100% of 4.45 billion |
| 🛡️ Lose any one site or plane | ✅ still 100% served | ✅ still 100% served |
| File | `designs/final_resilient.json` | `designs/whatif_all_orbit_light.json` |

**Design 1 is our entry and the safest.** It uses the organizers' numbers exactly, and it mixes
Earth and orbit, which fail for different reasons (grid outages vs solar storms). **Design 2 is our
idea:** the organizers invite each team to change one assumption, and ours is the satellite's
weight. With a 10.7-tonne satellite, the entire fleet can leave Earth's grid and still fit the
budget. Design 2 is also faster, because orbit is only 40 ms from everyone.

**The trade-off:** the two cost about the same (both about $1.2B under budget), but Design 2
depends on one kind of place (orbit), so a big solar storm hitting every plane at once is its
worst case. Design 1 mixes two kinds of place that fail for different reasons.

## Design 1: the safest (Earth + orbit)

- 🌍 **Earth:** all 6 sites (Nordics, Iceland, West Texas, Virginia, Midwest, Gulf), 435 of 500 MW
- 🛰️ **Orbit:** 8 separate orbital planes of 66 MW each, 9,442 tonnes launched
- 💰 **$28.78B:** chips $19.4B, buildings $3.2B, satellite hardware $3.2B, launch $1.9B, power and carbon $1.0B, agent memory store $0.2B

**Why not put everything in orbit?** Space has unlimited power, but with the organizers'
18-tonne satellite, an orbital megawatt costs about $11.2M over 5 years, against $9.3M in the
Nordics. So we use Earth where it's cheap, and orbit where Earth runs out. All-orbit with this
satellite would cost $30.6B, over budget.

**Why 8 planes and 6 Earth sites?** If everything sat in one place, one outage would take
down everyone. We spread the fleet so no single site or plane holds more than about 1/12 of
it, and carry just enough spare capacity that losing any one is a non-event. That insurance
costs about $2.1B. Without it the fleet is $26.6B, but losing one site would leave 36% of users
without service (`designs/final_A+B+C.json`).

Why orbit and not the Moon or Mars? The Moon is 2.6 s away and Mars 25 minutes, which is too
slow for chat. Orbit is only 40 ms away, about as close as a data center in Virginia.

## The five tricks that made it fit

1. **🌙 Night shift.** Background agents have 4 hours to finish their work. They run in the quiet
   hours of the racks that serve live agents, so we don't buy separate racks for them.
   This one trick saves about $4.9B. We checked it with a minute-by-minute simulation of a full
   day: the longest any background job waits is 50 minutes in Design 1 and 32 minutes in
   Design 2 (under 1.5 hours even with a site down), well inside the 4-hour deadline.
2. **🧠 Small helpers.** Half of each agent's steps go to a smaller sub-agent model, which is
   about 10x cheaper per step.
3. **⚡ Guess ahead (speculative decoding).** The AI drafts a few words ahead and checks them in
   one go, so every chip writes 2-3x more words.
4. **🔧 The right chip for each job.** "Reading" the question (prefill) runs on cheap "air cards".
   "Writing" the answer (decode) runs on fast-memory LPU chips.
5. **📍 Many small zones, not one big one.** Spread over every Earth site and 8 orbital planes,
   so the spare capacity we need for an outage stays small.

## Design 2: all orbit, with a lighter satellite (the 18-tonne problem)

- 🛰️ **Orbit only:** 8 orbital planes of 124 MW each, 10,660 tonnes launched, **0 MW of Earth grid**
- 💰 **$28.79B:** chips $20.9B, satellite hardware $5.5B, launch $2.1B, agent memory store $0.3B
- ⏱️ **Faster:** chat starts in 0.13 s, because orbit is only 40 ms from everyone

The organizers' orbital megawatt weighs 18 tonnes. Lighter solar panels, carbon-fiber
radiators and racks stripped down for space bring it to **10.7 tonnes**. Then orbit becomes
**cheaper than the cheapest place on Earth**, and the whole fleet fits in orbit, with no
Earth grid, for **$28.8B** (`designs/whatif_all_orbit_light.json`). Kept as a mix of Earth and
orbit, the lighter satellite would cost $27.8B (`designs/whatif_resilient_light.json`).

| Satellite upgrade (each step adds to the one before) | Tonnes per MW | Cost per MW in orbit |
|---|---|---|
| Organizers' satellite | 18.0 | $11.18M |
| Thin-film solar panels (500 W/kg) | 15.1 | $10.29M |
| Carbon-fiber radiators (2 kg/m²) | 12.7 | $9.63M |
| **Racks stripped down for space** | **10.7** | **$9.24M**, below the Nordics ($9.29M) |

Surprise: running chips *hotter* to shrink the radiators doesn't pay. Hot chips leak power,
and in space every extra watt needs more solar panels.

## What if our guesses are wrong?

The organizers didn't give every number (for example local electricity prices), so we guessed
some. We made each of our 16 guesses 25% worse, one at a time:

- **Prices, carbon and site power limits hardly matter**: under $0.2B each.
- **Design 1 still fits in 13 of 16 cases; Design 2 in 12 of 16.** Five of the guesses are about
  Earth sites, so they don't affect Design 2 at all. Design 2 is the more sensitive one to the
  price of solar panels and radiators (25% dearer puts it $0.1B over budget).
- The two that break both designs are about **how good 2035 chips are** (compute speed, and
  how often the AI's drafted words are right). Weaker chips mean every team needs more of
  them, which makes Earth's power limit tighter and orbit *more* necessary.

## How we checked it

| Check | What it does | Result |
|---|---|---|
| 🎯 Matches the organizers | Our model reproduces the deck's own numbers: 960 chat users per chip, 117 agents per chip, $3.6M to launch a megawatt, orbit breaking even with the Nordics at $95/kg | 11 of 11 tests pass |
| 📋 Every rule, one by one | Budget, grid, launch, chip and cooling rules, every speed target, users served, outages. Each is recalculated from the raw design | Design 1: 36 of 36. Design 2: 30 of 30 |
| 🕐 A full day, minute by minute | Users in 3 time zones, live users first, background jobs fill the gaps. Run on a normal day and once per possible outage | No live user ever waits. Longest background wait: 87 min (limit 228) |
| 🔥 What if our guesses are wrong | Each guessed number made 25% worse | Design 1 fits 13 of 16, Design 2 fits 12 of 16 |
| 🧮 Hand calculation | 15 key numbers for Design 1 (demand, users per chip, first-reply time, one site's bill, launch, outage spare) redone with plain arithmetic, without our code | All match exactly |
| 🔍 Code review | We read the model line by line and fixed 4 bugs that made designs look better than they were | Both designs re-optimized after the fixes and still pass |

**Energy per answer:** a chat reply uses about **0.054 Wh** in both designs, and a full AI-agent
task (80 steps) about **6.7 Wh**. For comparison, Google reported 0.24 Wh for a typical
Gemini prompt in 2025.

## Questions a judge might ask

- **"Air cards are air-cooled. How do they work in space?"** In orbit every rack, air cards
  included, is cooled through radiators. If air cards aren't allowed in space, GPUs can do the
  reading instead. Design 1 then costs $29.70B and Design 2 $29.14B, so both still fit.
- **"Why not put everything in orbit with the organizers' satellite?"** It would cost $30.6B,
  over budget. An orbital megawatt costs $11.2M against $9.3M in the Nordics, so Earth is still
  cheaper where it's available.
- **"What if a solar storm hits every satellite at once?"** That's Design 2's worst case, and why
  Design 1 is our entry: it keeps 435 MW on Earth, which fails for different reasons.
- **"What does 500 MW include?"** We count IT power plus cooling, at full power. That's the strict
  reading.
- **"How sure are the numbers?"** Every number the organizers gave is used exactly. Where they
  gave none (local electricity prices, some chip details), we guessed, labeled the guess in
  the code, and stress-tested it.

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
- Unlimited power is not the same as cheap power. Orbit only beats the best Earth sites once
  the satellite gets lighter.
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
