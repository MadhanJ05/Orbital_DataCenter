import type { ModuleDef } from '../../core/module'
import { computeSections } from './fields'
import { computeStage } from './stage'
import { ComputeOverlay } from './Overlay'

export const computeModule: ModuleDef = {
  id: 'compute',
  title: 'Compute',
  sections: computeSections,
  stage: computeStage,
  focus: ['bus'],
  Overlay: ComputeOverlay,
  sceneState: (p) => ({ chipFrac: Math.min(1, p * 1.6) }),
}
