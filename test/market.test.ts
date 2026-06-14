import { describe, it, expect } from 'vitest'
import { mergeCandlePages, klineToCandle } from '../app/types/market'
import type { Candle, BinanceKline } from '../app/types/market'

function candle(time: number, close = time): Candle {
  return { time, open: close, high: close, low: close, close, volume: 1 }
}

describe('mergeCandlePages', () => {
  it('orders ascending and de-duplicates the shared boundary bar', () => {
    // Two pages that overlap on time=300 (the boundary bar pagination repeats).
    const older = [candle(100), candle(200), candle(300)]
    const newer = [candle(300), candle(400), candle(500)]
    const out = mergeCandlePages([newer, older]) // pages out of order on purpose
    expect(out.map((c) => c.time)).toEqual([100, 200, 300, 400, 500])
  })

  it('keeps only the most recent `cap` candles', () => {
    const page = Array.from({ length: 10 }, (_, i) => candle((i + 1) * 100))
    const out = mergeCandlePages([page], 3)
    expect(out.map((c) => c.time)).toEqual([800, 900, 1000])
  })

  it('later pages win on a tie', () => {
    const a = [{ ...candle(100), close: 1 }]
    const b = [{ ...candle(100), close: 2 }]
    expect(mergeCandlePages([a, b])[0]!.close).toBe(2)
  })

  it('handles empty input', () => {
    expect(mergeCandlePages([])).toEqual([])
    expect(mergeCandlePages([[], []])).toEqual([])
  })
})

describe('klineToCandle', () => {
  it('converts ms open time to unix seconds and parses OHLCV', () => {
    const k: BinanceKline = [1_700_000_000_000, '10', '12', '9', '11', '123.4', 1_700_000_299_999]
    const c = klineToCandle(k)
    expect(c.time).toBe(1_700_000_000)
    expect(c).toMatchObject({ open: 10, high: 12, low: 9, close: 11, volume: 123.4 })
  })
})
