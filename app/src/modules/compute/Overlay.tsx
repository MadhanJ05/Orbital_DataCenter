import type { OverlayProps } from '../../core/module'
import { fmt } from '../../core/format'
import { PANEL, Panel } from '../../ui/walkthrough/kit'

export function ComputeOverlay({ p, inputs, r }: OverlayProps) {
  const grow = Math.min(1, p * 1.5)
  const { x, y } = PANEL
  return (
    <Panel>
      <text x={x + 12} y={y + 26} className="sc-label">Effective compute</text>
      <text x={x + 12} y={y + 62} className="sc-big">{fmt(r.compute.effectiveEflopsBol * grow)}</text>
      <text x={x + 12} y={y + 80} className="sc-label">EFLOPS (FP8)</text>
      <text x={x + 12} y={y + 104} className="sc-label">
        {inputs.workload === 'training' ? `Train in ${fmt(r.compute.trainDays)} days` : `${fmt(r.compute.tokensPerSec * grow)} tokens/s`}
      </text>
    </Panel>
  )
}
