import { serve, type ServingResult } from './serving'
import type { RequestType } from './presets'

export type Workload = RequestType | 'training'

export interface ComputeInputs {
  // Fleet
  satellites: number
  chipsPerSat: number
  sparesPct: number // cold spares launched, unpowered until needed
  // Accelerator
  chipId: string
  chipTdpW: number
  chipPflops: number // dense PFLOPS at serving precision (never sparse; NVFP4 marketing figures are not FP8)
  chipHbmGB: number
  chipHbmTBs: number
  chipPriceUsd: number
  serverOverhead: number // node power / accelerator TDP (CPU, HBM, NICs, pumps)
  serverKgPerChip: number // node mass per accelerator incl. cold plate and local shielding
  seuOverheadPct: number // compute lost to soft-error detection, checkpoint and replay
  // Workload: request type and its service targets (DECK s10)
  workload: Workload
  ctxTokens: number // tokens read per request
  cachedTokens: number // of those, already cached
  outTokens: number // tokens written per request
  stepsPerTask: number
  toolWaitS: number // tool call between steps
  ttftSloS: number // time to first token target
  tokPerSecSlo: number // per-user decode speed target
  taskDeadlineMin: number // whole-task deadline, 0 = none
  tasksPerUserDay: number
  peakFactor: number // peak-hour demand / daily average
  // Model
  modelId: string
  totalParamsB: number // stored parameters (memory)
  activeParamsB: number // parameters used per token (compute)
  kvKBPerToken: number
  stateMB: number
  maxContextK: number
  weightBits: number // 4 = FP4, 8 = FP8
  // Serving levers (DECK s10)
  easyChatPct: number // easy chat routed to gpt-oss-120b, up to 50%
  subagentPct: number // agent steps done by Qwen3.5-122B sub-agents on 32k contexts, up to 50%
  specDraft: number // speculative decoding draft tokens
  hybridKv: boolean // KV cache in 1 of 4 layers (hybrid attention)
  disaggPrefill: boolean // prefill and decode on different chips (adds a KV hand-off)
  chipsPerReplica: number // chips holding one model copy; must sit inside one satellite
  bwEffPct: number // achieved share of HBM bandwidth
  memReservePct: number // HBM kept free
  targetUtilPct: number // average load on serving chips (headroom for queues and peaks)
  mfuPct: number
  trainTokensT: number
}

export const computeDefaults: ComputeInputs = {
  satellites: 81,
  chipsPerSat: 32,
  sparesPct: 15,
  chipId: 'deckgpu',
  chipTdpW: 5500,
  chipPflops: 250,
  chipHbmGB: 3000,
  chipHbmTBs: 120,
  chipPriceUsd: 165_278,
  serverOverhead: 1,
  serverKgPerChip: 10,
  seuOverheadPct: 3,
  workload: 'agent_int', // inference goes to orbit first (root README); training is a preset
  ctxTokens: 256_000,
  cachedTokens: 250_000,
  outTokens: 500,
  stepsPerTask: 80,
  toolWaitS: 8,
  ttftSloS: 2,
  tokPerSecSlo: 100,
  taskDeadlineMin: 25,
  tasksPerUserDay: 12,
  peakFactor: 2.5,
  modelId: 'kimi',
  totalParamsB: 2800,
  activeParamsB: 104,
  kvKBPerToken: 14,
  stateMB: 217,
  maxContextK: 1000,
  weightBits: 4,
  easyChatPct: 0,
  subagentPct: 0,
  specDraft: 0,
  hybridKv: true,
  disaggPrefill: false,
  chipsPerReplica: 1,
  bwEffPct: 60,
  memReservePct: 5,
  targetUtilPct: 70,
  mfuPct: 50,
  trainTokensT: 100,
}

export interface ComputeModel {
  N: number // active accelerators
  chipsPerSatProv: number
  provisioned: number // active + spares
  perChipW: number
  itWPerSat: number
  P: number // active parameters
  mfu: number
  seu: number // share of compute left after soft-error overhead
  flopsPerChipEff: number
  tokensPerChipHr: number
  trainFlops: number
}

export function runCompute(i: ComputeInputs): ComputeModel {
  const N = i.satellites * i.chipsPerSat
  const chipsPerSatProv = Math.ceil(i.chipsPerSat * (1 + i.sparesPct / 100))
  const provisioned = i.satellites * chipsPerSatProv
  const perChipW = i.chipTdpW * i.serverOverhead
  const itWPerSat = i.chipsPerSat * perChipW
  const P = i.activeParamsB * 1e9
  const mfu = i.mfuPct / 100
  const seu = 1 - i.seuOverheadPct / 100
  const flopsPerChipEff = i.chipPflops * 1e15 * mfu * seu
  const tokensPerChipHr = (flopsPerChipEff * 3600) / ((i.workload === 'training' ? 6 : 2) * P)
  const trainFlops = 6 * P * i.trainTokensT * 1e12
  return { N, chipsPerSatProv, provisioned, perChipW, itWPerSat, P, mfu, seu, flopsPerChipEff, tokensPerChipHr, trainFlops }
}

/**
 * Cluster throughput once power availability and round-trip time are known. Training is FLOPS-bound
 * (6 x params x tokens). Inference uses the memory-aware serving model (serving.ts): decode limited by
 * HBM bandwidth at the per-user speed target and by KV-cache memory, plus prefill time.
 */
export function throughput(i: ComputeInputs, c: ComputeModel, availability: number, rttS: number) {
  const effFlopsBol = c.N * c.flopsPerChipEff * availability
  const trainDays = c.trainFlops / effFlopsBol / 86400
  if (i.workload === 'training') {
    return { effFlopsBol, tokensPerSec: effFlopsBol / (6 * c.P), trainDays, serving: null as ServingResult | null, tokensPerChipHr: c.tokensPerChipHr }
  }
  const serving = serve(i, rttS)
  const tokensPerSec = (c.N * availability * c.seu * serving.tokensPerChipHr) / 3600
  return { effFlopsBol, tokensPerSec, trainDays, serving, tokensPerChipHr: serving.tokensPerChipHr }
}
