import { num, type Section } from '../../core/fields'

export const massSections: Section[] = [
  {
    id: 'bus',
    title: 'Bus, propulsion & launch',
    fields: [
      num('busFixedKg', 'Avionics, ADCS, comms mass', 20, 2000, 10, 'kg', undefined, { log: true }),
      num('structurePct', 'Structure fraction', 5, 40, 1, '%'),
      num('propPct', 'Propellant fraction (wet)', 0.5, 40, 0.5, '%'),
      num('ispS', 'Thruster Isp', 200, 4000, 50, 's', 'Hall thrusters ~1,500 s; chemical ~300 s.'),
      num('launchPayloadT', 'Payload per launch', 0.5, 200, 0.5, 't'),
    ],
  },
]
