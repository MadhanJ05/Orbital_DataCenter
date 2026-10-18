import type { ModuleDef } from '../../core/module'
import { massSections } from './fields'
import { massStage } from './stage'
import { MassOverlay } from './Overlay'

export const massModule: ModuleDef = {
  id: 'mass',
  title: 'Mass & launch',
  sections: massSections,
  stage: massStage,
  focus: 'all',
  Overlay: MassOverlay,
}
