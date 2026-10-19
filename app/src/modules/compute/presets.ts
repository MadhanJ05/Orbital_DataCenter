import type { Inputs } from '../../core/types'

export interface ChipPreset {
  id: string
  label: string
  tdpW: number // per accelerator; deck chips use rack power / chips per rack (includes CPU, network, cooling pumps)
  pflops: number // dense PFLOPS at the precision it serves in (FP8 for vendor parts, FP4 for the deck GPU)
  hbmGB: number
  hbmTBs: number
  priceUsd: number
  pricePerHr: number // market rental price assumption
  serverOverhead: number // node power / tdpW
  serverCostMult: number // node cost / priceUsd
}

// Vendor parts: datasheet dense figures (Rubin estimated). Deck GPU/LPU: Track 1 organizer catalog
// (DECK s12-s13; FP4 peak ASSUMED in twin/catalog.py). 2035 accelerator: team projection, not a vendor figure.
export const CHIPS: ChipPreset[] = [
  { id: 'deckgpu', label: 'Deck 2035 GPU (organizer catalog)', tdpW: 5500, pflops: 250, hbmGB: 3000, hbmTBs: 120, priceUsd: 165_278, pricePerHr: 10, serverOverhead: 1, serverCostMult: 1 },
  { id: 'decklpu', label: 'Deck 2035 LPU (decode chip, organizer catalog)', tdpW: 2016, pflops: 50, hbmGB: 160, hbmTBs: 200, priceUsd: 55_859, pricePerHr: 4, serverOverhead: 1, serverCostMult: 1 },
  { id: 'h100', label: 'NVIDIA H100 SXM (2023)', tdpW: 700, pflops: 1.98, hbmGB: 80, hbmTBs: 3.35, priceUsd: 25000, pricePerHr: 2.0, serverOverhead: 1.3, serverCostMult: 1.6 },
  { id: 'b200', label: 'NVIDIA B200 (2025)', tdpW: 1000, pflops: 4.5, hbmGB: 192, hbmTBs: 8, priceUsd: 35000, pricePerHr: 3.5, serverOverhead: 1.3, serverCostMult: 1.6 },
  { id: 'rubin', label: 'Rubin-class (2026-27, est.)', tdpW: 1800, pflops: 16, hbmGB: 288, hbmTBs: 22, priceUsd: 50000, pricePerHr: 6.5, serverOverhead: 1.3, serverCostMult: 1.6 },
  { id: 'gen2035', label: '2035 accelerator (team projection)', tdpW: 2000, pflops: 50, hbmGB: 1500, hbmTBs: 60, priceUsd: 50000, pricePerHr: 9, serverOverhead: 1.3, serverCostMult: 1.6 },
  { id: 'custom', label: 'Custom', tdpW: 1000, pflops: 5, hbmGB: 192, hbmTBs: 8, priceUsd: 30000, pricePerHr: 3, serverOverhead: 1.3, serverCostMult: 1.6 },
]

export function chipPatch(id: string): Partial<Inputs> {
  const c = CHIPS.find((x) => x.id === id)!
  return {
    chipId: id, chipTdpW: c.tdpW, chipPflops: c.pflops, chipHbmGB: c.hbmGB, chipHbmTBs: c.hbmTBs,
    chipPriceUsd: c.priceUsd, pricePerChipHr: c.pricePerHr, serverOverhead: c.serverOverhead, serverCostMult: c.serverCostMult,
  }
}

export interface ModelPreset {
  id: string
  label: string
  totalB: number // stored parameters
  activeB: number // parameters active per token
  kvKB: number // KV cache per context token (hybrid models: already 1 in 4 layers)
  stateMB: number // fixed per-session state of the hybrid layers
  maxCtxK: number
}

// Open-weight models and published numbers from the Track 1 deck (DECK s10). Frontier: team projection, training only.
export const MODELS: ModelPreset[] = [
  { id: 'kimi', label: 'Kimi K3 (2.8T, 104B active)', totalB: 2800, activeB: 104, kvKB: 14, stateMB: 217, maxCtxK: 1000 },
  { id: 'qwen397', label: 'Qwen3.5-397B (17B active)', totalB: 397, activeB: 17, kvKB: 15, stateMB: 94, maxCtxK: 262 },
  { id: 'qwen122', label: 'Qwen3.5-122B (10B active)', totalB: 122, activeB: 10, kvKB: 12, stateMB: 75, maxCtxK: 262 },
  { id: 'gptoss', label: 'gpt-oss-120b (5.1B active)', totalB: 117, activeB: 5.1, kvKB: 18, stateMB: 2, maxCtxK: 131 },
  { id: 'frontier', label: '2035 frontier model (2T, training)', totalB: 2000, activeB: 2000, kvKB: 0, stateMB: 0, maxCtxK: 128 },
  { id: 'custom', label: 'Custom', totalB: 100, activeB: 100, kvKB: 15, stateMB: 0, maxCtxK: 128 },
]

export function modelPatch(id: string): Partial<Inputs> {
  const m = MODELS.find((x) => x.id === id)!
  return id === 'custom' ? { modelId: id } : { modelId: id, totalParamsB: m.totalB, activeParamsB: m.activeB, kvKBPerToken: m.kvKB, stateMB: m.stateMB, maxContextK: m.maxCtxK }
}

export type RequestType = 'chat' | 'agent_int' | 'agent_bg'

export interface RequestPreset {
  label: string
  model: string
  ctx: number // tokens read per request
  cached: number // of those, already in cache
  out: number // tokens written
  steps: number // requests per task
  toolS: number // wait between steps (tool call)
  ttft: number // s, time to first token SLO
  rate: number // tok/s per user SLO
  deadlineMin: number // task deadline, 0 = none
  rttPerStep: boolean // interactive work pays a user round trip every step
  peak: number // peak-hour multiplier on the daily average
  perUserDay: number // tasks (or prompts) per user per day
}

// DECK s10-s11 (three standard workloads; per-user rates from the user cases, peak factors from DECK s16).
export const REQUESTS: Record<RequestType, RequestPreset> = {
  chat: { label: 'Chat prompt', model: 'qwen397', ctx: 64_000, cached: 56_000, out: 3_500, steps: 1, toolS: 0, ttft: 0.6, rate: 60, deadlineMin: 0, rttPerStep: true, peak: 2.0, perUserDay: 30 },
  agent_int: { label: 'Agent step, interactive', model: 'kimi', ctx: 256_000, cached: 250_000, out: 500, steps: 80, toolS: 8, ttft: 2, rate: 100, deadlineMin: 25, rttPerStep: true, peak: 2.5, perUserDay: 12 },
  agent_bg: { label: 'Agent step, background', model: 'kimi', ctx: 256_000, cached: 250_000, out: 500, steps: 80, toolS: 8, ttft: 10, rate: 30, deadlineMin: 240, rttPerStep: false, peak: 1.0, perUserDay: 30 },
}

/** Selecting a workload loads the deck's request, SLO and model for it. Training keeps the frontier model. */
export function workloadPatch(w: string): Partial<Inputs> {
  if (w === 'training') return { workload: 'training', ...modelPatch('frontier'), mfuPct: 40 }
  const r = REQUESTS[w as RequestType]
  return {
    workload: w as RequestType, ...modelPatch(r.model),
    ctxTokens: r.ctx, cachedTokens: r.cached, outTokens: r.out, stepsPerTask: r.steps, toolWaitS: r.toolS,
    ttftSloS: r.ttft, tokPerSecSlo: r.rate, taskDeadlineMin: r.deadlineMin, peakFactor: r.peak, tasksPerUserDay: r.perUserDay,
    easyChatPct: 0, subagentPct: 0, mfuPct: 50,
  }
}
