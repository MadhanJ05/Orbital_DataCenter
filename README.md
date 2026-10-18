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

## Our answer: part of the fleet in orbit, with nothing that can fail alone

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

## Our what-if: make the satellite lighter (the 18-tonne problem)

The organizers' orbital megawatt weighs 18 tonnes. Lighter solar panels, carbon-fiber
radiators and racks stripped down for space bring it to **10.7 tonnes**. Then orbit becomes
**cheaper than the cheapest place on Earth**, and the same failure-proof fleet costs
**$28.7B** (`designs/whatif_resilient_light.json`).

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
python3 twin/score.py designs/final_resilient.json   # check our final design
python3 twin/test_calibration.py                   # our model matches the organizers' numbers
```

Technical details, assumptions and the design file format are in [`twin/README.md`](twin/README.md).
