import type { ModuleDef, ScenePart } from '../../core/module'
import type { Inputs, Results } from '../../core/types'
import { fmt } from '../../core/format'
import { ARR_L, ARR_R, BUS, C, GROUND, RAD, SUN, type Pt } from './kit'

const STARS: Pt[] = Array.from({ length: 40 }, (_, k) => [(k * 197) % 760, (k * 113) % 330])

/** The shared satellite drawing. The active step highlights its parts and draws its own overlay on top. */
export function Scene({ def, p, t, inputs, r, animate }: { def: ModuleDef; p: number; t: number; inputs: Inputs; r: Results; animate: boolean }) {
  const focus = def.focus ?? 'all'
  const on = (part: ScenePart) => (focus === 'all' || focus.includes(part) ? 1 : 0.28)
  const s = { chipFrac: 1, arrayFade: 1, radiatorHeat: 0, ...def.sceneState?.(p, inputs, r) }
  const Overlay = def.Overlay

  const cols = 8, rows = 4
  const chips = []
  for (let k = 0; k < cols * rows; k++) {
    const cx = BUS.x + 10 + (k % cols) * 10.5
    const cy = BUS.y + 22 + Math.floor(k / cols) * 12
    chips.push(<rect key={k} x={cx} y={cy} width={8} height={9} rx={1.5} fill={k / (cols * rows) < s.chipFrac ? C.chipOn : C.chipOff} />)
  }
  const h = s.radiatorHeat

  return (
    <svg className="scene" viewBox="0 0 760 380" role="img" aria-label={`Satellite diagram, ${def.title} step`}>
      <defs>
        <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={C.bg0} /><stop offset="1" stopColor={C.bg1} />
        </linearGradient>
        <radialGradient id="sunGlow"><stop offset="0" stopColor={C.photon} stopOpacity="0.9" /><stop offset="1" stopColor={C.photon} stopOpacity="0" /></radialGradient>
        <filter id="glow"><feGaussianBlur stdDeviation="3" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
      </defs>
      <rect width="760" height="380" fill="url(#sky)" rx="10" />
      {STARS.map(([x, y], k) => <circle key={k} cx={x} cy={y} r={k % 5 === 0 ? 1.2 : 0.7} fill={C.star} opacity={0.5} />)}

      <g opacity={on('ground')}>
        <circle cx="380" cy="760" r="412" fill={C.atmo} opacity="0.18" />
        <circle cx="380" cy="760" r="404" fill={C.earth} />
        <path d={`M ${GROUND[0] - 9} ${GROUND[1] + 4} Q ${GROUND[0]} ${GROUND[1] - 12} ${GROUND[0] + 9} ${GROUND[1] + 4}`} fill="none" stroke={C.text} strokeWidth="2" />
        <text x={GROUND[0] + 16} y={GROUND[1] + 6} className="sc-label">Ground station</text>
      </g>

      <g opacity={on('sun')}>
        <circle cx={SUN[0]} cy={SUN[1]} r="55" fill="url(#sunGlow)" />
        <circle cx={SUN[0]} cy={SUN[1]} r="20" fill={C.photon} />
        <text x={SUN[0] - 14} y={SUN[1] + 40} className="sc-label">Sun</text>
      </g>

      <g opacity={on('link')}>
        <line x1="380" y1={BUS.y + BUS.h + 8} x2={GROUND[0]} y2={GROUND[1] - 8} stroke={C.data} strokeDasharray="3 5" strokeWidth="1.5" />
        <text x="388" y="300" className="sc-label">Laser link · {r.orbit.rttMs.toFixed(0)} ms</text>
      </g>

      <g opacity={on('arrays') * s.arrayFade}>
        {[ARR_L, ARR_R].map((a, k) => (
          <g key={k}>
            <rect x={a.x} y={a.y} width={a.w} height={a.h} fill={C.panel} stroke={C.panelLine} strokeWidth="1" rx="2" />
            {Array.from({ length: 7 }, (_, j) => <line key={j} x1={a.x + (j + 1) * a.w / 8} y1={a.y} x2={a.x + (j + 1) * a.w / 8} y2={a.y + a.h} stroke={C.panelLine} strokeOpacity="0.5" />)}
            <line x1={a.x} y1={a.y + a.h / 2} x2={a.x + a.w} y2={a.y + a.h / 2} stroke={C.panelLine} strokeOpacity="0.5" />
          </g>
        ))}
        <line x1={ARR_L.x + ARR_L.w} y1="190" x2={BUS.x} y2="190" stroke={C.busEdge} strokeWidth="3" />
        <line x1={BUS.x + BUS.w} y1="190" x2={ARR_R.x} y2="190" stroke={C.busEdge} strokeWidth="3" />
        <text x={ARR_L.x} y={ARR_L.y + ARR_L.h + 16} className="sc-label">Solar array · {fmt(r.power.arrayM2PerSat)} m²</text>
      </g>

      <g opacity={on('radiator')}>
        <line x1="380" y1={RAD.y + RAD.h} x2="380" y2={BUS.y} stroke={C.busEdge} strokeWidth="3" />
        <rect x={RAD.x} y={RAD.y} width={RAD.w} height={RAD.h} fill={h > 0 ? `rgb(${225 + 30 * h}, ${224 - 90 * h}, ${217 - 130 * h})` : C.radiator} rx="2" />
        {Array.from({ length: 5 }, (_, j) => <line key={j} x1={RAD.x} y1={RAD.y + (j + 1) * RAD.h / 6} x2={RAD.x + RAD.w} y2={RAD.y + (j + 1) * RAD.h / 6} stroke={C.muted} strokeOpacity="0.6" />)}
        <text x={RAD.x + RAD.w + 10} y={RAD.y + 14} className="sc-label">Radiator · {fmt(r.thermal.radiatorM2PerSat)} m²</text>
      </g>

      <g opacity={on('bus')} filter={def.id === 'compute' || def.id === 'inputs' ? 'url(#glow)' : undefined}>
        <rect x={BUS.x} y={BUS.y} width={BUS.w} height={BUS.h} fill={C.bus} stroke={C.busEdge} strokeWidth="1.5" rx="4" />
        <text x={BUS.x + 8} y={BUS.y + 14} className="sc-label small">COMPUTE · {inputs.chipsPerSat}×</text>
        {chips}
        <rect x="372" y={BUS.y + BUS.h} width="16" height="8" fill={C.busEdge} rx="2" />
      </g>

      {Overlay && <Overlay p={p} t={t} inputs={inputs} r={r} animate={animate} />}
    </svg>
  )
}
