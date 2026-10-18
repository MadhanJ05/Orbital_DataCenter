import type { OverlayProps } from '../../core/module'
import { C, PANEL, Panel } from '../../ui/walkthrough/kit'
import { lifeClock } from './clock'

export function LifetimeOverlay({ p, inputs, r }: OverlayProps) {
  const { lifeYears, lifeT, point } = lifeClock(p, inputs, r)
  const { x, y, w } = PANEL
  const px = (yr: number) => x + 12 + (yr / lifeYears) * (w - 24)
  const py = (pct: number) => y + 96 - (Math.min(pct, 110) / 110) * 66
  const pts = r.series.filter((s) => s.year <= lifeT).map((s) => `${px(s.year)},${py(s.capacityPct)}`).join(' ')
  return (
    <Panel>
      <text x={x + 12} y={y + 20} className="sc-label">Year {lifeT.toFixed(1)} · capacity {point.capacityPct.toFixed(0)}%</text>
      <line x1={x + 12} y1={py(inputs.usefulThresholdPct)} x2={x + w - 12} y2={py(inputs.usefulThresholdPct)} stroke={C.muted} strokeDasharray="3 3" />
      <line x1={px(inputs.missionLifeYr)} y1={y + 28} x2={px(inputs.missionLifeYr)} y2={y + 96} stroke={C.muted} strokeDasharray="3 3" />
      <polyline points={pts} fill="none" stroke={C.chipOn} strokeWidth="2" />
      <text x={x + 12} y={y + 110} className="sc-label">Useful life {r.life.usefulLifeYr >= 25 ? '25+' : r.life.usefulLifeYr.toFixed(1)} yr</text>
    </Panel>
  )
}
