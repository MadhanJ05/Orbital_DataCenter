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
  eclipseCyclesYr: number // orbits per year that actually pass through shadow
  eclipseDaysPerYr: number // days per year with any eclipse
  inclinationDeg: number
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

// ---------------- Eclipse geometry ----------------
// Same method as agents-in-orbit/model.py (beta_deg, eclipse_fraction, eclipse_year) and agents-in-orbit/NOTES.md
// "Eclipses from the orbit geometry": step through the year daily, get the sun-orbit beta angle, and use the
// cylindrical-shadow formula for the fraction of each orbit in shadow. Shadow exists only while |beta| < beta* = asin(RE/a).
// Here beta comes from the full sun-vector / orbit-normal dot product so the same code serves SSO and precessing LEO.
// For a 06:00 LTAN plane it reduces to |beta| = |asin(sin(i - delta))|; Andrey's asin(sin(i + delta)) is the
// 18:00 LTAN mirror (eclipse season in June instead of December). Yearly statistics are identical.

const J2 = 1.08263e-3
const RE_EQ = 6378.137 // km, equatorial radius for the J2 term
const OBLIQUITY = 23.44 * Math.PI / 180
const DAYS_YR = 365.2422
const SUN_RATE = (2 * Math.PI) / (DAYS_YR * 86400) // rad/s, mean motion of the sun's right ascension
const DEG = Math.PI / 180
export const LTAN_H = 6 // local time of ascending node for SSO: fixed at 06:00 (dawn-dusk)
export const LEO_INC_DEG = 53 // mid-inclination LEO (Starlink-like shell)

/** J2 nodal precession rate (rad/s) of a circular orbit. */
export function nodalRate(hKm: number, incDeg: number) {
  const a = RE + hKm
  const n = Math.sqrt(MU / (a * a * a))
  return -1.5 * n * J2 * (RE_EQ / a) ** 2 * Math.cos(incDeg * DEG)
}

/** Sun-synchronous inclination: the J2 nodal precession matches the sun's 360 deg / 365.2422 days. */
export function ssoInclinationDeg(hKm: number) {
  const a = RE + hKm
  const n = Math.sqrt(MU / (a * a * a))
  const c = -SUN_RATE / (1.5 * n * J2 * (RE_EQ / a) ** 2)
  return c < -1 ? NaN : Math.acos(c) / DEG // above ~5,970 km no SSO exists
}

/** Fraction of one circular orbit inside Earth's cylindrical shadow at beta angle betaDeg (0 when |beta| >= beta*). */
export function eclipseFraction(hKm: number, betaDeg: number) {
  const a = RE + hKm
  const c = Math.cos(betaDeg * DEG)
  if (c <= 0) return 0
  const x = Math.sqrt(hKm * (2 * RE + hKm)) / (a * c)
  return x >= 1 ? 0 : Math.acos(x) / Math.PI
}

/** Beta angle (deg) on day `day` (0 = 1 Jan) for an orbit with inclination incDeg and right ascension of node raanRad. */
export function betaDeg(day: number, incDeg: number, raanRad: number) {
  const lam = (2 * Math.PI * (day - 79)) / DAYS_YR // sun's ecliptic longitude, 0 at the March equinox (~20 Mar)
  const sx = Math.cos(lam), sy = Math.cos(OBLIQUITY) * Math.sin(lam), sz = Math.sin(OBLIQUITY) * Math.sin(lam)
  const i = incDeg * DEG
  const nx = Math.sin(i) * Math.sin(raanRad), ny = -Math.sin(i) * Math.cos(raanRad), nz = Math.cos(i)
  return Math.asin(nx * sx + ny * sy + nz * sz) / DEG
}

export function sunRaRad(day: number) {
  const lam = (2 * Math.PI * (day - 79)) / DAYS_YR
  return Math.atan2(Math.cos(OBLIQUITY) * Math.sin(lam), Math.cos(lam))
}

export interface EclipseYear {
  fracAvg: number // year-average fraction of time in shadow
  maxFrac: number // longest single-orbit shadow fraction
  days: number // days with any eclipse
  minBetaDeg: number // smallest |beta| over the year
}

/** Daily sweep over one year. raan(day) gives the node's right ascension that day. */
export function eclipseYear(hKm: number, incDeg: number, raan: (day: number) => number): EclipseYear {
  let sum = 0, maxFrac = 0, days = 0, minBeta = 90
  for (let d = 0; d < 365; d++) {
    const b = betaDeg(d, incDeg, raan(d))
    const f = eclipseFraction(hKm, b)
    sum += f
    maxFrac = Math.max(maxFrac, f)
    if (f > 0) days++
    minBeta = Math.min(minBeta, Math.abs(b))
  }
  return { fracAvg: sum / 365, maxFrac, days: (days * DAYS_YR) / 365, minBetaDeg: minBeta }
}

/** Fraction of an orbit in Earth's shadow with the sun in the orbit plane (beta = 0, worst case). */
export function shadowFraction(hKm: number) {
  return eclipseFraction(hKm, 0)
}

export function runOrbit(i: OrbitInputs): OrbitModel {
  const h = altitude(i)
  const a = RE + h
  const periodS = 2 * Math.PI * Math.sqrt((a * a * a) / MU)
  const periodMin = periodS / 60
  const orbitsYr = SEC_YR / periodS
  const orbitsDay = 86400 / periodS
  let eclipseFracAvg: number, worstEclipseMin: number, eclipseCyclesYr: number, eclipseDaysPerYr: number, inclinationDeg: number
  if (i.orbitType === 'geo') {
    // Two ~45-day eclipse seasons around the equinoxes, max ~72 min/day
    eclipseFracAvg = 0.0075
    worstEclipseMin = 72
    eclipseCyclesYr = 90
    eclipseDaysPerYr = 90
    inclinationDeg = 0
  } else {
    let ey: EclipseYear
    if (i.orbitType === 'sso') {
      // Node locked to the sun: RAAN = sun RA + (LTAN - 12 h) x 15 deg/h
      inclinationDeg = ssoInclinationDeg(h)
      ey = eclipseYear(h, inclinationDeg, (d) => sunRaRad(d) + (LTAN_H - 12) * 15 * DEG)
    } else {
      // Mid-inclination LEO: node regresses under J2 (~-4.5 deg/day at 550 km) while the sun moves +1 deg/day,
      // so beta sweeps through 0 every ~2 months. Start node arbitrary (RAAN 0 on 1 Jan).
      inclinationDeg = LEO_INC_DEG
      const rate = nodalRate(h, inclinationDeg) * 86400
      ey = eclipseYear(h, inclinationDeg, (d) => rate * d)
    }
    eclipseFracAvg = ey.fracAvg
    worstEclipseMin = ey.maxFrac * periodMin
    eclipseDaysPerYr = ey.days
    // Satellites in one compact formation see the same shadow at the same time: these are per-satellite AND fleet
    // numbers, never averaged across the formation. Every orbit on an eclipse day is one battery cycle.
    eclipseCyclesYr = ey.days * orbitsDay
  }
  const relayMs = i.orbitType === 'geo' ? 10 : 20 // processing + relay hops
  const rttMs = (2 * h) / C_KMS * 1000 + relayMs
  const velocityKms = Math.sqrt(MU / a)
  return { h, a, periodS, periodMin, orbitsYr, eclipseFracAvg, worstEclipseMin, eclipseCyclesYr, eclipseDaysPerYr, inclinationDeg, rttMs, velocityKms }
}
