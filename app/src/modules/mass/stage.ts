import type { Stage } from '../../core/module'
import type { Inputs, Results } from '../../core/types'
import { fmt, usdM } from '../../core/format'

export function massStage(_i: Inputs, r: Results): Stage {
  return {
    id: 'mass',
    title: 'Mass & launch',
    what: `Each satellite weighs ${fmt(r.mass.wetKgPerSat)} kg. Solar arrays and radiators, not chips, dominate the mass that has to be launched.`,
    metrics: [
      { label: 'Mass to orbit', value: `${fmt(r.mass.totalT)} t` },
      { label: 'Launches', value: `${r.mass.launches}` },
      { label: 'Dry mass per MW of IT', value: `${fmt(r.mass.dryKgPerKw)} t (deck: 18)` },
      { label: 'Launch bill', value: usdM(r.econ.capexBreakdownM.find((c) => c.name === 'Launch')?.usd ?? 0) },
    ],
    status: { tone: 'neutral', text: `${r.mass.launches} launch${r.mass.launches === 1 ? '' : 'es'}` },
  }
}
