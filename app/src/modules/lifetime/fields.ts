import { num, type Section } from '../../core/fields'

export const lifetimeSections: Section[] = [
  {
    id: 'reliability',
    title: 'Reliability & radiation',
    fields: [
      num('afrPct', 'Annual failure rate (ground)', 0.5, 15, 0.5, '%/yr'),
      num('radFailMult', 'Space failure multiplier', 1, 5, 0.1, 'x', 'Thermal cycling, launch loads, radiation-induced latch-up.'),
      num('doseRateRadYr', 'Dose rate behind shielding', 10, 10000, 10, 'rad/yr', 'SSO 650 km behind ~10 mm Al: ~150 rad/yr. GEO: thousands.', { log: true }),
      num('tidToleranceKrad', 'Accelerator dose tolerance', 0.5, 100, 0.5, 'krad', 'Google tested TPUs: HBM issues from ~2 krad, no hard failures to 15 krad.', { log: true }),
    ],
  },
  {
    id: 'mission',
    title: 'Mission',
    fields: [
      num('missionLifeYr', 'Planned mission life', 1, 20, 0.5, 'yr'),
      num('usefulThresholdPct', 'End-of-life threshold', 10, 95, 1, '% capacity', 'Useful life ends when capacity drops below this.'),
    ],
  },
]
