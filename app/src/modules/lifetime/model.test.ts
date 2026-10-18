import { describe, expect, it } from 'vitest'
import { simulate } from '../../core/pipeline'
import { BASELINE } from '../../scenarios/presets'

describe('lifetime', () => {
  it('more spares extend useful life', () => {
    const few = simulate({ ...BASELINE, sparesPct: 5 }).life.usefulLifeYr
    const many = simulate({ ...BASELINE, sparesPct: 30 }).life.usefulLifeYr
    expect(many).toBeGreaterThan(few)
  })
  it('GEO radiation kills today-tolerance chips within ~2 years', () => {
    const r = simulate({ ...BASELINE, orbitType: 'geo', doseRateRadYr: 1500 })
    expect(r.life.usefulLifeYr).toBeLessThan(2)
  })
})
