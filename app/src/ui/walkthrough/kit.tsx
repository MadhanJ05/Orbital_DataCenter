// Shared drawing kit for the walkthrough: colors, satellite geometry, particle streams, overlay panel.
// Module overlays (modules/<name>/Overlay.tsx) draw on the same 760x380 frame using these.
import type { ReactNode } from 'react'

export type Pt = [number, number]

export const C = {
  bg0: '#070c18', bg1: '#111a2e', star: '#c3c2b7', earth: '#184f95', atmo: '#3987e5',
  panel: '#2a78d6', panelLine: '#86b6ef', bus: '#383835', busEdge: '#c3c2b7', chipOn: '#1baf7a', chipOff: '#2c2c2a',
  radiator: '#e1e0d9', heat: '#eb6834', photon: '#fab219', data: '#86b6ef', text: '#f0efec', muted: '#898781',
}

export const SUN: Pt = [70, 70]
export const BUS = { x: 330, y: 150, w: 100, h: 80 }
export const ARR_L = { x: 120, y: 165, w: 190, h: 50 }
export const ARR_R = { x: 450, y: 165, w: 190, h: 50 }
export const RAD = { x: 350, y: 52, w: 60, h: 90 }
export const GROUND: Pt = [380, 352]
export const PANEL = { x: 556, y: 22, w: 190, h: 118 } // top-right overlay panel

export function along(a: Pt, b: Pt, u: number): Pt {
  return [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u]
}

/** Looping particles from one point to another (sunlight, power, heat, data). */
export function Stream({ from, to, n, t, speed, color, r = 2.5 }: { from: Pt; to: Pt; n: number; t: number; speed: number; color: string; r?: number }) {
  return (
    <g>
      {Array.from({ length: n }, (_, k) => {
        const u = (t * speed + k / n) % 1
        const [x, y] = along(from, to, u)
        return <circle key={k} cx={x} cy={y} r={r} fill={color} opacity={Math.sin(u * Math.PI)} />
      })}
    </g>
  )
}

/** The dark panel in the top-right corner that holds a step's mini chart or big number. */
export function Panel({ children }: { children: ReactNode }) {
  return (
    <g>
      <rect x={PANEL.x} y={PANEL.y} width={PANEL.w} height={PANEL.h} rx="10" fill="#0d0d0d" fillOpacity="0.75" stroke="rgba(255,255,255,0.12)" />
      {children}
    </g>
  )
}

/** Horizontal bar with label and value, for panel comparisons. */
export function PanelBar({ label, value, frac, y, color, h = 10 }: { label: string; value: string; frac: number; y: number; color: string; h?: number }) {
  const { x, w } = PANEL
  return (
    <g>
      <text x={x + 12} y={y} className="sc-label">{label}</text>
      <rect x={x + 12} y={y + 5} width={Math.max(0, (w - 24) * frac)} height={h} rx="3" fill={color} />
      <text x={x + w - 12} y={y} textAnchor="end" className="sc-label strong">{value}</text>
    </g>
  )
}
