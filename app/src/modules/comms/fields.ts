import { num, type Section } from '../../core/fields'

export const commsSections: Section[] = [
  {
    id: 'comms',
    title: 'Comms',
    fields: [
      num('linkGbpsPerSat', 'Ground link per satellite', 1, 1000, 1, 'Gbps', 'Optical downlink or relay through a laser mesh.', { log: true }),
      num('linkAvailPct', 'Link availability', 20, 100, 1, '%'),
      num('ioBytesPerToken', 'Ground-link bytes per token', 1, 500, 1, 'B', 'Data moved to/from Earth per processed token (prompts, data, results).'),
    ],
  },
]
