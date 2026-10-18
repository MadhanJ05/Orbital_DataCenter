# Orbital Data Center: Engineering Spec (v0.1, Sundai Hack)

**Concept.** A 2035 cluster of 81 compute satellites in a 650 km dawn-dusk sun-synchronous orbit (SSO), flying in formation and linked by optical inter-satellite links. Each satellite runs 32 next-gen accelerators on near-continuous sunlight and rejects heat through deployable radiators. There is no in-orbit repair: the design launches spares and lets capacity degrade gracefully. All numbers below come from the digital twin's **"2035 SSO training cluster"** preset and can be changed live in the app.

## 1. Baseline design

| Subsystem | Baseline | Why |
|---|---|---|
| Orbit | 650 km dawn-dusk SSO, 97.6 min period | Rides the day/night line: ~1.5% time in shadow (eclipses only in one ~3-month season, ≤18 min). Low enough for ~24 ms round trip, high enough for low drag |
| Compute | 81 sats × 32 accelerators (+15% cold spares) = 2,592 active; 2 kW, 50 PFLOPS FP8 each (2035 projection) | 130 EFLOPS peak, **~50 EFLOPS delivered** at 40% utilization |
| Power | 87 kW load per sat; 130 kW array at launch (30% cells, 20% margin), 365 m² per sat; 64 kWh battery | Arrays oversized to cover 1.5%/yr degradation; battery carries full load through seasonal eclipses |
| Thermal | 99 m² two-sided radiator per sat at 330 K, ε = 0.9, ~970 W/m² | Radiator flux scales with T⁴, so hotter radiators are much smaller. 330 K leaves ~25 K margin to the chip cold plates |
| Mass | 2.3 t wet per sat: solar 650 kg, radiators 396 kg, compute 370 kg, structure 290 kg; **187 t total, 2 Starship-class launches** | ~28 kg per kW of IT. Solar and radiators, not chips, set the mass |
| Propulsion | Hall thrusters (Isp 1,500 s), 4% propellant; ~15 m/s/yr drag makeup + 111 m/s deorbit reserve | Station-keeping fuel lasts 25+ years; a dead satellite reenters in ~2.4 yr (meets the 5-year disposal rule) |
| Radiation | ~150 rad(Si)/yr behind ~10 mm Al; accelerators tolerate ~2 krad | Total-dose life ~13 yr. Soft errors cost ~3% of compute (detection, checkpointing, replay) |
| Comms | 100 Gbps optical ground link per sat via relay | Training needs <0.1 Gbps of data; inference is the bandwidth-sensitive case |

## 2. Lifetime and infrastructure model

The twin steps month by month over 25 years. Delivered capacity = min(working accelerators, solar power headroom, radiator headroom) × eclipse availability × link cap. Useful life ends when capacity falls below 70%.

| Subsystem | Life to 70% | Driver |
|---|---|---|
| **Accelerators** | **7.4 yr (limiting)** | 4%/yr ground failure rate × 1.5 in space, offset by 15% spares |
| Radiation dose | 13.3 yr | 150 rad/yr vs 2 krad tolerance |
| Batteries | 12 yr | Calendar-limited (SSO has few eclipse cycles) |
| Solar arrays, radiators, propellant | 25+ yr | Margins exceed degradation |

**Engineering takeaway:** chips die first. More spares, and accelerators hardened for space (lower failure rate, higher dose tolerance), extend life more than anything else.

## 3. Economics (6-year mission, 10% discount rate)

| Metric | Orbital baseline | Ground (same chips) | Orbital bull case* |
|---|---|---|---|
| Capex | $580M (41% compute, 21% bus/radiators, 18% solar, 6% launch) | $288M | $439M |
| Cost per accelerator-hour (levelized) | **$7.24** | $3.76 | $4.71 |
| NPV at $9/accelerator-hour, 85% sold | +$39M, payback 4.2 yr | — | +$354M, payback 3.1 yr |

*Bull case: $100/kg launch, $5/W solar, $800/kg bus, 3% failure rate, 20% spares, 8-year mission.

**Where orbit wins:** no grid hookup, no land or permits, near-continuous solar power, and fast scale-up limited only by launch cadence. In 2035 grid power and permitting may be the real bottleneck, which isn't captured in the ground price used here. **Where orbit loses:** hardware can't be repaired, and dedicated power and thermal hardware costs ~$0.50/kWh vs ~$0.11/kWh from the grid. Sensitivity analysis ranks mission life, accelerator price, bus manufacturing cost and solar cost as the biggest levers. At ≤$200/kg, launch is a minor factor.

## 4. Key risks and open questions
1. **Failure rate in orbit:** no fleet data yet for high-power accelerators in space. A demo satellite (the "Near-term demo" preset) is the first milestone.
2. **Formation-flying optical interconnect** at Tbps between satellites is needed for training; it isn't modeled here beyond ground-link capacity.
3. **Thermal:** pumped-loop radiators at ~100 m² per satellite need deployment and micrometeoroid-damage tolerance.
4. **Debris and space traffic:** large arrays mean high drag area; deorbit reserve and passive reentry under 5 years are built in.
5. **GEO is not viable** with today's chips: ~1,500 rad/yr exceeds the dose tolerance in ~1.3 years (see the GEO preset).

## 5. Model assumptions and sources
- Orbit and eclipse geometry: circular-orbit shadow formula. SSO modeled as ~1.5% orbit-average shadow. Radiator sizing: Stefan–Boltzmann with a 10% margin.
- Atmosphere: exponential density model (Vallado, *Fundamentals of Astrodynamics*, Table 8-4), × solar-activity factor.
- Google Research, *Project Suncatcher* (Nov 2025): 650 km dawn-dusk SSO cluster concept; Trillium TPU radiation test (HBM issues from ~2 krad(Si), no hard failures to 15 krad); launch below ~$200/kg by the mid-2030s as the viability threshold.
- Starcloud: launched an NVIDIA H100 to orbit in Nov 2025 (near-term demo reference).
- NVIDIA H100/B200 datasheets for TDP and dense FP8 throughput. The 2035 accelerator is a team projection.
- Workload: training compute = 6 × parameters × tokens; inference = 2 × active parameters per token.
- Ground comparison: $12M/MW IT facility capex, $0.09/kWh, PUE 1.2, 98% uptime, 6-year hardware life.

*Limitations:* steady-state power and thermal model (no thermal transients within an orbit), and one-input-at-a-time sensitivity rather than Monte Carlo. Revenue assumes a flat price.
