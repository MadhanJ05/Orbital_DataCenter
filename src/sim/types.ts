export type OrbitType = 'sso' | 'leo' | 'geo'
export type Workload = 'training' | 'inference'

export interface Inputs {
  // Orbit
  orbitType: OrbitType
  altitudeKm: number
  solarActivity: number // atmospheric density multiplier (1 = moderate, 2-3 = solar max)

  // Constellation & compute
  satellites: number
  chipsPerSat: number
  chipId: string
  chipTdpW: number
  chipPflops: number // dense FP8 PFLOPS per accelerator
  chipPriceUsd: number
  serverOverhead: number // node power / accelerator TDP (CPU, HBM, NICs, pumps)
  serverCostMult: number // node cost / accelerator price
  serverKgPerChip: number // node mass per accelerator incl. cold plate and local shielding
  sparesPct: number // cold spares launched, unpowered until needed
  afrPct: number // terrestrial annualized failure rate of a node
  radFailMult: number // failure-rate multiplier for the space environment
  seuOverheadPct: number // compute lost to soft-error detection, checkpoint and replay

  // Radiation
  doseRateRadYr: number // total ionizing dose behind shielding, rad(Si)/yr
  tidToleranceKrad: number // dose at which accelerators start failing

  // Power
  solarEffPct: number
  solarDegPctYr: number
  solarWPerKg: number
  solarCostPerW: number
  arrayMarginPct: number
  computeInEclipse: boolean
  batteryWhPerKg: number
  batteryDoDPct: number
  batteryCycleLife: number
  batteryCalendarLifeYr: number
  batteryCostPerKWh: number
  busPowerPct: number // avionics, ADCS, comms as % of IT power

  // Thermal
  radiatorTempK: number
  sinkTempK: number
  emissivity: number
  radiatorKgPerM2: number
  radiatorDegPctYr: number
  twoSidedRadiator: boolean

  // Bus & propulsion
  busFixedKg: number
  structurePct: number
  ispS: number
  propPct: number // propellant as % of wet mass
  busCostPerKg: number

  // Comms
  linkGbpsPerSat: number
  linkAvailPct: number

  // Workload
  workload: Workload
  modelId: string
  activeParamsB: number
  mfuPct: number
  trainTokensT: number
  ioBytesPerToken: number

  // Economics
  launchCostPerKg: number
  launchPayloadT: number
  insurancePct: number
  groundCapexM: number
  opexFixedMYr: number
  opexPerSatMYr: number
  pricePerChipHr: number
  soldPct: number
  discountPct: number
  missionLifeYr: number
  usefulThresholdPct: number

  // Terrestrial comparison
  elecPerKWh: number
  pue: number
  facilityCapexMPerMW: number
  terrestrialLifeYr: number
  terrestrialUptimePct: number
}

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
