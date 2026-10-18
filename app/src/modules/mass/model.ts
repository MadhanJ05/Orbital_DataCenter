import { CD, G0, MU, RE, SEC_YR } from '../../core/constants'
import { airDensity, type OrbitInputs, type OrbitModel } from '../orbit/model'

export interface MassInputs {
  busFixedKg: number // avionics, ADCS, comms
  structurePct: number
  ispS: number
  propPct: number // propellant as % of wet mass
  launchPayloadT: number
}

export const massDefaults: MassInputs = {
  busFixedKg: 300,
  structurePct: 15,
  ispS: 1500,
  propPct: 4,
  launchPayloadT: 100,
}

const BUS_AREA_M2 = 10 // projected area of the bus body

export interface MassModel {
  computeKg: number
  structureKg: number
  dryKg: number
  propKg: number
  wetKg: number
  totalKg: number
  launches: number
  // Propulsion & orbit maintenance
  projArea: number
  dragDv: number
  annualDv: number
  deorbitDv: number
  stationLifeYr: number
  passiveDecayYr: number
  warnings: string[]
}

interface Parts {
  chipsPerSatProv: number
  serverKgPerChip: number
  arrayKg: number
  batteryKg: number
  radiatorKg: number
  arrayM2: number
  radiatorM2: number
  satellites: number
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

export function runMass(i: MassInputs & OrbitInputs, orbit: OrbitModel, p: Parts): MassModel {
  const warnings: string[] = []
  const computeKg = p.chipsPerSatProv * p.serverKgPerChip
  const subtotal = computeKg + p.arrayKg + p.batteryKg + p.radiatorKg + i.busFixedKg
  const structureKg = subtotal * i.structurePct / 100
  const dryKg = subtotal + structureKg
  const pf = i.propPct / 100
  const propKg = dryKg * pf / (1 - pf)
  const wetKg = dryKg + propKg
  const totalKg = wetKg * p.satellites

  const projArea = 0.5 * (p.arrayM2 + p.radiatorM2) + BUS_AREA_M2
  const vMs = orbit.velocityKms * 1000
  const rho = airDensity(orbit.h) * i.solarActivity
  const dragDv = 0.5 * rho * vMs * vMs * CD * projArea / wetKg * SEC_YR
  const skDv = i.orbitType === 'geo' ? 50 : 2 // GEO N-S keeping; LEO phasing/collision avoidance
  let deorbitDv: number
  if (i.orbitType === 'geo') deorbitDv = 11 // +300 km graveyard orbit
  else {
    const r1 = orbit.a, r2 = RE + 250
    deorbitDv = vMs * (1 - Math.sqrt((2 * r2) / (r1 + r2))) // lower perigee to 250 km
  }
  const totalDv = i.ispS * G0 * Math.log(wetKg / dryKg)
  const annualDv = dragDv + skDv
  const stationLifeYr = Math.max(0, (totalDv - deorbitDv) / annualDv)
  const passiveDecayYr = passiveDecayYears(orbit.h, projArea, dryKg, i.solarActivity)
  if (totalDv < deorbitDv) warnings.push('Propellant is below the deorbit reserve.')

  return {
    computeKg, structureKg, dryKg, propKg, wetKg, totalKg,
    launches: Math.ceil(totalKg / 1000 / i.launchPayloadT),
    projArea, dragDv, annualDv, deorbitDv, stationLifeYr, passiveDecayYr, warnings,
  }
}
