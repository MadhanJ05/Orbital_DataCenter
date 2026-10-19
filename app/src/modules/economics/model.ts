import { HRS_YR } from '../../core/constants'
import type { Results } from '../../core/types'
import assumptions from '../../../../shared/assumptions.json'
import type { MonthState } from '../lifetime/model'

export interface EconomicsInputs {
  serverCostMult: number // node cost / accelerator price
  busCostPerKg: number
  launchCostPerKg: number
  insurancePct: number
  groundCapexM: number
  opexFixedMYr: number
  opexPerSatMYr: number
  pricePerChipHr: number
  soldPct: number
  discountPct: number
  // Terrestrial comparison
  elecPerKWh: number
  pue: number
  facilityCapexMPerMW: number
  terrestrialLifeYr: number
  terrestrialUptimePct: number
}

export const economicsDefaults: EconomicsInputs = {
  serverCostMult: 1, // deck chips are priced per rack slot; vendor chips set 1.6 via the chip preset
  busCostPerKg: 1500,
  launchCostPerKg: assumptions.launch_usd_per_kg.value,
  insurancePct: 5,
  groundCapexM: 50,
  opexFixedMYr: 15,
  opexPerSatMYr: 0.1,
  pricePerChipHr: 9,
  soldPct: 85,
  discountPct: 10,
  elecPerKWh: 0.09,
  pue: 1.2,
  facilityCapexMPerMW: 12,
  terrestrialLifeYr: 6,
  terrestrialUptimePct: 98,
}

/** What economics needs from the other modules. */
export interface EconomicsDeps {
  satellites: number
  N: number
  chipsPerSatProv: number
  chipPriceUsd: number
  chipPflops: number
  perChipW: number
  itW: number
  loadW: number
  arrayW: number
  arrayKg: number
  solarCostPerW: number
  batteryCostPerKWh: number
  batteryWh: number
  batteryKg: number
  radiatorKg: number
  structureKg: number
  busFixedKg: number
  totalKg: number
  seu: number
  mfu: number
  P: number
  training: boolean
  tokensPerChipHr: number
  flopsPerChipEff: number
  trainFlops: number
  commsCap: number
  afrPct: number
  missionLifeYr: number
  months: MonthState[]
}

export interface EconomicsModel {
  econ: Results['econ']
  terrestrial: Results['terrestrial']
  cumCashByMonth: number[] // cumulative cash after month m, for m < mission months
}

export function runEconomics(i: EconomicsInputs, d: EconomicsDeps): EconomicsModel {
  // ---------- Capex ----------
  const chipCapex = d.chipsPerSatProv * d.chipPriceUsd * i.serverCostMult * d.satellites
  const solarCapex = d.arrayW * d.solarCostPerW * d.satellites
  const batteryCapex = (d.batteryWh / 1000) * d.batteryCostPerKWh * d.satellites
  const busCapex = (d.radiatorKg + d.structureKg + d.busFixedKg) * i.busCostPerKg * d.satellites
  const launchCapex = d.totalKg * i.launchCostPerKg
  const preIns = chipCapex + solarCapex + batteryCapex + busCapex + launchCapex
  const insurance = preIns * i.insurancePct / 100
  const ground = i.groundCapexM * 1e6
  const capex = preIns + insurance + ground
  const opexYr = (i.opexFixedMYr + i.opexPerSatMYr * d.satellites) * 1e6

  // ---------- Cash flows over the mission, from the lifetime simulation ----------
  const monthlyDisc = Math.pow(1 + i.discountPct / 100, 1 / 12)
  const econMonths = Math.round(d.missionLifeYr * 12)
  let pvCost = capex, pvHours = 0, pvRevenue = 0, cumCash = -capex
  let revenue = 0, paybackYr: number | null = null, energyKWh = 0
  const cumCashByMonth: number[] = []
  for (let m = 0; m < econMonths && m < d.months.length; m++) {
    const { active, avail } = d.months[m]
    const hours = active * avail * d.commsCap * d.seu * (HRS_YR / 12)
    const disc = Math.pow(monthlyDisc, m + 1)
    const rev = hours * i.pricePerChipHr * i.soldPct / 100
    pvHours += hours / disc
    pvRevenue += rev / disc
    pvCost += opexYr / 12 / disc
    revenue += rev
    cumCash += rev - opexYr / 12
    if (paybackYr === null && cumCash >= 0) paybackYr = (m + 1) / 12
    energyKWh += (active / d.N) * avail * d.loadW * d.satellites / 1000 * (HRS_YR / 12)
    cumCashByMonth.push(cumCash)
  }

  const lcoc = pvCost / Math.max(pvHours, 1)
  const costPerMTokens = (lcoc / d.tokensPerChipHr) * 1e6
  const trainChipHrs = d.trainFlops / d.flopsPerChipEff / 3600
  const powerSysCost = solarCapex + batteryCapex + d.radiatorKg * i.busCostPerKg * d.satellites +
    (d.arrayKg + d.batteryKg + d.radiatorKg) * d.satellites * i.launchCostPerKg

  // ---------- Terrestrial comparison: same accelerators in a ground data center ----------
  const tItMw = (d.N * d.perChipW) / 1e6
  const tCapex = d.N * d.chipPriceUsd * i.serverCostMult + tItMw * i.facilityCapexMPerMW * 1e6
  const tElecYr = tItMw * 1000 * i.pue * HRS_YR * i.elecPerKWh
  const tReplYr = d.N * d.chipPriceUsd * i.serverCostMult * d.afrPct / 100 * 0.3 // RMA cost of failed nodes
  const tOpsYr = tCapex * 0.03
  const tOpexYr = tElecYr + tReplYr + tOpsYr
  const r = i.discountPct / 100
  let tPvCost = tCapex, tPvHours = 0
  for (let y = 1; y <= i.terrestrialLifeYr; y++) {
    const disc = Math.pow(1 + r, y)
    tPvCost += tOpexYr / disc
    tPvHours += (d.N * HRS_YR * i.terrestrialUptimePct / 100) / disc
  }
  const tLcoc = tPvCost / tPvHours
  // Same chips on the ground: inference uses the same serving throughput; training the FLOPS formula
  const tTokensPerChipHr = d.training ? (d.chipPflops * 1e15 * d.mfu * 3600) / (6 * d.P) : d.tokensPerChipHr

  return {
    econ: {
      capexBreakdownM: [
        { name: 'Compute hardware', usd: chipCapex / 1e6 },
        { name: 'Launch', usd: launchCapex / 1e6 },
        { name: 'Bus, radiators, structure', usd: busCapex / 1e6 },
        { name: 'Solar arrays', usd: solarCapex / 1e6 },
        { name: 'Batteries', usd: batteryCapex / 1e6 },
        { name: 'Insurance', usd: insurance / 1e6 },
        { name: 'Ground segment', usd: ground / 1e6 },
      ],
      capexM: capex / 1e6,
      opexMYr: opexYr / 1e6,
      lcocPerChipHr: lcoc,
      costPerMTokens,
      trainRunCostM: (trainChipHrs * lcoc) / 1e6,
      npvM: (pvRevenue - pvCost) / 1e6,
      paybackYr,
      revenueM: revenue / 1e6,
      orbitalLcoePerKWh: powerSysCost / Math.max(energyKWh, 1),
      capexPerKwIt: capex / ((d.itW * d.satellites) / 1000),
    },
    terrestrial: {
      capexM: tCapex / 1e6,
      opexMYr: tOpexYr / 1e6,
      lcocPerChipHr: tLcoc,
      costPerMTokens: (tLcoc / tTokensPerChipHr) * 1e6,
      lcoePerKWh: i.elecPerKWh * i.pue,
    },
    cumCashByMonth,
  }
}
