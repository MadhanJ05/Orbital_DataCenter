import { num, type Section } from '../../core/fields'

export const economicsSections: Section[] = [
  {
    id: 'econ',
    title: 'Costs & revenue',
    fields: [
      num('launchCostPerKg', 'Launch cost to orbit', 20, 20000, 10, '$/kg', 'Google Suncatcher: viable below ~$200/kg (mid-2030s). Track 1 deck: $200/kg.', { log: true }),
      num('busCostPerKg', 'Bus manufacturing cost', 200, 50000, 100, '$/kg', 'Starlink-class mass production ~$1-2k/kg.', { log: true }),
      num('serverCostMult', 'Node cost / accelerator', 1, 3, 0.05, 'x'),
      num('insurancePct', 'Launch & in-orbit insurance', 0, 20, 0.5, '% of capex'),
      num('groundCapexM', 'Ground segment capex', 0, 500, 1, '$M'),
      num('opexFixedMYr', 'Fixed operations', 0, 200, 1, '$M/yr'),
      num('opexPerSatMYr', 'Operations per satellite', 0, 2, 0.01, '$M/yr'),
      num('pricePerChipHr', 'Selling price', 0.5, 50, 0.1, '$/accel-hr'),
      num('soldPct', 'Capacity sold', 10, 100, 1, '%'),
      num('discountPct', 'Discount rate', 0, 25, 0.5, '%'),
    ],
  },
  {
    id: 'terrestrial',
    title: 'Ground data center (comparison)',
    fields: [
      num('elecPerKWh', 'Grid electricity', 0.02, 0.4, 0.005, '$/kWh'),
      num('pue', 'PUE', 1.02, 2, 0.01, ''),
      num('facilityCapexMPerMW', 'Facility capex', 2, 40, 0.5, '$M/MW IT'),
      num('terrestrialLifeYr', 'Hardware life', 2, 12, 1, 'yr'),
      num('terrestrialUptimePct', 'Uptime', 80, 100, 0.5, '%'),
    ],
  },
]
