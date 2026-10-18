import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import type { Inputs, Results } from '../sim/types'
import type { Stage, Tone } from '../stages'
import { fmt, usd } from '../format'

const STAGE_S = 4.5
type Pt = [number, number]

export interface PlayerHandle {
  seek: (stage: number) => void
  replay: () => void
}

interface Props {
  inputs: Inputs
  r: Results
  stages: Stage[]
  onStageChange?: (stage: number) => void
}

const reducedMotion = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

/** Plays the design through each subsystem of the satellite, one stage at a time, with live numbers. */
export const PipelineVideo = forwardRef<PlayerHandle, Props>(function PipelineVideo({ inputs, r, stages, onStageChange }, ref) {
  const total = stages.length * STAGE_S
  const [t, setT] = useState(0)
  const [playing, setPlaying] = useState(() => !reducedMotion())
  const last = useRef<number | null>(null)

  useEffect(() => {
    if (!playing) { last.current = null; return }
    let raf = 0
    const tick = (now: number) => {
      const dt = last.current === null ? 0 : (now - last.current) / 1000
      last.current = now
      setT((prev) => {
        const next = prev + dt
        if (next >= total) { setPlaying(false); return total - 0.001 }
        return next
      })
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [playing, total])

  const stage = Math.min(stages.length - 1, Math.floor(t / STAGE_S))
  const p = (t - stage * STAGE_S) / STAGE_S

  const onStage = useRef(onStageChange)
  onStage.current = onStageChange
  useEffect(() => { onStage.current?.(stage) }, [stage])

  useImperativeHandle(ref, () => ({
    seek: (s: number) => { setT(s * STAGE_S + 0.001); setPlaying(true) },
    replay: () => { setT(0); setPlaying(true) },
  }), [])

  const toggle = () => {
    if (!playing && t >= total - 0.01) setT(0)
    setPlaying(!playing)
  }

  const st = stages[stage]
  return (
    <section className="video card">
      <div className="video-frame">
        <Scene stageId={st.id} p={p} t={t} inputs={inputs} r={r} animate={!reducedMotion()} />
        <div className="video-caption" aria-live="polite">
          <div className="cap-step">Step {stage + 1} of {stages.length}</div>
          <h2>{st.title}</h2>
          <p>{st.what}</p>
          <dl className="cap-metrics">
            {st.metrics.map((m) => (
              <div key={m.label}><dt>{m.label}</dt><dd>{m.value}</dd></div>
            ))}
          </dl>
          <StatusChip tone={st.status.tone} text={st.status.text} />
        </div>
      </div>
      <div className="video-controls">
        <button className="ctl" onClick={toggle} aria-label={playing ? 'Pause' : 'Play'}>{playing ? '❚❚' : '▶'}</button>
        <button className="ctl" onClick={() => { setT(0); setPlaying(true) }} aria-label="Replay from start">↺</button>
        <div className="timeline" role="tablist" aria-label="Simulation steps">
          {stages.map((s, k) => {
            const fill = k < stage ? 1 : k === stage ? p : 0
            return (
              <button key={s.id} role="tab" aria-selected={k === stage} className={`tl-seg ${k === stage ? 'on' : ''}`} onClick={() => { setT(k * STAGE_S + 0.001); setPlaying(true) }}>
                <span className="tl-bar"><span style={{ width: `${fill * 100}%` }} /></span>
                <span className="tl-label">{s.title}</span>
              </button>
            )
          })}
        </div>
      </div>
    </section>
  )
})

export function StatusChip({ tone, text }: { tone: Tone; text: string }) {
  const icon = tone === 'good' ? '●' : tone === 'warn' ? '▲' : tone === 'bad' ? '■' : '○'
  return <span className={`chip ${tone}`}><span aria-hidden>{icon}</span> {text}</span>
}

// ---------------------------------------------------------------- scene

const C = {
  bg0: '#070c18', bg1: '#111a2e', star: '#c3c2b7', earth: '#184f95', atmo: '#3987e5',
  panel: '#2a78d6', panelLine: '#86b6ef', bus: '#383835', busEdge: '#c3c2b7', chipOn: '#1baf7a', chipOff: '#2c2c2a',
  radiator: '#e1e0d9', heat: '#eb6834', photon: '#fab219', data: '#86b6ef', text: '#f0efec', muted: '#898781',
}

const SUN: Pt = [70, 70]
const BUS = { x: 330, y: 150, w: 100, h: 80 }
const ARR_L = { x: 120, y: 165, w: 190, h: 50 }
const ARR_R = { x: 450, y: 165, w: 190, h: 50 }
const RAD = { x: 350, y: 52, w: 60, h: 90 }
const GROUND: Pt = [380, 352]
const STARS: Pt[] = Array.from({ length: 40 }, (_, k) => [(k * 197) % 760, (k * 113) % 330])

function along(a: Pt, b: Pt, u: number): Pt {
  return [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u]
}

function Stream({ from, to, n, t, speed, color, r = 2.5 }: { from: Pt; to: Pt; n: number; t: number; speed: number; color: string; r?: number }) {
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

function Scene({ stageId, p, t, inputs, r, animate }: { stageId: Stage['id']; p: number; t: number; inputs: Inputs; r: Results; animate: boolean }) {
  const lit = (parts: string[]) => (part: string) => (parts.includes(part) || parts.includes('all') ? 1 : 0.28)
  const on = lit({
    inputs: ['bus'], compute: ['bus'], power: ['sun', 'arrays', 'bus'], thermal: ['bus', 'radiator'],
    orbit: ['bus', 'link', 'ground'], mass: ['all'], life: ['all'], econ: ['all'],
  }[stageId])

  // Lifetime stage scrubs through the satellite's life: chips go dark, arrays fade
  const lifeYears = Math.min(25, inputs.missionLifeYr * 1.6)
  const lifeT = stageId === 'life' ? p * lifeYears : 0
  const pointAt = r.series.reduce((a, b) => (Math.abs(b.year - lifeT) < Math.abs(a.year - lifeT) ? b : a), r.series[0])
  const chipFrac = stageId === 'life' ? Math.min(1, pointAt.chipsPct / 100) : stageId === 'inputs' ? Math.max(0, (p - 0.55) / 0.45) : stageId === 'compute' ? Math.min(1, p * 1.6) : 1
  const arrayFade = stageId === 'life' ? Math.pow(1 - inputs.solarDegPctYr / 100, lifeT) : 1

  const cols = 8, rows = 4
  const chips = []
  for (let k = 0; k < cols * rows; k++) {
    const cx = BUS.x + 10 + (k % cols) * 10.5
    const cy = BUS.y + 22 + Math.floor(k / cols) * 12
    chips.push(<rect key={k} x={cx} y={cy} width={8} height={9} rx={1.5} fill={k / (cols * rows) < chipFrac ? C.chipOn : C.chipOff} />)
  }

  return (
    <svg className="scene" viewBox="0 0 760 380" role="img" aria-label={`Satellite diagram, ${stageId} step`}>
      <defs>
        <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={C.bg0} /><stop offset="1" stopColor={C.bg1} />
        </linearGradient>
        <radialGradient id="sunGlow"><stop offset="0" stopColor={C.photon} stopOpacity="0.9" /><stop offset="1" stopColor={C.photon} stopOpacity="0" /></radialGradient>
        <filter id="glow"><feGaussianBlur stdDeviation="3" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
      </defs>
      <rect width="760" height="380" fill="url(#sky)" rx="10" />
      {STARS.map(([x, y], k) => <circle key={k} cx={x} cy={y} r={k % 5 === 0 ? 1.2 : 0.7} fill={C.star} opacity={0.5} />)}

      {/* Earth */}
      <g opacity={on('ground')}>
        <circle cx="380" cy="760" r="412" fill={C.atmo} opacity="0.18" />
        <circle cx="380" cy="760" r="404" fill={C.earth} />
        <path d={`M ${GROUND[0] - 9} ${GROUND[1] + 4} Q ${GROUND[0]} ${GROUND[1] - 12} ${GROUND[0] + 9} ${GROUND[1] + 4}`} fill="none" stroke={C.text} strokeWidth="2" />
        <text x={GROUND[0] + 16} y={GROUND[1] + 6} className="sc-label">Ground station</text>
      </g>

      {/* Sun */}
      <g opacity={on('sun')}>
        <circle cx={SUN[0]} cy={SUN[1]} r="55" fill="url(#sunGlow)" />
        <circle cx={SUN[0]} cy={SUN[1]} r="20" fill={C.photon} />
        <text x={SUN[0] - 14} y={SUN[1] + 40} className="sc-label">Sun</text>
      </g>

      {/* Laser link */}
      <g opacity={on('link')}>
        <line x1="380" y1={BUS.y + BUS.h + 8} x2={GROUND[0]} y2={GROUND[1] - 8} stroke={C.data} strokeDasharray="3 5" strokeWidth="1.5" />
        <text x="388" y="300" className="sc-label">Laser link · {r.orbit.rttMs.toFixed(0)} ms</text>
      </g>

      {/* Solar arrays */}
      <g opacity={on('arrays') * arrayFade}>
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

      {/* Radiator */}
      <g opacity={on('radiator')}>
        <line x1="380" y1={RAD.y + RAD.h} x2="380" y2={BUS.y} stroke={C.busEdge} strokeWidth="3" />
        <rect x={RAD.x} y={RAD.y} width={RAD.w} height={RAD.h} fill={stageId === 'thermal' ? `rgb(${225 + 30 * p}, ${224 - 90 * p}, ${217 - 130 * p})` : C.radiator} rx="2" />
        {Array.from({ length: 5 }, (_, j) => <line key={j} x1={RAD.x} y1={RAD.y + (j + 1) * RAD.h / 6} x2={RAD.x + RAD.w} y2={RAD.y + (j + 1) * RAD.h / 6} stroke={C.muted} strokeOpacity="0.6" />)}
        <text x={RAD.x + RAD.w + 10} y={RAD.y + 14} className="sc-label">Radiator · {fmt(r.thermal.radiatorM2PerSat)} m²</text>
      </g>

      {/* Bus with compute */}
      <g opacity={on('bus')} filter={stageId === 'compute' || stageId === 'inputs' ? 'url(#glow)' : undefined}>
        <rect x={BUS.x} y={BUS.y} width={BUS.w} height={BUS.h} fill={C.bus} stroke={C.busEdge} strokeWidth="1.5" rx="4" />
        <text x={BUS.x + 8} y={BUS.y + 14} className="sc-label small">COMPUTE · {inputs.chipsPerSat}×</text>
        {chips}
        <rect x="372" y={BUS.y + BUS.h} width="16" height="8" fill={C.busEdge} rx="2" />
      </g>

      {/* Animated flows */}
      {animate && stageId === 'power' && (
        <>
          <Stream from={SUN} to={[ARR_L.x + 90, ARR_L.y + 10]} n={7} t={t} speed={0.9} color={C.photon} />
          <Stream from={SUN} to={[ARR_R.x + 60, ARR_R.y + 10]} n={9} t={t} speed={0.7} color={C.photon} />
          <Stream from={[ARR_L.x + ARR_L.w, 190]} to={[BUS.x + 4, 190]} n={4} t={t} speed={1.4} color={C.photon} r={2} />
          <Stream from={[ARR_R.x, 190]} to={[BUS.x + BUS.w - 4, 190]} n={4} t={t} speed={1.4} color={C.photon} r={2} />
        </>
      )}
      {animate && stageId === 'thermal' && (
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
      {animate && stageId === 'orbit' && (
        <>
          <Stream from={[386, GROUND[1] - 10]} to={[386, BUS.y + BUS.h + 10]} n={6} t={t} speed={1.1} color={C.data} />
          <Stream from={[374, BUS.y + BUS.h + 10]} to={[374, GROUND[1] - 10]} n={6} t={t} speed={1.1} color={C.chipOn} />
        </>
      )}
      {stageId === 'inputs' && <InputCard p={p} inputs={inputs} />}
      {stageId === 'mass' && <Rocket p={p} launches={r.mass.launches} />}

      <Overlay stageId={stageId} p={p} inputs={inputs} r={r} lifeT={lifeT} lifeYears={lifeYears} capNow={pointAt.capacityPct} />
    </svg>
  )
}

function InputCard({ p, inputs }: { p: number; inputs: Inputs }) {
  const u = Math.min(1, p / 0.55)
  const ease = 1 - Math.pow(1 - u, 3)
  const x = 20 + ease * (BUS.x - 20 - 10)
  const y = 250 - ease * 95
  const s = 1 - ease * 0.75
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`} opacity={u < 1 ? 1 : Math.max(0, 1 - (p - 0.55) * 4)}>
      <rect width="170" height="64" rx="8" fill="#1a1a19" stroke={C.data} />
      <text x="12" y="22" className="sc-label strong">{fmt(inputs.activeParamsB)}B-param model</text>
      <text x="12" y="40" className="sc-label">{inputs.workload === 'training' ? `Training · ${fmt(inputs.trainTokensT)}T tokens` : 'Inference · live requests'}</text>
      <text x="12" y="56" className="sc-label">{inputs.satellites} sats × {inputs.chipsPerSat} chips</text>
    </g>
  )
}

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

function Overlay({ stageId, p, inputs, r, lifeT, lifeYears, capNow }: { stageId: Stage['id']; p: number; inputs: Inputs; r: Results; lifeT: number; lifeYears: number; capNow: number }) {
  const X = 556, Y = 22, W = 190, H = 118
  const grow = Math.min(1, p * 1.5)
  let body: JSX.Element | null = null

  if (stageId === 'compute') {
    body = (
      <>
        <text x={X + 12} y={Y + 26} className="sc-label">Effective compute</text>
        <text x={X + 12} y={Y + 62} className="sc-big">{fmt(r.compute.effectiveEflopsBol * grow)}</text>
        <text x={X + 12} y={Y + 80} className="sc-label">EFLOPS (FP8)</text>
        <text x={X + 12} y={Y + 104} className="sc-label">
          {inputs.workload === 'training' ? `Train in ${fmt(r.compute.trainDays)} days` : `${fmt(r.compute.tokensPerSec * grow)} tokens/s`}
        </text>
      </>
    )
  } else if (stageId === 'power') {
    const max = Math.max(r.power.arrayKwPerSat, r.power.loadKwPerSat)
    const bar = (label: string, v: number, y: number, color: string) => (
      <g>
        <text x={X + 12} y={y} className="sc-label">{label}</text>
        <rect x={X + 12} y={y + 5} width={(W - 24) * (v / max) * grow} height="10" rx="3" fill={color} />
        <text x={X + W - 12} y={y} textAnchor="end" className="sc-label strong">{fmt(v)} kW</text>
      </g>
    )
    body = (
      <>
        {bar('Solar array', r.power.arrayKwPerSat, Y + 24, C.photon)}
        {bar('Load', r.power.loadKwPerSat, Y + 58, C.chipOn)}
        <text x={X + 12} y={Y + 102} className="sc-label">Battery {fmt(r.power.batteryKwhPerSat)} kWh · shadow {(r.orbit.eclipseFracAvg * 100).toFixed(1)}%</text>
      </>
    )
  } else if (stageId === 'thermal') {
    body = (
      <>
        <text x={X + 12} y={Y + 26} className="sc-label">Heat rejected per satellite</text>
        <text x={X + 12} y={Y + 62} className="sc-big">{fmt(r.power.loadKwPerSat * grow)} kW</text>
        <text x={X + 12} y={Y + 84} className="sc-label">{fmt(r.thermal.radiatorFluxWm2)} W/m² at {inputs.radiatorTempK} K</text>
        <text x={X + 12} y={Y + 104} className="sc-label">σT⁴: +10% temp → −32% area</text>
      </>
    )
  } else if (stageId === 'orbit') {
    const cx = X + 46, cy = Y + 60, ro = 32
    const a = p * Math.PI * 2 * 2
    body = (
      <>
        <circle cx={cx} cy={cy} r="14" fill={C.earth} />
        <circle cx={cx} cy={cy} r={ro} fill="none" stroke={C.muted} strokeDasharray="2 3" />
        <circle cx={cx + ro * Math.cos(a)} cy={cy + ro * Math.sin(a)} r="4" fill={C.text} />
        <text x={X + 92} y={Y + 40} className="sc-label">Period</text>
        <text x={X + 92} y={Y + 58} className="sc-label strong">{r.orbit.periodMin.toFixed(0)} min</text>
        <text x={X + 92} y={Y + 80} className="sc-label">Latency</text>
        <text x={X + 92} y={Y + 98} className="sc-label strong">{r.orbit.rttMs.toFixed(0)} ms</text>
      </>
    )
  } else if (stageId === 'mass') {
    const items = r.mass.breakdownKgPerSat.filter((m) => m.kg > 0)
    const colors = [C.chipOn, C.panel, C.radiator, C.photon, C.busEdge, C.muted, C.heat]
    const kg = (name: string) => items.find((m) => m.name === name)?.kg ?? 0
    let acc = 0
    body = (
      <>
        <text x={X + 12} y={Y + 24} className="sc-label">Mass per satellite · {fmt(r.mass.wetKgPerSat)} kg</text>
        {items.map((m, k) => {
          const w = (W - 24) * (m.kg / r.mass.wetKgPerSat) * grow
          const el = <rect key={m.name} x={X + 12 + acc} y={Y + 34} width={Math.max(0, w - 2)} height="16" fill={colors[k % colors.length]} rx="2"><title>{m.name}: {fmt(m.kg)} kg</title></rect>
          acc += w
          return el
        })}
        <text x={X + 12} y={Y + 70} className="sc-label">Solar {fmt(kg('Solar arrays'))} · radiators {fmt(kg('Radiators'))} kg</text>
        <text x={X + 12} y={Y + 98} className="sc-label strong">{fmt(r.mass.totalT)} t total · {r.mass.launches} launch{r.mass.launches === 1 ? '' : 'es'}</text>
      </>
    )
  } else if (stageId === 'life') {
    const px = (yr: number) => X + 12 + (yr / lifeYears) * (W - 24)
    const py = (pct: number) => Y + 96 - (Math.min(pct, 110) / 110) * 66
    const pts = r.series.filter((s) => s.year <= lifeT).map((s) => `${px(s.year)},${py(s.capacityPct)}`).join(' ')
    body = (
      <>
        <text x={X + 12} y={Y + 20} className="sc-label">Year {lifeT.toFixed(1)} · capacity {capNow.toFixed(0)}%</text>
        <line x1={X + 12} y1={py(inputs.usefulThresholdPct)} x2={X + W - 12} y2={py(inputs.usefulThresholdPct)} stroke={C.muted} strokeDasharray="3 3" />
        <line x1={px(inputs.missionLifeYr)} y1={Y + 28} x2={px(inputs.missionLifeYr)} y2={Y + 96} stroke={C.muted} strokeDasharray="3 3" />
        <polyline points={pts} fill="none" stroke={C.chipOn} strokeWidth="2" />
        <text x={X + 12} y={Y + 110} className="sc-label">Useful life {r.life.usefulLifeYr >= 25 ? '25+' : r.life.usefulLifeYr.toFixed(1)} yr</text>
      </>
    )
  } else if (stageId === 'econ') {
    const max = Math.max(r.econ.lcocPerChipHr, r.terrestrial.lcocPerChipHr)
    const bar = (label: string, v: number, y: number, color: string) => (
      <g>
        <text x={X + 12} y={y} className="sc-label">{label}</text>
        <rect x={X + 12} y={y + 5} width={(W - 24) * (v / max) * grow} height="12" rx="3" fill={color} />
        <text x={X + W - 12} y={y} textAnchor="end" className="sc-label strong">{usd(v * grow, 3)}/hr</text>
      </g>
    )
    body = (
      <>
        {bar('Orbit', r.econ.lcocPerChipHr, Y + 24, C.panel)}
        {bar('Ground', r.terrestrial.lcocPerChipHr, Y + 60, C.muted)}
        <text x={X + 12} y={Y + 106} className="sc-label">Cost per accelerator-hour</text>
      </>
    )
  }
  if (!body) return null
  return (
    <g>
      <rect x={X} y={Y} width={W} height={H} rx="10" fill="#0d0d0d" fillOpacity="0.75" stroke="rgba(255,255,255,0.12)" />
      {body}
    </g>
  )
}
