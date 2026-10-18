import type { Inputs, Results } from './sim/types'
import { CHIPS, MODELS } from './sim/presets'
import { fmt, usd, usdM, yrs } from './format'

export type Tone = 'good' | 'warn' | 'bad' | 'neutral'

export interface Stage {
  id: 'inputs' | 'compute' | 'power' | 'thermal' | 'orbit' | 'mass' | 'life' | 'econ'
  title: string
  what: string
  metrics: { label: string; value: string }[]
  status: { tone: Tone; text: string }
}

/** The eight steps the walkthrough plays, with live numbers for the current design. */
export function buildStages(i: Inputs, r: Results): Stage[] {
  const model = MODELS.find((m) => m.id === i.modelId)
  const chip = CHIPS.find((c) => c.id === i.chipId)
  const training = i.workload === 'training'
  const ratio = r.econ.lcocPerChipHr / r.terrestrial.lcocPerChipHr
  const commsOver = r.comms.utilizationPct > 100
  const lifeOk = r.life.usefulLifeYr >= i.missionLifeYr

  return [
    {
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
    },
    {
      id: 'compute',
      title: 'Compute',
      what: `Each accelerator delivers ${i.chipPflops} PFLOPS peak; at ${i.mfuPct}% utilization and ${i.seuOverheadPct}% lost to radiation soft errors, the cluster delivers real work.`,
      metrics: [
        { label: 'Effective compute', value: `${fmt(r.compute.effectiveEflopsBol)} EFLOPS` },
        training
          ? { label: 'Time to train', value: `${fmt(r.compute.trainDays)} days` }
          : { label: 'Throughput', value: `${fmt(r.compute.tokensPerSec)} tokens/s` },
        { label: 'Peak (FP8)', value: `${fmt(r.compute.peakEflops)} EFLOPS` },
        { label: 'Per satellite', value: `${i.chipsPerSat} accelerators` },
      ],
      status: training && r.compute.trainDays > 365
        ? { tone: 'warn', text: 'Training takes over a year' }
        : { tone: 'good', text: 'Compute sized' },
    },
    {
      id: 'power',
      title: 'Power',
      what: `Sunlight hits ${fmt(r.power.arrayM2PerSat)} m² of ${i.solarEffPct}%-efficient cells per satellite. Batteries carry the load through ${r.orbit.worstEclipseMin.toFixed(0)}-minute eclipses.`,
      metrics: [
        { label: 'Load per satellite', value: `${fmt(r.power.loadKwPerSat)} kW` },
        { label: 'Solar array', value: `${fmt(r.power.arrayKwPerSat)} kW` },
        { label: 'Battery', value: `${fmt(r.power.batteryKwhPerSat)} kWh` },
        { label: 'Time in shadow', value: `${(r.orbit.eclipseFracAvg * 100).toFixed(1)}%` },
      ],
      status: !i.computeInEclipse && r.orbit.eclipseFracAvg > 0.05
        ? { tone: 'warn', text: `Compute pauses ${(r.orbit.eclipseFracAvg * 100).toFixed(0)}% of the time` }
        : { tone: 'good', text: 'Power balanced' },
    },
    {
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
    },
    {
      id: 'orbit',
      title: 'Orbit & comms',
      what: `Circling Earth every ${r.orbit.periodMin.toFixed(0)} minutes. Laser links carry data to the ground with a ${r.orbit.rttMs.toFixed(0)} ms round trip.`,
      metrics: [
        { label: 'Round-trip latency', value: `${r.orbit.rttMs.toFixed(0)} ms` },
        { label: 'Ground link load', value: `${r.comms.utilizationPct < 0.1 ? '<0.1' : r.comms.utilizationPct.toFixed(1)}%` },
        { label: 'Drag to make up', value: `${r.propulsion.dragDvMsYr.toFixed(1)} m/s/yr` },
        { label: 'Reentry if it dies', value: isFinite(r.propulsion.passiveDecayYr) ? yrs(r.propulsion.passiveDecayYr) : 'Never' },
      ],
      status: commsOver ? { tone: 'bad', text: 'Ground link oversubscribed' } : r.orbit.rttMs > 150 ? { tone: 'warn', text: 'Too slow for live chat' } : { tone: 'good', text: 'Link has headroom' },
    },
    {
      id: 'mass',
      title: 'Mass & launch',
      what: `Each satellite weighs ${fmt(r.mass.wetKgPerSat)} kg. Solar arrays and radiators, not chips, dominate the mass that has to be launched.`,
      metrics: [
        { label: 'Mass to orbit', value: `${fmt(r.mass.totalT)} t` },
        { label: 'Launches', value: `${r.mass.launches}` },
        { label: 'Mass per kW of IT', value: `${fmt(r.mass.kgPerKw)} kg` },
        { label: 'Launch bill', value: usdM(r.econ.capexBreakdownM.find((c) => c.name === 'Launch')?.usd ?? 0) },
      ],
      status: { tone: 'neutral', text: `${r.mass.launches} launch${r.mass.launches === 1 ? '' : 'es'}` },
    },
    {
      id: 'life',
      title: 'Lifetime',
      what: `No repair crews in orbit. Chips fail, arrays fade and radiation adds up; spares cover losses until capacity drops below ${i.usefulThresholdPct}%.`,
      metrics: [
        { label: 'Useful life', value: yrs(r.life.usefulLifeYr) },
        { label: 'First to wear out', value: r.life.limiter },
        { label: `Capacity at year ${i.missionLifeYr}`, value: `${r.life.capacityAtMissionEndPct.toFixed(0)}%` },
        { label: 'Average over mission', value: `${r.life.avgCapacityPct.toFixed(0)}%` },
      ],
      status: lifeOk ? { tone: 'good', text: 'Outlives the mission' } : { tone: 'bad', text: `Wears out before year ${i.missionLifeYr}` },
    },
    {
      id: 'econ',
      title: 'Economics',
      what: `All costs spread over every accelerator-hour delivered, compared with the same chips in a data center on the ground.`,
      metrics: [
        { label: 'Cost per accelerator-hour', value: usd(r.econ.lcocPerChipHr, 3) },
        { label: 'Same on the ground', value: usd(r.terrestrial.lcocPerChipHr, 3) },
        { label: 'Capex', value: usdM(r.econ.capexM) },
        { label: `NPV (${i.missionLifeYr} yr)`, value: usdM(r.econ.npvM) },
      ],
      status: ratio <= 1 ? { tone: 'good', text: 'Cheaper than ground' } : ratio <= 1.5 ? { tone: 'warn', text: `${ratio.toFixed(2)}x ground cost` } : { tone: 'bad', text: `${ratio.toFixed(1)}x ground cost` },
    },
  ]
}
