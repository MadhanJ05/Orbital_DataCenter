import { C_KMS, GEO_ALT, MU, RE, SEC_YR } from '../../core/constants'

export type OrbitType = 'sso' | 'leo' | 'geo'

export interface OrbitInputs {
  orbitType: OrbitType
  altitudeKm: number
  solarActivity: number // atmospheric density multiplier (1 = moderate, 2-3 = solar max)
}

export const orbitDefaults: OrbitInputs = {
  orbitType: 'sso',
  altitudeKm: 650,
  solarActivity: 1,
}

export interface OrbitModel {
  h: number
  a: number
  periodS: number
  periodMin: number
  orbitsYr: number
  eclipseFracAvg: number
  worstEclipseMin: number
  eclipseCyclesYr: number
  rttMs: number
  velocityKms: number
}

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

export function altitude(i: OrbitInputs) {
  return i.orbitType === 'geo' ? GEO_ALT : i.altitudeKm
}

/** Fraction of an orbit in Earth's shadow for a circular orbit with sun in the orbit plane (beta = 0, worst case). */
export function shadowFraction(hKm: number) {
  const a = RE + hKm
  return Math.acos(Math.sqrt(hKm * (2 * RE + hKm)) / a) / Math.PI
}

export function runOrbit(i: OrbitInputs): OrbitModel {
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
