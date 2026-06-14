import { describe, it, expect } from 'vitest'
import type { Candle } from '../app/types/market'
import { searchShape, DEFAULT_SHAPE_PARAMS } from '../app/analysis/shapeSearch'

const BASE = 1_700_000_000 // arbitrary unix-sec base for explicit timestamps
const DT = 300 // 5-minute bars

/** Build candles from a series of close values, with explicit timestamps. */
function candlesFromCloses(closes: number[]): Candle[] {
  return closes.map((c, i) => ({
    time: BASE + i * DT,
    open: c,
    high: c + 1,
    low: c - 1,
    close: c,
    volume: 100 + i,
  }))
}

/** Deterministic pseudo-random in [-1,1] so tests are reproducible. */
function noise(seed: number): number {
  const x = Math.sin(seed * 12.9898) * 43758.5453
  return (x - Math.floor(x)) * 2 - 1
}

/** A clean rising-then-falling hump of `n` points peaking at `amp` over `level`. */
function hump(n: number, level: number, amp: number): number[] {
  const out: number[] = []
  for (let i = 0; i < n; i++) {
    // sin over [0,pi] => 0 -> 1 -> 0, a smooth rise-and-fall.
    out.push(level + amp * Math.sin((Math.PI * i) / (n - 1)))
  }
  return out
}

/** A clean V (fall-then-rise) of `n` points. */
function vShape(n: number, level: number, depth: number): number[] {
  const out: number[] = []
  const mid = (n - 1) / 2
  for (let i = 0; i < n; i++) {
    // 0 at the ends, -1 at the middle => a valley.
    const t = 1 - Math.abs(i - mid) / mid
    out.push(level - depth * t)
  }
  return out
}

describe('searchShape', () => {
  it('1. finds a planted motif at its known location with high score', () => {
    // Flat-ish noisy baseline with a distinctive hump planted at [200, 259].
    const closes: number[] = []
    for (let i = 0; i < 600; i++) closes.push(100 + noise(i) * 0.5)
    const plantStart = 200
    const motif = hump(60, 100, 30)
    for (let i = 0; i < motif.length; i++) closes[plantStart + i] = motif[i]!
    const history = candlesFromCloses(closes)

    // Sketch is the same shape, different point count + amplitude/level.
    const sketch = hump(25, 5, 1)
    const matches = searchShape(history, sketch)

    expect(matches.length).toBeGreaterThan(0)
    const top = matches[0]!
    expect(top.score).toBeGreaterThan(0.9)

    // Top match's index range overlaps the planted location.
    const overlaps = top.startIndex <= plantStart + 59 && top.endIndex >= plantStart
    expect(overlaps).toBe(true)

    // Sorted by score descending.
    for (let i = 1; i < matches.length; i++) {
      expect(matches[i - 1]!.score).toBeGreaterThanOrEqual(matches[i]!.score)
    }

    // Reported timestamps come from the candles.
    expect(top.startTime).toBe(BASE + top.startIndex * DT)
    expect(top.endTime).toBe(BASE + top.endIndex * DT)

    // Preview shape is at the requested resolution.
    expect(top.shape.length).toBe(DEFAULT_SHAPE_PARAMS.resolution)
  })

  it('2. matches despite a sketch point count different from the window length (resample)', () => {
    const closes: number[] = []
    for (let i = 0; i < 400; i++) closes.push(50 + noise(i + 7) * 0.3)
    const plantStart = 120
    const motif = vShape(80, 50, 20) // 80-bar window
    for (let i = 0; i < motif.length; i++) closes[plantStart + i] = motif[i]!
    const history = candlesFromCloses(closes)

    // Sketch captured with only 13 points — far fewer than the 80-bar window.
    const sketch = vShape(13, 0, 3)
    const matches = searchShape(history, sketch)

    expect(matches.length).toBeGreaterThan(0)
    const top = matches[0]!
    expect(top.score).toBeGreaterThan(0.9)
    const overlaps = top.startIndex <= plantStart + 79 && top.endIndex >= plantStart
    expect(overlaps).toBe(true)
  })

  it('3. is invariant to absolute price level and scale', () => {
    // Motif sits near price 60000 (BTC-ish); sketch y-values sit near 0.4.
    const closes: number[] = []
    for (let i = 0; i < 500; i++) closes.push(60000 + noise(i + 3) * 50)
    const plantStart = 300
    const motif = hump(70, 60000, 4000)
    for (let i = 0; i < motif.length; i++) closes[plantStart + i] = motif[i]!
    const history = candlesFromCloses(closes)

    const sketch = hump(40, 0.4, 0.2) // totally different level + scale
    const matches = searchShape(history, sketch)

    expect(matches.length).toBeGreaterThan(0)
    const top = matches[0]!
    expect(top.score).toBeGreaterThan(0.9)
    const overlaps = top.startIndex <= plantStart + 69 && top.endIndex >= plantStart
    expect(overlaps).toBe(true)
  })

  it('4a. returns two distinct non-overlapping matches when a motif is planted twice', () => {
    const closes: number[] = []
    for (let i = 0; i < 800; i++) closes.push(200 + noise(i + 11) * 0.4)
    const motif = hump(60, 200, 25)
    const a = 100
    const b = 600 // far apart
    for (let i = 0; i < motif.length; i++) {
      closes[a + i] = motif[i]!
      closes[b + i] = motif[i]!
    }
    const history = candlesFromCloses(closes)

    const sketch = hump(30, 0, 1)
    const matches = searchShape(history, sketch)

    expect(matches.length).toBeGreaterThanOrEqual(2)
    const top2 = matches.slice(0, 2)
    // The two best matches must be non-overlapping (one near a, one near b).
    const [m0, m1] = [top2[0]!, top2[1]!]
    const overlap = Math.min(m0.endIndex, m1.endIndex) - Math.max(m0.startIndex, m1.startIndex)
    expect(overlap).toBeLessThan(0)

    // Each lands on a different planted region.
    const hitsA = (m: typeof m0) => m.startIndex <= a + 59 && m.endIndex >= a
    const hitsB = (m: typeof m0) => m.startIndex <= b + 59 && m.endIndex >= b
    expect((hitsA(m0) && hitsB(m1)) || (hitsB(m0) && hitsA(m1))).toBe(true)
  })

  it('4b. does not emit duplicate overlapping matches of essentially the same window', () => {
    const closes: number[] = []
    for (let i = 0; i < 400; i++) closes.push(10 + noise(i + 23) * 0.2)
    const plantStart = 150
    const motif = hump(60, 10, 4)
    for (let i = 0; i < motif.length; i++) closes[plantStart + i] = motif[i]!
    const history = candlesFromCloses(closes)

    const sketch = hump(35, 0, 1)
    const matches = searchShape(history, sketch)

    // Without de-overlap there would be a swarm of high-score windows around the
    // single planted motif. Every accepted pair must respect the 50%-of-shorter
    // overlap rule, so no two near-identical windows survive.
    for (let i = 0; i < matches.length; i++) {
      for (let j = i + 1; j < matches.length; j++) {
        const mi = matches[i]!
        const mj = matches[j]!
        const lo = Math.max(mi.startIndex, mj.startIndex)
        const hi = Math.min(mi.endIndex, mj.endIndex)
        const overlap = hi < lo ? 0 : hi - lo + 1
        const shorter = Math.min(mi.length, mj.length)
        expect(overlap).toBeLessThanOrEqual(0.5 * shorter)
      }
    }
  })

  it('5. returns [] for degenerate inputs without throwing', () => {
    const history = candlesFromCloses(hump(100, 10, 3))

    // Sketch too short.
    expect(searchShape(history, [])).toEqual([])
    expect(searchShape(history, [1])).toEqual([])

    // History too small for the smallest window.
    const tiny = candlesFromCloses([1, 2, 3])
    expect(searchShape(tiny, hump(20, 0, 1))).toEqual([])

    // Empty history.
    expect(searchShape([], hump(20, 0, 1))).toEqual([])
  })
})
