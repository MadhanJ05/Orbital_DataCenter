import type { Inputs, Results } from '../../core/types'
import { simulate } from '../../core/pipeline'

export interface SensitivityRow {
  label: string
  low: number
  high: number
  lowLabel: string
  highLabel: string
}

const SENS: { key: keyof Inputs; label: string; swing: number }[] = [
  { key: 'launchCostPerKg', label: 'Launch cost $/kg', swing: 0.5 },
  { key: 'chipPriceUsd', label: 'Accelerator price', swing: 0.25 },
  { key: 'afrPct', label: 'Failure rate (AFR)', swing: 0.5 },
  { key: 'busCostPerKg', label: 'Bus cost $/kg', swing: 0.5 },
  { key: 'solarCostPerW', label: 'Solar cost $/W', swing: 0.5 },
  { key: 'radiatorTempK', label: 'Radiator temperature', swing: 0.08 },
  { key: 'missionLifeYr', label: 'Mission life', swing: 0.4 },
  { key: 'mfuPct', label: 'Utilization (MFU)', swing: 0.25 },
  { key: 'discountPct', label: 'Discount rate', swing: 0.3 },
  { key: 'serverKgPerChip', label: 'Node mass per accelerator', swing: 0.4 },
]

/** One-at-a-time sensitivity of the chosen metric to each key input (tornado chart). */
export function sensitivity(i: Inputs, metric: (r: Results) => number): SensitivityRow[] {
  const base = metric(simulate(i))
  return SENS.map(({ key, label, swing }) => {
    const v = i[key] as number
    const lo = { ...i, [key]: v * (1 - swing) }
    const hi = { ...i, [key]: v * (1 + swing) }
    return {
      label,
      low: metric(simulate(lo)) - base,
      high: metric(simulate(hi)) - base,
      lowLabel: `-${Math.round(swing * 100)}%`,
      highLabel: `+${Math.round(swing * 100)}%`,
    }
  }).sort((a, b) => Math.max(Math.abs(b.low), Math.abs(b.high)) - Math.max(Math.abs(a.low), Math.abs(a.high)))
}
