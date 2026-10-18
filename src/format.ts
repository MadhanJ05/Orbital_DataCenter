const sig = (x: number, digits: number) => (Math.abs(x) >= 100 ? x.toFixed(0) : String(+x.toPrecision(digits)))

export function fmt(v: number, digits = 3): string {
  if (!isFinite(v)) return '∞'
  const a = Math.abs(v)
  if (a >= 1e12) return sig(v / 1e12, digits) + 'T'
  if (a >= 1e9) return sig(v / 1e9, digits) + 'B'
  if (a >= 1e6) return sig(v / 1e6, digits) + 'M'
  if (a >= 1e4) return sig(v / 1e3, digits) + 'k'
  if (a >= 100) return v.toFixed(0)
  if (a >= 1) return String(+v.toPrecision(digits))
  if (a === 0) return '0'
  return v.toPrecision(2)
}

export const usd = (v: number, digits = 3) => (v < 0 ? '-$' : '$') + fmt(Math.abs(v), digits)
export const usdM = (m: number) => usd(m * 1e6)
export const yrs = (y: number) => (y >= 25 ? '25+ yr' : `${y.toFixed(1)} yr`)
