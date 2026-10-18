import type { OverlayProps } from '../../core/module'
import { BUS, C, GROUND, PANEL, Panel, Stream } from '../../ui/walkthrough/kit'

export function OrbitOverlay({ p, t, r, animate }: OverlayProps) {
  const { x, y } = PANEL
  const cx = x + 46, cy = y + 60, ro = 32
  const a = p * Math.PI * 2 * 2
  return (
    <>
      {animate && (
        <>
          <Stream from={[386, GROUND[1] - 10]} to={[386, BUS.y + BUS.h + 10]} n={6} t={t} speed={1.1} color={C.data} />
          <Stream from={[374, BUS.y + BUS.h + 10]} to={[374, GROUND[1] - 10]} n={6} t={t} speed={1.1} color={C.chipOn} />
        </>
      )}
      <Panel>
        <circle cx={cx} cy={cy} r="14" fill={C.earth} />
        <circle cx={cx} cy={cy} r={ro} fill="none" stroke={C.muted} strokeDasharray="2 3" />
        <circle cx={cx + ro * Math.cos(a)} cy={cy + ro * Math.sin(a)} r="4" fill={C.text} />
        <text x={x + 92} y={y + 40} className="sc-label">Period</text>
        <text x={x + 92} y={y + 58} className="sc-label strong">{r.orbit.periodMin.toFixed(0)} min</text>
        <text x={x + 92} y={y + 80} className="sc-label">Latency</text>
        <text x={x + 92} y={y + 98} className="sc-label strong">{r.orbit.rttMs.toFixed(0)} ms</text>
      </Panel>
    </>
  )
}
