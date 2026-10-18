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

## Our answer: put part of the fleet in orbit

| | |
|---|---|
| 👥 **Users served** | **4.45 billion: 100% of all three groups** |
| 💰 **5-year cost** | **$26.3B, $3.7B under budget** |
| 🌍 **On Earth** | Nordics, Iceland and West Texas: 487 of 500 MW |
| 🛰️ **In orbit** | 264 MW of computers in low Earth orbit (4,745 tonnes launched) |
| ⏱️ **Speed** | Chat starts in 0.19 s (limit 0.6 s); agents in 0.26 s (limit 2 s) |
| ✅ **All rules** | Budget, grid limit, every speed target, cooling rules: all met |

Why orbit and not the Moon or Mars? The Moon is 2.6 s away and Mars 25 minutes, which is too
slow for chat. Orbit is only 40 ms away, about as close as a data center in Virginia.

## The five tricks that made it fit

1. **🌙 Night shift.** Background agents have 4 hours to finish their work. They run in the quiet
   hours of the racks that serve live agents, so we don't buy separate racks for them.
   This one trick saved about $4B.
2. **🧠 Small helpers.** Half of each agent's steps go to a smaller sub-agent model, which is
   about 10x cheaper per step.
3. **⚡ Guess ahead (speculative decoding).** The AI drafts a few words ahead and checks them in
   one go, so every chip writes 2-3x more words.
4. **🔧 The right chip for each job.** "Reading" the question (prefill) runs on GPUs and cheap
   cards. "Writing" the answer (decode) runs on fast-memory LPU chips.
5. **📍 Cheapest power first.** Fill the cheap, cold, clean sites on Earth up to their power
   limits, then put the rest in orbit. Orbit beats Virginia, the Midwest and the Gulf on cost.

## Things we learned

- Sending easy questions to a smaller AI **does not** save money. The slow part is reading the
  conversation memory, and the small model's memory per word is actually bigger.
- For AI agents, *reading* the question needs as much hardware as *writing* the answer.
- Earth runs out of **power** before it runs out of **money**. That's why orbit matters.

## Try it yourself (just Python, nothing to install)

```bash
git clone https://github.com/MadhanJ05/Orbital_DataCenter
cd Orbital_DataCenter
python3 twin/score.py "designs/final_A+B+C.json"   # check our final design
python3 twin/test_calibration.py                   # our model matches the organizers' numbers
```

Technical details, assumptions and the design file format are in [`twin/README.md`](twin/README.md).
