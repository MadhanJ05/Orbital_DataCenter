import { useMemo, useState } from 'react'
import type { Inputs, Results } from '../../core/types'
import { sensitivity } from '../../modules/economics/sensitivity'
import { CapacityChart, CashChart, HBar, SubsystemLifeChart, Tornado } from './Charts'
import { OrbitDiagram } from './OrbitDiagram'
import { fmt, usd, usdM, yrs } from '../../core/format'

type SensMetric = 'lcoc' | 'tokens' | 'npv'

/** Full engineering and business charts, shown when the user expands "Detailed analysis". */
export function Details({ inputs, r }: { inputs: Inputs; r: Results }) {
  const [sensMetric, setSensMetric] = useState<SensMetric>('lcoc')
  const sens = useMemo(() => {
    const m = sensMetric === 'lcoc' ? (x: Results) => x.econ.lcocPerChipHr : sensMetric === 'tokens' ? (x: Results) => x.econ.costPerMTokens : (x: Results) => x.econ.npvM
    return sensitivity(inputs, m)
  }, [inputs, sensMetric])
  const sensFmt = sensMetric === 'npv' ? (v: number) => usdM(v) : (v: number) => (v >= 0 ? '+' : '') + usd(v, 2)
  const ground = r.terrestrial

  const sv = r.compute.serving
  const ok = (b: boolean) => (b ? '✓ meets' : '✗ misses')
  return (
    <div className="details">
      {sv && (
        <section className="card wide">
          <div className="card-head">
            <h2>Workload & service targets</h2>
            <p>Memory-aware serving (same method as the Python fleet twin): writing speed is capped by memory bandwidth at the per-user target, sessions by KV-cache memory, plus prefill time. {sv.feasible ? '' : <b>Infeasible: {sv.issues.join(' ')}</b>}</p>
          </div>
          <div className="two">
            <table className="kv">
              <tbody>
                <Row k={`First token (target ${inputs.ttftSloS} s)`} v={sv.feasible ? `${sv.ttftS.toFixed(2)} s · ${ok(sv.sloTtftOk)}` : '—'} warn={sv.feasible && !sv.sloTtftOk} />
                <Row k={`Writing speed (target ${inputs.tokPerSecSlo} tok/s)`} v={sv.feasible ? `${sv.ratePerUser.toFixed(0)} tok/s · ${ok(sv.sloRateOk)}` : '—'} warn={sv.feasible && !sv.sloRateOk} />
                <Row k={`Whole task (${inputs.stepsPerTask} steps${inputs.taskDeadlineMin > 0 ? `, deadline ${inputs.taskDeadlineMin} min` : ''})`} v={sv.feasible ? `${sv.taskMin.toFixed(1)} min${inputs.taskDeadlineMin > 0 ? ` · ${ok(sv.sloTaskOk)}` : ''}` : '—'} warn={sv.feasible && !sv.sloTaskOk} />
                <Row k="Users served at peak" v={sv.feasible ? fmt(sv.usersAtPeak) : '0'} />
                <Row k="Tasks per hour (fleet)" v={fmt(sv.tasksPerHour)} />
                <Row k="Output tokens/s (fleet)" v={fmt(r.compute.tokensPerSec)} />
              </tbody>
            </table>
            <table className="kv">
              <tbody>
                <Row k="Users per chip" v={`${fmt(sv.sessionsPerChip)} (${sv.bound})`} warn={!sv.feasible} />
                <Row k={`Weights vs usable memory (${inputs.chipsPerReplica} chip${inputs.chipsPerReplica > 1 ? 's' : ''})`} v={`${fmt(sv.weightsGB)} / ${fmt(sv.replicaMemGB)} GB`} warn={sv.weightsGB > sv.replicaMemGB} />
                <Row k="KV cache per session" v={`${sv.kvPerSessionGB.toFixed(2)} GB`} />
                <Row k="Output tokens per chip-hour" v={fmt(sv.tokensPerChipHr)} />
                <Row k="Routed / sub-agent share" v={sv.altModel ? `${(sv.altShare * 100).toFixed(0)}% on ${sv.altModel}` : 'none'} />
                <Row k="Cost per M output tokens (orbit / ground)" v={`${usd(r.econ.costPerMTokens, 3)} / ${usd(r.terrestrial.costPerMTokens, 3)}`} />
              </tbody>
            </table>
          </div>
        </section>
      )}
      <section className="card wide">
        <div className="card-head">
          <h2>Lifetime: how the data center ages</h2>
          <p>No repairs in orbit. Delivered capacity is the lowest of working accelerators, solar power and radiator headroom, times eclipse availability. Avg over mission: <b>{r.life.avgCapacityPct.toFixed(0)}%</b>, at mission end: <b>{r.life.capacityAtMissionEndPct.toFixed(0)}%</b>.</p>
        </div>
        <div className="two">
          <CapacityChart r={r} threshold={inputs.usefulThresholdPct} missionLife={inputs.missionLifeYr} />
          <div>
            <h3>Subsystem life (to {inputs.usefulThresholdPct}% capacity)</h3>
            <SubsystemLifeChart r={r} missionLife={inputs.missionLifeYr} />
            <p className="note">Red bars end before the planned mission life.</p>
          </div>
        </div>
      </section>

      <div className="grid2">
        <section className="card">
          <div className="card-head"><h2>Orbit & infrastructure</h2></div>
          <div className="orbit-row">
            <OrbitDiagram inputs={inputs} r={r} />
            <table className="kv">
              <tbody>
                <Row k="Orbital period" v={`${r.orbit.periodMin.toFixed(1)} min`} />
                <Row k="Time in shadow (avg)" v={`${(r.orbit.eclipseFracAvg * 100).toFixed(1)}%`} />
                <Row k="Longest eclipse" v={`${r.orbit.worstEclipseMin.toFixed(0)} min`} />
                <Row k="Round-trip latency (min)" v={`${r.orbit.rttMs.toFixed(0)} ms`} />
                <Row k="Drag Δv" v={`${r.propulsion.dragDvMsYr.toFixed(1)} m/s/yr`} />
                <Row k="Station-keeping life" v={yrs(r.propulsion.stationLifeYr)} />
                <Row k="Passive decay if dead" v={isFinite(r.propulsion.passiveDecayYr) ? yrs(r.propulsion.passiveDecayYr) : 'Never (graveyard)'} warn={r.propulsion.passiveDecayYr > 5 && inputs.orbitType !== 'geo'} />
              </tbody>
            </table>
          </div>
          <table className="kv cols">
            <thead><tr><th>Per satellite</th><th /></tr></thead>
            <tbody>
              <Row k="Electrical load" v={`${fmt(r.power.loadKwPerSat)} kW`} />
              <Row k="Solar array (start of life)" v={`${fmt(r.power.arrayKwPerSat)} kW · ${fmt(r.power.arrayM2PerSat)} m²`} />
              <Row k="Battery" v={`${fmt(r.power.batteryKwhPerSat)} kWh`} />
              <Row k="Radiator" v={`${fmt(r.thermal.radiatorM2PerSat)} m² @ ${fmt(r.thermal.radiatorFluxWm2)} W/m²`} />
              <Row k="Wet mass" v={`${fmt(r.mass.wetKgPerSat)} kg`} />
              <Row k="Ground link load" v={`${r.comms.utilizationPct < 0.1 ? '<0.1' : r.comms.utilizationPct.toFixed(1)}% of ${fmt(r.comms.availableGbps)} Gbps`} warn={r.comms.utilizationPct > 100} />
            </tbody>
          </table>
        </section>

        <section className="card">
          <div className="card-head"><h2>Mass per satellite</h2><p>{fmt(r.mass.wetKgPerSat)} kg wet. Solar and radiators usually outweigh the compute.</p></div>
          <HBar data={r.mass.breakdownKgPerSat.map((m) => ({ name: m.name, value: m.kg }))} unit=" kg" />
        </section>
      </div>

      <div className="grid2">
        <section className="card">
          <div className="card-head"><h2>Capex breakdown</h2><p>Total {usdM(r.econ.capexM)} for {inputs.satellites} satellite{inputs.satellites === 1 ? '' : 's'}.</p></div>
          <HBar data={r.econ.capexBreakdownM.map((c) => ({ name: c.name, value: c.usd }))} money />
        </section>
        <section className="card">
          <div className="card-head"><h2>Cumulative cash flow</h2><p>Revenue at {usd(inputs.pricePerChipHr, 3)}/accelerator-hour, {inputs.soldPct}% sold. Lifetime revenue {usdM(r.econ.revenueM)}.</p></div>
          <CashChart r={r} />
        </section>
      </div>

      <div className="grid2">
        <section className="card">
          <div className="card-head"><h2>Orbit vs. ground</h2><p>Same accelerators in a terrestrial data center.</p></div>
          <table className="cmp">
            <thead><tr><th /><th>Orbital</th><th>Ground</th></tr></thead>
            <tbody>
              <tr><td>Cost per accelerator-hour</td><td>{usd(r.econ.lcocPerChipHr, 3)}</td><td>{usd(ground.lcocPerChipHr, 3)}</td></tr>
              <tr><td>Cost per M tokens</td><td>{usd(r.econ.costPerMTokens, 3)}</td><td>{usd(ground.costPerMTokens, 3)}</td></tr>
              <tr><td>Energy cost ($/kWh)</td><td>{usd(r.econ.orbitalLcoePerKWh, 2)}</td><td>{usd(ground.lcoePerKWh, 2)}</td></tr>
              <tr><td>Capex</td><td>{usdM(r.econ.capexM)}</td><td>{usdM(ground.capexM)}</td></tr>
              <tr><td>Opex per year</td><td>{usdM(r.econ.opexMYr)}</td><td>{usdM(ground.opexMYr)}</td></tr>
            </tbody>
          </table>
          <p className="note">Orbital energy cost = solar, battery and radiator hardware plus their launch, spread over energy delivered. Ground = grid price × PUE.</p>
        </section>
        <section className="card">
          <div className="card-head row">
            <h2>What moves the number</h2>
            <select value={sensMetric} onChange={(e) => setSensMetric(e.target.value as SensMetric)} aria-label="Sensitivity metric">
              <option value="lcoc">Cost per accelerator-hour</option>
              <option value="tokens">Cost per M tokens</option>
              <option value="npv">NPV</option>
            </select>
          </div>
          <Tornado rows={sens} unitFmt={sensFmt} />
        </section>
      </div>
    </div>
  )
}

function Row({ k, v, warn }: { k: string; v: string; warn?: boolean }) {
  return (
    <tr className={warn ? 'warn-row' : ''}>
      <td>{k}</td>
      <td>{warn && <span className="warn-icon" aria-hidden>▲ </span>}{v}</td>
    </tr>
  )
}
