// Memory-aware inference serving, ported from Madhan's fleet twin (twin/score.py: decode_replica,
// prefill_replica, _ttft) so both twins agree. Constants tagged as in twin/catalog.py.
import type { ComputeInputs } from './model'
import { MODELS, REQUESTS, type ModelPreset, type RequestType } from './presets'

const STEP_SYNC_S = 1.7e-3 // DECK s17: per decode step, one-chip replica
const SYNC_PER_DOUBLING_S = 0.25e-3 // ASSUMED: extra sync each time chips per replica doubles
const WEIGHT_READ_FACTOR = 2.5 // CALIB: weight bytes read per step = 2.5 x active weights (MoE spread)
const ATTN_FLOPS_PER_KV_BYTE = 16 // ASSUMED: 2 FLOPs x 8 query heads per KV head
const SPEC_ACCEPT = 0.7 // ASSUMED: draft-token acceptance (2035 multi-token heads)
const SPEC_DRAFT_OVERHEAD_S = 0.05e-3 // ASSUMED: per draft token per step
const KV_LINK_BYTES_S = 50e9 // ASSUMED: prefill->decode hand-off link when disaggregated
const SUB_CTX = 32_000, SUB_CACHED = 26_000 // DECK s10: sub-agents on 32k contexts
const MIN_SPEED_FACTOR = 1e-9

export interface StreamSpec {
  model: Pick<ModelPreset, 'totalB' | 'activeB' | 'kvKB' | 'stateMB'>
  ctx: number
  cached: number
  out: number
  toolS: number
  rate: number // tok/s per user SLO
}

export interface StreamPerf {
  sessions: number // concurrent decoding sessions per replica
  tps: number // output tokens/s per replica
  ratePerUser: number
  stepS: number
  tReq: number // prefill replica-seconds per request
  weightsGB: number
  memGB: number // usable replica memory
  kvGB: number // KV per session
  bound: 'bandwidth' | 'memory' | 'weights do not fit' | 'speed target unreachable'
  replicaSecPerReq: number
}

/** One replica of n chips serving one stream: decode batch limited by the tok/s target and by memory. */
export function streamPerf(s: StreamSpec, i: ComputeInputs, n: number): StreamPerf {
  const bpw = i.weightBits / 8
  const mem = n * i.chipHbmGB * 1e9 * (1 - i.memReservePct / 100)
  const bw = n * i.chipHbmTBs * 1e12 * (i.bwEffPct / 100)
  const flops = n * i.chipPflops * 1e15 * (i.mfuPct / 100)
  const kvPerTok = s.model.kvKB * 1e3 * (i.hybridKv ? 1 : 4) // hybrid models keep KV in 1 of 4 layers
  const kv = kvPerTok * (s.ctx + s.out / 2) + s.model.stateMB * 1e6
  const weights = s.model.totalB * 1e9 * bpw
  const active = s.model.activeB * 1e9
  const draft = i.specDraft
  const tau = draft > 0 ? (1 - SPEC_ACCEPT ** (draft + 1)) / (1 - SPEC_ACCEPT) : 1
  const budget = tau / s.rate
  const sync = STEP_SYNC_S + SYNC_PER_DOUBLING_S * Math.log2(n)
  const fixed = sync + WEIGHT_READ_FACTOR * active * bpw / bw + draft * SPEC_DRAFT_OVERHEAD_S
  const perSession = kv / bw + (draft + 1) * (2 * active + ATTN_FLOPS_PER_KV_BYTE * kv) / flops
  const bBw = budget > fixed ? Math.floor((budget - fixed) / perSession) : 0
  const free = mem - weights
  const parkedPerActive = (b: number) => (s.toolS > 0 ? (tau / (fixed + b * perSession)) * s.toolS / s.out : 0)
  const fits = (b: number) => b * kv * (1 + parkedPerActive(b)) <= free
  let lo = 0, hi = Math.max(0, bBw)
  while (lo < hi) {
    const mid = Math.floor((lo + hi + 1) / 2)
    if (fits(mid)) lo = mid
    else hi = mid - 1
  }
  const b = free > 0 ? lo : 0
  const newTok = s.ctx - s.cached
  const avgCtx = s.cached + newTok / 2
  const tReq = (newTok * (2 * active + ATTN_FLOPS_PER_KV_BYTE * kvPerTok * avgCtx)) / flops + (s.cached * kvPerTok) / bw
  const base = { tReq, weightsGB: weights / 1e9, memGB: mem / 1e9, kvGB: kv / 1e9 }
  if (weights > mem) return { ...base, sessions: 0, tps: 0, ratePerUser: 0, stepS: budget, bound: 'weights do not fit', replicaSecPerReq: Infinity }
  if (b < 1) return { ...base, sessions: 0, tps: 0, ratePerUser: 0, stepS: budget, bound: bBw < 1 ? 'speed target unreachable' : 'memory', replicaSecPerReq: Infinity }
  const stepS = fixed + b * perSession
  const tps = (b * tau) / stepS
  return {
    ...base, sessions: b, tps, ratePerUser: tau / stepS, stepS,
    bound: b === bBw ? 'bandwidth' : 'memory',
    replicaSecPerReq: s.out / tps + tReq,
  }
}

export interface ServingResult {
  feasible: boolean
  issues: string[]
  bound: StreamPerf['bound']
  sessionsPerChip: number
  ratePerUser: number
  ttftS: number
  taskMin: number // wall time for one task (all steps)
  sloTtftOk: boolean
  sloRateOk: boolean
  sloTaskOk: boolean
  chipSecPerReq: number // blended over main + routed/sub-agent stream
  tokensPerChipHr: number // output tokens per powered chip-hour at target utilization
  weightsGB: number
  replicaMemGB: number
  kvPerSessionGB: number
  altShare: number // share of requests on the routed / sub-agent model
  altModel: string | null
}

/** Serving performance for the chosen request type, model, chip and levers (per chip, before fleet effects). */
export function serve(i: ComputeInputs, rttS: number): ServingResult {
  const req = REQUESTS[i.workload as RequestType]
  const model = { totalB: i.totalParamsB, activeB: i.activeParamsB, kvKB: i.kvKBPerToken, stateMB: i.stateMB }
  const n = Math.max(1, Math.round(i.chipsPerReplica))
  const issues: string[] = []
  if (n > i.chipsPerSat) issues.push(`A model copy needs ${n} chips but a satellite has ${i.chipsPerSat}; shards must stay inside one satellite.`)
  if (i.ctxTokens > i.maxContextK * 1000) issues.push(`Context ${Math.round(i.ctxTokens / 1000)}k exceeds the model's ${i.maxContextK}k limit.`)
  const cached = Math.min(i.cachedTokens, i.ctxTokens)
  const main = streamPerf({ model, ctx: i.ctxTokens, cached, out: i.outTokens, toolS: i.toolWaitS, rate: i.tokPerSecSlo }, i, n)

  // Deck levers: easy chat routed to gpt-oss-120b; agent sub-steps on Qwen3.5-122B with 32k contexts
  let altShare = 0, altModel: string | null = null, alt: StreamPerf | null = null
  if (i.workload === 'chat' && i.easyChatPct > 0) {
    const m = MODELS.find((x) => x.id === 'gptoss')!
    altShare = i.easyChatPct / 100; altModel = m.label
    alt = streamPerf({ model: m, ctx: i.ctxTokens, cached, out: i.outTokens, toolS: i.toolWaitS, rate: i.tokPerSecSlo }, i, n)
  } else if ((i.workload === 'agent_int' || i.workload === 'agent_bg') && i.subagentPct > 0) {
    const m = MODELS.find((x) => x.id === 'qwen122')!
    altShare = i.subagentPct / 100; altModel = m.label
    alt = streamPerf({ model: m, ctx: SUB_CTX, cached: SUB_CACHED, out: i.outTokens, toolS: i.toolWaitS, rate: i.tokPerSecSlo }, i, n)
  }
  if (!isFinite(main.replicaSecPerReq)) issues.push(main.bound === 'weights do not fit'
    ? `Model weights (${main.weightsGB.toFixed(0)} GB) don't fit in ${n} chip${n > 1 ? 's' : ''} (${main.memGB.toFixed(0)} GB usable). Raise chips per model copy to ${Math.ceil(main.weightsGB / (main.memGB / n))}+.`
    : main.bound === 'speed target unreachable'
      ? `Even one session can't reach ${i.tokPerSecSlo} tok/s on this chip: memory bandwidth is too low.`
      : `No session fits next to the weights: KV cache (${main.kvGB.toFixed(1)} GB per session) exceeds free memory.`)
  if (alt && !isFinite(alt.replicaSecPerReq)) issues.push(`The ${altModel} share can't be served on this replica (${alt.bound}).`)

  const chipSecPerReq = n * ((1 - altShare) * main.replicaSecPerReq + altShare * (alt ? alt.replicaSecPerReq : 0))
  const feasible = issues.length === 0 && isFinite(chipSecPerReq) && chipSecPerReq > 0
  const util = i.targetUtilPct / 100
  const tokensPerChipHr = feasible ? (util * i.outTokens * 3600) / chipSecPerReq : 0

  // TTFT (twin/score.py _ttft): user round trip + M/D/1 prefill queue + prefill + first step (+ KV hand-off)
  const rho = Math.min(util, 0.98)
  const handoff = i.disaggPrefill ? (i.ctxTokens - cached) * i.kvKBPerToken * 1e3 / KV_LINK_BYTES_S : 0
  const ttftS = (req.rttPerStep ? rttS : 0) + (rho / (2 * (1 - rho))) * main.tReq + main.tReq + main.stepS + handoff
  const rate = Math.max(main.ratePerUser, MIN_SPEED_FACTOR)
  const taskMin = (i.stepsPerTask * (ttftS + i.outTokens / rate + i.toolWaitS)) / 60
  return {
    feasible,
    issues,
    bound: main.bound,
    sessionsPerChip: main.sessions / n,
    ratePerUser: main.ratePerUser,
    ttftS,
    taskMin,
    sloTtftOk: feasible && ttftS <= i.ttftSloS,
    sloRateOk: feasible && main.ratePerUser >= i.tokPerSecSlo * 0.999,
    sloTaskOk: feasible && (i.taskDeadlineMin <= 0 || taskMin <= i.taskDeadlineMin),
    chipSecPerReq,
    tokensPerChipHr,
    weightsGB: main.weightsGB,
    replicaMemGB: main.memGB,
    kvPerSessionGB: main.kvGB,
    altShare,
    altModel,
  }
}
