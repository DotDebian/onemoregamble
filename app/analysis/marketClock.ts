// Market clock: aggregate historical candles into a 24-hour-by-day-of-week
// profile of volatility, direction and volume. Pure and framework-free — no
// charting-library import — so it unit-tests cleanly and runs identically on
// the server or in the browser. All time bucketing uses UTC: Binance
// timestamps are UTC, and UTC is the honest, machine-independent choice (the
// alternative, local time, would shift every bucket by the runner's timezone).

import type { Candle } from '~/types/market'

/**
 * One aggregated cell of the clock — either a single UTC hour (0..23) or a
 * single UTC day-of-week (0..6). `index` carries which one. Averages are over
 * the `count` candles that fell into the cell; an empty cell has all averages
 * at 0 (callers that need to distinguish "empty" from "genuinely zero" should
 * read `count`).
 */
export interface ClockBucket {
  index: number // hour 0..23 for byHour; dow 0..6 for byDow
  count: number // candles in this bucket
  avgVolatility: number // mean of (high-low)/open  (fraction; 0 if open<=0 skipped)
  avgReturn: number // mean of (close-open)/open (signed fraction)
  avgVolume: number // mean volume
}

export interface MarketClockResult {
  byHour: ClockBucket[] // length 24, index 0..23 (UTC hour)
  byDow: ClockBucket[] // length 7,  index 0..6  (0=Sunday..6=Saturday, UTC)
  grid: number[][] // grid[dow][hour] = avgVolatility for that (dow,hour) cell; dims [7][24]; NaN where count 0
  gridCounts: number[][] // gridCounts[dow][hour] = candle count; dims [7][24]
  totalCandles: number
}

/** Mutable accumulator: running sums plus a count, collapsed to averages later. */
interface Accumulator {
  count: number
  sumVolatility: number
  sumReturn: number
  sumVolume: number
}

function makeAccumulator(): Accumulator {
  return { count: 0, sumVolatility: 0, sumReturn: 0, sumVolume: 0 }
}

/** True only when every OHLCV field is a finite number (rejects NaN/Infinity). */
function isFiniteCandle(c: Candle): boolean {
  return (
    Number.isFinite(c.time) &&
    Number.isFinite(c.open) &&
    Number.isFinite(c.high) &&
    Number.isFinite(c.low) &&
    Number.isFinite(c.close) &&
    Number.isFinite(c.volume)
  )
}

/** Collapse an accumulator into a finished bucket for the given index. */
function finalize(acc: Accumulator, index: number): ClockBucket {
  if (acc.count === 0) {
    // No candles landed here: report zeros rather than NaN so charts and
    // numeric consumers don't have to special-case empties. `count` is the
    // honest signal that there's no data behind these.
    return { index, count: 0, avgVolatility: 0, avgReturn: 0, avgVolume: 0 }
  }
  return {
    index,
    count: acc.count,
    avgVolatility: acc.sumVolatility / acc.count,
    avgReturn: acc.sumReturn / acc.count,
    avgVolume: acc.sumVolume / acc.count,
  }
}

/**
 * Build the market clock from a flat list of candles. Order is irrelevant —
 * each candle is bucketed independently by its own UTC hour and weekday. A
 * candle with open<=0 or any non-finite OHLCV field is skipped entirely (it
 * contributes to no bucket and is excluded from `totalCandles`), because the
 * per-candle volatility/return are fractions of `open` and meaningless there.
 */
export function computeMarketClock(history: Candle[]): MarketClockResult {
  // 24 hour accumulators (UTC hour 0..23) and 7 weekday accumulators (UTC
  // getUTCDay: 0=Sunday..6=Saturday).
  const hourAcc: Accumulator[] = Array.from({ length: 24 }, makeAccumulator)
  const dowAcc: Accumulator[] = Array.from({ length: 7 }, makeAccumulator)

  // grid[dow][hour] volatility sums and counts. Built dense so callers can index
  // any cell without bounds juggling; empty cells become NaN at finalize time.
  const gridSum: number[][] = Array.from({ length: 7 }, () => new Array<number>(24).fill(0))
  const gridCounts: number[][] = Array.from({ length: 7 }, () => new Array<number>(24).fill(0))

  let totalCandles = 0

  for (const c of history) {
    // Skip anything we can't honestly turn into a fraction of `open`.
    if (!isFiniteCandle(c) || c.open <= 0) continue

    const d = new Date(c.time * 1000) // candle.time is UNIX **seconds**
    const hour = d.getUTCHours() // 0..23
    const dow = d.getUTCDay() // 0=Sunday..6=Saturday

    const volatility = (c.high - c.low) / c.open // non-negative range fraction
    const ret = (c.close - c.open) / c.open // signed directional return

    // Hour bucket.
    const h = hourAcc[hour]!
    h.count++
    h.sumVolatility += volatility
    h.sumReturn += ret
    h.sumVolume += c.volume

    // Weekday bucket.
    const w = dowAcc[dow]!
    w.count++
    w.sumVolatility += volatility
    w.sumReturn += ret
    w.sumVolume += c.volume

    // Grid cell (volatility only — that's all `grid` exposes).
    const gRow = gridSum[dow]!
    const cRow = gridCounts[dow]!
    gRow[hour] = (gRow[hour] ?? 0) + volatility
    cRow[hour] = (cRow[hour] ?? 0) + 1

    totalCandles++
  }

  const byHour = hourAcc.map((acc, i) => finalize(acc, i))
  const byDow = dowAcc.map((acc, i) => finalize(acc, i))

  // grid[dow][hour] = mean volatility, or NaN where no candle landed.
  const grid: number[][] = gridSum.map((row, dow) =>
    row.map((sum, hour) => {
      const n = gridCounts[dow]![hour]!
      return n === 0 ? NaN : sum / n
    }),
  )

  return { byHour, byDow, grid, gridCounts, totalCandles }
}
