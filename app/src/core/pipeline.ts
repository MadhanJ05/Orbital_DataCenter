import type { Inputs, Results } from './types'
import { runOrbit } from '../modules/orbit/model'
import { runCompute, throughput } from '../modules/compute/model'
import { runPower } from '../modules/power/model'
import { runThermal } from '../modules/thermal/model'
import { runMass } from '../modules/mass/model'
import { runComms } from '../modules/comms/model'
import { runLifetime } from '../modules/lifetime/model'
import { runEconomics } from '../modules/economics/model'

/**
 * Runs the twin: each module's physics in dependency order, then assembles the results.
 *
 *   orbit ─┬─> power ──> thermal ──> mass/propulsion ─┐
 *   compute┘        └──> comms ──────────────────────>├─> lifetime ──> economics
 */
export function simulate(i: Inputs): Results {
  const orbit = runOrbit(i)
  const compute = runCompute(i)
  const power = runPower(i, orbit, compute.itWPerSat)
  const thermal = runThermal(i, power.loadW)
  const mass = runMass(i, orbit, {
    chipsPerSatProv: compute.chipsPerSatProv, serverKgPerChip: i.serverKgPerChip,
    arrayKg: power.arrayKg, batteryKg: power.batteryKg, radiatorKg: thermal.radiatorKg,
    arrayM2: power.arrayM2, radiatorM2: thermal.radiatorM2, satellites: i.satellites,
  })
  const tp = throughput(i, compute, power.availability)
  const comms = runComms(i, tp.tokensPerSec, i.satellites)
  const life = runLifetime(i, {
    N: compute.N, provisioned: compute.provisioned, sparesPct: i.sparesPct,
    eclipseFracAvg: orbit.eclipseFracAvg, eclipseCyclesYr: orbit.eclipseCyclesYr,
    baseAvail: power.availability, batteryLifeYr: power.batteryLifeYr, computeInEclipse: i.computeInEclipse,
    solarDegPctYr: i.solarDegPctYr, arrayMarginPct: i.arrayMarginPct, radiatorDegPctYr: i.radiatorDegPctYr,
    stationLifeYr: mass.stationLifeYr, annualDv: mass.annualDv, deorbitDv: mass.deorbitDv,
    commsCap: comms.cap, altitudeKm: orbit.h, isGeo: i.orbitType === 'geo',
  })
  const ec = runEconomics(i, {
    satellites: i.satellites, N: compute.N, chipsPerSatProv: compute.chipsPerSatProv,
    chipPriceUsd: i.chipPriceUsd, chipPflops: i.chipPflops, perChipW: compute.perChipW,
    itW: power.itW, loadW: power.loadW, arrayW: power.arrayW, arrayKg: power.arrayKg,
    solarCostPerW: i.solarCostPerW, batteryCostPerKWh: i.batteryCostPerKWh,
    batteryWh: power.batteryWh, batteryKg: power.batteryKg, radiatorKg: thermal.radiatorKg,
    structureKg: mass.structureKg, busFixedKg: i.busFixedKg, totalKg: mass.totalKg,
    seu: compute.seu, mfu: compute.mfu, P: compute.P, training: i.workload === 'training',
    tokensPerChipHr: compute.tokensPerChipHr, flopsPerChipEff: compute.flopsPerChipEff, trainFlops: compute.trainFlops,
    commsCap: comms.cap, afrPct: i.afrPct, missionLifeYr: i.missionLifeYr, months: life.months,
  })

  // Economics fills the cash curve into the lifetime chart series
  const econMonths = ec.cumCashByMonth.length
  const series = life.series.map((pt, k) => {
    const m = k * 3
    return { ...pt, cumCashM: m <= econMonths && econMonths > 0 ? ec.cumCashByMonth[Math.min(m, econMonths - 1)] / 1e6 : NaN }
  })

  return {
    orbit: {
      periodMin: orbit.periodMin,
      eclipseFracAvg: orbit.eclipseFracAvg,
      worstEclipseMin: orbit.worstEclipseMin,
      eclipseCyclesYr: orbit.eclipseCyclesYr,
      rttMs: orbit.rttMs,
      velocityKms: orbit.velocityKms,
    },
    compute: {
      activeChips: compute.N,
      provisionedChips: compute.provisioned,
      peakEflops: (compute.N * i.chipPflops) / 1000,
      effectiveEflopsBol: tp.effFlopsBol / 1e18,
      tokensPerSec: tp.tokensPerSec * comms.cap,
      trainDays: tp.trainDays / comms.cap,
      trainFlops: compute.trainFlops,
    },
    power: {
      itMw: (power.itW * i.satellites) / 1e6,
      loadKwPerSat: power.loadW / 1000,
      arrayKwPerSat: power.arrayW / 1000,
      arrayM2PerSat: power.arrayM2,
      batteryKwhPerSat: power.batteryWh / 1000,
      totalArrayM2: power.arrayM2 * i.satellites,
    },
    thermal: {
      radiatorFluxWm2: thermal.fluxWm2,
      radiatorM2PerSat: thermal.radiatorM2,
      totalRadiatorM2: thermal.radiatorM2 * i.satellites,
    },
    mass: {
      breakdownKgPerSat: [
        { name: 'Compute nodes', kg: mass.computeKg },
        { name: 'Solar arrays', kg: power.arrayKg },
        { name: 'Radiators', kg: thermal.radiatorKg },
        { name: 'Batteries', kg: power.batteryKg },
        { name: 'Bus avionics/comms', kg: i.busFixedKg },
        { name: 'Structure', kg: mass.structureKg },
        { name: 'Propellant', kg: mass.propKg },
      ],
      dryKgPerSat: mass.dryKg,
      wetKgPerSat: mass.wetKg,
      totalT: mass.totalKg / 1000,
      kgPerKw: mass.wetKg / (power.itW / 1000),
      dryKgPerKw: mass.dryKg / (power.itW / 1000),
      launches: mass.launches,
    },
    propulsion: {
      dragDvMsYr: mass.dragDv,
      stationKeepingDvMsYr: mass.annualDv,
      deorbitDvMs: mass.deorbitDv,
      stationLifeYr: mass.stationLifeYr,
      passiveDecayYr: mass.passiveDecayYr,
    },
    comms: { requiredGbps: comms.requiredGbps, availableGbps: comms.availableGbps, utilizationPct: comms.utilizationPct },
    life: {
      usefulLifeYr: life.usefulLifeYr,
      limiter: life.limiter,
      subsystems: life.subsystems,
      capacityAtMissionEndPct: life.capacityAtMissionEndPct,
      avgCapacityPct: life.avgCapacityPct,
    },
    econ: ec.econ,
    terrestrial: ec.terrestrial,
    series,
    warnings: [...thermal.warnings, ...mass.warnings, ...comms.warnings, ...life.warnings],
  }
}
