export interface ChipPreset {
  id: string
  label: string
  tdpW: number
  pflops: number // dense FP8
  priceUsd: number
  pricePerHr: number // market rental price assumption
}

// Dense FP8 figures from vendor datasheets; 2035 entry is a team projection.
export const CHIPS: ChipPreset[] = [
  { id: 'h100', label: 'NVIDIA H100 SXM (2023)', tdpW: 700, pflops: 1.98, priceUsd: 25000, pricePerHr: 2.0 },
  { id: 'b200', label: 'NVIDIA B200 (2025)', tdpW: 1000, pflops: 4.5, priceUsd: 35000, pricePerHr: 3.5 },
  { id: 'rubin', label: 'Rubin-class (2026-27, est.)', tdpW: 1800, pflops: 16, priceUsd: 50000, pricePerHr: 6.5 },
  { id: 'gen2035', label: '2035 accelerator (projected)', tdpW: 2000, pflops: 50, priceUsd: 50000, pricePerHr: 9 },
  { id: 'custom', label: 'Custom', tdpW: 1000, pflops: 5, priceUsd: 30000, pricePerHr: 3 },
]

export interface ModelPreset {
  id: string
  label: string
  activeB: number // parameters active per token
}

// Model sizes from the Track 1 organizer deck (Qwen3.5, Kimi-K3); the 2035 frontier model is a team projection.
export const MODELS: ModelPreset[] = [
  { id: 'qwen397', label: 'Qwen3.5-397B (17B active, MoE)', activeB: 17 },
  { id: 'dense70', label: '70B dense (Llama-class)', activeB: 70 },
  { id: 'kimi', label: 'Kimi-K3 (2.8T, 104B active, MoE)', activeB: 104 },
  { id: 'frontier', label: '2035 frontier model (2T active)', activeB: 2000 },
  { id: 'custom', label: 'Custom', activeB: 100 },
]
