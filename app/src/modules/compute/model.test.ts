import { describe, expect, it } from 'vitest'
import { computeDefaults, runCompute, throughput } from './model'

const training = { ...computeDefaults, workload: 'training' as const, activeParamsB: 2000 }

describe('compute', () => {
  it('training compute = 6 x params x tokens', () => {
    const c = runCompute(training)
    expect(c.trainFlops).toBeCloseTo(6 * 2000e9 * 100e12, -20)
  })
  it('spares round up per satellite', () => {
    const c = runCompute({ ...computeDefaults, chipsPerSat: 32, sparesPct: 15 })
    expect(c.chipsPerSatProv).toBe(37)
  })
  it('inference makes 3x more tokens per FLOP than training', () => {
    const tr = throughput(training, runCompute(training), 1)
    const inf = { ...training, workload: 'inference' as const }
    const ti = throughput(inf, runCompute(inf), 1)
    expect(ti.tokensPerSec / tr.tokensPerSec).toBeCloseTo(3, 6)
  })
})
