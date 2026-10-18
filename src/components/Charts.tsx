import { useEffect, useState } from 'react'
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, ReferenceLine,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import type { Results } from '../sim/types'
import type { SensitivityRow } from '../sim/engine'
import { fmt, usd } from '../format'

const LIGHT = {
  s1: '#2a78d6', s2: '#eb6834', s3: '#1baf7a', s4: '#eda100', s7: '#6250d6',
  grid: '#e1e0d9', axis: '#c3c2b7', muted: '#898781', text: '#52514e', surface: '#fcfcfb', critical: '#d03b3b',
}
const DARK = {
  s1: '#3987e5', s2: '#d95926', s3: '#199e70', s4: '#c98500', s7: '#9085e9',
  grid: '#2c2c2a', axis: '#383835', muted: '#898781', text: '#c3c2b7', surface: '#1a1a19', critical: '#d03b3b',
}

export function usePalette() {
  const mq = typeof window !== 'undefined' ? window.matchMedia('(prefers-color-scheme: dark)') : null
  const [dark, setDark] = useState(mq?.matches ?? false)
  useEffect(() => {
    if (!mq) return
    const h = (e: MediaQueryListEvent) => setDark(e.matches)
    mq.addEventListener('change', h)
    return () => mq.removeEventListener('change', h)
  }, [mq])
  return dark ? DARK : LIGHT
}
type Pal = typeof LIGHT

const axisProps = (p: Pal) => ({
  stroke: p.axis,
  tick: { fill: p.muted, fontSize: 11 },
  tickLine: false,
})

const tooltipStyle = (p: Pal) => ({
  contentStyle: { background: p.surface, border: `1px solid ${p.grid}`, borderRadius: 8, fontSize: 12, color: p.text },
  labelStyle: { color: p.text, fontWeight: 600 },
  cursor: { stroke: p.axis, strokeWidth: 1 },
})

export function CapacityChart({ r, threshold, missionLife }: { r: Results; threshold: number; missionLife: number }) {
  const p = usePalette()
  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={r.series} margin={{ top: 10, right: 16, bottom: 4, left: -8 }}>
        <CartesianGrid stroke={p.grid} vertical={false} />
        <XAxis dataKey="year" type="number" domain={[0, 25]} ticks={[0, 5, 10, 15, 20, 25]} unit=" yr" {...axisProps(p)} />
        <YAxis domain={[0, 130]} ticks={[0, 25, 50, 75, 100, 125]} unit="%" {...axisProps(p)} />
        <Tooltip
          {...tooltipStyle(p)}
          labelFormatter={(v) => `Year ${(+v).toFixed(1)}`}
          formatter={(v: number, name: string) => [`${v.toFixed(0)}%`, name]}
        />
        <Legend wrapperStyle={{ fontSize: 12, color: p.text }} iconType="plainline" />
        <ReferenceLine y={threshold} stroke={p.muted} strokeDasharray="4 4" label={{ value: 'End-of-life threshold', fill: p.muted, fontSize: 11, position: 'insideBottomRight' }} />
        <ReferenceLine x={missionLife} stroke={p.muted} strokeDasharray="4 4" label={{ value: 'Mission end', fill: p.muted, fontSize: 11, position: 'insideTopLeft' }} />
        <Line name="Delivered capacity" dataKey="capacityPct" stroke={p.s1} strokeWidth={2.5} dot={false} isAnimationActive={false} />
        <Line name="Working accelerators" dataKey="chipsPct" stroke={p.s2} strokeWidth={2} dot={false} isAnimationActive={false} />
        <Line name="Solar power headroom" dataKey="powerPct" stroke={p.s3} strokeWidth={2} dot={false} isAnimationActive={false} />
        <Line name="Radiator headroom" dataKey="thermalPct" stroke={p.s7} strokeWidth={2} dot={false} isAnimationActive={false} />
      </LineChart>
    </ResponsiveContainer>
  )
}

export function SubsystemLifeChart({ r, missionLife }: { r: Results; missionLife: number }) {
  const p = usePalette()
  const data = r.life.subsystems.map((s) => ({ ...s, short: s.name.replace(/ \(.*\)/, '') }))
  return (
    <ResponsiveContainer width="100%" height={230}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 40, bottom: 4, left: 8 }} barCategoryGap={6}>
        <CartesianGrid stroke={p.grid} horizontal={false} />
        <XAxis type="number" domain={[0, 25]} ticks={[0, 5, 10, 15, 20, 25]} unit=" yr" {...axisProps(p)} />
        <YAxis type="category" dataKey="short" width={110} {...axisProps(p)} tick={{ fill: p.text, fontSize: 12 }} />
        <Tooltip
          {...tooltipStyle(p)}
          cursor={{ fill: p.grid, opacity: 0.4 }}
          formatter={(v: number, _n: string, item: { payload?: { note: string } }) => [`${v >= 25 ? '25+' : v.toFixed(1)} yr — ${item.payload?.note ?? ''}`, 'Life']}
        />
        <ReferenceLine x={missionLife} stroke={p.muted} strokeDasharray="4 4" label={{ value: 'Mission', fill: p.muted, fontSize: 11, position: 'top' }} />
        <Bar dataKey="years" radius={[0, 4, 4, 0]} isAnimationActive={false} label={{ position: 'right', fill: p.text, fontSize: 11, formatter: (v: number) => (v >= 25 ? '25+' : v.toFixed(1)) }}>
          {data.map((d) => (
            <Cell key={d.name} fill={d.years < missionLife ? p.critical : p.s1} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

export function HBar({ data, unit, money }: { data: { name: string; value: number }[]; unit?: string; money?: boolean }) {
  const p = usePalette()
  const sorted = [...data].filter((d) => d.value > 0).sort((a, b) => b.value - a.value)
  const f = (v: number) => (money ? usd(v * 1e6) : fmt(v) + (unit ?? ''))
  return (
    <ResponsiveContainer width="100%" height={Math.max(160, sorted.length * 32 + 20)}>
      <BarChart data={sorted} layout="vertical" margin={{ top: 4, right: 70, bottom: 4, left: 8 }} barCategoryGap={6}>
        <XAxis type="number" hide />
        <YAxis type="category" dataKey="name" width={150} {...axisProps(p)} tick={{ fill: p.text, fontSize: 12 }} axisLine={false} />
        <Tooltip {...tooltipStyle(p)} cursor={{ fill: p.grid, opacity: 0.4 }} formatter={(v: number) => [f(v), '']} separator="" />
        <Bar dataKey="value" fill={p.s1} radius={[0, 4, 4, 0]} isAnimationActive={false} label={{ position: 'right', fill: p.text, fontSize: 11, formatter: f }} />
      </BarChart>
    </ResponsiveContainer>
  )
}

export function CashChart({ r }: { r: Results }) {
  const p = usePalette()
  const data = r.series.filter((d) => !isNaN(d.cumCashM))
  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={data} margin={{ top: 10, right: 16, bottom: 4, left: 0 }}>
        <CartesianGrid stroke={p.grid} vertical={false} />
        <XAxis dataKey="year" type="number" domain={['dataMin', 'dataMax']} unit=" yr" {...axisProps(p)} />
        <YAxis tickFormatter={(v) => usd(v * 1e6, 2)} {...axisProps(p)} width={64} />
        <Tooltip {...tooltipStyle(p)} labelFormatter={(v) => `Year ${(+v).toFixed(1)}`} formatter={(v: number) => [usd(v * 1e6), 'Cumulative cash']} />
        <ReferenceLine y={0} stroke={p.axis} />
        <Area dataKey="cumCashM" stroke={p.s1} fill={p.s1} fillOpacity={0.15} strokeWidth={2} isAnimationActive={false} />
      </AreaChart>
    </ResponsiveContainer>
  )
}

export function Tornado({ rows, unitFmt }: { rows: SensitivityRow[]; unitFmt: (v: number) => string }) {
  const p = usePalette()
  return (
    <ResponsiveContainer width="100%" height={rows.length * 28 + 50}>
      <BarChart data={rows} layout="vertical" margin={{ top: 4, right: 24, bottom: 4, left: 8 }} barCategoryGap={5} barGap="-100%">
        <CartesianGrid stroke={p.grid} horizontal={false} />
        <XAxis type="number" tickFormatter={unitFmt} {...axisProps(p)} />
        <YAxis type="category" dataKey="label" width={160} {...axisProps(p)} tick={{ fill: p.text, fontSize: 12 }} axisLine={false} />
        <Tooltip {...tooltipStyle(p)} cursor={{ fill: p.grid, opacity: 0.4 }} formatter={(v: number, name: string) => [unitFmt(v), name]} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <ReferenceLine x={0} stroke={p.axis} />
        <Bar name="Input lowered" dataKey="low" fill={p.s1} radius={2} isAnimationActive={false} />
        <Bar name="Input raised" dataKey="high" fill={p.s2} radius={2} isAnimationActive={false} />
      </BarChart>
    </ResponsiveContainer>
  )
}
