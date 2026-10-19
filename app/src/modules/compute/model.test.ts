import { describe, expect, it } from 'vitest'
import { computeDefaults, runCompute, throughput, type ComputeInputs } from './model'
import { chipPatch, modelPatch, workloadPatch } from './presets'
import { serve, streamPerf } from './serving'

const within = (x: number, target: number, tol: number) => expect(Math.abs(x - target)).toBeLessThanOrEqual(tol * target)
const withW = (w: string, extra: Partial<ComputeInputs> = {}): ComputeInputs => ({ ...computeDefaults, ...workloadPatch(w), ...extra } as ComputeInputs)
const spec = (i: ComputeInputs) => ({
  model: { totalB: i.totalParamsB, activeB: i.activeParamsB, kvKB: i.kvKBPerToken, stateMB: i.stateMB },
  ctx: i.ctxTokens, cached: i.cachedTokens, out: i.outTokens, toolS: i.toolWaitS, rate: i.tokPerSecSlo,
})

// Same calibration targets as twin/test_calibration.py (DECK s13), on one deck GPU with no levers.
describe('serving matches the deck and the fleet twin', () => {
  it('chat on Qwen3.5-397B: ~960 sessions and ~58,000 tok/s per GPU', () => {
    const r = streamPerf(spec(withW('chat')), withW('chat'), 1)
    within(r.sessions, 960, 0.03)
    within(r.tps, 58_000, 0.03)
  })
  it('interactive agents on Kimi K3: ~117 sessions and ~11,700 tok/s per GPU', () => {
    const r = streamPerf(spec(withW('agent_int')), withW('agent_int'), 1)
    within(r.sessions, 117, 0.03)
    within(r.tps, 11_700, 0.03)
  })
  it('KV per session: ~1.1 GB chat, ~3.8 GB agent', () => {
    within(streamPerf(spec(withW('chat')), withW('chat'), 1).kvGB, 1.1, 0.03)
    within(streamPerf(spec(withW('agent_int')), withW('agent_int'), 1).kvGB, 3.8, 0.03)
  })
})

describe('serving feasibility is reported, not hidden', () => {
  it('Kimi K3 weights do not fit on one H100', () => {
    const s = serve(withW('agent_int', chipPatch('h100') as Partial<ComputeInputs>), 0.024)
    expect(s.feasible).toBe(false)
    expect(s.tokensPerChipHr).toBe(0)
    expect(s.issues.join(' ')).toMatch(/don't fit/)
  })
  it('a model copy larger than a satellite is infeasible', () => {
    const s = serve(withW('agent_int', { chipsPerReplica: 64, chipsPerSat: 32 }), 0.024)
    expect(s.feasible).toBe(false)
    expect(s.issues.join(' ')).toMatch(/inside one satellite/)
  })
  it('context beyond the model limit is infeasible', () => {
    const s = serve(withW('chat', { ...modelPatch('gptoss'), ctxTokens: 200_000 } as Partial<ComputeInputs>), 0.024)
    expect(s.feasible).toBe(false)
  })
  it('a utilization slider cannot rescue infeasible memory', () => {
    const s = serve(withW('agent_int', { ...chipPatch('h100'), mfuPct: 80, targetUtilPct: 95 } as Partial<ComputeInputs>), 0.024)
    expect(s.feasible).toBe(false)
  })
})

describe('serving levers', () => {
  it('sub-agents and speculative decoding raise tokens per chip-hour', () => {
    const base = serve(withW('agent_int'), 0.024).tokensPerChipHr
    expect(serve(withW('agent_int', { subagentPct: 50 }), 0.024).tokensPerChipHr).toBeGreaterThan(base)
    expect(serve(withW('agent_int', { specDraft: 4 }), 0.024).tokensPerChipHr).toBeGreaterThan(base)
  })
  it('turning off hybrid attention (4x KV) cuts sessions per chip', () => {
    expect(serve(withW('agent_int', { hybridKv: false }), 0.024).sessionsPerChip).toBeLessThan(serve(withW('agent_int'), 0.024).sessionsPerChip)
  })
  it('chat meets 0.6 s first token from 650 km at the default load', () => {
    const s = serve(withW('chat'), 0.024)
    expect(s.sloTtftOk).toBe(true)
    expect(s.sloRateOk).toBe(true)
  })
  it('background agents skip the user round trip', () => {
    const near = serve(withW('agent_bg'), 0.01).ttftS
    const far = serve(withW('agent_bg'), 0.5).ttftS
    expect(far).toBeCloseTo(near, 9)
  })
})

describe('training', () => {
  it('training compute = 6 x params x tokens', () => {
    const c = runCompute(withW('training'))
    expect(c.trainFlops).toBeCloseTo(6 * 2000e9 * 100e12, -20)
  })
  it('spares round up per satellite', () => {
    expect(runCompute({ ...computeDefaults, chipsPerSat: 32, sparesPct: 15 }).chipsPerSatProv).toBe(37)
  })
  it('training throughput ignores the serving model', () => {
    const i = withW('training')
    expect(throughput(i, runCompute(i), 1, 0.024).serving).toBeNull()
  })
})
