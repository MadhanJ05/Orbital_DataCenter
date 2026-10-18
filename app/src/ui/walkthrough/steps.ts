import type { ModuleDef, Stage } from '../../core/module'
import type { Inputs, Results } from '../../core/types'
import { MODULES } from '../../modules'
import { inputsStep } from './inputsStep'

export interface Step {
  def: ModuleDef
  stage: Stage
}

/** Walkthrough steps: the inputs card, then every module that defines a stage, in registry order. */
export function buildSteps(i: Inputs, r: Results): Step[] {
  return [inputsStep, ...MODULES].filter((m) => m.stage).map((def) => ({ def, stage: def.stage!(i, r) }))
}
