import type { ModuleDef } from '../../core/module'
import { orbitSections } from './fields'
import { orbitStage } from './stage'
import { OrbitOverlay } from './Overlay'

export const orbitModule: ModuleDef = {
  id: 'orbit',
  title: 'Orbit',
  sections: orbitSections,
  stage: orbitStage,
  focus: ['bus', 'link', 'ground'],
  Overlay: OrbitOverlay,
}
