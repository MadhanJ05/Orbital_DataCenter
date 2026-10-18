import { describe, expect, it } from 'vitest'
import { airDensity, eclipseFraction, orbitDefaults, runOrbit, ssoInclinationDeg } from './model'
import { RE } from '../../core/constants'

describe('orbit', () => {
  it('650 km dawn-dusk SSO: ~97.6 min period', () => {
    const o = runOrbit(orbitDefaults)
    expect(o.periodMin).toBeCloseTo(97.6, 1)
  })
  it('575 km dawn-dusk SSO matches agents-in-orbit: ~21 min worst eclipse, ~4.6% of the year, ~96 days', () => {
    const o = runOrbit({ ...orbitDefaults, altitudeKm: 575 })
    expect(o.worstEclipseMin).toBeGreaterThan(20.5)
    expect(o.worstEclipseMin).toBeLessThan(21.5)
    expect(o.eclipseFracAvg).toBeGreaterThan(0.043)
    expect(o.eclipseFracAvg).toBeLessThan(0.049)
    expect(o.eclipseDaysPerYr).toBeGreaterThan(90)
    expect(o.eclipseDaysPerYr).toBeLessThan(100)
    // battery cycles: every orbit on an eclipse day, not every orbit of the year
    expect(o.eclipseCyclesYr).toBeCloseTo((o.eclipseDaysPerYr * 86400) / o.periodS, 0)
  })
  it('SSO inclination from J2 precession: ~97.9-98.0 deg at 650 km', () => {
    const inc = ssoInclinationDeg(650)
    expect(inc).toBeGreaterThan(97.9)
    expect(inc).toBeLessThan(98.0)
    expect(runOrbit(orbitDefaults).inclinationDeg).toBeCloseTo(inc, 6)
  })
  it('no eclipse once beta exceeds beta* = asin(RE / a)', () => {
    const h = 650
    const betaStar = (Math.asin(RE / (RE + h)) * 180) / Math.PI
    expect(eclipseFraction(h, betaStar + 0.1)).toBe(0)
    expect(eclipseFraction(h, -(betaStar + 0.1))).toBe(0)
    expect(eclipseFraction(h, betaStar - 1)).toBeGreaterThan(0)
    expect(eclipseFraction(h, 0)).toBeGreaterThan(eclipseFraction(h, 30))
  })
  it('high dawn-dusk SSO never sees shadow', () => {
    const o = runOrbit({ ...orbitDefaults, altitudeKm: 1500 })
    expect(o.eclipseFracAvg).toBe(0)
    expect(o.eclipseCyclesYr).toBe(0)
  })
  it('LEO 550 km at 53 deg spends roughly a third of each orbit in shadow, worst at beta = 0', () => {
    const o = runOrbit({ ...orbitDefaults, orbitType: 'leo', altitudeKm: 550 })
    expect(o.eclipseFracAvg).toBeGreaterThan(0.28)
    expect(o.eclipseFracAvg).toBeLessThan(0.36)
    expect(o.worstEclipseMin).toBeCloseTo(eclipseFraction(550, 0) * o.periodMin, 0)
  })
  it('GEO unchanged: one sidereal day, ~250 ms latency, equinox seasons', () => {
    const o = runOrbit({ ...orbitDefaults, orbitType: 'geo' })
    expect(o.periodMin).toBeCloseTo(1436, 0)
    expect(o.rttMs).toBeGreaterThan(240)
    expect(o.eclipseFracAvg).toBe(0.0075)
    expect(o.worstEclipseMin).toBe(72)
    expect(o.eclipseCyclesYr).toBe(90)
  })
  it('air density falls with altitude', () => {
    expect(airDensity(400)).toBeGreaterThan(airDensity(650))
    expect(airDensity(36000)).toBe(0)
  })
})
