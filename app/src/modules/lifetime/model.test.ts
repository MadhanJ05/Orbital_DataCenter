import { describe, expect, it } from 'vitest'
import { simulate } from '../../core/pipeline'
import { BASELINE } from '../../scenarios/presets'
import { lifetimeDefaults, tidCapacityFactor } from './model'

const tid = lifetimeDefaults

describe('lifetime', () => {
  it('more spares extend useful life', () => {
    const few = simulate({ ...BASELINE, sparesPct: 5 }).life.usefulLifeYr
    const many = simulate({ ...BASELINE, sparesPct: 30 }).life.usefulLifeYr
    expect(many).toBeGreaterThan(few)
  })
  it('dose below onset causes no TID losses', () => {
    expect(tidCapacityFactor(0, tid)).toBe(1)
    expect(tidCapacityFactor(tid.tidOnsetKrad * 1000, tid)).toBe(1)
    // 50 rad/yr stays under the 2 krad onset for the whole 25-year horizon: same chips as zero dose.
    const low = simulate({ ...BASELINE, doseRateRadYr: 50 }).series.map((p) => p.chipsPct)
    const none = simulate({ ...BASELINE, doseRateRadYr: 0 }).series.map((p) => p.chipsPct)
    expect(low).toEqual(none)
  })
  it('dose between onset and hard-failure dose degrades gradually, not a cliff', () => {
    let prev = 1
    for (let krad = tid.tidOnsetKrad; krad <= tid.tidHardFailKrad; krad += 0.1) {
      const f = tidCapacityFactor(krad * 1000, tid)
      expect(f).toBeLessThanOrEqual(prev)
      expect(prev - f).toBeLessThan(0.01) // under 1% lost per 0.1 krad
      prev = f
    }
    const mid = tidCapacityFactor(8000, tid)
    expect(mid).toBeGreaterThan(0.5)
    expect(mid).toBeLessThan(0.9)
    expect(tidCapacityFactor(tid.tidHardFailKrad * 1000, tid)).toBeGreaterThan(0)
  })
  it('chips hard-fail beyond the hard-failure dose', () => {
    expect(tidCapacityFactor(tid.tidHardFailKrad * 1.5 * 1000, tid)).toBeLessThan(0.01)
  })
  it('GEO high dose still degrades badly', () => {
    const sso = simulate(BASELINE)
    const geo = simulate({ ...BASELINE, orbitType: 'geo', doseRateRadYr: 1500 })
    expect(geo.life.usefulLifeYr).toBeLessThan(BASELINE.missionLifeYr)
    expect(geo.life.usefulLifeYr).toBeLessThan(sso.life.usefulLifeYr - 2)
    // Past the 15 krad hard-failure dose (year 10) almost nothing is left.
    expect(geo.series.find((p) => p.year >= 12)!.chipsPct).toBeLessThan(5)
  })
})
