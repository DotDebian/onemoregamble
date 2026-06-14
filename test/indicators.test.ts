import { describe, it, expect } from 'vitest'
import {
  simpleMovingAverage,
  exponentialMovingAverage,
  rollingStdDev,
  relativeStrengthIndex,
  macd,
  averageTrueRange,
} from '../app/indicators/math'
import {
  isOpenAt,
  utcHour,
  computeSessionSegments,
  sessionStatuses,
  SESSIONS,
} from '../app/indicators/sessions'
import { vwapIndicator } from '../app/indicators/definitions/vwap'
import { vwapBandsIndicator } from '../app/indicators/definitions/vwapBands'
import type { Candle } from '../app/types/market'

describe('moving averages', () => {
  it('SMA matches a hand-computed window', () => {
    const out = simpleMovingAverage([1, 2, 3, 4, 5], 3)
    expect(out[0]).toBeNaN()
    expect(out[1]).toBeNaN()
    expect(out[2]).toBeCloseTo(2)
    expect(out[3]).toBeCloseTo(3)
    expect(out[4]).toBeCloseTo(4)
  })

  it('EMA of a constant series is the constant', () => {
    const out = exponentialMovingAverage([5, 5, 5, 5, 5], 3)
    expect(out.at(-1)).toBeCloseTo(5)
  })

  it('EMA reacts to a step up (stays below the new level until it converges)', () => {
    const out = exponentialMovingAverage([10, 10, 10, 20, 20], 3)
    const last = out.at(-1)!
    expect(last).toBeGreaterThan(10)
    expect(last).toBeLessThan(20)
  })
})

describe('rolling std dev', () => {
  it('is zero for a constant series', () => {
    const out = rollingStdDev([7, 7, 7, 7], 2)
    expect(out.at(-1)).toBeCloseTo(0)
  })

  it('matches the population std dev of a known window', () => {
    // window [2,4,4,4,5,5,7,9] population std dev = 2
    const out = rollingStdDev([2, 4, 4, 4, 5, 5, 7, 9], 8)
    expect(out.at(-1)).toBeCloseTo(2, 6)
  })
})

describe('RSI', () => {
  it('returns 100 for a strictly increasing series (no losses)', () => {
    const closes = Array.from({ length: 20 }, (_, i) => i + 1)
    const out = relativeStrengthIndex(closes, 14)
    expect(out.at(-1)).toBeCloseTo(100)
  })

  it('returns ~0 for a strictly decreasing series (no gains)', () => {
    const closes = Array.from({ length: 20 }, (_, i) => 100 - i)
    const out = relativeStrengthIndex(closes, 14)
    expect(out.at(-1)!).toBeLessThan(1)
  })
})

describe('MACD', () => {
  it('is ~0 for a constant series', () => {
    const closes = new Array(60).fill(100)
    const { macd: line, histogram } = macd(closes, 12, 26, 9)
    expect(line.at(-1)).toBeCloseTo(0)
    expect(histogram.at(-1)).toBeCloseTo(0)
  })
})

describe('ATR', () => {
  it('is positive and finite once seeded', () => {
    const n = 30
    const high = Array.from({ length: n }, (_, i) => 100 + i + 1)
    const low = Array.from({ length: n }, (_, i) => 100 + i - 1)
    const close = Array.from({ length: n }, (_, i) => 100 + i)
    const out = averageTrueRange(high, low, close, 14)
    expect(out.at(-1)!).toBeGreaterThan(0)
    expect(Number.isFinite(out.at(-1)!)).toBe(true)
  })
})

describe('VWAP session reset', () => {
  // 2024-01-01 00:00 UTC. Two days of hourly candles crossing one midnight.
  const midnightUtc = 1704067200
  const candles: Candle[] = []
  for (let i = 0; i < 48; i++) {
    const t = midnightUtc + 12 * 3600 + i * 3600 // start midday so day 1 has bars
    const base = 100 + i
    candles.push({ time: t, open: base, high: base + 1, low: base - 1, close: base, volume: 10 })
  }
  // Index where the UTC day flips (first bar of day 2).
  const resetIdx = candles.findIndex(
    (c, i) => i > 0 && Math.floor(c.time / 86400) !== Math.floor(candles[i - 1]!.time / 86400),
  )

  it('breaks the line (whitespace) at the midnight reset so no vertical connector is drawn', () => {
    const { plots } = vwapIndicator.compute(candles)
    const data = plots[0]!.data
    expect(resetIdx).toBeGreaterThan(0)
    expect(Number.isFinite(data[resetIdx]!.value)).toBe(false) // gap at session open
    expect(Number.isFinite(data[0]!.value)).toBe(true) // no leading gap
    expect(Number.isFinite(data[resetIdx + 1]!.value)).toBe(true) // resumes next bar
  })

  it('restarts the average each session (post-reset VWAP tracks the new day, not day 1)', () => {
    const { plots } = vwapIndicator.compute(candles)
    const data = plots[0]!.data
    const postReset = data[resetIdx + 1]!.value // includes the reset bar's volume
    const day2Close = candles[resetIdx + 1]!.close
    // Fresh session: VWAP sits within a couple bars of the new day's price,
    // not dragged down by day 1's lower prices.
    expect(Math.abs(postReset - day2Close)).toBeLessThan(5)
  })

  it('bands also break at the reset', () => {
    const { plots } = vwapBandsIndicator.compute(candles)
    for (const plot of plots) {
      expect(Number.isFinite(plot.data[resetIdx]!.value)).toBe(false)
      expect(Number.isFinite(plot.data[0]!.value)).toBe(true)
    }
  })
})

describe('market sessions', () => {
  // 2024-01-01 00:00 UTC = 1704067200
  const midnightUtc = 1704067200

  it('computes UTC hour correctly', () => {
    expect(utcHour(midnightUtc)).toBeCloseTo(0)
    expect(utcHour(midnightUtc + 14 * 3600)).toBeCloseTo(14)
  })

  it('New York session is open at 14:00 UTC, closed at 23:00 UTC', () => {
    const ny = SESSIONS.find((s) => s.id === 'newyork')!
    expect(isOpenAt(ny, midnightUtc + 14 * 3600)).toBe(true)
    expect(isOpenAt(ny, midnightUtc + 23 * 3600)).toBe(false)
  })

  it('sessionStatuses returns one entry per defined session', () => {
    const statuses = sessionStatuses(midnightUtc + 14 * 3600)
    expect(statuses).toHaveLength(SESSIONS.length)
    expect(statuses.find((s) => s.session.id === 'newyork')!.open).toBe(true)
  })

  it('groups contiguous in-session candles into segments', () => {
    // Build 5-min candles spanning 13:00–15:00 UTC (NY open from 13:00).
    const candles: Candle[] = []
    for (let i = 0; i < 24; i++) {
      const t = midnightUtc + 13 * 3600 + i * 300
      candles.push({ time: t, open: 1, high: 1, low: 1, close: 1, volume: 1 })
    }
    const segments = computeSessionSegments(candles)
    const nySeg = segments.filter((s) => s.session.id === 'newyork')
    expect(nySeg.length).toBe(1)
    expect(nySeg[0]!.start).toBe(candles[0]!.time)
  })
})
