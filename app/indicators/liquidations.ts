import type { Candle } from '~/types/market'

/** A liquidation above this notional is flagged as a "whale". */
export const WHALE_USD = 100_000

export interface RealLiq {
  time: number
  price: number
  usd: number
  side: 'long' | 'short'
}

export interface RealLiqBucket {
  low: number
  high: number
  mid: number
  long: number
  short: number
}
export interface RealLiqProfile {
  buckets: RealLiqBucket[]
  max: number
}

/** Aggregate *real* liquidation events into price buckets (the real heatmap). */
export function aggregateLiquidations(
  events: RealLiq[],
  priceMin: number,
  priceMax: number,
  bins = 70,
): RealLiqProfile | null {
  if (!events.length || priceMax <= priceMin) return null
  const binSize = (priceMax - priceMin) / bins
  if (binSize <= 0) return null
  const buckets: RealLiqBucket[] = Array.from({ length: bins }, (_, i) => ({
    low: priceMin + i * binSize,
    high: priceMin + (i + 1) * binSize,
    mid: priceMin + (i + 0.5) * binSize,
    long: 0,
    short: 0,
  }))
  for (const e of events) {
    const idx = Math.floor((e.price - priceMin) / binSize)
    if (idx < 0 || idx >= bins) continue
    if (e.side === 'long') buckets[idx]!.long += e.usd
    else buckets[idx]!.short += e.usd
  }
  let max = 0
  for (const b of buckets) {
    const tot = b.long + b.short
    if (tot > max) max = tot
  }
  return max > 0 ? { buckets, max } : null
}

/** Biggest real liquidation cluster by price (for the recap / Claude). */
export function hottestRealCluster(
  profile: RealLiqProfile | null,
): { price: number; usd: number; side: 'long' | 'short' } | null {
  if (!profile) return null
  let best: RealLiqBucket | null = null
  let bestMag = 0
  for (const b of profile.buckets) {
    const tot = b.long + b.short
    if (tot > bestMag) {
      bestMag = tot
      best = b
    }
  }
  if (!best) return null
  return { price: best.mid, usd: bestMag, side: best.long >= best.short ? 'long' : 'short' }
}

// Estimated liquidation heatmap (a *heuristic model*, not exchange position
// data). For each recent candle we treat its volume as positions opened around
// its typical price, then project where common leverage tiers would be
// liquidated and bucket the estimated notional by price.

export interface LiqTier {
  leverage: number
  weight: number
}

export const DEFAULT_TIERS: LiqTier[] = [
  { leverage: 10, weight: 0.3 },
  { leverage: 25, weight: 0.3 },
  { leverage: 50, weight: 0.25 },
  { leverage: 100, weight: 0.15 },
]

export interface LiqBucket {
  low: number
  high: number
  mid: number
  longMag: number
  shortMag: number
}

export interface LiqHeatmap {
  buckets: LiqBucket[]
  max: number
  priceMin: number
  priceMax: number
}

export function estimateLiquidationHeatmap(
  candles: Candle[],
  bins = 70,
  tiers: LiqTier[] = DEFAULT_TIERS,
  spreadPct = 0.12,
): LiqHeatmap | null {
  if (candles.length < 5) return null

  let minLow = Infinity
  let maxHigh = -Infinity
  for (const c of candles) {
    if (c.low < minLow) minLow = c.low
    if (c.high > maxHigh) maxHigh = c.high
  }
  if (!Number.isFinite(minLow) || !Number.isFinite(maxHigh)) return null

  // Extend the range so deep-leverage (10×) liquidation levels are captured.
  const priceMin = minLow * (1 - spreadPct)
  const priceMax = maxHigh * (1 + spreadPct)
  const binSize = (priceMax - priceMin) / bins
  if (binSize <= 0) return null

  const buckets: LiqBucket[] = Array.from({ length: bins }, (_, i) => ({
    low: priceMin + i * binSize,
    high: priceMin + (i + 1) * binSize,
    mid: priceMin + (i + 0.5) * binSize,
    longMag: 0,
    shortMag: 0,
  }))

  const addAt = (price: number, side: 'long' | 'short', mag: number) => {
    const idx = Math.floor((price - priceMin) / binSize)
    if (idx < 0 || idx >= bins) return
    if (side === 'long') buckets[idx]!.longMag += mag
    else buckets[idx]!.shortMag += mag
  }

  const n = candles.length
  for (let i = 0; i < n; i++) {
    const c = candles[i]!
    // Newer positions are more likely still open → weight recency higher.
    const recency = 0.25 + 0.75 * (n === 1 ? 1 : i / (n - 1))
    const entry = (c.high + c.low + c.close) / 3
    const notional = c.volume * entry * recency
    for (const t of tiers) {
      const mag = t.weight * notional
      addAt(entry * (1 - 1 / t.leverage), 'long', mag)
      addAt(entry * (1 + 1 / t.leverage), 'short', mag)
    }
  }

  let max = 0
  for (const b of buckets) {
    const tot = b.longMag + b.shortMag
    if (tot > max) max = tot
  }

  return { buckets, max, priceMin, priceMax }
}

/** The single hottest estimated cluster (for the recap / Claude context). */
export function hottestCluster(
  heatmap: LiqHeatmap | null,
): { price: number; side: 'long' | 'short' } | null {
  if (!heatmap || heatmap.max <= 0) return null
  let best: LiqBucket | null = null
  let bestMag = 0
  for (const b of heatmap.buckets) {
    const tot = b.longMag + b.shortMag
    if (tot > bestMag) {
      bestMag = tot
      best = b
    }
  }
  if (!best) return null
  return { price: best.mid, side: best.longMag >= best.shortMag ? 'long' : 'short' }
}
