import type { ModuleDef } from '../../core/module'
import { powerSections } from './fields'
import { powerStage } from './stage'
import { PowerOverlay } from './Overlay'

export const powerModule: ModuleDef = {
  id: 'power',
  title: 'Power',
  sections: powerSections,
  stage: powerStage,
  focus: ['sun', 'arrays', 'bus'],
  Overlay: PowerOverlay,
}
