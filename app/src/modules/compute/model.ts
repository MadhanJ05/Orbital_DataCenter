export type Workload = 'training' | 'inference'

export interface ComputeInputs {
  // Fleet
  satellites: number
  chipsPerSat: number
  sparesPct: number // cold spares launched, unpowered until needed
  // Accelerator
  chipId: string
  chipTdpW: number
  chipPflops: number // dense FP8 PFLOPS per accelerator
  chipPriceUsd: number
  serverOverhead: number // node power / accelerator TDP (CPU, HBM, NICs, pumps)
  serverKgPerChip: number // node mass per accelerator incl. cold plate and local shielding
  seuOverheadPct: number // compute lost to soft-error detection, checkpoint and replay
  // Workload
  workload: Workload
  modelId: string
  activeParamsB: number
  mfuPct: number
  trainTokensT: number
}

export const computeDefaults: ComputeInputs = {
  satellites: 81,
  chipsPerSat: 32,
  sparesPct: 15,
  chipId: 'gen2035',
  chipTdpW: 2000,
  chipPflops: 50,
  chipPriceUsd: 50000,
  serverOverhead: 1.3,
  serverKgPerChip: 10,
  seuOverheadPct: 3,
  workload: 'training',
  modelId: 'frontier',
  activeParamsB: 2000,
  mfuPct: 40,
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

/** Cluster throughput once power availability is known (compute pauses in eclipse if batteries don't carry it). */
export function throughput(i: ComputeInputs, c: ComputeModel, availability: number) {
  const effFlopsBol = c.N * c.flopsPerChipEff * availability
  const tokensPerSec = i.workload === 'training' ? effFlopsBol / (6 * c.P) : effFlopsBol / (2 * c.P)
  const trainDays = c.trainFlops / effFlopsBol / 86400
  return { effFlopsBol, tokensPerSec, trainDays }
}
