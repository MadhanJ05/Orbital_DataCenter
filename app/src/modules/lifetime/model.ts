import { HORIZON_YR } from '../../core/constants'
import type { SubsystemLife, TimePoint } from '../../core/types'
import { RADIATOR_MARGIN } from '../thermal/model'

export interface LifetimeInputs {
  afrPct: number // terrestrial annualized failure rate of a node
  radFailMult: number // failure-rate multiplier for the space environment
  doseRateRadYr: number // total ionizing dose behind shielding, rad(Si)/yr
  tidToleranceKrad: number // dose at which accelerators start failing
  missionLifeYr: number
  usefulThresholdPct: number // useful life ends below this capacity
}

export const lifetimeDefaults: LifetimeInputs = {
  afrPct: 4,
  radFailMult: 1.5,
  doseRateRadYr: 150,
  tidToleranceKrad: 2,
  missionLifeYr: 6,
  usefulThresholdPct: 70,
}

/** What the lifetime simulation needs from the other modules. */
export interface LifetimeDeps {
  N: number
  provisioned: number
  sparesPct: number
  eclipseFracAvg: number
  eclipseCyclesYr: number
  baseAvail: number
  batteryLifeYr: number
  computeInEclipse: boolean
  solarDegPctYr: number
  arrayMarginPct: number
  radiatorDegPctYr: number
  stationLifeYr: number
  annualDv: number
  deorbitDv: number
  commsCap: number
  altitudeKm: number
  isGeo: boolean
}

export interface MonthState {
  active: number // working, powered, cooled accelerators
  avail: number // share of the month compute runs (eclipses)
}

export interface LifetimeModel {
  months: MonthState[] // one per month, 0..HORIZON_YR*12
  series: TimePoint[] // quarterly, for charts (cumCashM filled in by economics)
  usefulLifeYr: number
  limiter: string
  subsystems: SubsystemLife[]
  capacityAtMissionEndPct: number
  avgCapacityPct: number
  warnings: string[]
}

const logistic = (x: number) => 1 / (1 + Math.exp(x))

/** Month-by-month ageing with no repairs: failures, radiation dose, array and radiator wear, batteries, propellant. */
export function runLifetime(i: LifetimeInputs, d: LifetimeDeps): LifetimeModel {
  const warnings: string[] = []
  const { N } = d
  const lambda = -Math.log(1 - i.afrPct / 100) * i.radFailMult
  const tol = i.tidToleranceKrad * 1000
  const thr = i.usefulThresholdPct / 100
  const econMonths = Math.round(i.missionLifeYr * 12)
  const months: MonthState[] = []
  const series: TimePoint[] = []
  let usefulLifeYr = HORIZON_YR
  let usefulLimiter = 'Horizon (25 yr)'
  let capSum = 0, capCount = 0, capAtEnd = 0

  for (let m = 0; m <= HORIZON_YR * 12; m++) {
    const t = m / 12
    const alive = d.provisioned * Math.exp(-lambda * t)
    const tidSurv = logistic((i.doseRateRadYr * t - tol) / (0.15 * tol))
    const chipsCap = Math.min(alive * tidSurv, N)
    const powerCap = N * Math.pow(1 - d.solarDegPctYr / 100, t) * (1 + d.arrayMarginPct / 100)
    const thermalCap = N * RADIATOR_MARGIN * Math.pow(1 - d.radiatorDegPctYr / 100, t)
    const inOrbit = t < d.stationLifeYr
    const batteryOk = t < d.batteryLifeYr
    const avail = d.computeInEclipse && batteryOk ? 1 : 1 - d.eclipseFracAvg
    const caps: [string, number][] = [['Accelerator failures', chipsCap], ['Solar power', powerCap], ['Radiator', thermalCap], ['Target size', N]]
    let active = inOrbit ? Math.min(...caps.map((c) => c[1])) : 0
    const limiter = !inOrbit ? 'Propellant (deorbit)' : caps.reduce((a, b) => (b[1] < a[1] ? b : a))[0]
    active = Math.max(0, active)
    const capacity = (active / N) * avail * d.commsCap
    months.push({ active, avail })

    if (capacity < thr && usefulLifeYr === HORIZON_YR) {
      usefulLifeYr = t
      usefulLimiter = !inOrbit ? 'Propellant (deorbit)' : avail < d.baseAvail && d.computeInEclipse ? 'Battery' : limiter
    }
    if (m < econMonths) {
      capSum += capacity; capCount++
      capAtEnd = capacity
    }
    if (m % 3 === 0) {
      series.push({
        year: +t.toFixed(2),
        capacityPct: capacity * 100,
        chipsPct: (chipsCap / N) * 100,
        powerPct: Math.min(powerCap / N, 1.5) * 100,
        thermalPct: Math.min(thermalCap / N, 1.5) * 100,
        availabilityPct: avail * 100,
        cumCashM: NaN,
        limiter,
      })
    }
  }

  const chipsLifeYr = (() => {
    const s = series.find((p) => p.chipsPct < thr * 100)
    return s ? s.year : HORIZON_YR
  })()
  const subsystems: SubsystemLife[] = [
    { name: 'Accelerators (random failures, no repair)', years: chipsLifeYr, note: `${d.sparesPct}% cold spares, AFR ${(i.afrPct * i.radFailMult).toFixed(1)}%/yr in orbit` },
    { name: 'Radiation dose (TID)', years: i.doseRateRadYr > 0 ? tol / i.doseRateRadYr : Infinity, note: `${i.doseRateRadYr} rad/yr vs ${i.tidToleranceKrad} krad tolerance` },
    { name: 'Solar arrays', years: Math.min(HORIZON_YR, Math.log(thr / (1 + d.arrayMarginPct / 100)) / Math.log(1 - d.solarDegPctYr / 100)), note: `${d.solarDegPctYr}%/yr degradation, ${d.arrayMarginPct}% margin` },
    { name: 'Radiators', years: Math.min(HORIZON_YR, Math.log(thr / RADIATOR_MARGIN) / Math.log(1 - d.radiatorDegPctYr / 100)), note: `${d.radiatorDegPctYr}%/yr coating/MMOD loss` },
    { name: 'Batteries', years: d.batteryLifeYr, note: d.eclipseCyclesYr > 0 ? `${Math.round(d.eclipseCyclesYr)} cycles/yr` : 'No eclipses: calendar-limited' },
    { name: 'Propellant (station-keeping)', years: d.stationLifeYr, note: `${d.annualDv.toFixed(1)} m/s/yr, ${d.deorbitDv.toFixed(0)} m/s deorbit reserve` },
  ].map((s) => ({ ...s, years: Math.min(s.years, HORIZON_YR) }))

  if (i.missionLifeYr > usefulLifeYr) warnings.push(`Mission life (${i.missionLifeYr} yr) exceeds useful life (${usefulLifeYr.toFixed(1)} yr).`)
  if (d.altitudeKm < 400 && !d.isGeo) warnings.push('Below 400 km, drag on large arrays dominates propellant use.')

  return {
    months, series, usefulLifeYr, limiter: usefulLimiter, subsystems,
    capacityAtMissionEndPct: capAtEnd * 100,
    avgCapacityPct: capCount ? (capSum / capCount) * 100 : 0,
    warnings,
  }
}
