import type { ModuleDef } from '../../core/module'
import { economicsSections } from './fields'
import { economicsStage } from './stage'
import { EconomicsOverlay } from './Overlay'

export const economicsModule: ModuleDef = {
  id: 'econ',
  title: 'Economics',
  sections: economicsSections,
  stage: economicsStage,
  focus: 'all',
  Overlay: EconomicsOverlay,
}
