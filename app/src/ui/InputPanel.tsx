import { useState } from 'react'
import type { Inputs } from '../core/types'
import type { Field, NumField } from '../core/fields'
import { MODULES } from '../modules'

interface Props {
  inputs: Inputs
  onChange: (patch: Partial<Inputs>) => void
}

/** Every module's input sections, in module order. */
export function InputPanel({ inputs, onChange }: Props) {
  const sections = MODULES.flatMap((m) => m.sections)
  const [open, setOpen] = useState<Record<string, boolean>>({ workload: true, model: true, serving: true })

  return (
    <div className="inputs">
      {sections.map((s) => (
        <section key={s.id} className={`in-section ${open[s.id] ? 'open' : ''}`}>
          <button className="in-head" onClick={() => setOpen({ ...open, [s.id]: !open[s.id] })} aria-expanded={!!open[s.id]}>
            <span>{s.title}</span>
            <span className="chev">{open[s.id] ? '−' : '+'}</span>
          </button>
          {open[s.id] && (
            <div className="in-body">
              {s.fields.map((f) => (
                <FieldRow key={String(f.key)} field={f} inputs={inputs} onChange={onChange} />
              ))}
            </div>
          )}
        </section>
      ))}
    </div>
  )
}

export function FieldRow({ field, inputs, onChange }: { field: Field; inputs: Inputs; onChange: Props['onChange'] }) {
  if (field.kind === 'bool') {
    return (
      <label className="field toggle" title={field.help}>
        <input type="checkbox" checked={inputs[field.key] as boolean} onChange={(e) => onChange({ [field.key]: e.target.checked })} />
        <span>{field.label}</span>
        {field.help && <span className="help">{field.help}</span>}
      </label>
    )
  }
  if (field.kind === 'select') {
    return (
      <label className="field">
        <span className="f-label">{field.label}</span>
        <select
          value={inputs[field.key] as string}
          onChange={(e) => onChange(field.patch ? field.patch(e.target.value) : { [field.key]: e.target.value })}
        >
          {field.options.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </label>
    )
  }
  if (field.hideFor?.(inputs)) return null
  return <NumRow field={field} value={inputs[field.key] as number} onChange={onChange} />
}

function NumRow({ field, value, onChange }: { field: NumField; value: number; onChange: Props['onChange'] }) {
  const { min, max, log } = field
  const toPos = (v: number) => (log ? (Math.log(v) - Math.log(min)) / (Math.log(max) - Math.log(min)) : (v - min) / (max - min)) * 1000
  const fromPos = (p: number) => {
    const t = p / 1000
    const raw = log ? Math.exp(Math.log(min) + t * (Math.log(max) - Math.log(min))) : min + t * (max - min)
    const snapped = Math.round(raw / field.step) * field.step
    return +snapped.toPrecision(6)
  }
  const set = (v: number) => {
    if (!isFinite(v)) return
    onChange({ [field.key]: v, ...field.alsoSet })
  }
  return (
    <div className="field">
      <div className="f-top">
        <span className="f-label" title={field.help}>
          {field.label}
          {field.help && <span className="info" aria-label={field.help}>i</span>}
        </span>
        <span className="f-val">
          <input type="number" value={value} step={field.step} onChange={(e) => set(parseFloat(e.target.value))} />
          {field.unit && <span className="unit">{field.unit}</span>}
        </span>
      </div>
      <input
        type="range"
        min={0}
        max={1000}
        value={Math.max(0, Math.min(1000, toPos(value)))}
        onChange={(e) => set(fromPos(+e.target.value))}
        aria-label={field.label}
      />
    </div>
  )
}
