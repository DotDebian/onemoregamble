import { describe, it, expect } from 'vitest'
import {
  pivotPoints,
  findSwings,
  clusterLevels,
  volumeProfile,
  marketStructure,
} from '../app/indicators/structure'
import { computeRisk } from '../app/utils/risk'
import {
  estimateLiquidationHeatmap,
  hottestCluster,
  aggregateLiquidations,
  hottestRealCluster,
} from '../app/indicators/liquidations'
import type { Candle } from '../app/types/market'

function candle(t: number, o: number, h: number, l: number, c: number, v = 1): Candle {
  return { time: t, open: o, high: h, low: l, close: c, volume: v }
}

describe('pivot points', () => {
  it('computes classic pivots from H/L/C', () => {
    const p = pivotPoints(110, 90, 100)
    expect(p.pp).toBeCloseTo(100)
    expect(p.r1).toBeCloseTo(110)
    expect(p.s1).toBeCloseTo(90)
    expect(p.r2).toBeCloseTo(120)
    expect(p.s2).toBeCloseTo(80)
  })
})

describe('swings + S/R clustering', () => {
  it('detects an obvious swing high and low', () => {
    // a clean peak at index 5 and trough at index 11
    const prices = [10, 11, 12, 13, 14, 20, 14, 13, 12, 11, 10, 4, 10, 11, 12, 13, 14]
    const candles = prices.map((p, i) => candle(i * 300, p, p + 0.2, p - 0.2, p))
    const swings = findSwings(candles, 3, 3)
    expect(swings.some((s) => s.type === 'high' && s.index === 5)).toBe(true)
    expect(swings.some((s) => s.type === 'low' && s.index === 11)).toBe(true)
  })

  it('clusters nearby swing prices into one level', () => {
    const swings = [
      { index: 0, time: 0, price: 100.0, type: 'high' as const },
      { index: 1, time: 1, price: 100.2, type: 'high' as const },
      { index: 2, time: 2, price: 100.1, type: 'high' as const },
      { index: 3, time: 3, price: 90.0, type: 'low' as const },
    ]
    const levels = clusterLevels(swings, 0.01)
    const strong = levels[0]!
    expect(strong.touches).toBe(3)
    expect(strong.price).toBeCloseTo(100.1, 1)
  })
})

describe('market structure', () => {
  it('flags an uptrend from HH/HL sequence', () => {
    const swings = [
      { index: 0, time: 0, price: 100, type: 'low' as const },
      { index: 1, time: 1, price: 110, type: 'high' as const },
      { index: 2, time: 2, price: 105, type: 'low' as const },
      { index: 3, time: 3, price: 120, type: 'high' as const },
    ]
    const { trend, points } = marketStructure(swings)
    expect(points.at(-1)!.label).toBe('HH')
    expect(trend).toBe('up')
  })
})

describe('volume profile', () => {
  it('finds the POC where most volume traded', () => {
    const candles = [
      candle(0, 100, 101, 99, 100, 1),
      candle(300, 100, 101, 99, 100, 1),
      candle(600, 105, 106, 104, 105, 50), // heavy volume around 105
      candle(900, 100, 101, 99, 100, 1),
    ]
    const vp = volumeProfile(candles, 20)!
    expect(vp).not.toBeNull()
    expect(vp.poc).toBeGreaterThan(104)
    expect(vp.poc).toBeLessThan(106)
    expect(vp.val).toBeLessThan(vp.vah)
  })
})

describe('risk / position sizing', () => {
  it('sizes a long so the stop equals the risk budget', () => {
    const r = computeRisk({ accountSize: 10000, riskPct: 1, entry: 100, stop: 95, target: 115 })
    expect(r.valid).toBe(true)
    expect(r.direction).toBe('long')
    expect(r.riskAmount).toBeCloseTo(100)
    expect(r.quantity).toBeCloseTo(20) // 100 risk / 5 per-unit
    expect(r.rr).toBeCloseTo(3) // (115-100)/(100-95)
  })

  it('is invalid when entry equals stop', () => {
    const r = computeRisk({ accountSize: 10000, riskPct: 1, entry: 100, stop: 100 })
    expect(r.valid).toBe(false)
  })
})

describe('liquidation heatmap', () => {
  it('returns null below the minimum sample size', () => {
    expect(estimateLiquidationHeatmap([candle(0, 100, 100, 100, 100)], 20)).toBeNull()
  })

  it('places long-liq clusters below price and short-liq above', () => {
    const candles = Array.from({ length: 10 }, (_, i) =>
      candle(i * 300, 100, 100.5, 99.5, 100, 1000),
    )
    const hm = estimateLiquidationHeatmap(candles, 60)!
    expect(hm).not.toBeNull()
    expect(hm.max).toBeGreaterThan(0)
    const longBelow = hm.buckets
      .filter((b) => b.mid < 100)
      .reduce((s, b) => s + b.longMag, 0)
    const longAbove = hm.buckets
      .filter((b) => b.mid > 100)
      .reduce((s, b) => s + b.longMag, 0)
    const shortAbove = hm.buckets
      .filter((b) => b.mid > 100)
      .reduce((s, b) => s + b.shortMag, 0)
    expect(longBelow).toBeGreaterThan(0)
    expect(shortAbove).toBeGreaterThan(0)
    expect(longAbove).toBeCloseTo(0) // longs never liquidate above entry
  })

  it('is roughly symmetric for a symmetric price series', () => {
    const candles = Array.from({ length: 10 }, (_, i) =>
      candle(i * 300, 100, 100.5, 99.5, 100, 1000),
    )
    const hm = estimateLiquidationHeatmap(candles, 60)!
    const totalLong = hm.buckets.reduce((s, b) => s + b.longMag, 0)
    const totalShort = hm.buckets.reduce((s, b) => s + b.shortMag, 0)
    expect(totalLong).toBeCloseTo(totalShort, 5)
    expect(hottestCluster(hm)).not.toBeNull()
  })

  it('aggregates real liquidations into the right price buckets', () => {
    const events = [
      { time: 1, price: 90, usd: 50000, side: 'long' as const },
      { time: 2, price: 90.2, usd: 30000, side: 'long' as const },
      { time: 3, price: 110, usd: 20000, side: 'short' as const },
    ]
    const prof = aggregateLiquidations(events, 80, 120, 40)!
    expect(prof).not.toBeNull()
    const longBucket = prof.buckets.find((b) => b.low <= 90 && 90 < b.high)!
    const shortBucket = prof.buckets.find((b) => b.low <= 110 && 110 < b.high)!
    expect(longBucket.long).toBeGreaterThan(0)
    expect(shortBucket.short).toBeGreaterThan(0)
    const hot = hottestRealCluster(prof)!
    expect(hot.side).toBe('long') // 80k long cluster > 20k short
    expect(hot.price).toBeGreaterThan(88)
    expect(hot.price).toBeLessThan(92)
  })

  it('returns null aggregation with no events', () => {
    expect(aggregateLiquidations([], 80, 120, 40)).toBeNull()
  })
})
