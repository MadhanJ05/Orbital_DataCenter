# Demo script (about 5 minutes, no slides)

The organizers allow no slides, so we demo the product itself, and we prove the numbers live.

## Before you go on stage

Open these in this order:

1. **3D twin:** https://madhanj05.github.io/Orbital_DataCenter/twin3d.html (opens on the whole fleet, Design 1, normal day)
2. **A terminal** in the repo folder, with this typed and ready: `python3 twin/prove.py`
   (it runs every check in about 6 seconds and needs no internet)
3. **Backup, if the 3D view doesn't load:** https://madhanj05.github.io/Orbital_DataCenter/explained.html
   (the plain-language explainer). Offline, open `twin.html` from the repo.

## The script

### 1. The problem (30 s): stay on the 3D twin

> "By 2035, 4.45 billion people use AI every day, and AI agents do hours of work for developers.
> The organizers gave us $30 billion for 5 years, only 500 megawatts of Earth's power grid, and
> $200 per kilogram to launch anything into space. Chat has to start answering in 0.6 seconds,
> agents in 2.
>
> The catch: Earth runs out of power before it runs out of money. On Earth alone, the grid is
> full when only 58% of people are served. So we took the data center to orbit."

### 2. Design 1, the safe one (60 s)

Point at the side panel: **$29.88B, 323 MW, 4.45B served.**

> "This is Design 1. Six data centers on Earth, the glowing dots, and 12 rings of satellites.
> They're dawn-dusk orbits along the line between day and night, so they see the Sun almost
> all the time. 84 satellites of 8 megawatts each. It serves all 4.45 billion people for
> $29.88 billion, inside the budget, using only 323 of the 500 megawatts."

**Click "June eclipse".**

> "Twice a year, each orbit dips into Earth's shadow for up to 21 minutes. Half our rings fly at
> 6 am local time and half at 6 pm, so their eclipse seasons are June and December and never
> overlap. Racks serving live users carry batteries."

**Choose "Switch off" → Plane 1.**

> "Now we break something. We switch off a whole ring, during an eclipse. The panel shows the
> result of a full simulated day: every user still served."

**Click "Ride a satellite".**

> "And this is the view from one of our satellites."

### 3. Design 2, our big idea (40 s)

**Click "Design 2", then "One satellite".**

> "Design 2 is our what-if: everything in orbit, zero grid power, $29.44 billion. It needs a
> lighter satellite. The organizers' satellite weighs 18 tonnes per megawatt."

**In "Start from", pick "Design 2 satellite (our 11 t/MW)".** Then drag "Racks, tonnes per MW" back
up to 5 and down again, so people see the satellite and the numbers change.

> "With thin-film solar panels, carbon-fiber radiators and racks stripped down for space, it
> drops to 11 tonnes. At that weight a megawatt in orbit costs about the same as the cheapest
> place on Earth, the Nordics, and one more step makes orbit cheaper. This panel runs the same
> physics as our Python model and checks itself against it every time the page loads."
> (Point at "✓ 12 of 12 reference cases match".)

### 4. Proof: none of these numbers are made up (90 s): switch to the terminal

**Run `python3 twin/prove.py`** and walk down the six sections:

1. > "First, before we trusted our model, we made it reproduce the organizers' own numbers:
   > 960 chat users per chip, 117 agents per chip, $3.6 million to launch a megawatt, orbit
   > breaking even with the Nordics at $95 per kilogram. Ours: 951, 118, $3.6M, $95."
2. > "Every organizer rule, re-checked from the raw design files: 39 of 39 pass for Design 1,
   > 33 of 33 for Design 2."
3. > "Key numbers redone by hand, with plain arithmetic, without our model's code. All 16 match
   > to the last digit, including the $29.88 billion total."
4. > "Full days simulated minute by minute, with users in three time zones: a normal day, every
   > possible outage, the worst eclipse days, and eclipses plus outages. 96 days in total. No
   > live user ever goes unserved, and background jobs always finish inside their deadline."
5. > "And what if our own guesses are wrong? We made each one 25% worse. Design 1 still fits in 9
   > of 16 cases, Design 2 in 10. What breaks it is how good 2035 chips are, and weaker chips
   > would make orbit even more necessary."
6. > "Every input is tagged: 19 straight from the organizers' slides, and every guess labeled as
   > a guess. All of it is open on GitHub."

### 5. What we learned (30 s)

> "Three things surprised us.
> One: unlimited power isn't cheap power. Orbit only matches the best places on Earth once
> satellites get much lighter.
> Two: chips are about two-thirds of the cost wherever they sit, so how you use them matters
> more than where. Letting background agents work in quiet hours saved $4.8 billion.
> Three: some ideas that sound smart don't pay. Running chips hotter, or sending easy questions
> to a smaller AI, both made things worse.
> Earth runs out of power before it runs out of users, and orbit is how you serve everyone."

## Who does what (suggestion)

| Part | Presenter |
|---|---|
| 1. Problem, 5. What we learned | whoever opens and closes |
| 2-3. The 3D twin | one person driving the mouse |
| 4. Proof | one person at the terminal |
| Questions | everyone, using the cheat sheet below |

## Questions cheat sheet

| They ask | We say |
|---|---|
| Are these numbers made up? | Run `python3 twin/prove.py`: the model reproduces the organizers' numbers first, then every rule is re-checked, key numbers are redone by hand, and 96 days are simulated. Every input is tagged with its source. |
| Where do your guesses come from? | Wherever the organizers gave no number (local electricity prices, some chip details), we guessed, labeled it ASSUMED in `twin/catalog.py`, and stress-tested it 25% worse. |
| Why not everything in orbit with the organizers' satellite? | It costs $31.1B, over budget. An orbital megawatt costs $11.2M, against $9.3M in the Nordics. |
| What about eclipses? | Up to 21 minutes per orbit, about 95 days a year. Half the rings at 06:00 and half at 18:00, plus batteries. Simulated alone and with every outage: all OK. |
| A solar storm hitting every satellite? | That's Design 2's worst case, and why Design 1 (with 323 MW on Earth) is our safe entry. |
| How do satellites talk to Earth? | Each one has 3 laser terminals (1 to the ground, 2 to neighbours for relaying), plus 16 optical ground stations: $0.37B, all costed. The busiest ring uses about a seventh of its link capacity. |
| Someone is always awake: are there really quiet hours? | Yes. Most people live in Asia and almost nobody over the Pacific, so world demand is below average 13 hours a day, matching the organizers' 2.5x peak. |
| Why not an orbit that's always sunny? | Above about 1,400 km there are no eclipses, but that's the Van Allen radiation belt, launches cost more, and debris lasts centuries. Batteries cost us only $0.06–0.11B. |
| Why not train AI in space? | Training needs thousands of chips working as one with very fast links. Answering questions is the easy first job: each satellite works on its own. |
| How reliable are the chips in space? | We use the organizers' 95% survival. The radiation dose over 5 years at 650 km (0.75 krad) stays below where Google's tests first saw memory errors (2 krad). |

## If something goes wrong

- **3D view is black or blank:** the network blocked the 3D library. Switch to the explainer link above, or open `twin.html`.
- **No internet at all:** `python3 twin/prove.py` and `python3 twin/score.py designs/final_resilient.json` work offline.
