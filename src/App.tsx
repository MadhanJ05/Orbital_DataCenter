import { useEffect, useMemo, useState } from 'react'
import type { Inputs, Results } from './sim/types'
import { simulate, sensitivity } from './sim/engine'
import { BASELINE, SCENARIOS } from './sim/presets'
import { InputPanel } from './components/InputPanel'
import { CapacityChart, CashChart, HBar, SubsystemLifeChart, Tornado } from './components/Charts'
import { OrbitDiagram } from './components/OrbitDiagram'
import { fmt, usd, usdM, yrs } from './format'

function readHash(): Inputs {
  try {
    const raw = window.location.hash.slice(1)
    if (!raw) return BASELINE
    return { ...BASELINE, ...JSON.parse(atob(decodeURIComponent(raw))) }
  } catch {
    return BASELINE
  }
}

function writeHash(i: Inputs) {
  const diff: Partial<Record<keyof Inputs, unknown>> = {}
  for (const k of Object.keys(i) as (keyof Inputs)[]) if (i[k] !== BASELINE[k]) diff[k] = i[k]
  const h = Object.keys(diff).length ? '#' + encodeURIComponent(btoa(JSON.stringify(diff))) : ' '
  history.replaceState(null, '', h === ' ' ? window.location.pathname : h)
}

type SensMetric = 'lcoc' | 'tokens' | 'npv'

export default function App() {
  const [inputs, setInputs] = useState<Inputs>(readHash)
  const [scenario, setScenario] = useState<string>(() => (window.location.hash ? 'custom' : 'baseline'))
  const [sensMetric, setSensMetric] = useState<SensMetric>('lcoc')
  const [copied, setCopied] = useState(false)

  useEffect(() => writeHash(inputs), [inputs])

  const r = useMemo(() => simulate(inputs), [inputs])
  const sens = useMemo(() => {
    const m = sensMetric === 'lcoc' ? (x: Results) => x.econ.lcocPerChipHr : sensMetric === 'tokens' ? (x: Results) => x.econ.costPerMTokens : (x: Results) => x.econ.npvM
    return sensitivity(inputs, m)
  }, [inputs, sensMetric])
  const sensFmt = sensMetric === 'npv' ? (v: number) => usdM(v) : (v: number) => (v >= 0 ? '+' : '') + usd(v, 2)

  const update = (patch: Partial<Inputs>) => {
    setInputs((prev) => ({ ...prev, ...patch }))
    setScenario('custom')
  }
  const loadScenario = (id: string) => {
    const s = SCENARIOS.find((x) => x.id === id)
    if (s) { setInputs(s.inputs); setScenario(id) }
  }
  const copyLink = async () => {
    try { await navigator.clipboard.writeText(window.location.href); setCopied(true); setTimeout(() => setCopied(false), 1500) } catch { /* clipboard blocked */ }
  }

  const training = inputs.workload === 'training'
  const ground = r.terrestrial
  const costRatio = r.econ.lcocPerChipHr / ground.lcocPerChipHr
  const blurb = SCENARIOS.find((s) => s.id === scenario)?.blurb

  return (
    <div className="app">
      <header className="top">
        <div className="brand">
          <span className="logo" aria-hidden>◐</span>
          <div>
            <h1>Orbital Data Center Twin</h1>
            <p className="sub">Plug in a design, see its compute, lifetime and economics — vs. a ground data center.</p>
          </div>
        </div>
        <div className="top-actions">
          <label className="scenario">
            <span>Scenario</span>
            <select value={scenario} onChange={(e) => loadScenario(e.target.value)}>
              {SCENARIOS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
              {scenario === 'custom' && <option value="custom">Custom (edited)</option>}
            </select>
          </label>
          <button className="btn" onClick={copyLink}>{copied ? 'Link copied' : 'Copy scenario link'}</button>
        </div>
      </header>

      <div className="layout">
        <aside className="side">
          {blurb && <p className="blurb">{blurb}</p>}
          <InputPanel inputs={inputs} onChange={update} />
        </aside>

        <main className="main">
          {r.warnings.length > 0 && (
            <div className="warnings" role="status">
              {r.warnings.map((w) => <div key={w}><span className="warn-icon" aria-hidden>▲</span> {w}</div>)}
            </div>
          )}

          <section className="kpis">
            <Kpi label="Effective compute (start of life)" value={`${fmt(r.compute.effectiveEflopsBol)} EFLOPS`} sub={`${fmt(r.compute.peakEflops)} EFLOPS peak FP8 · ${fmt(r.compute.activeChips)} accelerators`} />
            {training
              ? <Kpi label="Time to train the model" value={`${fmt(r.compute.trainDays)} days`} sub={`${r.compute.trainFlops.toExponential(1)} FLOPs · run cost ${usdM(r.econ.trainRunCostM)}`} />
              : <Kpi label="Inference throughput" value={`${fmt(r.compute.tokensPerSec)} tok/s`} sub={`${usd(r.econ.costPerMTokens, 2)} per M tokens (ground ${usd(ground.costPerMTokens, 2)})`} />}
            <Kpi label="Cost per accelerator-hour" value={usd(r.econ.lcocPerChipHr, 3)} sub={`Ground: ${usd(ground.lcocPerChipHr, 3)} · ${costRatio.toFixed(2)}x`} tone={costRatio <= 1 ? 'good' : costRatio <= 1.5 ? 'warn' : 'bad'} />
            <Kpi label="Useful life" value={yrs(r.life.usefulLifeYr)} sub={`Limited by: ${r.life.limiter}`} tone={r.life.usefulLifeYr >= inputs.missionLifeYr ? 'good' : 'bad'} />
            <Kpi label="IT power" value={`${fmt(r.power.itMw)} MW`} sub={`${fmt(r.power.totalArrayM2)} m² solar · ${fmt(r.thermal.totalRadiatorM2)} m² radiator`} />
            <Kpi label="Mass to orbit" value={`${fmt(r.mass.totalT)} t`} sub={`${r.mass.launches} launch${r.mass.launches === 1 ? '' : 'es'} · ${fmt(r.mass.kgPerKw)} kg/kW IT`} />
            <Kpi label="Capex" value={usdM(r.econ.capexM)} sub={`${usd(r.econ.capexPerKwIt)}/kW IT · opex ${usdM(r.econ.opexMYr)}/yr`} />
            <Kpi label={`NPV over ${inputs.missionLifeYr} yr`} value={usdM(r.econ.npvM)} sub={r.econ.paybackYr ? `Payback in ${r.econ.paybackYr.toFixed(1)} yr` : 'No payback in mission life'} tone={r.econ.npvM >= 0 ? 'good' : 'bad'} />
          </section>

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

          <footer className="foot">
            Steady-state physics with a monthly lifetime simulation. Sources and assumptions: see ENGINEERING_SPEC.md in the repo. Built at Sundai Hack, 2026.
          </footer>
        </main>
      </div>
    </div>
  )
}

function Kpi({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: 'good' | 'warn' | 'bad' }) {
  return (
    <div className={`kpi ${tone ?? ''}`}>
      <div className="kpi-label">
        {tone && <span className="tone-icon" aria-label={tone}>{tone === 'good' ? '●' : tone === 'warn' ? '▲' : '■'}</span>}
        {label}
      </div>
      <div className="kpi-value">{value}</div>
      {sub && <div className="kpi-sub">{sub}</div>}
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
