import type { Inputs, Results } from '../../core/types'

/** Schematic view from above the orbit plane: Sun to the left, Earth's shadow to the right. */
export function OrbitDiagram({ inputs, r }: { inputs: Inputs; r: Results }) {
  const h = inputs.orbitType === 'geo' ? 35786 : inputs.altitudeKm
  const cx = 150, cy = 110, re = 46
  const ro = re + 14 + 70 * Math.sqrt(h / 35786)
  const worstFrac = r.orbit.worstEclipseMin / r.orbit.periodMin
  const half = Math.PI * worstFrac // eclipse arc centred on the anti-sun direction
  const arc = (a0: number, a1: number) => {
    const p = (a: number) => `${cx + ro * Math.cos(a)} ${cy + ro * Math.sin(a)}`
    return `M ${p(a0)} A ${ro} ${ro} 0 ${a1 - a0 > Math.PI ? 1 : 0} 1 ${p(a1)}`
  }
  const periodS = Math.max(4, Math.min(20, r.orbit.periodMin / 8))
  const label = inputs.orbitType === 'sso' ? 'Dawn-dusk SSO (eclipse arc = worst season)' : inputs.orbitType === 'geo' ? 'GEO (eclipse arc = equinox season)' : 'LEO (eclipse arc = sun in orbit plane)'
  return (
    <figure className="orbit">
      <svg viewBox="0 0 300 220" role="img" aria-label={`Orbit schematic: ${label}`}>
        <defs>
          <linearGradient id="sun" x1="0" x2="1">
            <stop offset="0" stopColor="var(--warn)" stopOpacity="0.35" />
            <stop offset="1" stopColor="var(--warn)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <rect x="0" y="0" width="70" height="220" fill="url(#sun)" />
        <text x="8" y="16" className="svg-muted">☀ Sun</text>
        <rect x={cx} y={cy - re} width={300 - cx} height={re * 2} fill="var(--shadow)" />
        <circle cx={cx} cy={cy} r={ro} fill="none" stroke="var(--axis)" strokeDasharray="3 3" />
        {half > 0.001 && <path d={arc(-half, half)} fill="none" stroke="var(--critical)" strokeWidth="4" strokeLinecap="round" />}
        <circle cx={cx} cy={cy} r={re} fill="var(--s1)" />
        <g style={{ transformOrigin: `${cx}px ${cy}px`, animation: `spin ${periodS}s linear infinite` }}>
          <circle cx={cx + ro} cy={cy} r="5" fill="var(--text-1)" stroke="var(--surface)" strokeWidth="2" />
        </g>
        <text x="150" y="212" textAnchor="middle" className="svg-muted">{label}</text>
      </svg>
    </figure>
  )
}
