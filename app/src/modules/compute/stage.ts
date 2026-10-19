import type { Stage } from '../../core/module'
import type { Inputs, Results } from '../../core/types'
import { fmt } from '../../core/format'

export function computeStage(i: Inputs, r: Results): Stage {
  const sv = r.compute.serving
  if (i.workload === 'training' || !sv) {
    return {
      id: 'compute',
      title: 'Compute',
      what: `Each accelerator delivers ${i.chipPflops} PFLOPS peak; at ${i.mfuPct}% utilization and ${i.seuOverheadPct}% lost to radiation soft errors, the cluster trains as one machine.`,
      metrics: [
        { label: 'Effective compute', value: `${fmt(r.compute.effectiveEflopsBol)} EFLOPS` },
        { label: 'Time to train', value: `${fmt(r.compute.trainDays)} days` },
        { label: 'Peak', value: `${fmt(r.compute.peakEflops)} EFLOPS` },
        { label: 'Per satellite', value: `${i.chipsPerSat} accelerators` },
      ],
      status: r.compute.trainDays > 365 ? { tone: 'warn', text: 'Training takes over a year' } : { tone: 'good', text: 'Compute sized' },
    }
  }
  const sloOk = sv.sloTtftOk && sv.sloRateOk && sv.sloTaskOk
  return {
    id: 'compute',
    title: 'Compute & serving',
    what: sv.feasible
      ? `Each copy of the model sits on ${i.chipsPerReplica} chip${i.chipsPerReplica > 1 ? 's' : ''}. Writing speed is capped by memory bandwidth at ${i.tokPerSecSlo} tok/s per user, and KV caches fill the memory: ${fmt(sv.sessionsPerChip)} users per chip (${sv.bound}-bound).`
      : `This setup can't serve the request: ${sv.issues[0] ?? 'see warnings'}`,
    metrics: [
      { label: 'Users served at peak', value: sv.feasible ? fmt(sv.usersAtPeak) : 'infeasible' },
      { label: 'Output tokens/s', value: fmt(r.compute.tokensPerSec) },
      { label: `First token (target ${i.ttftSloS} s)`, value: sv.feasible ? `${sv.ttftS.toFixed(2)} s` : '—' },
      { label: 'Users per chip', value: sv.feasible ? `${fmt(sv.sessionsPerChip)} (${sv.bound})` : sv.bound },
    ],
    status: !sv.feasible ? { tone: 'bad', text: 'Infeasible' } : sloOk ? { tone: 'good', text: 'Meets service targets' } : { tone: 'warn', text: 'Misses a service target' },
  }
}
