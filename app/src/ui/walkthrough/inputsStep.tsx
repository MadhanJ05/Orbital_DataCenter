import type { ModuleDef, OverlayProps, Stage } from '../../core/module'
import type { Inputs, Results } from '../../core/types'
import { fmt } from '../../core/format'
import { CHIPS, MODELS } from '../../modules/compute/presets'
import { BUS, C } from './kit'

function inputsStage(i: Inputs, r: Results): Stage {
  const model = MODELS.find((m) => m.id === i.modelId)
  const chip = CHIPS.find((c) => c.id === i.chipId)
  const training = i.workload === 'training'
  return {
    id: 'inputs',
    title: 'Your inputs',
    what: `${training ? 'Training' : 'Serving'} ${model && model.id !== 'custom' ? model.label : `a ${fmt(i.activeParamsB)}B-parameter model`} on ${fmt(r.compute.activeChips)} ${chip && chip.id !== 'custom' ? chip.label : 'custom accelerators'} across ${i.satellites} satellite${i.satellites === 1 ? '' : 's'}.`,
    metrics: [
      { label: 'Active parameters', value: `${fmt(i.activeParamsB)}B` },
      { label: training ? 'Training tokens' : 'Ground-link bytes/token', value: training ? `${fmt(i.trainTokensT)}T` : `${i.ioBytesPerToken} B` },
      { label: 'Accelerators', value: `${fmt(r.compute.activeChips)} + ${fmt(r.compute.provisionedChips - r.compute.activeChips)} spares` },
      { label: 'Orbit', value: i.orbitType === 'geo' ? 'GEO 35,786 km' : `${i.orbitType === 'sso' ? 'Dawn-dusk SSO' : 'LEO'} ${i.altitudeKm} km` },
    ],
    status: { tone: 'neutral', text: 'Design loaded' },
  }
}

/** A card with the user's model and workload flies into the compute bus. */
function InputCard({ p, inputs }: OverlayProps) {
  const u = Math.min(1, p / 0.55)
  const ease = 1 - Math.pow(1 - u, 3)
  const x = 20 + ease * (BUS.x - 20 - 10)
  const y = 250 - ease * 95
  const s = 1 - ease * 0.75
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`} opacity={u < 1 ? 1 : Math.max(0, 1 - (p - 0.55) * 4)}>
      <rect width="170" height="64" rx="8" fill="#1a1a19" stroke={C.data} />
      <text x="12" y="22" className="sc-label strong">{fmt(inputs.activeParamsB)}B-param model</text>
      <text x="12" y="40" className="sc-label">{inputs.workload === 'training' ? `Training · ${fmt(inputs.trainTokensT)}T tokens` : 'Inference · live requests'}</text>
      <text x="12" y="56" className="sc-label">{inputs.satellites} sats × {inputs.chipsPerSat} chips</text>
    </g>
  )
}

/** The walkthrough's opening step. Not a simulation module, so it has no inputs of its own. */
export const inputsStep: ModuleDef = {
  id: 'inputs',
  title: 'Your inputs',
  sections: [],
  stage: inputsStage,
  focus: ['bus'],
  Overlay: InputCard,
  sceneState: (p) => ({ chipFrac: Math.max(0, (p - 0.55) / 0.45) }),
}
