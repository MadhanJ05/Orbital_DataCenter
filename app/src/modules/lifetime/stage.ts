import type { Stage } from '../../core/module'
import type { Inputs, Results } from '../../core/types'
import { yrs } from '../../core/format'

export function lifetimeStage(i: Inputs, r: Results): Stage {
  const lifeOk = r.life.usefulLifeYr >= i.missionLifeYr
  return {
    id: 'life',
    title: 'Lifetime',
    what: `No repair crews in orbit. Chips fail, arrays fade and radiation adds up; spares cover losses until capacity drops below ${i.usefulThresholdPct}%.`,
    metrics: [
      { label: 'Useful life', value: yrs(r.life.usefulLifeYr) },
      { label: 'First to wear out', value: r.life.limiter },
      { label: `Capacity at year ${i.missionLifeYr}`, value: `${r.life.capacityAtMissionEndPct.toFixed(0)}%` },
      { label: 'Average over mission', value: `${r.life.avgCapacityPct.toFixed(0)}%` },
    ],
    status: lifeOk ? { tone: 'good', text: 'Outlives the mission' } : { tone: 'bad', text: `Wears out before year ${i.missionLifeYr}` },
  }
}
