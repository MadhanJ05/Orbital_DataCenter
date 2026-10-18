import { describe, expect, it } from 'vitest'
import { orbitDefaults, runOrbit } from '../orbit/model'
import { massDefaults, runMass } from './model'
import { simulate } from '../../core/pipeline'
import { SCENARIOS } from '../../scenarios/presets'
import assumptions from '../../../../shared/assumptions.json'

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
  it.each([['deck', 'deck'], ['light', 'light']] as const)('%s preset reproduces the shared mass split', (id, key) => {
    const split = assumptions.mass_t_per_mw[key]
    const r = simulate(SCENARIOS.find((s) => s.id === id)!.inputs)
    const itKw = r.power.loadKwPerSat / (1 + SCENARIOS[0].inputs.busPowerPct / 100)
    const line = (...names: string[]) => r.mass.breakdownKgPerSat.filter((b) => names.includes(b.name)).reduce((s, b) => s + b.kg, 0) / itKw
    expect(line('Compute nodes')).toBeCloseTo(split.compute, 6)
    expect(line('Solar arrays', 'Batteries')).toBeCloseTo(split.solar, 6)
    expect(line('Radiators')).toBeCloseTo(split.radiators, 6)
    expect(line('Structure', 'Bus avionics/comms')).toBeCloseTo(split.structure, 6)
    expect(r.mass.dryKgPerKw).toBeCloseTo(split.total, 2)
  })
})
