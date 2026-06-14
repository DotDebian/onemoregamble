// Core market data types. Kept free of any charting-library import so the
// indicator engine and its unit tests don't depend on lightweight-charts.

/** Unix timestamp in **seconds** (what lightweight-charts expects). */
export type Time = number

export interface Candle {
  time: Time
  open: number
  high: number
  low: number
  close: number
  volume: number
}

/** Binance kline tuple (REST + WS share the same field order). */
export type BinanceKline = [
  openTime: number,
  open: string,
  high: string,
  low: string,
  close: string,
  volume: string,
  closeTime: number,
  ...rest: unknown[],
]

export function klineToCandle(k: BinanceKline): Candle {
  return {
    time: Math.floor(k[0] / 1000),
    open: +k[1],
    high: +k[2],
    low: +k[3],
    close: +k[4],
    volume: +k[5],
  }
}

/**
 * Merge possibly-overlapping pages of candles into one ascending, de-duplicated
 * series keyed by open time. Pages may arrive in any order — e.g. when paging
 * the klines REST endpoint backwards, where consecutive pages share a boundary
 * bar. Later pages win on a tie. Optionally keep only the most recent `cap`.
 */
export function mergeCandlePages(pages: Candle[][], cap?: number): Candle[] {
  const byTime = new Map<number, Candle>()
  for (const page of pages) for (const c of page) byTime.set(c.time, c)
  const merged = [...byTime.values()].sort((a, b) => a.time - b.time)
  return cap != null && merged.length > cap ? merged.slice(-cap) : merged
}
