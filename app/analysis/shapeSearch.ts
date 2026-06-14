// Sketch search — the core of the "draw a shape, find where price did that"
// feature. Given a hand-drawn curve (an arbitrary series of y-values) and a
// candle history, we slide windows of several lengths across history, resample
// both the sketch and each window to a common resolution, z-normalise, and rank
// windows by Pearson correlation against the sketch.
//
// Everything here is pure and framework-free (no charting-library import) so it
// unit-tests cleanly and runs identically on the server or in the browser. The
// numeric primitives live in `~/analysis/correlate` and are reused verbatim:
// z-normalisation + Pearson gives us level- and scale-invariant shape matching,
// and `resample` lets a sketch of any point count compare to windows of any bar
// length.

import type { Candle } from '~/types/market'
import { pearson, resample, zNormalize } from '~/analysis/correlate'

export interface ShapeMatch {
  startIndex: number
  endIndex: number          // inclusive
  length: number            // endIndex - startIndex + 1
  score: number             // correlation in [-1,1] vs the sketch
  startTime: number         // unix sec of first candle
  endTime: number           // unix sec of last candle
  shape: number[]           // the window's closes, resampled to `resolution` and z-normalised (for preview rendering)
}

export interface ShapeSearchParams {
  resolution: number   // points to resample both sketch and windows to
  minLength: number    // min window length in bars
  maxLength: number    // max window length in bars
  lengthSteps: number  // how many distinct window lengths to try across [minLength,maxLength]
  topK: number
  minScore: number
  stride: number       // step between window start indices (perf knob)
}

export const DEFAULT_SHAPE_PARAMS: ShapeSearchParams = {
  resolution: 64,
  minLength: 20,
  maxLength: 200,
  lengthSteps: 8,
  topK: 12,
  minScore: 0.6,
  stride: 2,
}

// `sketch` is the raw sequence of drawn y-values (any length >= 2). Higher y can
// be up or down depending on screen coords; the CALLER is responsible for
// flipping so that higher value = higher price before calling. This function
// treats sketch as a price-like curve directly.
export function searchShape(
  history: Candle[],
  sketch: number[],
  params?: Partial<ShapeSearchParams>,
): ShapeMatch[] {
  const p = { ...DEFAULT_SHAPE_PARAMS, ...params }

  // Degenerate guards: nothing to draw or not enough history to host even the
  // smallest window. Returning [] keeps callers branch-free.
  if (sketch.length < 2) return []
  if (history.length < p.minLength) return []

  // The query is the sketch reduced to the comparison space: resample to the
  // fixed resolution, then z-normalise so only its *shape* survives.
  const query = zNormalize(resample(sketch, p.resolution))

  // Candidate window lengths: `lengthSteps` values evenly spaced from minLength
  // to min(maxLength, history.length). We round to whole bars and de-duplicate,
  // since rounding (and small spans) can collapse several steps onto the same L.
  const lengths = candidateLengths(
    p.minLength,
    Math.min(p.maxLength, history.length),
    p.lengthSteps,
  )

  const stride = Math.max(1, Math.floor(p.stride))

  // Collect every passing window across all lengths, then de-overlap globally so
  // the same motif at a single location doesn't crowd out distinct matches.
  const candidates: ShapeMatch[] = []
  for (const L of lengths) {
    if (L < 2 || L > history.length) continue
    for (let s = 0; s + L <= history.length; s += stride) {
      const closes = new Array<number>(L)
      for (let i = 0; i < L; i++) closes[i] = history[s + i]!.close
      const cand = zNormalize(resample(closes, p.resolution))
      const score = pearson(query, cand)
      if (score < p.minScore) continue
      candidates.push({
        startIndex: s,
        endIndex: s + L - 1,
        length: L,
        score,
        startTime: history[s]!.time,
        endTime: history[s + L - 1]!.time,
        shape: cand,
      })
    }
  }

  // Greedy non-maximum suppression: take the best score first, then accept a
  // weaker candidate only if it overlaps every already-accepted match by no more
  // than half of the shorter of the two windows. This yields distinct regions
  // (the same motif planted twice survives) while collapsing the cluster of
  // near-identical windows that surround any single good match.
  candidates.sort((a, b) => b.score - a.score)
  const accepted: ShapeMatch[] = []
  for (const c of candidates) {
    if (accepted.length >= p.topK) break
    let ok = true
    for (const a of accepted) {
      const overlap = overlapBars(a.startIndex, a.endIndex, c.startIndex, c.endIndex)
      const shorter = Math.min(a.length, c.length)
      if (overlap > 0.5 * shorter) {
        ok = false
        break
      }
    }
    if (ok) accepted.push(c)
  }

  return accepted
}

/**
 * Evenly spaced, rounded, de-duplicated window lengths over [lo, hi] inclusive.
 * `steps` is the desired count; the result preserves both endpoints and is
 * ascending. Degenerate spans (lo >= hi, steps <= 1) collapse to a single value.
 */
function candidateLengths(lo: number, hi: number, steps: number): number[] {
  if (hi < lo) return []
  if (steps <= 1 || hi === lo) return [lo]
  const seen = new Set<number>()
  const out: number[] = []
  for (let i = 0; i < steps; i++) {
    const L = Math.round(lo + ((hi - lo) * i) / (steps - 1))
    if (!seen.has(L)) {
      seen.add(L)
      out.push(L)
    }
  }
  return out
}

/**
 * Number of overlapping bars between two inclusive index ranges (0 if disjoint).
 */
function overlapBars(aStart: number, aEnd: number, bStart: number, bEnd: number): number {
  const lo = Math.max(aStart, bStart)
  const hi = Math.min(aEnd, bEnd)
  return hi < lo ? 0 : hi - lo + 1
}
