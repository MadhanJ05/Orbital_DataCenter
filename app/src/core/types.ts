import type { OrbitInputs } from '../modules/orbit/model'
import type { ComputeInputs } from '../modules/compute/model'
import type { PowerInputs } from '../modules/power/model'
import type { ThermalInputs } from '../modules/thermal/model'
import type { MassInputs } from '../modules/mass/model'
import type { CommsInputs } from '../modules/comms/model'
import type { LifetimeInputs } from '../modules/lifetime/model'
import type { EconomicsInputs } from '../modules/economics/model'

export type { OrbitType } from '../modules/orbit/model'
export type { Workload } from '../modules/compute/model'

/** Every input of the twin: the union of each module's own inputs (defined in modules/<name>/model.ts). */
export type Inputs = OrbitInputs & ComputeInputs & PowerInputs & ThermalInputs & MassInputs & CommsInputs & LifetimeInputs & EconomicsInputs

export interface TimePoint {
  year: number
  capacityPct: number
  chipsPct: number
  powerPct: number
  thermalPct: number
  availabilityPct: number
  cumCashM: number
  limiter: string
}

export interface SubsystemLife {
  name: string
  years: number
  note: string
}

export interface Results {
  orbit: {
    periodMin: number
    eclipseFracAvg: number
    worstEclipseMin: number
    eclipseCyclesYr: number
    rttMs: number
    velocityKms: number
  }
  compute: {
    activeChips: number
    provisionedChips: number
    peakEflops: number
    effectiveEflopsBol: number
    tokensPerSec: number
    trainDays: number
    trainFlops: number
  }
  power: {
    itMw: number
    loadKwPerSat: number
    arrayKwPerSat: number
    arrayM2PerSat: number
    batteryKwhPerSat: number
    totalArrayM2: number
  }
  thermal: {
    radiatorFluxWm2: number
    radiatorM2PerSat: number
    totalRadiatorM2: number
  }
  mass: {
    breakdownKgPerSat: { name: string; kg: number }[]
    dryKgPerSat: number
    wetKgPerSat: number
    totalT: number
    kgPerKw: number
    dryKgPerKw: number // = dry t per MW of IT, comparable to the deck's 18 t/MW
    launches: number
  }
  propulsion: {
    dragDvMsYr: number
    stationKeepingDvMsYr: number
    deorbitDvMs: number
    stationLifeYr: number
    passiveDecayYr: number
  }
  comms: {
    requiredGbps: number
    availableGbps: number
    utilizationPct: number
  }
  life: {
    usefulLifeYr: number
    limiter: string
    subsystems: SubsystemLife[]
    capacityAtMissionEndPct: number
    avgCapacityPct: number
  }
  econ: {
    capexBreakdownM: { name: string; usd: number }[]
    capexM: number
    opexMYr: number
    lcocPerChipHr: number
    costPerMTokens: number
    trainRunCostM: number
    npvM: number
    paybackYr: number | null
    revenueM: number
    orbitalLcoePerKWh: number
    capexPerKwIt: number
  }
  terrestrial: {
    capexM: number
    opexMYr: number
    lcocPerChipHr: number
    costPerMTokens: number
    lcoePerKWh: number
  }
  series: TimePoint[]
  warnings: string[]
}
