import type { OverlayProps } from '../../core/module'
import { fmt } from '../../core/format'
import { C, PANEL, Panel } from '../../ui/walkthrough/kit'

function Rocket({ p, launches }: { p: number; launches: number }) {
  const y = 330 - Math.min(1, p * 1.3) * 230
  return (
    <g transform={`translate(70 ${y})`}>
      <path d="M 0 -26 Q 9 -14 9 4 L 9 18 L -9 18 L -9 4 Q -9 -14 0 -26 Z" fill={C.text} />
      <path d="M -9 10 L -16 22 L -9 18 Z M 9 10 L 16 22 L 9 18 Z" fill={C.muted} />
      <path d={`M -6 20 Q 0 ${36 + 8 * Math.sin(p * 40)} 6 20 Z`} fill={C.heat} />
      <text x="20" y="0" className="sc-label">× {launches}</text>
    </g>
  )
}

export function MassOverlay({ p, r }: OverlayProps) {
  const grow = Math.min(1, p * 1.5)
  const { x, y, w } = PANEL
  const items = r.mass.breakdownKgPerSat.filter((m) => m.kg > 0)
  const colors = [C.chipOn, C.panel, C.radiator, C.photon, C.busEdge, C.muted, C.heat]
  const kg = (name: string) => items.find((m) => m.name === name)?.kg ?? 0
  let acc = 0
  return (
    <>
      <Rocket p={p} launches={r.mass.launches} />
      <Panel>
        <text x={x + 12} y={y + 24} className="sc-label">Mass per satellite · {fmt(r.mass.wetKgPerSat)} kg</text>
        {items.map((m, k) => {
          const bw = (w - 24) * (m.kg / r.mass.wetKgPerSat) * grow
          const el = <rect key={m.name} x={x + 12 + acc} y={y + 34} width={Math.max(0, bw - 2)} height="16" fill={colors[k % colors.length]} rx="2"><title>{m.name}: {fmt(m.kg)} kg</title></rect>
          acc += bw
          return el
        })}
        <text x={x + 12} y={y + 70} className="sc-label">Solar {fmt(kg('Solar arrays'))} · radiators {fmt(kg('Radiators'))} kg</text>
        <text x={x + 12} y={y + 98} className="sc-label strong">{fmt(r.mass.totalT)} t total · {r.mass.launches} launch{r.mass.launches === 1 ? '' : 'es'}</text>
      </Panel>
    </>
  )
}
