import type { ComponentType } from 'react'
import type { Inputs, Results } from './types'
import type { Section } from './fields'

export type Tone = 'good' | 'warn' | 'bad' | 'neutral'

/** One step of the walkthrough: caption, four live metrics and a status. */
export interface Stage {
  id: string
  title: string
  what: string
  metrics: { label: string; value: string }[]
  status: { tone: Tone; text: string }
}

/** Satellite parts the walkthrough can highlight. */
export type ScenePart = 'sun' | 'arrays' | 'bus' | 'radiator' | 'link' | 'ground'

export interface OverlayProps {
  p: number // progress through this step, 0..1
  t: number // seconds since the walkthrough started (drives looping particles)
  inputs: Inputs
  r: Results
  animate: boolean // false when the viewer prefers reduced motion
}

/** Per-step overrides of the shared satellite drawing. */
export interface SceneState {
  chipFrac?: number // share of compute chips lit
  arrayFade?: number // solar array opacity (ageing)
  radiatorHeat?: number // 0..1 radiator glow
}

/**
 * A simulation module as the UI sees it. Physics lives in modules/<name>/model.ts and is
 * chained in core/pipeline.ts; this definition plugs the module into the drawer, the
 * walkthrough and the scorecards.
 */
export interface ModuleDef {
  id: string
  title: string
  sections: Section[]
  stage?: (i: Inputs, r: Results) => Stage
  focus?: ScenePart[] | 'all'
  Overlay?: ComponentType<OverlayProps>
  sceneState?: (p: number, i: Inputs, r: Results) => SceneState
}
