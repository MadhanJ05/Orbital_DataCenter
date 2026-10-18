import { num, type Section } from '../../core/fields'
import type { OrbitType } from './model'

// Typical dose behind ~10 mm Al shielding for each orbit, applied when the orbit changes
const DOSE: Record<OrbitType, number> = { sso: 150, leo: 60, geo: 1500 }

export const orbitSections: Section[] = [
  {
    id: 'orbit',
    title: 'Orbit',
    fields: [
      {
        kind: 'select', key: 'orbitType', label: 'Orbit',
        options: [{ value: 'sso', label: 'Dawn-dusk sun-synchronous' }, { value: 'leo', label: 'LEO mid-inclination' }, { value: 'geo', label: 'Geostationary' }],
        patch: (v) => ({ orbitType: v as OrbitType, doseRateRadYr: DOSE[v as OrbitType], ...(v === 'geo' ? {} : { altitudeKm: v === 'leo' ? 550 : 650 }) }),
      },
      num('altitudeKm', 'Altitude', 350, 2000, 10, 'km', undefined, { hideFor: (i) => i.orbitType === 'geo' }),
      num('solarActivity', 'Solar activity (drag)', 0.3, 4, 0.1, 'x', '1 = moderate; 2-3 = solar maximum. Scales atmospheric density.'),
    ],
  },
]
