import type { Inputs } from './types'

export interface ChipPreset {
  id: string
  label: string
  tdpW: number
  pflops: number // dense FP8
  priceUsd: number
  pricePerHr: number // market rental price assumption
}

// Dense FP8 figures from vendor datasheets; 2035 entry is a team projection.
export const CHIPS: ChipPreset[] = [
  { id: 'h100', label: 'NVIDIA H100 SXM (2023)', tdpW: 700, pflops: 1.98, priceUsd: 25000, pricePerHr: 2.0 },
  { id: 'b200', label: 'NVIDIA B200 (2025)', tdpW: 1000, pflops: 4.5, priceUsd: 35000, pricePerHr: 3.5 },
  { id: 'rubin', label: 'Rubin-class (2026-27, est.)', tdpW: 1800, pflops: 16, priceUsd: 50000, pricePerHr: 6.5 },
  { id: 'gen2035', label: '2035 accelerator (projected)', tdpW: 2000, pflops: 50, priceUsd: 50000, pricePerHr: 9 },
  { id: 'custom', label: 'Custom', tdpW: 1000, pflops: 5, priceUsd: 30000, pricePerHr: 3 },
]

export const BASELINE: Inputs = {
  orbitType: 'sso',
  altitudeKm: 650,
  solarActivity: 1,

  satellites: 81,
  chipsPerSat: 32,
  chipId: 'gen2035',
  chipTdpW: 2000,
  chipPflops: 50,
  chipPriceUsd: 50000,
  serverOverhead: 1.3,
  serverCostMult: 1.6,
  serverKgPerChip: 10,
  sparesPct: 15,
  afrPct: 4,
  radFailMult: 1.5,
  seuOverheadPct: 3,

  doseRateRadYr: 150,
  tidToleranceKrad: 2,

  solarEffPct: 30,
  solarDegPctYr: 1.5,
  solarWPerKg: 200,
  solarCostPerW: 10,
  arrayMarginPct: 20,
  computeInEclipse: true,
  batteryWhPerKg: 300,
  batteryDoDPct: 40,
  batteryCycleLife: 30000,
  batteryCalendarLifeYr: 12,
  batteryCostPerKWh: 500,
  busPowerPct: 5,

  radiatorTempK: 330,
  sinkTempK: 220,
  emissivity: 0.9,
  radiatorKgPerM2: 4,
  radiatorDegPctYr: 0.7,
  twoSidedRadiator: true,

  busFixedKg: 300,
  structurePct: 15,
  ispS: 1500,
  propPct: 4,
  busCostPerKg: 1500,

  linkGbpsPerSat: 100,
  linkAvailPct: 95,

  workload: 'training',
  activeParamsB: 2000,
  mfuPct: 40,
  trainTokensT: 100,
  ioBytesPerToken: 4,

  launchCostPerKg: 200,
  launchPayloadT: 100,
  insurancePct: 5,
  groundCapexM: 50,
  opexFixedMYr: 15,
  opexPerSatMYr: 0.1,
  pricePerChipHr: 9,
  soldPct: 85,
  discountPct: 10,
  missionLifeYr: 6,
  usefulThresholdPct: 70,

  elecPerKWh: 0.09,
  pue: 1.2,
  facilityCapexMPerMW: 12,
  terrestrialLifeYr: 6,
  terrestrialUptimePct: 98,
}

export interface Scenario {
  id: string
  label: string
  blurb: string
  inputs: Inputs
}

export const SCENARIOS: Scenario[] = [
  {
    id: 'baseline',
    label: '2035 SSO training cluster',
    blurb: '81-satellite dawn-dusk cluster at 650 km (Suncatcher-style), near-continuous sun.',
    inputs: BASELINE,
  },
  {
    id: 'bull',
    label: '2035 bull case',
    blurb: 'Starship at $100/kg, mass-produced buses and arrays, longer-lived hardware.',
    inputs: {
      ...BASELINE,
      launchCostPerKg: 100,
      solarCostPerW: 5,
      busCostPerKg: 800,
      afrPct: 3,
      radFailMult: 1.2,
      sparesPct: 20,
      missionLifeYr: 8,
      serverKgPerChip: 8,
      groundCapexM: 30,
    },
  },
  {
    id: 'demo',
    label: 'Near-term demo (1 sat, 2027)',
    blurb: 'Single satellite with 8 H100-class GPUs; proves thermal and radiation design.',
    inputs: {
      ...BASELINE,
      altitudeKm: 550,
      satellites: 1,
      chipsPerSat: 8,
      chipId: 'h100',
      chipTdpW: 700,
      chipPflops: 1.98,
      chipPriceUsd: 25000,
      pricePerChipHr: 2,
      sparesPct: 0,
      serverKgPerChip: 15,
      busFixedKg: 150,
      solarWPerKg: 120,
      solarCostPerW: 80,
      busCostPerKg: 8000,
      launchCostPerKg: 6000,
      launchPayloadT: 0.5,
      groundCapexM: 2,
      opexFixedMYr: 3,
      opexPerSatMYr: 0,
      missionLifeYr: 3,
      workload: 'inference',
      activeParamsB: 70,
      mfuPct: 30,
      ioBytesPerToken: 40,
      linkGbpsPerSat: 10,
    },
  },
  {
    id: 'leo-inference',
    label: 'LEO 53° inference edge',
    blurb: '550 km mid-inclination shell: lower latency, but ~35% of each orbit in shadow.',
    inputs: {
      ...BASELINE,
      orbitType: 'leo',
      altitudeKm: 550,
      doseRateRadYr: 60,
      workload: 'inference',
      activeParamsB: 200,
      mfuPct: 30,
      ioBytesPerToken: 40,
      satellites: 200,
      chipsPerSat: 16,
    },
  },
  {
    id: 'geo',
    label: 'GEO always-on',
    blurb: 'Geostationary: almost no eclipse or drag, but 10x the radiation and ~250 ms latency.',
    inputs: {
      ...BASELINE,
      orbitType: 'geo',
      altitudeKm: 35786,
      doseRateRadYr: 1500,
      launchCostPerKg: 600,
      sinkTempK: 200,
      propPct: 15,
      busFixedKg: 500,
    },
  },
]
