import type { ModuleDef } from '../core/module'
import { computeModule } from './compute'
import { powerModule } from './power'
import { thermalModule } from './thermal'
import { orbitModule } from './orbit'
import { commsModule } from './comms'
import { massModule } from './mass'
import { lifetimeModule } from './lifetime'
import { economicsModule } from './economics'

/**
 * Every module, in walkthrough order. The input drawer, walkthrough steps, scene overlays and
 * scorecards are all generated from this list. To add a module: create modules/<name>/ with
 * model.ts + index.ts, wire its physics into core/pipeline.ts, and add it here.
 */
export const MODULES: ModuleDef[] = [
  computeModule,
  powerModule,
  thermalModule,
  orbitModule,
  commsModule,
  massModule,
  lifetimeModule,
  economicsModule,
]
