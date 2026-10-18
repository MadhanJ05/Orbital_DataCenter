import type { Inputs, Results, SubsystemLife, TimePoint } from './types'

const RE = 6371 // km
const MU = 398600.4418 // km^3/s^2
const SOLAR = 1361 // W/m^2 at 1 AU
const SIGMA = 5.670374e-8
const C_KMS = 299792.458
const G0 = 9.80665
const HRS_YR = 8766
const SEC_YR = HRS_YR * 3600
const GEO_ALT = 35786
const CD = 2.2
const BUS_AREA_M2 = 10 // projected area of the bus body
const RADIATOR_MARGIN = 1.1
const BATTERY_EFF = 0.92
const ARRAY_PACKING = 0.9 * 0.97 // cell packing x pointing loss
const SAFE_MODE_HRS = 1 // minimum battery: 1 h of bus power in safe mode
const HORIZON_YR = 25

// Exponential atmosphere (Vallado, Fundamentals of Astrodynamics, Table 8-4): [base km, density kg/m^3, scale height km]
const ATMOS: [number, number, number][] = [
  [150, 2.07e-9, 22.523], [180, 5.464e-10, 29.74], [200, 2.789e-10, 37.105],
  [250, 7.248e-11, 45.546], [300, 2.418e-11, 53.628], [350, 9.518e-12, 53.298],
  [400, 3.725e-12, 58.515], [450, 1.585e-12, 60.828], [500, 6.967e-13, 63.822],
  [600, 1.454e-13, 71.835], [700, 3.614e-14, 88.667], [800, 1.17e-14, 124.64],
  [900, 5.245e-15, 181.05], [1000, 3.019e-15, 268.0],
]

export function airDensity(hKm: number): number {
  if (hKm > 2000) return 0
  let row = ATMOS[0]
  for (const r of ATMOS) if (hKm >= r[0]) row = r
  return row[1] * Math.exp(-(hKm - row[0]) / row[2])
}

function altitude(i: Inputs) {
  return i.orbitType === 'geo' ? GEO_ALT : i.altitudeKm
}

/** Fraction of an orbit in Earth's shadow for a circular orbit with sun in the orbit plane (beta = 0, worst case). */
function shadowFraction(hKm: number) {
  const a = RE + hKm
  return Math.acos(Math.sqrt(hKm * (2 * RE + hKm)) / a) / Math.PI
}

function orbitModel(i: Inputs) {
  const h = altitude(i)
  const a = RE + h
  const periodS = 2 * Math.PI * Math.sqrt((a * a * a) / MU)
  const periodMin = periodS / 60
  const orbitsYr = SEC_YR / periodS
  let eclipseFracAvg: number, worstEclipseMin: number, eclipseCyclesYr: number
  if (i.orbitType === 'geo') {
    // Two ~45-day eclipse seasons around the equinoxes, max ~72 min/day
    eclipseFracAvg = 0.0075
    worstEclipseMin = 72
    eclipseCyclesYr = 90
  } else if (i.orbitType === 'sso') {
    // Dawn-dusk SSO rides the terminator; short eclipses only in a ~3-month season near one solstice
    eclipseFracAvg = h < 1500 ? 0.015 : 0
    worstEclipseMin = h < 1500 ? 0.5 * shadowFraction(h) * periodMin : 0
    eclipseCyclesYr = h < 1500 ? orbitsYr * 0.25 : 0
  } else {
    const f = shadowFraction(h)
    eclipseFracAvg = f * 0.9 // orbit-average over beta angles for a mid-inclination orbit
    worstEclipseMin = f * periodMin
    eclipseCyclesYr = orbitsYr
  }
  const relayMs = i.orbitType === 'geo' ? 10 : 20 // processing + relay hops
  const rttMs = (2 * h) / C_KMS * 1000 + relayMs
  const velocityKms = Math.sqrt(MU / a)
  return { h, a, periodS, periodMin, orbitsYr, eclipseFracAvg, worstEclipseMin, eclipseCyclesYr, rttMs, velocityKms }
}

/** Years for an uncontrolled satellite to decay from hKm to 150 km. */
function passiveDecayYears(hKm: number, areaM2: number, massKg: number, activity: number) {
  if (hKm > 2000) return Infinity
  let t = 0
  const step = 5
  for (let h = hKm; h > 150; h -= step) {
    const rho = airDensity(h) * activity
    const aM = (RE + h) * 1000
    const dadt = Math.sqrt(MU * 1e9 * aM) * rho * CD * areaM2 / massKg // m/s
    t += (step * 1000) / dadt
    if (t > 1e4 * SEC_YR) return Infinity
  }
  return t / SEC_YR
}

const logistic = (x: number) => 1 / (1 + Math.exp(x))

export function simulate(i: Inputs): Results {
  const warnings: string[] = []
  const o = orbitModel(i)
  const N = i.satellites * i.chipsPerSat
  const chipsPerSatProv = Math.ceil(i.chipsPerSat * (1 + i.sparesPct / 100))
  const provisioned = i.satellites * chipsPerSatProv

  // ---------- Power ----------
  const perChipW = i.chipTdpW * i.serverOverhead
  const itW = i.chipsPerSat * perChipW
  const busW = itW * i.busPowerPct / 100
  const loadW = itW + busW
  const eclipseLoadW = i.computeInEclipse ? loadW : busW
  const worstEclipseH = o.worstEclipseMin / 60
  const sunlitH = o.periodS / 3600 - worstEclipseH
  const batteryWh = Math.max(eclipseLoadW * worstEclipseH, busW * SAFE_MODE_HRS) / (i.batteryDoDPct / 100)
  const rechargeW = (eclipseLoadW * worstEclipseH) / (Math.max(sunlitH, 0.1) * BATTERY_EFF)
  const arrayW = (loadW + rechargeW) * (1 + i.arrayMarginPct / 100)
  const arrayM2 = arrayW / (SOLAR * (i.solarEffPct / 100) * ARRAY_PACKING)
  const arrayKg = arrayW / i.solarWPerKg
  const batteryKg = batteryWh / i.batteryWhPerKg

  // ---------- Thermal ----------
  const sides = i.twoSidedRadiator ? 2 : 1
  const fluxWm2 = i.emissivity * SIGMA * (i.radiatorTempK ** 4 - i.sinkTempK ** 4) * sides
  if (fluxWm2 <= 0) warnings.push('Radiator temperature must exceed sink temperature.')
  const radiatorM2 = (loadW / Math.max(fluxWm2, 1)) * RADIATOR_MARGIN
  const radiatorKg = radiatorM2 * i.radiatorKgPerM2

  // ---------- Mass ----------
  const computeKg = chipsPerSatProv * i.serverKgPerChip
  const subtotal = computeKg + arrayKg + batteryKg + radiatorKg + i.busFixedKg
  const structureKg = subtotal * i.structurePct / 100
  const dryKg = subtotal + structureKg
  const pf = i.propPct / 100
  const propKg = dryKg * pf / (1 - pf)
  const wetKg = dryKg + propKg
  const totalKg = wetKg * i.satellites

  // ---------- Propulsion & orbit maintenance ----------
  const projArea = 0.5 * (arrayM2 + radiatorM2) + BUS_AREA_M2
  const vMs = o.velocityKms * 1000
  const rho = airDensity(o.h) * i.solarActivity
  const dragDv = 0.5 * rho * vMs * vMs * CD * projArea / wetKg * SEC_YR
  const skDv = i.orbitType === 'geo' ? 50 : 2 // GEO N-S keeping; LEO phasing/collision avoidance
  let deorbitDv: number
  if (i.orbitType === 'geo') deorbitDv = 11 // +300 km graveyard orbit
  else {
    const r1 = o.a, r2 = RE + 250
    deorbitDv = vMs * (1 - Math.sqrt((2 * r2) / (r1 + r2))) // lower perigee to 250 km
  }
  const totalDv = i.ispS * G0 * Math.log(wetKg / dryKg)
  const annualDv = dragDv + skDv
  const stationLifeYr = Math.max(0, (totalDv - deorbitDv) / annualDv)
  const passiveDecayYr = passiveDecayYears(o.h, projArea, dryKg, i.solarActivity)
  if (totalDv < deorbitDv) warnings.push('Propellant is below the deorbit reserve.')

  // ---------- Compute & workload ----------
  const P = i.activeParamsB * 1e9
  const mfu = i.mfuPct / 100
  const seu = 1 - i.seuOverheadPct / 100
  const baseAvail = i.computeInEclipse ? 1 : 1 - o.eclipseFracAvg
  const flopsPerChipEff = i.chipPflops * 1e15 * mfu * seu
  const effFlopsBol = N * flopsPerChipEff * baseAvail
  const tokensPerSec = i.workload === 'training' ? effFlopsBol / (6 * P) : effFlopsBol / (2 * P)
  const trainFlops = 6 * P * i.trainTokensT * 1e12
  const trainDays = trainFlops / effFlopsBol / 86400
  const tokensPerChipHr = (flopsPerChipEff * 3600) / ((i.workload === 'training' ? 6 : 2) * P)

  // ---------- Comms ----------
  const requiredGbps = (tokensPerSec * i.ioBytesPerToken * 8) / 1e9
  const availableGbps = i.satellites * i.linkGbpsPerSat * i.linkAvailPct / 100
  const commsUtil = requiredGbps / Math.max(availableGbps, 1e-9) * 100
  if (commsUtil > 100) warnings.push(`Ground link is oversubscribed (${commsUtil.toFixed(0)}%) and throttles throughput.`)
  const commsCap = Math.min(1, 100 / Math.max(commsUtil, 1e-9))

  // ---------- Economics: capex ----------
  const chipCapex = chipsPerSatProv * i.chipPriceUsd * i.serverCostMult * i.satellites
  const solarCapex = arrayW * i.solarCostPerW * i.satellites
  const batteryCapex = (batteryWh / 1000) * i.batteryCostPerKWh * i.satellites
  const busCapex = (radiatorKg + structureKg + i.busFixedKg) * i.busCostPerKg * i.satellites
  const launchCapex = totalKg * i.launchCostPerKg
  const preIns = chipCapex + solarCapex + batteryCapex + busCapex + launchCapex
  const insurance = preIns * i.insurancePct / 100
  const ground = i.groundCapexM * 1e6
  const capex = preIns + insurance + ground
  const opexYr = (i.opexFixedMYr + i.opexPerSatMYr * i.satellites) * 1e6

  // ---------- Lifetime simulation (monthly) ----------
  const lambda = -Math.log(1 - i.afrPct / 100) * i.radFailMult
  const tol = i.tidToleranceKrad * 1000
  const batteryLife = Math.min(
    i.batteryCalendarLifeYr,
    o.eclipseCyclesYr > 0 ? i.batteryCycleLife / o.eclipseCyclesYr : Infinity,
  )
  const thr = i.usefulThresholdPct / 100
  const monthlyDisc = Math.pow(1 + i.discountPct / 100, 1 / 12)
  const series: TimePoint[] = []
  let usefulLifeYr = HORIZON_YR
  let usefulLimiter = 'Horizon (25 yr)'
  let pvCost = capex, pvHours = 0, pvRevenue = 0, cumCash = -capex
  let revenue = 0, paybackYr: number | null = null, energyKWh = 0
  let capSum = 0, capCount = 0, capAtEnd = 0
  const econMonths = Math.round(i.missionLifeYr * 12)

  for (let m = 0; m <= HORIZON_YR * 12; m++) {
    const t = m / 12
    const alive = provisioned * Math.exp(-lambda * t)
    const tidSurv = logistic((i.doseRateRadYr * t - tol) / (0.15 * tol))
    const chipsCap = Math.min(alive * tidSurv, N)
    const powerCap = N * Math.pow(1 - i.solarDegPctYr / 100, t) * (1 + i.arrayMarginPct / 100)
    const thermalCap = N * RADIATOR_MARGIN * Math.pow(1 - i.radiatorDegPctYr / 100, t)
    const inOrbit = t < stationLifeYr
    const batteryOk = t < batteryLife
    const avail = i.computeInEclipse && batteryOk ? 1 : 1 - o.eclipseFracAvg
    const caps: [string, number][] = [['Accelerator failures', chipsCap], ['Solar power', powerCap], ['Radiator', thermalCap], ['Target size', N]]
    let active = inOrbit ? Math.min(...caps.map((c) => c[1])) : 0
    const limiter = !inOrbit ? 'Propellant (deorbit)' : caps.reduce((a, b) => (b[1] < a[1] ? b : a))[0]
    active = Math.max(0, active)
    const capacity = (active / N) * avail * commsCap

    if (capacity < thr && usefulLifeYr === HORIZON_YR) {
      usefulLifeYr = t
      usefulLimiter = !inOrbit ? 'Propellant (deorbit)' : avail < baseAvail && i.computeInEclipse ? 'Battery' : limiter
    }

    if (m < econMonths) {
      const hours = active * avail * commsCap * seu * (HRS_YR / 12)
      const disc = Math.pow(monthlyDisc, m + 1)
      const rev = hours * i.pricePerChipHr * i.soldPct / 100
      pvHours += hours / disc
      pvRevenue += rev / disc
      pvCost += opexYr / 12 / disc
      revenue += rev
      cumCash += rev - opexYr / 12
      if (paybackYr === null && cumCash >= 0) paybackYr = (m + 1) / 12
      energyKWh += (active / N) * avail * loadW * i.satellites / 1000 * (HRS_YR / 12)
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
        cumCashM: m <= econMonths ? cumCash / 1e6 : NaN,
        limiter,
      })
    }
  }

  const lcoc = pvCost / Math.max(pvHours, 1)
  const costPerMTokens = (lcoc / tokensPerChipHr) * 1e6
  const trainChipHrs = trainFlops / flopsPerChipEff / 3600
  const powerSysCost = solarCapex + batteryCapex + radiatorKg * i.busCostPerKg * i.satellites +
    (arrayKg + batteryKg + radiatorKg) * i.satellites * i.launchCostPerKg

  const chipsLifeYr = (() => {
    const s = series.find((p) => p.chipsPct < thr * 100)
    return s ? s.year : HORIZON_YR
  })()
  const subsystems: SubsystemLife[] = [
    { name: 'Accelerators (random failures, no repair)', years: chipsLifeYr, note: `${i.sparesPct}% cold spares, AFR ${(i.afrPct * i.radFailMult).toFixed(1)}%/yr in orbit` },
    { name: 'Radiation dose (TID)', years: i.doseRateRadYr > 0 ? tol / i.doseRateRadYr : Infinity, note: `${i.doseRateRadYr} rad/yr vs ${i.tidToleranceKrad} krad tolerance` },
    { name: 'Solar arrays', years: Math.min(HORIZON_YR, Math.log(thr / (1 + i.arrayMarginPct / 100)) / Math.log(1 - i.solarDegPctYr / 100)), note: `${i.solarDegPctYr}%/yr degradation, ${i.arrayMarginPct}% margin` },
    { name: 'Radiators', years: Math.min(HORIZON_YR, Math.log(thr / RADIATOR_MARGIN) / Math.log(1 - i.radiatorDegPctYr / 100)), note: `${i.radiatorDegPctYr}%/yr coating/MMOD loss` },
    { name: 'Batteries', years: batteryLife, note: o.eclipseCyclesYr > 0 ? `${Math.round(o.eclipseCyclesYr)} cycles/yr` : 'No eclipses: calendar-limited' },
    { name: 'Propellant (station-keeping)', years: stationLifeYr, note: `${annualDv.toFixed(1)} m/s/yr, ${deorbitDv.toFixed(0)} m/s deorbit reserve` },
  ].map((s) => ({ ...s, years: Math.min(s.years, HORIZON_YR) }))

  if (i.missionLifeYr > usefulLifeYr) warnings.push(`Mission life (${i.missionLifeYr} yr) exceeds useful life (${usefulLifeYr.toFixed(1)} yr).`)
  if (o.h < 400 && i.orbitType !== 'geo') warnings.push('Below 400 km, drag on large arrays dominates propellant use.')

  // ---------- Terrestrial comparison ----------
  const tItMw = (N * perChipW) / 1e6
  const tCapex = N * i.chipPriceUsd * i.serverCostMult + tItMw * i.facilityCapexMPerMW * 1e6
  const tElecYr = tItMw * 1000 * i.pue * HRS_YR * i.elecPerKWh
  const tReplYr = N * i.chipPriceUsd * i.serverCostMult * i.afrPct / 100 * 0.3 // RMA cost of failed nodes
  const tOpsYr = tCapex * 0.03
  const tOpexYr = tElecYr + tReplYr + tOpsYr
  const r = i.discountPct / 100
  let tPvCost = tCapex, tPvHours = 0
  for (let y = 1; y <= i.terrestrialLifeYr; y++) {
    const d = Math.pow(1 + r, y)
    tPvCost += tOpexYr / d
    tPvHours += (N * HRS_YR * i.terrestrialUptimePct / 100) / d
  }
  const tLcoc = tPvCost / tPvHours
  const tTokensPerChipHr = (i.chipPflops * 1e15 * mfu * 3600) / ((i.workload === 'training' ? 6 : 2) * P)

  const results: Results = {
    orbit: {
      periodMin: o.periodMin,
      eclipseFracAvg: o.eclipseFracAvg,
      worstEclipseMin: o.worstEclipseMin,
      eclipseCyclesYr: o.eclipseCyclesYr,
      rttMs: o.rttMs,
      velocityKms: o.velocityKms,
    },
    compute: {
      activeChips: N,
      provisionedChips: provisioned,
      peakEflops: (N * i.chipPflops) / 1000,
      effectiveEflopsBol: effFlopsBol / 1e18,
      tokensPerSec: tokensPerSec * commsCap,
      trainDays: trainDays / commsCap,
      trainFlops,
    },
    power: {
      itMw: (itW * i.satellites) / 1e6,
      loadKwPerSat: loadW / 1000,
      arrayKwPerSat: arrayW / 1000,
      arrayM2PerSat: arrayM2,
      batteryKwhPerSat: batteryWh / 1000,
      totalArrayM2: arrayM2 * i.satellites,
    },
    thermal: {
      radiatorFluxWm2: fluxWm2,
      radiatorM2PerSat: radiatorM2,
      totalRadiatorM2: radiatorM2 * i.satellites,
    },
    mass: {
      breakdownKgPerSat: [
        { name: 'Compute nodes', kg: computeKg },
        { name: 'Solar arrays', kg: arrayKg },
        { name: 'Radiators', kg: radiatorKg },
        { name: 'Batteries', kg: batteryKg },
        { name: 'Bus avionics/comms', kg: i.busFixedKg },
        { name: 'Structure', kg: structureKg },
        { name: 'Propellant', kg: propKg },
      ],
      dryKgPerSat: dryKg,
      wetKgPerSat: wetKg,
      totalT: totalKg / 1000,
      kgPerKw: wetKg / (itW / 1000),
      launches: Math.ceil(totalKg / 1000 / i.launchPayloadT),
    },
    propulsion: {
      dragDvMsYr: dragDv,
      stationKeepingDvMsYr: annualDv,
      deorbitDvMs: deorbitDv,
      stationLifeYr,
      passiveDecayYr,
    },
    comms: { requiredGbps, availableGbps, utilizationPct: commsUtil },
    life: {
      usefulLifeYr,
      limiter: usefulLimiter,
      subsystems,
      capacityAtMissionEndPct: capAtEnd * 100,
      avgCapacityPct: capCount ? (capSum / capCount) * 100 : 0,
    },
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
      capexPerKwIt: capex / ((itW * i.satellites) / 1000),
    },
    terrestrial: {
      capexM: tCapex / 1e6,
      opexMYr: tOpexYr / 1e6,
      lcocPerChipHr: tLcoc,
      costPerMTokens: (tLcoc / tTokensPerChipHr) * 1e6,
      lcoePerKWh: i.elecPerKWh * i.pue,
    },
    series,
    warnings,
  }
  return results
}

export interface SensitivityRow {
  label: string
  low: number
  high: number
  lowLabel: string
  highLabel: string
}

const SENS: { key: keyof Inputs; label: string; swing: number }[] = [
  { key: 'launchCostPerKg', label: 'Launch cost $/kg', swing: 0.5 },
  { key: 'chipPriceUsd', label: 'Accelerator price', swing: 0.25 },
  { key: 'afrPct', label: 'Failure rate (AFR)', swing: 0.5 },
  { key: 'busCostPerKg', label: 'Bus cost $/kg', swing: 0.5 },
  { key: 'solarCostPerW', label: 'Solar cost $/W', swing: 0.5 },
  { key: 'radiatorTempK', label: 'Radiator temperature', swing: 0.08 },
  { key: 'missionLifeYr', label: 'Mission life', swing: 0.4 },
  { key: 'mfuPct', label: 'Utilization (MFU)', swing: 0.25 },
  { key: 'discountPct', label: 'Discount rate', swing: 0.3 },
  { key: 'serverKgPerChip', label: 'Node mass per accelerator', swing: 0.4 },
]

/** One-at-a-time sensitivity of the chosen metric to each key input (tornado chart). */
export function sensitivity(i: Inputs, metric: (r: Results) => number): SensitivityRow[] {
  const base = metric(simulate(i))
  return SENS.map(({ key, label, swing }) => {
    const v = i[key] as number
    const lo = { ...i, [key]: v * (1 - swing) }
    const hi = { ...i, [key]: v * (1 + swing) }
    return {
      label,
      low: metric(simulate(lo)) - base,
      high: metric(simulate(hi)) - base,
      lowLabel: `-${Math.round(swing * 100)}%`,
      highLabel: `+${Math.round(swing * 100)}%`,
    }
  }).sort((a, b) => Math.max(Math.abs(b.low), Math.abs(b.high)) - Math.max(Math.abs(a.low), Math.abs(a.high)))
}
