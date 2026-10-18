import type { Inputs } from './types'

export interface NumField {
  kind: 'num'
  key: keyof Inputs
  label: string
  unit?: string
  min: number
  max: number
  step: number
  help?: string
  log?: boolean
  hideFor?: (i: Inputs) => boolean
  alsoSet?: Partial<Inputs> // e.g. editing a chip spec marks the chip preset "custom"
}
export interface BoolField {
  kind: 'bool'
  key: keyof Inputs
  label: string
  help?: string
}
export interface SelectField {
  kind: 'select'
  key: keyof Inputs
  label: string
  options: { value: string; label: string }[]
  patch?: (value: string) => Partial<Inputs> // side effects of picking a preset
  help?: string
}
export type Field = NumField | BoolField | SelectField

export interface Section {
  id: string
  title: string
  fields: Field[]
}

export const num = (key: keyof Inputs, label: string, min: number, max: number, step: number, unit?: string, help?: string, extra: Partial<NumField> = {}): NumField =>
  ({ kind: 'num', key, label, min, max, step, unit, help, ...extra })
