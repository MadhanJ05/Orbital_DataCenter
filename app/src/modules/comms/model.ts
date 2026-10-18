export interface CommsInputs {
  linkGbpsPerSat: number
  linkAvailPct: number
  ioBytesPerToken: number // data to/from Earth per processed token
}

export const commsDefaults: CommsInputs = {
  linkGbpsPerSat: 100,
  linkAvailPct: 95,
  ioBytesPerToken: 40, // inference: prompts in, tokens out
}

export interface CommsModel {
  requiredGbps: number
  availableGbps: number
  utilizationPct: number
  cap: number // throughput multiplier when the link is the bottleneck (<= 1)
  warnings: string[]
}

export function runComms(i: CommsInputs, tokensPerSec: number, satellites: number): CommsModel {
  const warnings: string[] = []
  const requiredGbps = (tokensPerSec * i.ioBytesPerToken * 8) / 1e9
  const availableGbps = satellites * i.linkGbpsPerSat * i.linkAvailPct / 100
  const utilizationPct = requiredGbps / Math.max(availableGbps, 1e-9) * 100
  if (utilizationPct > 100) warnings.push(`Ground link is oversubscribed (${utilizationPct.toFixed(0)}%) and throttles throughput.`)
  const cap = Math.min(1, 100 / Math.max(utilizationPct, 1e-9))
  return { requiredGbps, availableGbps, utilizationPct, cap, warnings }
}
