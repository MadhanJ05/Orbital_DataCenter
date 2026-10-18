import { useEffect, useMemo, useRef, useState } from 'react'
import type { Inputs } from './sim/types'
import { simulate } from './sim/engine'
import { BASELINE, SCENARIOS } from './sim/presets'
import { FieldRow, InputPanel } from './components/InputPanel'
import { PipelineVideo, StatusChip, type PlayerHandle } from './components/PipelineVideo'
import { Details } from './components/Details'
import { SECTIONS, type Field } from './fields'
import { buildStages } from './stages'

function readHash(): Inputs {
  try {
    const raw = window.location.hash.slice(1)
    if (!raw) return BASELINE
    return { ...BASELINE, ...JSON.parse(atob(decodeURIComponent(raw))) }
  } catch {
    return BASELINE
  }
}

function writeHash(i: Inputs) {
  const diff: Partial<Record<keyof Inputs, unknown>> = {}
  for (const k of Object.keys(i) as (keyof Inputs)[]) if (i[k] !== BASELINE[k]) diff[k] = i[k]
  const url = Object.keys(diff).length ? '#' + encodeURIComponent(btoa(JSON.stringify(diff))) : window.location.pathname
  history.replaceState(null, '', url)
}

const QUICK_KEYS: (keyof Inputs)[] = ['modelId', 'workload', 'chipId', 'orbitType', 'satellites', 'chipsPerSat', 'launchCostPerKg']
const ALL_FIELDS: Field[] = SECTIONS.flatMap((s) => s.fields)
const QUICK_FIELDS = QUICK_KEYS.map((k) => ALL_FIELDS.find((f) => f.key === k)!)

export default function App() {
  const [inputs, setInputs] = useState<Inputs>(readHash)
  const [scenario, setScenario] = useState<string>(() => (window.location.hash ? 'custom' : 'baseline'))
  const [drawer, setDrawer] = useState(false)
  const [showDetails, setShowDetails] = useState(false)
  const [stage, setStage] = useState(0)
  const [copied, setCopied] = useState(false)
  const player = useRef<PlayerHandle>(null)

  useEffect(() => writeHash(inputs), [inputs])
  useEffect(() => {
    if (!drawer) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setDrawer(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [drawer])

  const r = useMemo(() => simulate(inputs), [inputs])
  const stages = useMemo(() => buildStages(inputs, r), [inputs, r])

  const update = (patch: Partial<Inputs>) => {
    setInputs((prev) => ({ ...prev, ...patch }))
    setScenario('custom')
  }
  const loadScenario = (id: string) => {
    const s = SCENARIOS.find((x) => x.id === id)
    if (s) { setInputs(s.inputs); setScenario(id); player.current?.replay() }
  }
  const copyLink = async () => {
    try { await navigator.clipboard.writeText(window.location.href); setCopied(true); setTimeout(() => setCopied(false), 1500) } catch { /* clipboard blocked */ }
  }
  const blurb = SCENARIOS.find((s) => s.id === scenario)?.blurb

  return (
    <div className="app">
      <header className="top">
        <div className="brand">
          <span className="logo" aria-hidden>◐</span>
          <div>
            <h1>Orbital Data Center Twin</h1>
            <p className="sub">Pick a model and workload, then watch it run through every part of the satellite.</p>
          </div>
        </div>
        <div className="top-actions">
          <label className="scenario">
            <span>Scenario</span>
            <select value={scenario} onChange={(e) => loadScenario(e.target.value)}>
              {SCENARIOS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
              {scenario === 'custom' && <option value="custom">Custom (edited)</option>}
            </select>
          </label>
          <button className="btn ghost" onClick={copyLink}>{copied ? 'Link copied' : 'Copy link'}</button>
        </div>
      </header>

      <main className="page">
        <section className="quick card">
          <div className="quick-head">
            <div>
              <h2>Quick setup</h2>
              {blurb && <p className="sub">{blurb}</p>}
            </div>
            <div className="quick-actions">
              <button className="btn ghost" onClick={() => setDrawer(true)}>All inputs</button>
              <button className="btn" onClick={() => player.current?.replay()}>▶ Run simulation</button>
            </div>
          </div>
          <div className="quick-grid">
            {QUICK_FIELDS.map((f) => (
              <div key={String(f.key)} className="quick-cell">
                <FieldRow field={f} inputs={inputs} onChange={update} />
              </div>
            ))}
          </div>
        </section>

        {r.warnings.length > 0 && (
          <div className="warnings" role="status">
            {r.warnings.map((w) => <div key={w}><span className="warn-icon" aria-hidden>▲</span> {w}</div>)}
          </div>
        )}

        <PipelineVideo ref={player} inputs={inputs} r={r} stages={stages} onStageChange={setStage} />

        <section className="modules" aria-label="Module results">
          {stages.slice(1).map((s, k) => (
            <button key={s.id} className={`module ${stage === k + 1 ? 'on' : ''}`} onClick={() => player.current?.seek(k + 1)}>
              <span className="m-title">{s.title}</span>
              <span className="m-value">{s.metrics[0].value}</span>
              <span className="m-sub">{s.metrics[0].label} · {s.metrics[1].label.toLowerCase()} {s.metrics[1].value}</span>
              <StatusChip tone={s.status.tone} text={s.status.text} />
            </button>
          ))}
        </section>

        <button className="details-toggle" onClick={() => setShowDetails(!showDetails)} aria-expanded={showDetails}>
          {showDetails ? '− Hide detailed analysis' : '+ Show detailed analysis (lifetime, mass, cash flow, sensitivity)'}
        </button>
        {showDetails && <Details inputs={inputs} r={r} />}

        <footer className="foot">
          Steady-state physics with a monthly lifetime simulation. Sources and assumptions: ENGINEERING_SPEC.md. Built at Sundai Hack, 2026.
        </footer>
      </main>

      {drawer && (
        <div className="drawer-wrap" onClick={() => setDrawer(false)}>
          <aside className="drawer" role="dialog" aria-label="All inputs" onClick={(e) => e.stopPropagation()}>
            <div className="drawer-head">
              <h2>All inputs</h2>
              <button className="ctl" onClick={() => setDrawer(false)} aria-label="Close">✕</button>
            </div>
            <p className="sub">Changes apply live. Press ▶ Run simulation to replay the walkthrough.</p>
            <InputPanel inputs={inputs} onChange={update} />
          </aside>
        </div>
      )}
    </div>
  )
}
