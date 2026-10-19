import { num, type Section } from '../../core/fields'
import type { Inputs } from '../../core/types'
import { CHIPS, MODELS, chipPatch, modelPatch, workloadPatch } from './presets'

const training = (i: Inputs) => i.workload === 'training'
const notChat = (i: Inputs) => i.workload !== 'chat'
const notAgent = (i: Inputs) => i.workload !== 'agent_int' && i.workload !== 'agent_bg'

export const computeSections: Section[] = [
  {
    id: 'workload',
    title: 'Workload & service targets',
    fields: [
      {
        kind: 'select', key: 'workload', label: 'Request type',
        options: [
          { value: 'chat', label: 'Chat prompt' },
          { value: 'agent_int', label: 'Agent step, interactive' },
          { value: 'agent_bg', label: 'Agent step, background' },
          { value: 'training', label: 'Training (frontier model)' },
        ],
        patch: workloadPatch,
        help: 'Loads the deck values for that request; edit any of them below.',
      },
      num('ctxTokens', 'Tokens read per request', 1000, 1_000_000, 1000, 'tokens', 'Context the model reads each request (DECK s10).', { log: true, hideFor: training }),
      num('cachedTokens', 'Of which already cached', 0, 1_000_000, 1000, 'tokens', 'Prefix reused from cache; only the rest is prefilled.', { hideFor: training }),
      num('outTokens', 'Tokens written per request', 10, 20_000, 10, 'tokens', undefined, { log: true, hideFor: training }),
      num('stepsPerTask', 'Requests per task', 1, 200, 1, 'steps', 'Chat: 1. Agents: 80 steps per task.', { hideFor: training }),
      num('toolWaitS', 'Tool wait between steps', 0, 60, 0.5, 's', 'Interactive: tools on a laptop (8 s). Background: sandbox next door. The KV cache stays parked in memory meanwhile.', { hideFor: training }),
      num('ttftSloS', 'Time to first token target', 0.1, 30, 0.1, 's', 'Chat 0.6 s, interactive agents 2 s, background 10 s.', { hideFor: training }),
      num('tokPerSecSlo', 'Writing speed target', 5, 300, 1, 'tok/s', 'Per user. Chat 60, interactive 100, background 30.', { hideFor: training }),
      num('taskDeadlineMin', 'Task deadline', 0, 600, 1, 'min', 'Whole task. Interactive 25 min, background 4 h (240). 0 = none.', { hideFor: training }),
      num('tasksPerUserDay', 'Tasks per user per day', 1, 100, 1, '', 'Prompts (chat) or agent tasks per user per day (DECK s11 user cases).', { hideFor: training }),
      num('peakFactor', 'Peak-hour factor', 1, 4, 0.1, 'x', 'Peak demand / daily average (DECK s16): chat 2, interactive 2.5, background 1.', { hideFor: training }),
      num('trainTokensT', 'Training tokens', 1, 1000, 1, 'T', 'Total training-set tokens. Compute = 6 x params x tokens.', { hideFor: (i) => !training(i) }),
    ],
  },
  {
    id: 'model',
    title: 'Model',
    fields: [
      { kind: 'select', key: 'modelId', label: 'AI model', options: MODELS.map((m) => ({ value: m.id, label: m.label })), patch: modelPatch },
      num('totalParamsB', 'Total parameters (stored)', 1, 20000, 1, 'B', 'Sets weight memory. Mixture-of-experts models store far more than they use per token.', { log: true, alsoSet: { modelId: 'custom' } }),
      num('activeParamsB', 'Active parameters (per token)', 1, 20000, 0.1, 'B', 'Sets compute and weight reads per step.', { log: true, alsoSet: { modelId: 'custom' } }),
      num('kvKBPerToken', 'KV cache per token', 0, 500, 0.5, 'KB', 'Memory per context token (FP8). Deck hybrid models already count 1 in 4 layers.', { hideFor: training, alsoSet: { modelId: 'custom' } }),
      num('stateMB', 'Fixed state per session', 0, 2000, 1, 'MB', 'Hybrid-layer state held per session.', { hideFor: training, alsoSet: { modelId: 'custom' } }),
      num('maxContextK', 'Max context', 8, 2000, 1, 'k tokens', undefined, { hideFor: training, alsoSet: { modelId: 'custom' } }),
      num('weightBits', 'Weight precision', 4, 16, 4, 'bits', 'Deck: FP4 weights, FP8 KV cache.', { hideFor: training }),
    ],
  },
  {
    id: 'serving',
    title: 'Serving levers',
    fields: [
      num('easyChatPct', 'Easy chat routed to gpt-oss-120b', 0, 50, 1, '%', 'DECK s10: up to 50%.', { hideFor: notChat }),
      num('subagentPct', 'Steps done by Qwen3.5-122B sub-agents', 0, 50, 1, '%', 'DECK s10: up to half of the steps, on 32k contexts.', { hideFor: notAgent }),
      num('specDraft', 'Speculative decoding: draft tokens', 0, 8, 1, '', 'Draft ahead and verify in one step (70% acceptance assumed).', { hideFor: training }),
      { kind: 'bool', key: 'hybridKv', label: 'Hybrid attention: KV cache in 1 of 4 layers', help: 'Off = full attention, 4x the KV memory and traffic.' },
      { kind: 'bool', key: 'disaggPrefill', label: 'Prefill and decode on different chips', help: 'Adds a KV hand-off to time-to-first-token; lets each phase use its best chip.' },
      num('chipsPerReplica', 'Chips per model copy', 1, 64, 1, '', 'Shards of one copy talk every step, so they must sit in one satellite.', { hideFor: training }),
      num('bwEffPct', 'Achieved memory bandwidth', 20, 100, 1, '%', 'DECK s13: a 120 TB/s GPU reads ~72 TB/s (60%).', { hideFor: training }),
      num('mfuPct', 'Achieved compute (MFU)', 5, 80, 1, '%', 'Inference prefill ~50%; training ~35-50%.'),
      num('memReservePct', 'Memory kept free', 0, 30, 1, '%', 'Safety reserve (fleet twin: 5%).', { hideFor: training }),
      num('targetUtilPct', 'Average chip load', 20, 95, 1, '%', 'Headroom for queues and bursts; higher load means longer queues (TTFT).', { hideFor: training }),
    ],
  },
  {
    id: 'compute',
    title: 'Compute hardware',
    fields: [
      { kind: 'select', key: 'chipId', label: 'Accelerator', options: CHIPS.map((c) => ({ value: c.id, label: c.label })), patch: chipPatch },
      num('chipTdpW', 'Power per accelerator', 200, 8000, 50, 'W', 'Deck chips: rack power / chips per rack.', { alsoSet: { chipId: 'custom' } }),
      num('chipPflops', 'Dense PFLOPS (serving precision)', 0.5, 500, 0.5, 'PFLOPS', 'Dense, not sparse. Vendor FP4 marketing figures are not FP8.', { alsoSet: { chipId: 'custom' } }),
      num('chipHbmGB', 'Memory (HBM)', 16, 5000, 1, 'GB', undefined, { log: true, alsoSet: { chipId: 'custom' } }),
      num('chipHbmTBs', 'Memory bandwidth', 1, 300, 0.5, 'TB/s', undefined, { log: true, alsoSet: { chipId: 'custom' } }),
      num('chipPriceUsd', 'Accelerator price', 5000, 300000, 1000, '$', undefined, { alsoSet: { chipId: 'custom' } }),
      num('serverOverhead', 'Node power / accelerator power', 1, 2, 0.05, 'x', 'CPU, memory, NICs and pumps. Deck chips: 1 (already in rack power).'),
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
