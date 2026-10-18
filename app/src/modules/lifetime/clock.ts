import type { Inputs, Results } from '../../core/types'

/** During the lifetime step the walkthrough scrubs through the satellite's years. */
export function lifeClock(p: number, i: Inputs, r: Results) {
  const lifeYears = Math.min(25, i.missionLifeYr * 1.6)
  const lifeT = p * lifeYears
  const point = r.series.reduce((a, b) => (Math.abs(b.year - lifeT) < Math.abs(a.year - lifeT) ? b : a), r.series[0])
  return { lifeYears, lifeT, point }
}
