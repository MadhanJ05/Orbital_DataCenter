# Architecture notes

*Status as of 2026-10-18. Competitor claims checked on that date; evidence labels explained below.*

## Three architecture cases

| Case | Description | Status in our work |
|---|---|---|
| **A. Independent compute satellites** | Each satellite carries its own array, radiator, compute and bus. Failures are isolated; no servicing assumed. | **Recommended baseline.** Modeled by `app/` and Madhan's `twin/`. |
| **B. Serviceable docked modules** | Compute modules dock to a shared power/thermal/comms host and can be swapped. | Modeled all-space in `agents-in-orbit/` (case B, $16.7B). Servicing economics are not yet modeled. |
| **C. Integrated solar/compute/radiator panels** | Compute, solar and radiating surface are one tile or panel. | **Research scenario only.** See arXiv 2604.07760; Sophia Space / Caltech tile patent US12679564B2; Starcloud modular patent application WO2026055239A1. We have not re-derived the claims in these documents. |

## Evidence status

Labels: **organizer** (given by the challenge), **demonstrated** (observed in flight or test), **manufacturer_spec**, **published_proposal** (paper or patent, not flown), **team_projection**, **sensitivity** (swept, not believed).

| Number | Value | Label | Note |
|---|---|---|---|
| Launch cost | $200/kg | organizer | Also Google's viability threshold in Suncatcher. |
| 2035 accelerator | 2 kW, 50 PFLOPS FP8 | team_projection | **Not comparable** to NVIDIA NVFP4 figures (different precision, sparsity and dense/peak conventions). |
| Deck mass | 18 t/MW | organizer deck | Madhan's twin default. |
| Team Design 2 | 10.7 t/MW | team_projection | Aggressive; lightweight satellite. |
| App baseline | ~28 t/MW | team_projection | Bottom-up in `app/`; to be updated at integration. |
| Published range | 34-59 t/MW | published_proposal | Conservative range, arXiv 2604.27197. Our 18 and 10.7 sit well below it; the ~28 baseline is also below it. |
| HBM radiation | ~2 krad | demonstrated | Onset of HBM irregularities in a stress test. **Not a failure threshold.** arXiv 2511.19468. |
| TID testing | 15 krad, no TID hard failures | demonstrated | Same source. |
| Dose rate | 150 rad/yr | team_projection | Assumes ~10 mm Al shielding (arXiv 2511.19468 context). Sensitive to orbit and shielding. |
| Optical downlink | 200 Gbps | demonstrated | NASA TBIRD space-to-ground laser demo. |
| Failure rate | 4%/yr x 1.5 in space | sensitivity | Guess; no flight data at this power level. |

## Competitors (checked 2026-10-18)

| Player | Claim | Status | Primary / best source | Caveat |
|---|---|---|---|---|
| **Starcloud** | H100 in orbit Nov 2025; small-model demos | **Verified (secondary only)** | Launched 2 Nov 2025 on SpaceX Bandwagon-4. Dec 10 2025 announcement: nanoGPT trained on Shakespeare, Gemma inference. Coverage via press (e.g. oodaloop, scienceblog); Starcloud's own release not opened. | Gemma was inference only, not trained in orbit. A tiny demo, not evidence of cost or reliability. |
| **Google Suncatcher** | Prototype launched Oct 1 2026; two-satellite networking test 2027 | **Partly verified; wording corrected** | Google X post and press report a single prototype, four TPUs, with Planet on Transporter-18, 1 Oct 2026. Google blog (4 Nov 2025): two prototype satellites with Planet by **early 2027** to validate optical inter-satellite links. | Google's own blog post confirming contact was reported by press, not opened by us. Do not describe the 2026 flight as the networking test. No post-launch results found. |
| **Aetherflux / Cowboy Space** | Rebrand; proposed integrated launch/compute | **Verified** | Via Satellite, 2026-05-11 (rebrand, $275M Series B); Payload; filing for 20,000 satellites. Upper stage as 1 MW data center; first rocket no earlier than end of 2028. | Proposal stage. Near-term satellite is for power-beaming. |
| **Lonestar** | Lunar storage and delay-tolerant networking (DTN) demos | **Partly verified** | Freedom payload (8 TB) flew on Intuitive Machines Athena, launched 26 Feb 2025, landed 6 Mar 2025 on its side; DTN test with Solar System Internet project reported. Sources are secondary press. | The lander died within ~a day; surface operation is Lonestar's own claim. No primary press release opened. |
| **Axiom / Kepler** | Two operational orbital compute nodes with node-to-node and ground comms | **Verified (primary)** | Axiom release dated 2026-10-06: "currently operates two ARCs on orbit"; ARC-to-ARC and ARC-to-ground comms confirmed. | Units are called ARC (Axiom Resilient Compute) here. Exact launch date not confirmed; earlier plans said end of 2025. Performance not stated. |
| **China Three-Body Computing Constellation** | First 12 satellites launched May 2025 | **Verified (secondary)** | 14 May 2025, Long March 2D from Jiuquan; ADA Space and Zhejiang Lab; planned 2,800 satellites. | Reported 5 POPS for the first batch and 1,000 POPS target are operations at unstated precision (likely INT8). Normalize for precision and workload before comparing to FLOPS. A per-satellite 744 TOPS figure conflicts and is unverified. |

## Known limitations / deferred

- Full network and latency percentiles (not just means).
- Correlated optical-weather outages at ground stations.
- Battery state of charge over time in the app (Andrey's model has a one-year simulation).
- Formation geometry and spacing for inter-satellite links.
- Launch cadence and replenishment of failed satellites.
- Servicing economics (case B).
- Monte Carlo uncertainty on failure, radiation and cost.
- Evolving terrestrial baseline (cheaper power, efficiency gains) over 2026-2035.
