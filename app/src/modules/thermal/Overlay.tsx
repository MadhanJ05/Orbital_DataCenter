import type { OverlayProps } from '../../core/module'
import { fmt } from '../../core/format'
import { BUS, C, PANEL, Panel, RAD, Stream } from '../../ui/walkthrough/kit'

export function ThermalOverlay({ p, t, inputs, r, animate }: OverlayProps) {
  const grow = Math.min(1, p * 1.5)
  const { x, y } = PANEL
  return (
    <>
      {animate && (
        <>
          <Stream from={[380, BUS.y + 4]} to={[380, RAD.y + RAD.h - 4]} n={5} t={t} speed={1.2} color={C.heat} r={3} />
          {[0, 1, 2].map((k) => {
            const u = (t * 0.8 + k / 3) % 1
            return (
              <g key={k} opacity={1 - u} stroke={C.heat} fill="none" strokeWidth="1.5">
                <path d={`M ${RAD.x - 6 - u * 40} ${RAD.y + 20} q -6 12 0 24 q 6 12 0 24`} />
                <path d={`M ${RAD.x + RAD.w + 6 + u * 40} ${RAD.y + 20} q 6 12 0 24 q -6 12 0 24`} />
              </g>
            )
          })}
        </>
      )}
      <Panel>
        <text x={x + 12} y={y + 26} className="sc-label">Heat rejected per satellite</text>
        <text x={x + 12} y={y + 62} className="sc-big">{fmt(r.power.loadKwPerSat * grow)} kW</text>
        <text x={x + 12} y={y + 84} className="sc-label">{fmt(r.thermal.radiatorFluxWm2)} W/m² at {inputs.radiatorTempK} K</text>
        <text x={x + 12} y={y + 104} className="sc-label">σT⁴: +10% temp → −32% area</text>
      </Panel>
    </>
  )
}
