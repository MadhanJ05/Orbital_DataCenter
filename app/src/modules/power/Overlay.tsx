import type { OverlayProps } from '../../core/module'
import { fmt } from '../../core/format'
import { ARR_L, ARR_R, BUS, C, PANEL, Panel, PanelBar, Stream, SUN } from '../../ui/walkthrough/kit'

export function PowerOverlay({ p, t, r, animate }: OverlayProps) {
  const grow = Math.min(1, p * 1.5)
  const max = Math.max(r.power.arrayKwPerSat, r.power.loadKwPerSat)
  const { x, y } = PANEL
  return (
    <>
      {animate && (
        <>
          <Stream from={SUN} to={[ARR_L.x + 90, ARR_L.y + 10]} n={7} t={t} speed={0.9} color={C.photon} />
          <Stream from={SUN} to={[ARR_R.x + 60, ARR_R.y + 10]} n={9} t={t} speed={0.7} color={C.photon} />
          <Stream from={[ARR_L.x + ARR_L.w, 190]} to={[BUS.x + 4, 190]} n={4} t={t} speed={1.4} color={C.photon} r={2} />
          <Stream from={[ARR_R.x, 190]} to={[BUS.x + BUS.w - 4, 190]} n={4} t={t} speed={1.4} color={C.photon} r={2} />
        </>
      )}
      <Panel>
        <PanelBar label="Solar array" value={`${fmt(r.power.arrayKwPerSat)} kW`} frac={(r.power.arrayKwPerSat / max) * grow} y={y + 24} color={C.photon} />
        <PanelBar label="Load" value={`${fmt(r.power.loadKwPerSat)} kW`} frac={(r.power.loadKwPerSat / max) * grow} y={y + 58} color={C.chipOn} />
        <text x={x + 12} y={y + 102} className="sc-label">Battery {fmt(r.power.batteryKwhPerSat)} kWh · shadow {(r.orbit.eclipseFracAvg * 100).toFixed(1)}%</text>
      </Panel>
    </>
  )
}
