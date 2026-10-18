import { describe, expect, it } from 'vitest'
import { simulate } from '../../core/pipeline'
import { BASELINE } from '../../scenarios/presets'

describe('economics', () => {
  it('cheaper launch lowers cost per accelerator-hour', () => {
    const a = simulate({ ...BASELINE, launchCostPerKg: 1000 }).econ.lcocPerChipHr
    const b = simulate({ ...BASELINE, launchCostPerKg: 100 }).econ.lcocPerChipHr
    expect(b).toBeLessThan(a)
  })
  it('capex breakdown sums to total capex', () => {
    const r = simulate(BASELINE)
    const sum = r.econ.capexBreakdownM.reduce((s, c) => s + c.usd, 0)
    expect(sum).toBeCloseTo(r.econ.capexM, 6)
  })
})
