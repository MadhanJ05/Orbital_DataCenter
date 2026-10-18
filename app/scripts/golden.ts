// Writes test/golden.json: every preset scenario's full results. The golden test fails if a change moves any number.
import { writeFileSync } from 'node:fs'
import { simulate } from '../src/core/pipeline'
import { SCENARIOS } from '../src/scenarios/presets'

const out: Record<string, unknown> = {}
for (const s of SCENARIOS) out[s.id] = simulate(s.inputs)
writeFileSync(new URL('../test/golden.json', import.meta.url), JSON.stringify(out, (_k, v) => (typeof v === 'number' && !isFinite(v) ? String(v) : v), 1))
console.log('wrote test/golden.json for', Object.keys(out).join(', '))
