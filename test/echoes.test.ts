import { describe, it, expect } from 'vitest'
import { computeEchoes, DEFAULT_ECHO_PARAMS } from '../app/analysis/echoes'
import type { Candle } from '../app/types/market'

const BASE_SEC = 1_700_000_000
const STEP = 300 // 5-minute bars

/** Build candles from a closes array; OHLC tracks close, volume is constant. */
function candlesFromCloses(closes: number[], baseSec = BASE_SEC): Candle[] {
  return closes.map((close, i) => ({
    time: baseSec + i * STEP,
    open: close,
    high: close,
    low: close,
    close,
    volume: 100,
  }))
}

/**
 * A distinctive zig-zag motif of length `len` around a given price `level`,
 * scaled by `amp`. The exact same relative shape regardless of level/amp, which
 * is what makes shape-matching pick it up.
 */
function motif(len: number, level: number, amp: number): number[] {
  const out = new Array<number>(len)
  for (let i = 0; i < len; i++) {
    // A few superimposed sines give a non-trivial, repeatable shape.
    const t = (i / (len - 1)) * Math.PI * 2
    const s = Math.sin(t) + 0.5 * Math.sin(2 * t) + 0.25 * Math.sin(3 * t)
    out[i] = level + amp * s
  }
  return out
}

describe('computeEchoes — repeated motif recovery', () => {
  it('finds past occurrences of a motif and recovers the consistent follow-through', () => {
    const W = 12
    const H = 6
    const closes: number[] = []

    // Filler between occurrences so windows do not trivially overlap.
    const filler = (level: number, n: number) =>
      Array.from({ length: n }, (_, i) => level + (i % 2 === 0 ? 0.3 : -0.3))

    // Plant several past occurrences, each followed by a KNOWN rise.
    for (let occ = 0; occ < 5; occ++) {
      const level = 100 + occ * 5 // drift the level to exercise invariance
      closes.push(...filler(level, 8))
      const m = motif(W, level, 4)
      closes.push(...m)
      // The follow-through: a clean rise over the next H bars from the motif's
      // last close.
      const last = m[m.length - 1]!
      for (let k = 1; k <= H; k++) closes.push(last * (1 + 0.01 * k))
      closes.push(...filler(level + 6, 6))
    }

    // The most recent window is the SAME motif shape (different level again).
    const queryMotif = motif(W, 130, 4)
    closes.push(...queryMotif)

    const history = candlesFromCloses(closes)
    // A high threshold so only the genuine motif occurrences survive (incidental
    // partial matches in the filler are correctly excluded).
    const res = computeEchoes(history, { window: W, horizon: H, topK: 30, minScore: 0.9 })

    expect(res.matches.length).toBeGreaterThan(0)
    for (const m of res.matches) {
      expect(m.score).toBeGreaterThan(0.9)
      expect(m.pathReturns).toHaveLength(H)
    }
    // It correctly recovers "what happened next": consistent rise.
    expect(res.stats.fractionHigher).toBeGreaterThan(0.7)
    expect(res.stats.medianReturn).toBeGreaterThan(0)
    expect(res.stats.meanReturn).toBeGreaterThan(0)
    expect(res.queryLength).toBe(W)
    expect(res.horizon).toBe(H)
  })
})

describe('computeEchoes — no lookahead', () => {
  it('never returns a match that overlaps the query or lacks a full horizon', () => {
    const W = 10
    const H = 5
    // Deterministic but varied series so several windows pass the threshold.
    const closes = Array.from({ length: 300 }, (_, i) => {
      const t = i / 7
      return 50 + 10 * Math.sin(t) + 3 * Math.sin(2.3 * t) + 0.5 * Math.sin(11 * t)
    })
    const history = candlesFromCloses(closes)
    const n = history.length
    const res = computeEchoes(history, { window: W, horizon: H, minScore: 0.5 })

    expect(res.matches.length).toBeGreaterThan(0)
    for (const m of res.matches) {
      // (b) full horizon of real bars after the match.
      expect(m.endIndex + H).toBeLessThanOrEqual(n - 1)
      // (c) no overlap with the query window [n - W .. n - 1].
      expect(m.endIndex).toBeLessThan(n - W)
      // (a) window fits inside history.
      expect(m.endIndex - W + 1).toBeGreaterThanOrEqual(0)
      // Forward returns are computed against the match's own last close.
      const base = history[m.endIndex]!.close
      for (let k = 0; k < H; k++) {
        const expected = history[m.endIndex + 1 + k]!.close / base - 1
        expect(m.pathReturns[k]!).toBeCloseTo(expected, 12)
      }
    }
  })
})

describe('computeEchoes — scale invariance', () => {
  it('matches the same shape at a 10x different price level with ~1.0 score', () => {
    const W = 12
    const H = 4

    const closes: number[] = []
    // One past occurrence at a VERY different absolute price (~10x lower).
    const lowLevel = motif(W, 13, 0.4)
    closes.push(...lowLevel)
    // Follow-through (irrelevant to the score, just needs to exist).
    const lowLast = lowLevel[lowLevel.length - 1]!
    for (let k = 1; k <= H; k++) closes.push(lowLast * (1 + 0.005 * k))
    // Some unrelated padding so the candidate set is not degenerate.
    closes.push(...Array.from({ length: 20 }, (_, i) => 15 + (i % 3)))
    // The current window: the same shape at ~10x the price.
    const highLevel = motif(W, 130, 4)
    closes.push(...highLevel)

    const history = candlesFromCloses(closes)
    const res = computeEchoes(history, { window: W, horizon: H, minScore: 0.7 })

    expect(res.matches.length).toBeGreaterThan(0)
    // The low-priced occurrence ends at index W - 1.
    const lowMatch = res.matches.find((m) => m.endIndex === W - 1)
    expect(lowMatch).toBeDefined()
    expect(lowMatch!.score).toBeGreaterThan(0.99)
  })
})

describe('computeEchoes — too-short history', () => {
  it('returns an empty result without throwing', () => {
    const W = DEFAULT_ECHO_PARAMS.window
    const H = DEFAULT_ECHO_PARAMS.horizon
    // Exactly one short of the W + H + 1 minimum.
    const history = candlesFromCloses(Array.from({ length: W + H }, (_, i) => 100 + i))
    const res = computeEchoes(history)

    expect(res.matches).toEqual([])
    expect(res.stats.count).toBe(0)
    expect(res.stats.fractionHigher).toBe(0)
    expect(res.stats.medianReturn).toBe(0)
    expect(res.stats.meanReturn).toBe(0)
    expect(res.stats.band).toEqual({ p10: 0, p50: 0, p90: 0 })
    expect(res.queryLength).toBe(W)
    expect(res.horizon).toBe(H)
  })

  it('handles an empty history', () => {
    expect(() => computeEchoes([])).not.toThrow()
    const res = computeEchoes([])
    expect(res.matches).toEqual([])
    expect(res.stats.count).toBe(0)
  })
})

describe('computeEchoes — minScore filtering', () => {
  it('a stricter threshold keeps no more matches than a lax one', () => {
    const W = 12
    const H = 5
    // Noisy series: many partial matches, few near-perfect ones.
    let seed = 42
    const rand = () => {
      // Deterministic LCG so the test is reproducible.
      seed = (seed * 1103515245 + 12345) & 0x7fffffff
      return seed / 0x7fffffff
    }
    const closes = Array.from({ length: 400 }, (_, i) => {
      const t = i / 9
      return 200 + 20 * Math.sin(t) + 12 * (rand() - 0.5)
    })
    const history = candlesFromCloses(closes)

    const lax = computeEchoes(history, { window: W, horizon: H, topK: 1000, minScore: 0.3 })
    const strict = computeEchoes(history, { window: W, horizon: H, topK: 1000, minScore: 0.99 })

    expect(strict.matches.length).toBeLessThanOrEqual(lax.matches.length)
    // The lax threshold should genuinely admit more in a noisy series.
    expect(lax.matches.length).toBeGreaterThan(strict.matches.length)
    // Every strict match must clear the strict bar.
    for (const m of strict.matches) expect(m.score).toBeGreaterThanOrEqual(0.99)
  })
})
