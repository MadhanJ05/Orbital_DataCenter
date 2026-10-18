import { describe, expect, it } from 'vitest'
import { runThermal, thermalDefaults } from './model'

describe('thermal', () => {
  it('deck radiator (330 K, 220 K sink, e=0.9, two-sided) rejects ~972 W/m²', () => {
    const t = runThermal(thermalDefaults, 100_000)
    expect(t.fluxWm2).toBeGreaterThan(965)
    expect(t.fluxWm2).toBeLessThan(980)
  })
  it('warns when the radiator is colder than its sink', () => {
    const t = runThermal({ ...thermalDefaults, radiatorTempK: 200 }, 100_000)
    expect(t.warnings.length).toBe(1)
  })
})
