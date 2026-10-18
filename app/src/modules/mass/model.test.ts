import { describe, expect, it } from 'vitest'
import { orbitDefaults, runOrbit } from '../orbit/model'
import { massDefaults, runMass } from './model'

const parts = { chipsPerSatProv: 37, serverKgPerChip: 10, arrayKg: 650, batteryKg: 214, radiatorKg: 396, arrayM2: 365, radiatorM2: 99, satellites: 81 }

describe('mass & propulsion', () => {
  it('propellant is the configured share of wet mass', () => {
    const i = { ...massDefaults, ...orbitDefaults }
    const m = runMass(i, runOrbit(i), parts)
    expect(m.propKg / m.wetKg).toBeCloseTo(massDefaults.propPct / 100, 9)
  })
  it('lower orbits burn more propellant against drag', () => {
    const hi = { ...massDefaults, ...orbitDefaults, altitudeKm: 650 }
    const lo = { ...massDefaults, ...orbitDefaults, altitudeKm: 450 }
    expect(runMass(lo, runOrbit(lo), parts).dragDv).toBeGreaterThan(runMass(hi, runOrbit(hi), parts).dragDv)
  })
})
