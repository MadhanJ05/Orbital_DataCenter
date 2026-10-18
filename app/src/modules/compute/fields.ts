import { num, type Section } from '../../core/fields'
import { CHIPS, MODELS } from './presets'

export const computeSections: Section[] = [
  {
    id: 'workload',
    title: 'Workload & model',
    fields: [
      { kind: 'select', key: 'workload', label: 'Workload', options: [{ value: 'training', label: 'Training' }, { value: 'inference', label: 'Inference' }] },
      {
        kind: 'select', key: 'modelId', label: 'AI model',
        options: MODELS.map((m) => ({ value: m.id, label: m.label })),
        patch: (v) => (v === 'custom' ? { modelId: v } : { modelId: v, activeParamsB: MODELS.find((m) => m.id === v)!.activeB }),
      },
      num('activeParamsB', 'Active parameters', 1, 20000, 1, 'B', 'Parameters touched per token (for MoE, the active experts only).', { log: true, alsoSet: { modelId: 'custom' } }),
      num('trainTokensT', 'Training tokens', 1, 1000, 1, 'T', 'Total training-set tokens. Compute = 6 x params x tokens.', { hideFor: (i) => i.workload !== 'training' }),
      num('mfuPct', 'Utilization (MFU)', 5, 80, 1, '%', 'Achieved share of peak FLOPS. Training ~35-50%, decode-heavy inference ~20-35%.'),
    ],
  },
  {
    id: 'compute',
    title: 'Compute hardware',
    fields: [
      {
        kind: 'select', key: 'chipId', label: 'Accelerator',
        options: CHIPS.map((c) => ({ value: c.id, label: c.label })),
        patch: (v) => {
          const c = CHIPS.find((x) => x.id === v)!
          return { chipId: v, chipTdpW: c.tdpW, chipPflops: c.pflops, chipPriceUsd: c.priceUsd, pricePerChipHr: c.pricePerHr }
        },
      },
      num('chipTdpW', 'Accelerator TDP', 200, 4000, 50, 'W', undefined, { alsoSet: { chipId: 'custom' } }),
      num('chipPflops', 'Dense FP8 per accelerator', 0.5, 200, 0.5, 'PFLOPS', undefined, { alsoSet: { chipId: 'custom' } }),
      num('chipPriceUsd', 'Accelerator price', 5000, 150000, 1000, '$', undefined, { alsoSet: { chipId: 'custom' } }),
      num('serverOverhead', 'Node power / TDP', 1, 2, 0.05, 'x', 'CPU, memory, NICs and pumps on top of the accelerator.'),
      num('serverKgPerChip', 'Node mass per accelerator', 2, 40, 0.5, 'kg', 'Board, cold plate, local radiation shielding.'),
      num('seuOverheadPct', 'Soft-error overhead', 0, 20, 0.5, '%', 'Compute lost to error detection, checkpointing and replay.'),
    ],
  },
  {
    id: 'fleet',
    title: 'Fleet size',
    fields: [
      num('satellites', 'Satellites', 1, 2000, 1, '', undefined, { log: true }),
      num('chipsPerSat', 'Accelerators per satellite', 1, 512, 1, '', undefined, { log: true }),
      num('sparesPct', 'Cold spares', 0, 50, 1, '%', 'Extra accelerators launched unpowered; switched in as others fail.'),
    ],
  },
]
