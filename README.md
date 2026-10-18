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
| 💰 Budget ($30B) | ✅ $29.73B | ✅ $29.80B |
| ⚡ Earth grid (500 MW) | ✅ 449 MW | ✅ 0 MW |
| 🚀 Launch ($200/kg) | ✅ 9,727 t = $1.95B | ✅ 10,984 t = $2.20B |
| ⏱️ Speed (chat 0.6 s, agents 2 s) | ✅ 0.23 s / 0.23 s | ✅ 0.12 s / 0.11 s |
| 👥 Users served | ✅ 100% of 4.45 billion | ✅ 100% of 4.45 billion |
| 🛡️ Lose any one site or plane | ✅ still 100% served | ✅ still 100% served |
| File | `designs/final_resilient.json` | `designs/whatif_all_orbit_light.json` |

**Design 1 is our entry and the safest.** It uses the organizers' numbers exactly, and it mixes
Earth and orbit, which fail for different reasons (grid outages vs solar storms). **Design 2 is our
idea:** the organizers invite each team to change one assumption, and ours is the satellite's
weight. With a 10.7-tonne satellite, the entire fleet can leave Earth's grid and still fit the
budget. Design 2 is also faster, because orbit is only 40 ms from everyone.

**The honest trade-off:** Design 2 has less money to spare ($0.2B), and it depends on one kind of
place (orbit), so a big solar storm hitting every plane at once is its worst case.

### Design 1 in detail

| | |
|---|---|
| 👥 **Users served** | **4.45 billion: 100% of all three groups** |
| 💰 **5-year cost** | **$29.7B, under the $30B budget** |
| 🌍 **On Earth** | All 6 sites (Nordics, Iceland, West Texas, Virginia, Midwest, Gulf): 449 of 500 MW |
| 🛰️ **In orbit** | 8 separate orbital planes, 68 MW each (9,727 tonnes launched) |
| 🛡️ **Failure test** | Lose **any one** Earth site or orbital plane: **still 100% of users served** |
| ⏱️ **Speed** | Chat starts in 0.23 s (limit 0.6 s); agents in 0.23 s (limit 2 s) |
| ✅ **All rules** | Budget, grid limit, every speed target, cooling rules: all met |

**Why 8 planes and 6 Earth sites?** If everything sat in one place, one outage would take
down everyone. We spread the fleet so no single site or plane holds more than about 1/12 of
it, and carry just enough spare capacity that losing any one is a non-event. That insurance
costs about $3.4B. Without it the same fleet is $26.3B (`designs/final_A+B+C.json`).

Why orbit and not the Moon or Mars? The Moon is 2.6 s away and Mars 25 minutes, which is too
slow for chat. Orbit is only 40 ms away, about as close as a data center in Virginia.

## The five tricks that made it fit

1. **🌙 Night shift.** Background agents have 4 hours to finish their work. They run in the quiet
   hours of the racks that serve live agents, so we don't buy separate racks for them.
   This one trick saved about $4B. We checked it with a minute-by-minute simulation of a full
   day: the longest any background job waits is 35 minutes (58 minutes even with a site down),
   well inside its 4-hour deadline.
2. **🧠 Small helpers.** Half of each agent's steps go to a smaller sub-agent model, which is
   about 10x cheaper per step.
3. **⚡ Guess ahead (speculative decoding).** The AI drafts a few words ahead and checks them in
   one go, so every chip writes 2-3x more words.
4. **🔧 The right chip for each job.** "Reading" the question (prefill) runs on GPUs and cheap
   cards. "Writing" the answer (decode) runs on fast-memory LPU chips.
5. **📍 Many small zones, not one big one.** Spread over every Earth site and 8 orbital planes,
   so the spare capacity we need for an outage stays small.

## Design 2: make the satellite lighter (the 18-tonne problem)

The organizers' orbital megawatt weighs 18 tonnes. Lighter solar panels, carbon-fiber
radiators and racks stripped down for space bring it to **10.7 tonnes**. Then orbit becomes
**cheaper than the cheapest place on Earth**, and the whole fleet fits in orbit, with no
Earth grid, for **$29.8B** (`designs/whatif_all_orbit_light.json`). Kept as a mix of Earth and
orbit, the lighter satellite would cost $28.7B (`designs/whatif_resilient_light.json`).

## What if our guesses are wrong?

The organizers didn't give every number (for example local electricity prices), so we guessed
some. We made each of our 15 guesses 25% worse, one at a time:

- **Prices, carbon and site power limits hardly matter**: under $0.2B each.
- **Design 1 still fits in 10 of 15 cases; Design 2 in 11 of 15.** Five of the guesses are about
  Earth sites, so they don't affect Design 2 at all. What hurts Design 2 most is the price of
  solar panels and radiators.
- The two that break both designs are about **how good 2035 chips are** (compute speed, and
  how often the AI's drafted words are right). Weaker chips mean every team needs more of
  them, which makes Earth's power limit tighter and orbit *more* necessary.

## Why we don't train AI in space (yet)

Answering questions is the easy first job for orbit: every copy of the model works on its
own, little data flows up and down, and a broken chip just means users move to another copy.
Training needs thousands of chips working as one machine with very fast links. It also
suffers more from radiation errors, and needs petabytes of data sent up. That comes later.

Surprise: running chips *hotter* to shrink the radiators doesn't pay. Hot chips leak power,
and in space every extra watt needs more solar panels.

## Things we learned

- Sending easy questions to a smaller AI **does not** save money. The slow part is reading the
  conversation memory, and the small model's memory per word is actually bigger.
- For AI agents, *reading* the question needs as much hardware as *writing* the answer.
- Earth runs out of **power** before it runs out of **money**. That's why orbit matters.

## Try it yourself (just Python, nothing to install)

```bash
git clone https://github.com/MadhanJ05/Orbital_DataCenter
cd Orbital_DataCenter
python3 twin/score.py designs/final_resilient.json   # check Design 1
python3 twin/simulate.py                             # a full day, minute by minute, every outage
python3 twin/stress.py --light --orbit-only          # Design 2 with every guess 25% worse
python3 twin/test_calibration.py                   # our model matches the organizers' numbers
```

Technical details, assumptions and the design file format are in [`twin/README.md`](twin/README.md).
