import type { Inputs } from '../core/types'
import { MODELS, REQUESTS, modelPatch, workloadPatch, type RequestType } from '../modules/compute/presets'
import { fmt } from '../core/format'

interface Props {
  inputs: Inputs
  onChange: (patch: Partial<Inputs>) => void
}

const REQUEST_ORDER: (RequestType | 'training')[] = ['chat', 'agent_int', 'agent_bg', 'training']
const DECK_MODELS = ['kimi', 'qwen397', 'qwen122', 'gptoss']

/** The Track 1 "3 Standard Workloads" slide as controls: request, model, request numbers and serving levers. */
export function WorkloadPanel({ inputs: i, onChange }: Props) {
  const training = i.workload === 'training'
  const isAgent = i.workload === 'agent_int' || i.workload === 'agent_bg'
  const num = (key: keyof Inputs, label: string, unit: string, step = 1) => (
    <label className="wl-num">
      <span>{label}</span>
      <span className="wl-num-in">
        <input type="number" value={i[key] as number} step={step} min={0}
          onChange={(e) => { const v = parseFloat(e.target.value); if (isFinite(v)) onChange({ [key]: v }) }} />
        <em>{unit}</em>
      </span>
    </label>
  )
  const toggle = (on: boolean, title: string, desc: string, set: (v: boolean) => void, disabledNote?: string) => (
    <label className={`wl-switch ${disabledNote ? 'off' : ''}`} title={disabledNote}>
      <input type="checkbox" role="switch" checked={on && !disabledNote} disabled={!!disabledNote} onChange={(e) => set(e.target.checked)} />
      <span className="wl-knob" aria-hidden />
      <span><b>{title}</b> {disabledNote ?? desc}</span>
    </label>
  )

  return (
    <section className="card workload">
      <div className="quick-head">
        <div>
          <h2>Workload</h2>
          <p className="sub">The Track 1 standard workloads. Pick a request and model; every number below is editable.</p>
        </div>
      </div>

      <div className="wl-row">
        <span className="wl-label">Request</span>
        <div className="seg" role="radiogroup" aria-label="Request type">
          {REQUEST_ORDER.map((w) => (
            <button key={w} role="radio" aria-checked={i.workload === w} className={i.workload === w ? 'on' : ''} onClick={() => onChange(workloadPatch(w))}>
              {w === 'training' ? 'Training' : REQUESTS[w].label}
            </button>
          ))}
        </div>
      </div>

      {!training && (
        <>
          <div className="wl-row">
            <span className="wl-label">Model</span>
            <div className="seg models" role="radiogroup" aria-label="Model">
              {DECK_MODELS.map((id) => {
                const m = MODELS.find((x) => x.id === id)!
                return (
                  <button key={id} role="radio" aria-checked={i.modelId === id} className={i.modelId === id ? 'on' : ''} onClick={() => onChange(modelPatch(id))}>
                    <span>{m.label.split(' (')[0]}</span>
                    <small>{fmt(m.totalB * 1e9)} total · {m.activeB}B active · {m.kvKB} KB + {m.stateMB} MB · {m.maxCtxK >= 1000 ? `${m.maxCtxK / 1000}M` : `${m.maxCtxK}k`} ctx</small>
                  </button>
                )
              })}
            </div>
          </div>

          <div className="wl-grid">
            {num('ctxTokens', 'Reads', 'tokens', 1000)}
            {num('cachedTokens', 'Cached', 'tokens', 1000)}
            {num('outTokens', 'Writes', 'tokens', 10)}
            {num('stepsPerTask', 'Repeats', 'per task')}
            {num('toolWaitS', 'Tool wait', 's', 0.5)}
            {num('ttftSloS', 'First token', 's', 0.1)}
            {num('tokPerSecSlo', 'Speed', 'tok/s')}
            {num('taskDeadlineMin', 'Task deadline', 'min (0 = none)')}
          </div>

          <div className="wl-row">
            <span className="wl-label">How you serve them</span>
            <div className="wl-switches">
              {toggle(i.easyChatPct > 0, 'Routing', `easy chat to gpt-oss-120b (${i.easyChatPct || 50}%)`,
                (v) => onChange({ easyChatPct: v ? 50 : 0 }), i.workload !== 'chat' ? 'applies to chat only' : undefined)}
              {toggle(i.subagentPct > 0, 'Multi-agent', `Qwen3.5-122B sub-agents do ${i.subagentPct || 50}% of steps on 32k contexts`,
                (v) => onChange({ subagentPct: v ? 50 : 0 }), !isAgent ? 'applies to agents only' : undefined)}
              {toggle(i.hybridKv, 'Hybrid models', 'KV cache in 1 of 4 layers (off = full attention, 4x KV)', (v) => onChange({ hybridKv: v }))}
              {toggle(i.disaggPrefill, 'Hybrid serving', 'prefill and decode on different chips (adds a KV hand-off)', (v) => onChange({ disaggPrefill: v }))}
            </div>
          </div>
        </>
      )}
      {training && <p className="sub">Training uses the 2T frontier model; set training tokens and MFU in All inputs.</p>}
    </section>
  )
}
