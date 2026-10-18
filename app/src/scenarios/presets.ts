import type { Inputs } from '../core/types'
import { orbitDefaults } from '../modules/orbit/model'
import { computeDefaults } from '../modules/compute/model'
import { powerDefaults } from '../modules/power/model'
import { thermalDefaults } from '../modules/thermal/model'
import { massDefaults } from '../modules/mass/model'
import { commsDefaults } from '../modules/comms/model'
import { lifetimeDefaults } from '../modules/lifetime/model'
import { economicsDefaults } from '../modules/economics/model'

/** Baseline design = every module's defaults. Change a default in its module's model.ts. */
export const BASELINE: Inputs = {
  ...orbitDefaults,
  ...computeDefaults,
  ...powerDefaults,
  ...thermalDefaults,
  ...massDefaults,
  ...commsDefaults,
  ...lifetimeDefaults,
  ...economicsDefaults,
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
      modelId: 'dense70',
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
      modelId: 'kimi',
      activeParamsB: 104,
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
