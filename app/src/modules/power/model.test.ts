import { describe, expect, it } from 'vitest'
import { orbitDefaults, runOrbit } from '../orbit/model'
import { powerDefaults, runPower } from './model'

describe('power', () => {
  const orbit = runOrbit(orbitDefaults)
  it('array covers load plus margin', () => {
    const p = runPower(powerDefaults, orbit, 80_000)
    expect(p.arrayW).toBeGreaterThan(p.loadW * 1.2)
  })
  it('pausing compute in eclipse shrinks the battery and costs availability', () => {
    const on = runPower(powerDefaults, orbit, 80_000)
    const off = runPower({ ...powerDefaults, computeInEclipse: false }, orbit, 80_000)
    expect(off.batteryWh).toBeLessThan(on.batteryWh)
    expect(off.availability).toBeLessThan(1)
  })
})
