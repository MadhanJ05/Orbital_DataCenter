import type { Stage } from '../../core/module'
import type { Inputs, Results } from '../../core/types'
import { yrs } from '../../core/format'

/** Orbit and comms share one walkthrough step: where the satellite flies and how data gets home. */
export function orbitStage(_i: Inputs, r: Results): Stage {
  const commsOver = r.comms.utilizationPct > 100
  return {
    id: 'orbit',
    title: 'Orbit & comms',
    what: `Circling Earth every ${r.orbit.periodMin.toFixed(0)} minutes. Laser links carry data to the ground with a ${r.orbit.rttMs.toFixed(0)} ms round trip.`,
    metrics: [
      { label: 'Round-trip latency', value: `${r.orbit.rttMs.toFixed(0)} ms` },
      { label: 'Ground link load', value: `${r.comms.utilizationPct < 0.1 ? '<0.1' : r.comms.utilizationPct.toFixed(1)}%` },
      { label: 'Drag to make up', value: `${r.propulsion.dragDvMsYr.toFixed(1)} m/s/yr` },
      { label: 'Reentry if it dies', value: isFinite(r.propulsion.passiveDecayYr) ? yrs(r.propulsion.passiveDecayYr) : 'Never' },
    ],
    status: commsOver ? { tone: 'bad', text: 'Ground link oversubscribed' } : r.orbit.rttMs > 150 ? { tone: 'warn', text: 'Too slow for live chat' } : { tone: 'good', text: 'Link has headroom' },
  }
}
