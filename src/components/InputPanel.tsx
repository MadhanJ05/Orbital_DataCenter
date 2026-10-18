import { useState } from 'react'
import type { Inputs } from '../sim/types'
import { SECTIONS, type Field, type NumField } from '../fields'
import { CHIPS, MODELS } from '../sim/presets'

const CHIP_KEYS: (keyof Inputs)[] = ['chipTdpW', 'chipPflops', 'chipPriceUsd']

/** Patch for a select change, applying preset side effects (chip specs, model size, orbit defaults). */
export function selectPatch(key: keyof Inputs, v: string): Partial<Inputs> {
  if (key === 'chipId') {
    const c = CHIPS.find((x) => x.id === v)!
    return { chipId: v, chipTdpW: c.tdpW, chipPflops: c.pflops, chipPriceUsd: c.priceUsd, pricePerChipHr: c.pricePerHr }
  }
  if (key === 'modelId') {
    const m = MODELS.find((x) => x.id === v)!
    return v === 'custom' ? { modelId: v } : { modelId: v, activeParamsB: m.activeB }
  }
  if (key === 'orbitType') {
    const dose = v === 'geo' ? 1500 : v === 'leo' ? 60 : 150
    return { orbitType: v as Inputs['orbitType'], doseRateRadYr: dose, ...(v === 'geo' ? {} : { altitudeKm: v === 'leo' ? 550 : 650 }) }
  }
  return { [key]: v }
}

export function selectOptions(key: keyof Inputs, fallback: { value: string; label: string }[]) {
  if (key === 'chipId') return CHIPS.map((c) => ({ value: c.id, label: c.label }))
  if (key === 'modelId') return MODELS.map((m) => ({ value: m.id, label: m.label }))
  return fallback
}

interface Props {
  inputs: Inputs
  onChange: (patch: Partial<Inputs>) => void
}

export function InputPanel({ inputs, onChange }: Props) {
  const [open, setOpen] = useState<Record<string, boolean>>({ workload: true, compute: true, constellation: true })

  return (
    <div className="inputs">
      {SECTIONS.map((s) => (
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
    const options = selectOptions(field.key, field.options)
    return (
      <label className="field">
        <span className="f-label">{field.label}</span>
        <select
          value={inputs[field.key] as string}
          onChange={(e) => onChange(selectPatch(field.key, e.target.value))}
        >
          {options.map((o) => (
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
    const patch: Partial<Inputs> = { [field.key]: v }
    if (CHIP_KEYS.includes(field.key)) patch.chipId = 'custom'
    if (field.key === 'activeParamsB') patch.modelId = 'custom'
    onChange(patch)
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
