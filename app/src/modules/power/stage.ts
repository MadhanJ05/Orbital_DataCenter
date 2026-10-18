import type { Stage } from '../../core/module'
import type { Inputs, Results } from '../../core/types'
import { fmt } from '../../core/format'

export function powerStage(i: Inputs, r: Results): Stage {
  return {
    id: 'power',
    title: 'Power',
    what: `Sunlight hits ${fmt(r.power.arrayM2PerSat)} m² of ${i.solarEffPct}%-efficient cells per satellite. Batteries carry the load through ${r.orbit.worstEclipseMin.toFixed(0)}-minute eclipses.`,
    metrics: [
      { label: 'Load per satellite', value: `${fmt(r.power.loadKwPerSat)} kW` },
      { label: 'Solar array', value: `${fmt(r.power.arrayKwPerSat)} kW` },
      { label: 'Battery', value: `${fmt(r.power.batteryKwhPerSat)} kWh` },
      { label: 'Time in shadow', value: `${(r.orbit.eclipseFracAvg * 100).toFixed(1)}%` },
    ],
    status: !i.computeInEclipse && r.orbit.eclipseFracAvg > 0.05
      ? { tone: 'warn', text: `Compute pauses ${(r.orbit.eclipseFracAvg * 100).toFixed(0)}% of the time` }
      : { tone: 'good', text: 'Power balanced' },
  }
}
