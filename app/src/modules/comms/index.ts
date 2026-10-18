import type { ModuleDef } from '../../core/module'
import { commsSections } from './fields'

// Comms results appear in the orbit module's "Orbit & comms" walkthrough step.
export const commsModule: ModuleDef = {
  id: 'comms',
  title: 'Comms',
  sections: commsSections,
}
