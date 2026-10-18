import type { ModuleDef } from '../../core/module'
import { lifetimeSections } from './fields'
import { lifetimeStage } from './stage'
import { LifetimeOverlay } from './Overlay'
import { lifeClock } from './clock'

export const lifetimeModule: ModuleDef = {
  id: 'life',
  title: 'Lifetime',
  sections: lifetimeSections,
  stage: lifetimeStage,
  focus: 'all',
  Overlay: LifetimeOverlay,
  sceneState: (p, i, r) => {
    const { lifeT, point } = lifeClock(p, i, r)
    return { chipFrac: Math.min(1, point.chipsPct / 100), arrayFade: Math.pow(1 - i.solarDegPctYr / 100, lifeT) }
  },
}
