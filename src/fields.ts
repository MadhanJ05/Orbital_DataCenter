import type { Inputs } from './sim/types'

export interface NumField {
  kind: 'num'
  key: keyof Inputs
  label: string
  unit?: string
  min: number
  max: number
  step: number
  help?: string
  log?: boolean
  hideFor?: (i: Inputs) => boolean
}
export interface BoolField {
  kind: 'bool'
  key: keyof Inputs
  label: string
  help?: string
}
export interface SelectField {
  kind: 'select'
  key: keyof Inputs
  label: string
  options: { value: string; label: string }[]
  help?: string
}
export type Field = NumField | BoolField | SelectField

export interface Section {
  id: string
  title: string
  fields: Field[]
}

const n = (key: keyof Inputs, label: string, min: number, max: number, step: number, unit?: string, help?: string, extra: Partial<NumField> = {}): NumField =>
  ({ kind: 'num', key, label, min, max, step, unit, help, ...extra })

export const SECTIONS: Section[] = [
  {
    id: 'workload',
    title: 'Workload & model',
    fields: [
      { kind: 'select', key: 'workload', label: 'Workload', options: [{ value: 'training', label: 'Training' }, { value: 'inference', label: 'Inference' }] },
      { kind: 'select', key: 'modelId', label: 'AI model', options: [] }, // filled from MODELS in the UI
      n('activeParamsB', 'Active parameters', 1, 20000, 1, 'B', 'Parameters touched per token (for MoE, the active experts only).', { log: true }),
      n('trainTokensT', 'Training tokens', 1, 1000, 1, 'T', 'Total training-set tokens. Compute = 6 x params x tokens.', { hideFor: (i) => i.workload !== 'training' }),
      n('mfuPct', 'Utilization (MFU)', 5, 80, 1, '%', 'Achieved share of peak FLOPS. Training ~35-50%, decode-heavy inference ~20-35%.'),
      n('ioBytesPerToken', 'Ground-link bytes per token', 1, 500, 1, 'B', 'Data moved to/from Earth per processed token (prompts, data, results).'),
    ],
  },
  {
    id: 'compute',
    title: 'Compute hardware',
    fields: [
      { kind: 'select', key: 'chipId', label: 'Accelerator', options: [] }, // filled from CHIPS in the UI
      n('chipTdpW', 'Accelerator TDP', 200, 4000, 50, 'W'),
      n('chipPflops', 'Dense FP8 per accelerator', 0.5, 200, 0.5, 'PFLOPS'),
      n('chipPriceUsd', 'Accelerator price', 5000, 150000, 1000, '$'),
      n('serverOverhead', 'Node power / TDP', 1, 2, 0.05, 'x', 'CPU, memory, NICs and pumps on top of the accelerator.'),
      n('serverCostMult', 'Node cost / accelerator', 1, 3, 0.05, 'x'),
      n('serverKgPerChip', 'Node mass per accelerator', 2, 40, 0.5, 'kg', 'Board, cold plate, local radiation shielding.'),
      n('sparesPct', 'Cold spares', 0, 50, 1, '%', 'Extra accelerators launched unpowered; switched in as others fail.'),
      n('afrPct', 'Annual failure rate (ground)', 0.5, 15, 0.5, '%/yr'),
      n('radFailMult', 'Space failure multiplier', 1, 5, 0.1, 'x', 'Thermal cycling, launch loads, radiation-induced latch-up.'),
      n('seuOverheadPct', 'Soft-error overhead', 0, 20, 0.5, '%', 'Compute lost to error detection, checkpointing and replay.'),
    ],
  },
  {
    id: 'constellation',
    title: 'Constellation & orbit',
    fields: [
      { kind: 'select', key: 'orbitType', label: 'Orbit', options: [{ value: 'sso', label: 'Dawn-dusk sun-synchronous' }, { value: 'leo', label: 'LEO mid-inclination' }, { value: 'geo', label: 'Geostationary' }] },
      n('altitudeKm', 'Altitude', 350, 2000, 10, 'km', undefined, { hideFor: (i) => i.orbitType === 'geo' }),
      n('satellites', 'Satellites', 1, 2000, 1, '', undefined, { log: true }),
      n('chipsPerSat', 'Accelerators per satellite', 1, 512, 1, '', undefined, { log: true }),
      n('solarActivity', 'Solar activity (drag)', 0.3, 4, 0.1, 'x', '1 = moderate; 2-3 = solar maximum. Scales atmospheric density.'),
      n('linkGbpsPerSat', 'Ground link per satellite', 1, 1000, 1, 'Gbps', 'Optical downlink or relay through a laser mesh.', { log: true }),
      n('linkAvailPct', 'Link availability', 20, 100, 1, '%'),
    ],
  },
  {
    id: 'radiation',
    title: 'Radiation',
    fields: [
      n('doseRateRadYr', 'Dose rate behind shielding', 10, 10000, 10, 'rad/yr', 'SSO 650 km behind ~10 mm Al: ~150 rad/yr. GEO: thousands.', { log: true }),
      n('tidToleranceKrad', 'Accelerator dose tolerance', 0.5, 100, 0.5, 'krad', 'Google tested TPUs: HBM issues from ~2 krad, no hard failures to 15 krad.', { log: true }),
    ],
  },
  {
    id: 'power',
    title: 'Power',
    fields: [
      n('solarEffPct', 'Solar cell efficiency', 15, 45, 0.5, '%'),
      n('solarDegPctYr', 'Array degradation', 0.2, 5, 0.1, '%/yr'),
      n('arrayMarginPct', 'Array oversize margin', 0, 100, 1, '%', 'Extra power at launch to offset degradation.'),
      n('solarWPerKg', 'Array specific power', 50, 500, 5, 'W/kg'),
      n('solarCostPerW', 'Array cost', 1, 200, 1, '$/W', undefined, { log: true }),
      n('busPowerPct', 'Bus power (avionics, comms)', 1, 20, 0.5, '% of IT'),
      { kind: 'bool', key: 'computeInEclipse', label: 'Keep computing during eclipse', help: 'On: batteries carry full load through shadow. Off: compute pauses.' },
      n('batteryWhPerKg', 'Battery specific energy', 100, 600, 10, 'Wh/kg'),
      n('batteryDoDPct', 'Battery depth of discharge', 10, 90, 1, '%'),
      n('batteryCycleLife', 'Battery cycle life', 1000, 100000, 1000, 'cycles', undefined, { log: true }),
      n('batteryCalendarLifeYr', 'Battery calendar life', 3, 25, 1, 'yr'),
      n('batteryCostPerKWh', 'Battery cost', 50, 3000, 10, '$/kWh', undefined, { log: true }),
    ],
  },
  {
    id: 'thermal',
    title: 'Thermal',
    fields: [
      n('radiatorTempK', 'Radiator temperature', 250, 450, 1, 'K', 'Hotter radiators shrink fast (T^4) but chips run hotter.'),
      n('sinkTempK', 'Effective sink temperature', 3, 280, 1, 'K', 'Deep space ~3 K; Earth IR and albedo raise it in LEO.'),
      n('emissivity', 'Coating emissivity', 0.5, 0.98, 0.01, ''),
      { kind: 'bool', key: 'twoSidedRadiator', label: 'Two-sided radiator (edge-on to Sun)' },
      n('radiatorKgPerM2', 'Radiator areal mass', 1, 15, 0.5, 'kg/m²'),
      n('radiatorDegPctYr', 'Radiator performance loss', 0, 5, 0.1, '%/yr', 'Coating darkening and micrometeoroid damage.'),
    ],
  },
  {
    id: 'bus',
    title: 'Bus & propulsion',
    fields: [
      n('busFixedKg', 'Avionics, ADCS, comms mass', 20, 2000, 10, 'kg', undefined, { log: true }),
      n('structurePct', 'Structure fraction', 5, 40, 1, '%'),
      n('propPct', 'Propellant fraction (wet)', 0.5, 40, 0.5, '%'),
      n('ispS', 'Thruster Isp', 200, 4000, 50, 's', 'Hall thrusters ~1,500 s; chemical ~300 s.'),
      n('busCostPerKg', 'Bus manufacturing cost', 200, 50000, 100, '$/kg', 'Starlink-class mass production ~$1-2k/kg.', { log: true }),
    ],
  },
  {
    id: 'econ',
    title: 'Launch & economics',
    fields: [
      n('launchCostPerKg', 'Launch cost to orbit', 20, 20000, 10, '$/kg', 'Google Suncatcher: viable below ~$200/kg (mid-2030s).', { log: true }),
      n('launchPayloadT', 'Payload per launch', 0.5, 200, 0.5, 't'),
      n('insurancePct', 'Launch & in-orbit insurance', 0, 20, 0.5, '% of capex'),
      n('groundCapexM', 'Ground segment capex', 0, 500, 1, '$M'),
      n('opexFixedMYr', 'Fixed operations', 0, 200, 1, '$M/yr'),
      n('opexPerSatMYr', 'Operations per satellite', 0, 2, 0.01, '$M/yr'),
      n('pricePerChipHr', 'Selling price', 0.5, 50, 0.1, '$/accel-hr'),
      n('soldPct', 'Capacity sold', 10, 100, 1, '%'),
      n('discountPct', 'Discount rate', 0, 25, 0.5, '%'),
      n('missionLifeYr', 'Planned mission life', 1, 20, 0.5, 'yr'),
      n('usefulThresholdPct', 'End-of-life threshold', 10, 95, 1, '% capacity', 'Useful life ends when capacity drops below this.'),
    ],
  },
  {
    id: 'terrestrial',
    title: 'Terrestrial comparison',
    fields: [
      n('elecPerKWh', 'Grid electricity', 0.02, 0.4, 0.005, '$/kWh'),
      n('pue', 'PUE', 1.02, 2, 0.01, ''),
      n('facilityCapexMPerMW', 'Facility capex', 2, 40, 0.5, '$M/MW IT'),
      n('terrestrialLifeYr', 'Hardware life', 2, 12, 1, 'yr'),
      n('terrestrialUptimePct', 'Uptime', 80, 100, 0.5, '%'),
    ],
  },
]
