import { simulate, sensitivity } from '../src/sim/engine'
import { SCENARIOS } from '../src/sim/presets'

for (const s of SCENARIOS) {
  const r = simulate(s.inputs)
  const { series, ...rest } = r
  console.log('\n=====', s.label)
  console.log(JSON.stringify(rest, (_k, v) => (typeof v === 'number' ? +v.toPrecision(4) : v), 1))
}
const sens = sensitivity(SCENARIOS[0].inputs, (r) => r.econ.lcocPerChipHr)
console.log(sens.map((x) => `${x.label}: ${x.low.toFixed(2)} / ${x.high.toFixed(2)}`).join('\n'))
