import { describe, expect, it } from 'vitest'
import { airDensity, orbitDefaults, runOrbit } from './model'

describe('orbit', () => {
  it('650 km dawn-dusk SSO: ~97.6 min period, ~1.5% shadow', () => {
    const o = runOrbit(orbitDefaults)
    expect(o.periodMin).toBeCloseTo(97.6, 1)
    expect(o.eclipseFracAvg).toBe(0.015)
  })
  it('LEO 550 km spends roughly a third of each orbit in shadow', () => {
    const o = runOrbit({ ...orbitDefaults, orbitType: 'leo', altitudeKm: 550 })
    expect(o.eclipseFracAvg).toBeGreaterThan(0.3)
    expect(o.eclipseFracAvg).toBeLessThan(0.4)
  })
  it('GEO period is one sidereal day and latency is ~250 ms', () => {
    const o = runOrbit({ ...orbitDefaults, orbitType: 'geo' })
    expect(o.periodMin).toBeCloseTo(1436, 0)
    expect(o.rttMs).toBeGreaterThan(240)
  })
  it('air density falls with altitude', () => {
    expect(airDensity(400)).toBeGreaterThan(airDensity(650))
    expect(airDensity(36000)).toBe(0)
  })
})
