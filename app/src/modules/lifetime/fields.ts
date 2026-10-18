import { num, type Section } from '../../core/fields'

export const lifetimeSections: Section[] = [
  {
    id: 'reliability',
    title: 'Reliability & radiation',
    fields: [
      num('afrPct', 'Annual failure rate (ground)', 0.5, 15, 0.5, '%/yr'),
      num('radFailMult', 'Space failure multiplier', 1, 5, 0.1, 'x', 'Sensitivity input, not a measured value. Lumps thermal cycling, launch loads and radiation-induced latch-up.'),
      num('doseRateRadYr', 'Dose rate behind shielding', 10, 10000, 10, 'rad/yr', '~150 rad/yr assumes ~650 km SSO behind ~10 mm Al-equivalent shielding (Suncatcher). Thinner shielding means more; GEO is thousands. No shielding geometry is modeled.', { log: true }),
      num('tidOnsetKrad', 'TID degradation onset', 0.5, 50, 0.5, 'krad', 'Sensitivity input. Google Suncatcher saw the first HBM irregularities near ~2 krad; that is not an established failure threshold.', { log: true }),
      num('tidLossPctPerKrad', 'Capacity loss per krad above onset', 0, 30, 0.5, '%/krad', 'Team assumption: gradual derate from memory errors and retired HBM. No measured rate exists.'),
      num('tidHardFailKrad', 'Hard-failure dose', 2, 100, 0.5, 'krad', 'Team assumption. Suncatcher tests reached 15 krad with no hard failures attributed to TID: tested without failure, not a guaranteed safe limit.', { log: true }),
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
