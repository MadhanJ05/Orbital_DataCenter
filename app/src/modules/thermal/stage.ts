import type { Stage } from '../../core/module'
import type { Inputs, Results } from '../../core/types'
import { fmt } from '../../core/format'

export function thermalStage(i: Inputs, r: Results): Stage {
  return {
    id: 'thermal',
    title: 'Thermal',
    what: `Every watt becomes heat. With no air to cool it, radiators at ${i.radiatorTempK} K glow it away as infrared at ${fmt(r.thermal.radiatorFluxWm2)} W/m².`,
    metrics: [
      { label: 'Heat per satellite', value: `${fmt(r.power.loadKwPerSat)} kW` },
      { label: 'Radiator area', value: `${fmt(r.thermal.radiatorM2PerSat)} m²` },
      { label: 'Radiator temperature', value: `${i.radiatorTempK} K (${(i.radiatorTempK - 273).toFixed(0)} °C)` },
      { label: 'Fleet radiator area', value: `${fmt(r.thermal.totalRadiatorM2)} m²` },
    ],
    status: r.thermal.radiatorFluxWm2 <= 0 ? { tone: 'bad', text: 'Radiator colder than sink' } : { tone: 'good', text: 'Heat rejected' },
  }
}
