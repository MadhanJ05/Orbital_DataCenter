import type { Stage } from '../../core/module'
import type { Inputs, Results } from '../../core/types'
import { fmt } from '../../core/format'

export function computeStage(i: Inputs, r: Results): Stage {
  const training = i.workload === 'training'
  return {
    id: 'compute',
    title: 'Compute',
    what: `Each accelerator delivers ${i.chipPflops} PFLOPS peak; at ${i.mfuPct}% utilization and ${i.seuOverheadPct}% lost to radiation soft errors, the cluster delivers real work.`,
    metrics: [
      { label: 'Effective compute', value: `${fmt(r.compute.effectiveEflopsBol)} EFLOPS` },
      training
        ? { label: 'Time to train', value: `${fmt(r.compute.trainDays)} days` }
        : { label: 'Throughput', value: `${fmt(r.compute.tokensPerSec)} tokens/s` },
      { label: 'Peak (FP8)', value: `${fmt(r.compute.peakEflops)} EFLOPS` },
      { label: 'Per satellite', value: `${i.chipsPerSat} accelerators` },
    ],
    status: training && r.compute.trainDays > 365
      ? { tone: 'warn', text: 'Training takes over a year' }
      : { tone: 'good', text: 'Compute sized' },
  }
}
