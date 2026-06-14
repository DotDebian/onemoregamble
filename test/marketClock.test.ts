import { describe, it, expect } from 'vitest'
import type { Candle } from '../app/types/market'
import { computeMarketClock } from '../app/analysis/marketClock'

// Helper: build a candle, defaulting the OHLCV fields so each test only states
// what it cares about. `time` is UNIX **seconds** (the Candle contract).
function candle(time: number, p: Partial<Omit<Candle, 'time'>> = {}): Candle {
  return {
    time,
    open: p.open ?? 100,
    high: p.high ?? 100,
    low: p.low ?? 100,
    close: p.close ?? 100,
    volume: p.volume ?? 0,
  }
}

// Anchors verified independently via `new Date(t*1000).toISOString()`:
//   1700000000 -> 2023-11-14T22:13:20Z  -> UTC hour 22, dow 2 (Tuesday)
//   1700003600 -> 2023-11-14T23:13:20Z  -> UTC hour 23, dow 2
//   1700000000 + 86400 -> 2023-11-15... -> UTC hour 22, dow 3 (Wednesday)
//   0          -> 1970-01-01T00:00:00Z  -> UTC hour 0,  dow 4 (Thursday)
//   1672567200 -> 2023-01-01T10:00:00Z  -> UTC hour 10, dow 0 (Sunday)
const TUE_22 = 1700000000
const TUE_23 = 1700003600
const WED_22 = 1700000000 + 86400
const THU_00 = 0
const SUN_10 = 1672567200

describe('computeMarketClock — structure', () => {
  it('returns fixed-length byHour (24), byDow (7) and 7x24 grids', () => {
    const r = computeMarketClock([])
    expect(r.byHour).toHaveLength(24)
    expect(r.byDow).toHaveLength(7)
    expect(r.grid).toHaveLength(7)
    expect(r.gridCounts).toHaveLength(7)
    for (let d = 0; d < 7; d++) {
      expect(r.grid[d]).toHaveLength(24)
      expect(r.gridCounts[d]).toHaveLength(24)
    }
    // Indices are 0..23 / 0..6 in order.
    expect(r.byHour.map((b) => b.index)).toEqual(Array.from({ length: 24 }, (_, i) => i))
    expect(r.byDow.map((b) => b.index)).toEqual(Array.from({ length: 7 }, (_, i) => i))
    expect(r.totalCandles).toBe(0)
  })
})

describe('computeMarketClock — known bucketing', () => {
  it('lands candles in the expected UTC hour/dow with hand-computed averages', () => {
    // Single candle on Tuesday 22:00 UTC. open 100, high 110, low 90, close 105.
    // volatility = (110-90)/100 = 0.20 ; return = (105-100)/100 = 0.05.
    const r = computeMarketClock([
      candle(TUE_22, { open: 100, high: 110, low: 90, close: 105, volume: 1000 }),
    ])

    expect(r.totalCandles).toBe(1)

    const h22 = r.byHour[22]!
    expect(h22.count).toBe(1)
    expect(h22.avgVolatility).toBeCloseTo(0.2, 12)
    expect(h22.avgReturn).toBeCloseTo(0.05, 12)
    expect(h22.avgVolume).toBeCloseTo(1000, 12)

    const dTue = r.byDow[2]! // Tuesday
    expect(dTue.count).toBe(1)
    expect(dTue.avgVolatility).toBeCloseTo(0.2, 12)
    expect(dTue.avgReturn).toBeCloseTo(0.05, 12)

    // No other hour/dow received anything.
    expect(r.byHour[23]!.count).toBe(0)
    expect(r.byDow[3]!.count).toBe(0)
  })

  it('separates candles that differ only by UTC hour and only by UTC day', () => {
    const r = computeMarketClock([
      candle(TUE_22), // hour 22, dow 2
      candle(TUE_23), // hour 23, dow 2
      candle(WED_22), // hour 22, dow 3
      candle(THU_00), // hour 0,  dow 4
    ])
    expect(r.totalCandles).toBe(4)

    // Hour split.
    expect(r.byHour[22]!.count).toBe(2) // TUE_22 + WED_22
    expect(r.byHour[23]!.count).toBe(1) // TUE_23
    expect(r.byHour[0]!.count).toBe(1) // THU_00

    // Dow split (0=Sun..6=Sat).
    expect(r.byDow[2]!.count).toBe(2) // Tuesday: TUE_22 + TUE_23
    expect(r.byDow[3]!.count).toBe(1) // Wednesday: WED_22
    expect(r.byDow[4]!.count).toBe(1) // Thursday: THU_00
    expect(r.byDow[0]!.count).toBe(0) // Sunday untouched
  })
})

describe('computeMarketClock — averaging', () => {
  it('averages return and volatility across candles in the same hour bucket', () => {
    // Two candles in the SAME hour/dow bucket (Sunday 10:00 UTC).
    //  A: open 100, close 102 -> return +0.02 ; high 105 low 95 -> vol 0.10
    //  B: open 100, close 96  -> return -0.04 ; high 103 low 97 -> vol 0.06
    // avgReturn = (0.02 + -0.04)/2 = -0.01 ; avgVol = (0.10 + 0.06)/2 = 0.08
    const r = computeMarketClock([
      candle(SUN_10, { open: 100, high: 105, low: 95, close: 102, volume: 10 }),
      candle(SUN_10 + 600, { open: 100, high: 103, low: 97, close: 96, volume: 30 }),
    ])

    const h10 = r.byHour[10]!
    expect(h10.count).toBe(2)
    expect(h10.avgReturn).toBeCloseTo(-0.01, 12)
    expect(h10.avgVolatility).toBeCloseTo(0.08, 12)
    expect(h10.avgVolume).toBeCloseTo(20, 12) // (10+30)/2

    // Same on the weekday bucket (both are Sunday).
    const dSun = r.byDow[0]!
    expect(dSun.count).toBe(2)
    expect(dSun.avgReturn).toBeCloseTo(-0.01, 12)
    expect(dSun.avgVolatility).toBeCloseTo(0.08, 12)
  })
})

describe('computeMarketClock — empty buckets', () => {
  it('reports count 0 / avg 0 for empty hour & dow buckets and NaN grid cells', () => {
    const r = computeMarketClock([candle(TUE_22, { open: 100, high: 110, low: 90, close: 105 })])

    // Every hour except 22 is empty.
    for (let h = 0; h < 24; h++) {
      if (h === 22) continue
      const b = r.byHour[h]!
      expect(b.count).toBe(0)
      expect(b.avgVolatility).toBe(0)
      expect(b.avgReturn).toBe(0)
      expect(b.avgVolume).toBe(0)
    }

    // Grid: only [dow=2][hour=22] is populated; all other cells are NaN.
    for (let d = 0; d < 7; d++) {
      for (let h = 0; h < 24; h++) {
        if (d === 2 && h === 22) {
          expect(r.gridCounts[d]![h]).toBe(1)
          expect(r.grid[d]![h]).toBeCloseTo(0.2, 12)
        } else {
          expect(r.gridCounts[d]![h]).toBe(0)
          expect(Number.isNaN(r.grid[d]![h]!)).toBe(true)
        }
      }
    }
  })
})

describe('computeMarketClock — grid consistency', () => {
  it('gridCounts sum to totalCandles and each cell matches its byHour/byDow index', () => {
    const r = computeMarketClock([
      candle(TUE_22, { open: 100, high: 110, low: 90, close: 100 }),
      candle(TUE_23, { open: 100, high: 102, low: 98, close: 100 }),
      candle(WED_22, { open: 100, high: 104, low: 96, close: 100 }),
      candle(THU_00, { open: 100, high: 101, low: 99, close: 100 }),
      candle(SUN_10, { open: 100, high: 106, low: 94, close: 100 }),
    ])

    // Sum of all grid counts equals the number of counted candles.
    let sum = 0
    for (let d = 0; d < 7; d++) for (let h = 0; h < 24; h++) sum += r.gridCounts[d]![h]!
    expect(sum).toBe(r.totalCandles)
    expect(r.totalCandles).toBe(5)

    // A candle's grid cell sits at [its dow][its hour]; that volatility equals
    // the lone (110-90)/100 = 0.20 for the Tuesday-22 candle.
    expect(r.gridCounts[2]![22]).toBe(1)
    expect(r.grid[2]![22]).toBeCloseTo(0.2, 12)
    expect(r.gridCounts[2]![23]).toBe(1) // TUE_23
    expect(r.gridCounts[3]![22]).toBe(1) // WED_22
    expect(r.gridCounts[4]![0]).toBe(1) // THU_00
    expect(r.gridCounts[0]![10]).toBe(1) // SUN_10

    // Column/row totals reconcile with the 1-D buckets.
    let hour22 = 0
    for (let d = 0; d < 7; d++) hour22 += r.gridCounts[d]![22]!
    expect(hour22).toBe(r.byHour[22]!.count) // 2 (TUE_22 + WED_22)

    let dowTue = 0
    for (let h = 0; h < 24; h++) dowTue += r.gridCounts[2]![h]!
    expect(dowTue).toBe(r.byDow[2]!.count) // 2 (TUE_22 + TUE_23)
  })
})

describe('computeMarketClock — robustness', () => {
  it('skips candles with open<=0 or non-finite OHLCV without crashing', () => {
    const r = computeMarketClock([
      candle(TUE_22, { open: 100, high: 110, low: 90, close: 105 }), // valid
      candle(TUE_22, { open: 0, high: 110, low: 90, close: 105 }), // open == 0 -> skip
      candle(TUE_22, { open: -50, high: 110, low: 90, close: 105 }), // open < 0  -> skip
      candle(TUE_22, { open: 100, high: NaN, low: 90, close: 105 }), // NaN high  -> skip
      candle(TUE_22, { open: 100, high: 110, low: 90, close: Infinity }), // Inf close -> skip
      candle(NaN, { open: 100, high: 110, low: 90, close: 105 }), // NaN time  -> skip
      candle(TUE_22, { open: 100, high: 110, low: 90, close: 105, volume: NaN }), // NaN volume -> skip
    ])

    // Only the single valid candle is counted.
    expect(r.totalCandles).toBe(1)
    expect(r.byHour[22]!.count).toBe(1)
    expect(r.byHour[22]!.avgVolatility).toBeCloseTo(0.2, 12)
    expect(r.byHour[22]!.avgReturn).toBeCloseTo(0.05, 12)
    expect(r.gridCounts[2]![22]).toBe(1)
  })

  it('handles an all-invalid history as if empty', () => {
    const r = computeMarketClock([
      candle(TUE_22, { open: 0 }),
      candle(TUE_22, { open: NaN }),
    ])
    expect(r.totalCandles).toBe(0)
    expect(r.byHour.every((b) => b.count === 0)).toBe(true)
    expect(r.byDow.every((b) => b.count === 0)).toBe(true)
  })
})
