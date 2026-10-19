import type { OverlayProps } from '../../core/module'
import { fmt } from '../../core/format'
import { PANEL, Panel } from '../../ui/walkthrough/kit'

export function ComputeOverlay({ p, inputs, r }: OverlayProps) {
  const grow = Math.min(1, p * 1.5)
  const { x, y } = PANEL
  const sv = r.compute.serving
  if (inputs.workload === 'training' || !sv) {
    return (
      <Panel>
        <text x={x + 12} y={y + 26} className="sc-label">Effective compute</text>
        <text x={x + 12} y={y + 62} className="sc-big">{fmt(r.compute.effectiveEflopsBol * grow)}</text>
        <text x={x + 12} y={y + 80} className="sc-label">EFLOPS</text>
        <text x={x + 12} y={y + 104} className="sc-label">Train in {fmt(r.compute.trainDays)} days</text>
      </Panel>
    )
  }
  return (
    <Panel>
      <text x={x + 12} y={y + 26} className="sc-label">Users served at peak</text>
      <text x={x + 12} y={y + 62} className="sc-big">{sv.feasible ? fmt(sv.usersAtPeak * grow) : 'infeasible'}</text>
      <text x={x + 12} y={y + 84} className="sc-label">{fmt(sv.sessionsPerChip)} users/chip · {sv.bound}</text>
      <text x={x + 12} y={y + 104} className="sc-label">First token {sv.feasible ? sv.ttftS.toFixed(2) : '—'} s · {inputs.tokPerSecSlo} tok/s</text>
    </Panel>
  )
}
