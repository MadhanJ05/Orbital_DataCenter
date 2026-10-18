import { SOLAR } from '../../core/constants'
import type { OrbitModel } from '../orbit/model'

export interface PowerInputs {
  solarEffPct: number
  solarDegPctYr: number
  solarWPerKg: number
  solarCostPerW: number
  arrayMarginPct: number
  computeInEclipse: boolean
  batteryWhPerKg: number
  batteryDoDPct: number
  batteryCycleLife: number
  batteryCalendarLifeYr: number
  batteryCostPerKWh: number
  busPowerPct: number // avionics, ADCS, comms as % of IT power
}

export const powerDefaults: PowerInputs = {
  solarEffPct: 30,
  solarDegPctYr: 1.5,
  solarWPerKg: 200,
  solarCostPerW: 10,
  arrayMarginPct: 20,
  computeInEclipse: true,
  batteryWhPerKg: 300,
  batteryDoDPct: 40,
  batteryCycleLife: 30000,
  batteryCalendarLifeYr: 12,
  batteryCostPerKWh: 500,
  busPowerPct: 5,
}

const BATTERY_EFF = 0.92
const ARRAY_PACKING = 0.9 * 0.97 // cell packing x pointing loss
const SAFE_MODE_HRS = 1 // minimum battery: 1 h of bus power in safe mode

export interface PowerModel {
  itW: number
  busW: number
  loadW: number // per satellite
  batteryWh: number
  arrayW: number
  arrayM2: number
  arrayKg: number
  batteryKg: number
  availability: number // share of time compute runs at start of life
  batteryLifeYr: number
}

export function runPower(i: PowerInputs, orbit: OrbitModel, itWPerSat: number): PowerModel {
  const itW = itWPerSat
  const busW = itW * i.busPowerPct / 100
  const loadW = itW + busW
  const eclipseLoadW = i.computeInEclipse ? loadW : busW
  const worstEclipseH = orbit.worstEclipseMin / 60
  const sunlitH = orbit.periodS / 3600 - worstEclipseH
  const batteryWh = Math.max(eclipseLoadW * worstEclipseH, busW * SAFE_MODE_HRS) / (i.batteryDoDPct / 100)
  const rechargeW = (eclipseLoadW * worstEclipseH) / (Math.max(sunlitH, 0.1) * BATTERY_EFF)
  const arrayW = (loadW + rechargeW) * (1 + i.arrayMarginPct / 100)
  const arrayM2 = arrayW / (SOLAR * (i.solarEffPct / 100) * ARRAY_PACKING)
  const arrayKg = arrayW / i.solarWPerKg
  const batteryKg = batteryWh / i.batteryWhPerKg
  const availability = i.computeInEclipse ? 1 : 1 - orbit.eclipseFracAvg
  const batteryLifeYr = Math.min(
    i.batteryCalendarLifeYr,
    orbit.eclipseCyclesYr > 0 ? i.batteryCycleLife / orbit.eclipseCyclesYr : Infinity,
  )
  return { itW, busW, loadW, batteryWh, arrayW, arrayM2, arrayKg, batteryKg, availability, batteryLifeYr }
}

/** Array specific power that makes arrays + batteries weigh `kg` (used to reproduce a published mass split). */
export function solarWPerKgFor(kg: number, p: PowerModel) {
  return p.arrayW / (kg - p.batteryKg)
}
