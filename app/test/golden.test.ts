import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { simulate } from '../src/core/pipeline'
import { SCENARIOS } from '../src/scenarios/presets'

// test/golden.json holds every preset's full results. If you changed physics on purpose,
// regenerate it with `npm run golden` and commit it with your change so reviewers see the diff.
const golden = JSON.parse(readFileSync(new URL('./golden.json', import.meta.url), 'utf8'))

const normalize = (v: unknown): unknown => JSON.parse(JSON.stringify(v, (_k, x) => (typeof x === 'number' && !isFinite(x) ? String(x) : x)))

function diff(a: unknown, b: unknown, path: string, out: string[]) {
  if (typeof a === 'number' && typeof b === 'number') {
    if (Math.abs(a - b) > 1e-9 * Math.max(1, Math.abs(a), Math.abs(b))) out.push(`${path}: ${b} -> ${a}`)
  } else if (a && b && typeof a === 'object' && typeof b === 'object') {
    const keys = new Set([...Object.keys(a), ...Object.keys(b)])
    for (const k of keys) diff((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k], `${path}.${k}`, out)
  } else if (a !== b) out.push(`${path}: ${JSON.stringify(b)} -> ${JSON.stringify(a)}`)
}

describe('golden results', () => {
  for (const s of SCENARIOS) {
    it(`${s.label} matches test/golden.json`, () => {
      const out: string[] = []
      diff(normalize(simulate(s.inputs)), golden[s.id], s.id, out)
      expect(out.slice(0, 20)).toEqual([])
    })
  }
})
