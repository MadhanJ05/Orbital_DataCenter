import { num, type Section } from '../../core/fields'

export const thermalSections: Section[] = [
  {
    id: 'thermal',
    title: 'Thermal',
    fields: [
      num('radiatorTempK', 'Radiator temperature', 250, 450, 1, 'K', 'Hotter radiators shrink fast (T^4) but chips run hotter.'),
      num('sinkTempK', 'Effective sink temperature', 3, 280, 1, 'K', 'Deep space ~3 K; Earth IR and albedo raise it in LEO.'),
      num('emissivity', 'Coating emissivity', 0.5, 0.98, 0.01, ''),
      { kind: 'bool', key: 'twoSidedRadiator', label: 'Two-sided radiator (edge-on to Sun)' },
      num('radiatorKgPerM2', 'Radiator areal mass', 1, 15, 0.5, 'kg/m²'),
      num('radiatorDegPctYr', 'Radiator performance loss', 0, 5, 0.1, '%/yr', 'Coating darkening and micrometeoroid damage.'),
    ],
  },
]
