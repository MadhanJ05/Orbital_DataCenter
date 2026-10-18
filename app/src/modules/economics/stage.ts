import type { Stage } from '../../core/module'
import type { Inputs, Results } from '../../core/types'
import { usd, usdM } from '../../core/format'

export function economicsStage(i: Inputs, r: Results): Stage {
  const ratio = r.econ.lcocPerChipHr / r.terrestrial.lcocPerChipHr
  return {
    id: 'econ',
    title: 'Economics',
    what: 'All costs spread over every accelerator-hour delivered, compared with the same chips in a data center on the ground.',
    metrics: [
      { label: 'Cost per accelerator-hour', value: usd(r.econ.lcocPerChipHr, 3) },
      { label: 'Same on the ground', value: usd(r.terrestrial.lcocPerChipHr, 3) },
      { label: 'Capex', value: usdM(r.econ.capexM) },
      { label: `NPV (${i.missionLifeYr} yr)`, value: usdM(r.econ.npvM) },
    ],
    status: ratio <= 1 ? { tone: 'good', text: 'Cheaper than ground' } : ratio <= 1.5 ? { tone: 'warn', text: `${ratio.toFixed(2)}x ground cost` } : { tone: 'bad', text: `${ratio.toFixed(1)}x ground cost` },
  }
}
