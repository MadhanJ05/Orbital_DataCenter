import type { OverlayProps } from '../../core/module'
import { usd } from '../../core/format'
import { C, PANEL, Panel, PanelBar } from '../../ui/walkthrough/kit'

export function EconomicsOverlay({ p, r }: OverlayProps) {
  const grow = Math.min(1, p * 1.5)
  const max = Math.max(r.econ.lcocPerChipHr, r.terrestrial.lcocPerChipHr)
  const { x, y } = PANEL
  return (
    <Panel>
      <PanelBar label="Orbit" value={`${usd(r.econ.lcocPerChipHr * grow, 3)}/hr`} frac={(r.econ.lcocPerChipHr / max) * grow} y={y + 24} color={C.panel} h={12} />
      <PanelBar label="Ground" value={`${usd(r.terrestrial.lcocPerChipHr * grow, 3)}/hr`} frac={(r.terrestrial.lcocPerChipHr / max) * grow} y={y + 60} color={C.muted} h={12} />
      <text x={x + 12} y={y + 106} className="sc-label">Cost per accelerator-hour</text>
    </Panel>
  )
}
