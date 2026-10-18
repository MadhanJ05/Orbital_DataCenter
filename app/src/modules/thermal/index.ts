import type { ModuleDef } from '../../core/module'
import { thermalSections } from './fields'
import { thermalStage } from './stage'
import { ThermalOverlay } from './Overlay'

export const thermalModule: ModuleDef = {
  id: 'thermal',
  title: 'Thermal',
  sections: thermalSections,
  stage: thermalStage,
  focus: ['bus', 'radiator'],
  Overlay: ThermalOverlay,
  sceneState: (p) => ({ radiatorHeat: p }),
}
