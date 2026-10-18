import { num, type Section } from '../../core/fields'

export const powerSections: Section[] = [
  {
    id: 'power',
    title: 'Power',
    fields: [
      num('solarEffPct', 'Solar cell efficiency', 15, 45, 0.5, '%'),
      num('solarDegPctYr', 'Array degradation', 0.2, 5, 0.1, '%/yr'),
      num('arrayMarginPct', 'Array oversize margin', 0, 100, 1, '%', 'Extra power at launch to offset degradation.'),
      num('solarWPerKg', 'Array specific power', 50, 500, 5, 'W/kg'),
      num('solarCostPerW', 'Array cost', 1, 200, 1, '$/W', undefined, { log: true }),
      num('busPowerPct', 'Bus power (avionics, comms)', 1, 20, 0.5, '% of IT'),
      { kind: 'bool', key: 'computeInEclipse', label: 'Keep computing during eclipse', help: 'On: batteries carry full load through shadow. Off: compute pauses.' },
      num('batteryWhPerKg', 'Battery specific energy', 100, 600, 10, 'Wh/kg'),
      num('batteryDoDPct', 'Battery depth of discharge', 10, 90, 1, '%'),
      num('batteryCycleLife', 'Battery cycle life', 1000, 100000, 1000, 'cycles', undefined, { log: true }),
      num('batteryCalendarLifeYr', 'Battery calendar life', 3, 25, 1, 'yr'),
      num('batteryCostPerKWh', 'Battery cost', 50, 3000, 10, '$/kWh', undefined, { log: true }),
    ],
  },
]
