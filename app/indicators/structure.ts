import type { Candle } from '~/types/market'

// ---------------------------------------------------------------------------
// Pivot points (classic) — derived from the prior period's High/Low/Close.
// ---------------------------------------------------------------------------

export interface PivotLevels {
  pp: number
  r1: number
  r2: number
  r3: number
  s1: number
  s2: number
  s3: number
}

export function pivotPoints(high: number, low: number, close: number): PivotLevels {
  const pp = (high + low + close) / 3
  return {
    pp,
    r1: 2 * pp - low,
    s1: 2 * pp - high,
    r2: pp + (high - low),
    s2: pp - (high - low),
    r3: high + 2 * (pp - low),
    s3: low - 2 * (high - pp),
  }
}

/** Aggregate candles into the prior completed UTC day's H/L/C. */
export function priorDayHLC(candles: Candle[]): { high: number; low: number; close: number } | null {
  if (!candles.length) return null
  const lastDay = Math.floor(candles[candles.length - 1]!.time / 86400)
  const prevDay = lastDay - 1
  let high = -Infinity
  let low = Infinity
  let close = NaN
  let found = false
  for (const c of candles) {
    if (Math.floor(c.time / 86400) === prevDay) {
      found = true
      high = Math.max(high, c.high)
      low = Math.min(low, c.low)
      close = c.close // last one wins
    }
  }
  return found ? { high, low, close } : null
}

// ---------------------------------------------------------------------------
// Swing pivots + clustering into support/resistance zones.
// ---------------------------------------------------------------------------

export interface Swing {
  index: number
  time: number
  price: number
  type: 'high' | 'low'
}

export function findSwings(candles: Candle[], left = 5, right = 5): Swing[] {
  const swings: Swing[] = []
  for (let i = left; i < candles.length - right; i++) {
    const h = candles[i]!.high
    const l = candles[i]!.low
    let isHigh = true
    let isLow = true
    for (let j = i - left; j <= i + right; j++) {
      if (j === i) continue
      if (candles[j]!.high >= h) isHigh = false
      if (candles[j]!.low <= l) isLow = false
    }
    if (isHigh) swings.push({ index: i, time: candles[i]!.time, price: h, type: 'high' })
    if (isLow) swings.push({ index: i, time: candles[i]!.time, price: l, type: 'low' })
  }
  return swings
}

export interface SrLevel {
  price: number
  touches: number
  type: 'high' | 'low'
  lastTime: number
}

/** Cluster swing prices into levels; tolerance is a fraction of price (e.g. 0.004 = 0.4%). */
export function clusterLevels(swings: Swing[], tolerance = 0.004): SrLevel[] {
  if (!swings.length) return []
  const sorted = [...swings].sort((a, b) => a.price - b.price)
  const clusters: { prices: number[]; highs: number; lows: number; lastTime: number }[] = []
  for (const s of sorted) {
    const last = clusters[clusters.length - 1]
    const mean = last ? last.prices.reduce((a, b) => a + b, 0) / last.prices.length : 0
    if (last && Math.abs(s.price - mean) <= mean * tolerance) {
      last.prices.push(s.price)
      if (s.type === 'high') last.highs++
      else last.lows++
      last.lastTime = Math.max(last.lastTime, s.time)
    } else {
      clusters.push({
        prices: [s.price],
        highs: s.type === 'high' ? 1 : 0,
        lows: s.type === 'low' ? 1 : 0,
        lastTime: s.time,
      })
    }
  }
  return clusters
    .map((c): SrLevel => ({
      price: c.prices.reduce((a, b) => a + b, 0) / c.prices.length,
      touches: c.prices.length,
      type: c.highs >= c.lows ? 'high' : 'low',
      lastTime: c.lastTime,
    }))
    .sort((a, b) => b.touches - a.touches)
}

// ---------------------------------------------------------------------------
// Market structure labels (HH / HL / LH / LL) + trend bias.
// ---------------------------------------------------------------------------

export type StructureLabel = 'HH' | 'HL' | 'LH' | 'LL'
export interface StructurePoint extends Swing {
  label: StructureLabel
}

export function marketStructure(swings: Swing[]): {
  points: StructurePoint[]
  trend: 'up' | 'down' | 'range'
} {
  const points: StructurePoint[] = []
  let lastHigh: number | null = null
  let lastLow: number | null = null
  for (const s of swings) {
    if (s.type === 'high') {
      const label: StructureLabel = lastHigh != null && s.price < lastHigh ? 'LH' : 'HH'
      points.push({ ...s, label })
      lastHigh = s.price
    } else {
      const label: StructureLabel = lastLow != null && s.price > lastLow ? 'HL' : 'LL'
      points.push({ ...s, label })
      lastLow = s.price
    }
  }
  // Trend from the last two highs and last two lows (more robust than scanning
  // labels, whose first-of-type entries have no prior reference).
  const highs = swings.filter((s) => s.type === 'high').map((s) => s.price)
  const lows = swings.filter((s) => s.type === 'low').map((s) => s.price)
  let trend: 'up' | 'down' | 'range' = 'range'
  if (highs.length >= 2 && lows.length >= 2) {
    const hUp = highs.at(-1)! > highs.at(-2)!
    const lUp = lows.at(-1)! > lows.at(-2)!
    const hDown = highs.at(-1)! < highs.at(-2)!
    const lDown = lows.at(-1)! < lows.at(-2)!
    if (hUp && lUp) trend = 'up'
    else if (hDown && lDown) trend = 'down'
  }
  return { points, trend }
}

// ---------------------------------------------------------------------------
// Volume profile (by price) over a set of candles.
// ---------------------------------------------------------------------------

export interface VolumeProfileBin {
  low: number
  high: number
  mid: number
  volume: number
}
export interface VolumeProfile {
  bins: VolumeProfileBin[]
  poc: number
  vah: number
  val: number
  maxVolume: number
  total: number
}

export function volumeProfile(
  candles: Candle[],
  binCount = 48,
  valueAreaPct = 0.7,
): VolumeProfile | null {
  if (candles.length < 2) return null
  let min = Infinity
  let max = -Infinity
  for (const c of candles) {
    if (c.low < min) min = c.low
    if (c.high > max) max = c.high
  }
  if (!Number.isFinite(min) || !Number.isFinite(max) || max <= min) return null

  const binSize = (max - min) / binCount
  const bins: VolumeProfileBin[] = Array.from({ length: binCount }, (_, i) => ({
    low: min + i * binSize,
    high: min + (i + 1) * binSize,
    mid: min + (i + 0.5) * binSize,
    volume: 0,
  }))

  for (const c of candles) {
    const range = c.high - c.low
    if (range <= 0) {
      const idx = Math.min(binCount - 1, Math.max(0, Math.floor((c.close - min) / binSize)))
      bins[idx]!.volume += c.volume
      continue
    }
    const volPerUnit = c.volume / range
    const startIdx = Math.max(0, Math.floor((c.low - min) / binSize))
    const endIdx = Math.min(binCount - 1, Math.floor((c.high - min) / binSize))
    for (let i = startIdx; i <= endIdx; i++) {
      const overlap = Math.min(c.high, bins[i]!.high) - Math.max(c.low, bins[i]!.low)
      if (overlap > 0) bins[i]!.volume += volPerUnit * overlap
    }
  }

  let pocIndex = 0
  let maxVolume = 0
  let total = 0
  for (let i = 0; i < bins.length; i++) {
    total += bins[i]!.volume
    if (bins[i]!.volume > maxVolume) {
      maxVolume = bins[i]!.volume
      pocIndex = i
    }
  }

  // Value area: expand from POC to the richer neighbour until 70% is captured.
  const target = total * valueAreaPct
  let captured = bins[pocIndex]!.volume
  let lo = pocIndex
  let hi = pocIndex
  while (captured < target && (lo > 0 || hi < bins.length - 1)) {
    const below = lo > 0 ? bins[lo - 1]!.volume : -1
    const above = hi < bins.length - 1 ? bins[hi + 1]!.volume : -1
    if (above >= below) {
      hi++
      captured += bins[hi]!.volume
    } else {
      lo--
      captured += bins[lo]!.volume
    }
  }

  return {
    bins,
    poc: bins[pocIndex]!.mid,
    vah: bins[hi]!.high,
    val: bins[lo]!.low,
    maxVolume,
    total,
  }
}
