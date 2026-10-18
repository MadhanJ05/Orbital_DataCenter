import { SIGMA } from '../../core/constants'
import assumptions from '../../../../shared/assumptions.json'

export interface ThermalInputs {
  radiatorTempK: number
  sinkTempK: number
  emissivity: number
  radiatorKgPerM2: number
  radiatorDegPctYr: number
  twoSidedRadiator: boolean
}

const deck = assumptions.radiator
export const thermalDefaults: ThermalInputs = {
  radiatorTempK: deck.temp_k,
  sinkTempK: deck.sink_k,
  emissivity: deck.emissivity,
  radiatorKgPerM2: 4,
  radiatorDegPctYr: 0.7,
  twoSidedRadiator: deck.sides === 2,
}

export const RADIATOR_MARGIN = 1.1

export interface ThermalModel {
  fluxWm2: number
  radiatorM2: number // per satellite
  radiatorKg: number
  warnings: string[]
}

/** Radiator sized by Stefan-Boltzmann to reject the satellite's whole electrical load. */
export function runThermal(i: ThermalInputs, loadW: number): ThermalModel {
  const warnings: string[] = []
  const sides = i.twoSidedRadiator ? 2 : 1
  const fluxWm2 = i.emissivity * SIGMA * (i.radiatorTempK ** 4 - i.sinkTempK ** 4) * sides
  if (fluxWm2 <= 0) warnings.push('Radiator temperature must exceed sink temperature.')
  const radiatorM2 = (loadW / Math.max(fluxWm2, 1)) * RADIATOR_MARGIN
  const radiatorKg = radiatorM2 * i.radiatorKgPerM2
  return { fluxWm2, radiatorM2, radiatorKg, warnings }
}
