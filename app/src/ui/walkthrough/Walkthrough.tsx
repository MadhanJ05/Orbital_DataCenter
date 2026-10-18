import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import type { Tone } from '../../core/module'
import type { Inputs, Results } from '../../core/types'
import { Scene } from './Scene'
import type { Step } from './steps'

const STAGE_S = 4.5

export interface PlayerHandle {
  seek: (stage: number) => void
  replay: () => void
}

interface Props {
  inputs: Inputs
  r: Results
  steps: Step[]
  onStageChange?: (stage: number) => void
}

const reducedMotion = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

/** Plays the design through each subsystem of the satellite, one stage at a time, with live numbers. */
export const Walkthrough = forwardRef<PlayerHandle, Props>(function Walkthrough({ inputs, r, steps, onStageChange }, ref) {
  const total = steps.length * STAGE_S
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

  const stage = Math.min(steps.length - 1, Math.floor(t / STAGE_S))
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

  const { def, stage: st } = steps[stage]
  return (
    <section className="video card">
      <div className="video-frame">
        <Scene def={def} p={p} t={t} inputs={inputs} r={r} animate={!reducedMotion()} />
        <div className="video-caption" aria-live="polite">
          <div className="cap-step">Step {stage + 1} of {steps.length}</div>
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
          {steps.map(({ stage: s }, k) => {
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
