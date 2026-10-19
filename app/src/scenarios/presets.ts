import type { Inputs } from '../core/types'
import assumptions from '../../../shared/assumptions.json'
import { orbitDefaults, runOrbit } from '../modules/orbit/model'
import { computeDefaults, runCompute } from '../modules/compute/model'
import { powerDefaults, runPower, solarWPerKgFor } from '../modules/power/model'
import { radiatorKgPerM2For, runThermal, thermalDefaults } from '../modules/thermal/model'
import { massDefaults, structurePctFor, type MassSplit } from '../modules/mass/model'
import { commsDefaults } from '../modules/comms/model'
import { lifetimeDefaults } from '../modules/lifetime/model'
import { economicsDefaults } from '../modules/economics/model'
import { chipPatch, modelPatch, workloadPatch } from '../modules/compute/presets'

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

/**
 * Sets the per-part densities (node kg, array W/kg, radiator kg/m², structure %) so each line of a
 * published mass split comes out exactly: compute = nodes incl. spares, solar = arrays + batteries,
 * radiators, structure = structure + fixed bus. Propellant is extra (the split is dry mass).
 */
function matchMassSplit(i: Inputs, split: MassSplit): Inputs {
  const orbit = runOrbit(i)
  const compute = runCompute(i)
  const power = runPower(i, orbit, compute.itWPerSat)
  const thermal = runThermal(i, power.loadW)
  const kg = (tPerMw: number) => tPerMw * compute.itWPerSat / 1000 // t/MW = kg/kW
  const computeKg = kg(split.compute), solarKg = kg(split.solar), radiatorKg = kg(split.radiators)
  return {
    ...i,
    serverKgPerChip: computeKg / compute.chipsPerSatProv,
    solarWPerKg: solarWPerKgFor(solarKg, power),
    radiatorKgPerM2: radiatorKgPerM2For(radiatorKg, thermal),
    structurePct: structurePctFor(kg(split.structure), computeKg + solarKg + radiatorKg + i.busFixedKg, i.busFixedKg),
  }
}

// Deck-style fleet: the same 2,592 accelerators on 8 MW-class satellites (fixed bus mass fits inside
// the deck's structure line), compute pausing in the short dawn-dusk eclipse season (no battery line).
const MW_CLASS: Inputs = { ...BASELINE, satellites: 8, chipsPerSat: 324, computeInEclipse: false }
const SPLITS = assumptions.mass_t_per_mw

export interface Scenario {
  id: string
  label: string
  blurb: string
  inputs: Inputs
}

export const SCENARIOS: Scenario[] = [
  {
    id: 'baseline',
    label: '2035 SSO cluster: interactive agents',
    blurb: "81-satellite dawn-dusk cluster at 650 km on the deck's 2035 GPU, serving Kimi K3 interactive agent steps (256k context, 2 s first token, 100 tok/s, 80 steps in 25 min).",
    inputs: BASELINE,
  },
  {
    id: 'chat',
    label: 'Chat prompts (Qwen3.5-397B)',
    blurb: 'Same cluster serving chat: 64k context (56k cached), 3,500 tokens out, first token in 0.6 s, 60 tok/s.',
    inputs: { ...BASELINE, ...workloadPatch('chat') },
  },
  {
    id: 'background',
    label: 'Background agents (Kimi K3)',
    blurb: 'Same cluster running background agent steps: 10 s first token, 30 tok/s, 80 steps within 4 hours, sandbox next door (no user round trip).',
    inputs: { ...BASELINE, ...workloadPatch('agent_bg') },
  },
  {
    id: 'deck',
    label: 'Deck 18 t/MW',
    blurb: "The organizers' orbital megawatt: compute 5 t, solar 5, radiators 4, structure 4 (dry). Same as Design 1 in the Python fleet twin.",
    inputs: matchMassSplit(MW_CLASS, SPLITS.deck),
  },
  {
    id: 'light',
    label: 'Design 2 light (10.7 t/MW)',
    blurb: 'Our lighter megawatt: thin-film solar, carbon-fiber radiators, space-stripped racks, cooler chips. Same as Design 2 in the Python fleet twin.',
    inputs: matchMassSplit(MW_CLASS, SPLITS.light),
  },
  {
    id: 'training',
    label: '2035 SSO training cluster',
    blurb: 'Same 81 satellites training a 2T-active frontier model as one machine (Suncatcher-style). Harder: tight links, radiation errors, petabytes uplinked.',
    inputs: {
      ...BASELINE,
      ...chipPatch('gen2035'),
      ...workloadPatch('training'),
      ioBytesPerToken: 4,
    },
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
    blurb: 'Single satellite with 8 H100s serving gpt-oss-120b chat (FP8, two chips per copy); proves thermal and radiation design.',
    inputs: {
      ...BASELINE,
      altitudeKm: 550,
      satellites: 1,
      chipsPerSat: 8,
      ...chipPatch('h100'),
      ...workloadPatch('chat'),
      ...modelPatch('gptoss'),
      weightBits: 8, // H100 has no FP4: 117 GB of FP8 weights need two chips
      chipsPerReplica: 2,
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
