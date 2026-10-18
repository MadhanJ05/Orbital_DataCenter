import { describe, expect, it } from 'vitest'
import { commsDefaults, runComms } from './model'

describe('comms', () => {
  it('throttles throughput when the ground link is oversubscribed', () => {
    const c = runComms({ ...commsDefaults, linkGbpsPerSat: 1 }, 1e9, 1)
    expect(c.utilizationPct).toBeGreaterThan(100)
    expect(c.cap).toBeLessThan(1)
    expect(c.warnings.length).toBe(1)
  })
})
