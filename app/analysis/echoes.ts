// "Echoes" core — given a price history, take the SHAPE of the most recent
// window and scan the past for windows whose shape correlates with it, then
// summarise what happened in the bars that FOLLOWED each historical match.
//
// The intuition: markets rhyme. If the current 48-bar setup looks like a setup
// that played out 30 times before, the distribution of what came next is a
// (weak, honest) prior on what might come next now. Because Pearson correlation
// is shift- and positive-scale-invariant, a $63K BTC setup matches a $10K one
// on shape alone — exactly what we want.
//
// Pure and framework-free (no charting-library import) so it unit-tests cleanly
// and runs identically on the server or in the browser.

import type { Candle } from '~/types/market'
import { median, pearson } from '~/analysis/correlate'

export interface EchoMatch {
  /** Index in `history` where the matched window ENDS (inclusive). */
  endIndex: number
  /** Correlation in [-1, 1] of the matched window vs the query window. */
  score: number
  /** Time (unix sec) of the last candle of the matched window. */
  time: number
  /**
   * Forward path after the match, length = horizon.
   * pathReturns[k] = history[end + 1 + k].close / history[end].close - 1.
   */
  pathReturns: number[]
}

export interface EchoStats {
  count: number
  /** Fraction of matches whose return AT the horizon is > 0, in [0, 1]. */
  fractionHigher: number
  /** Median forward return at the horizon (fraction, e.g. -0.0005). */
  medianReturn: number
  /** Mean forward return at the horizon. */
  meanReturn: number
  /** Percentiles of the forward return at the horizon across matches. */
  band: { p10: number; p50: number; p90: number }
}

export interface EchoesParams {
  /** Query length in bars. */
  window: number
  /** Forward bars to study after each match. */
  horizon: number
  /** Max matches kept (highest-scoring). */
  topK: number
  /** Correlation threshold; candidates below this are discarded. */
  minScore: number
}

export interface EchoesResult {
  matches: EchoMatch[]
  stats: EchoStats
  queryLength: number
  horizon: number
}

export const DEFAULT_ECHO_PARAMS: EchoesParams = {
  window: 48,
  horizon: 24,
  topK: 30,
  minScore: 0.7,
}

/** Zeroed stats, used for empty results. */
function emptyStats(): EchoStats {
  return {
    count: 0,
    fractionHigher: 0,
    medianReturn: 0,
    meanReturn: 0,
    band: { p10: 0, p50: 0, p90: 0 },
  }
}

/** Empty result preserving the requested geometry (W, H). */
function emptyResult(window: number, horizon: number): EchoesResult {
  return { matches: [], stats: emptyStats(), queryLength: window, horizon }
}

/**
 * Linear-interpolated percentile of a numeric sample, q in [0, 1]. Sorts a copy
 * (does not mutate). Uses the "C = 1" / numpy-default convention: position is
 * q * (n - 1), then we blend the two straddling order statistics. Returns 0 for
 * an empty sample so callers get a defined band even with no data.
 */
function percentile(xs: number[], q: number): number {
  const n = xs.length
  if (n === 0) return 0
  if (n === 1) return xs[0]!
  const s = xs.slice().sort((a, b) => a - b)
  const pos = q * (n - 1)
  const lo = Math.floor(pos)
  const hi = Math.min(lo + 1, n - 1)
  const frac = pos - lo
  return s[lo]! * (1 - frac) + s[hi]! * frac
}

/**
 * Find historical windows whose shape correlates with the most recent `window`
 * bars, and summarise the forward returns of those matches.
 *
 * No-lookahead is enforced structurally: a candidate window ending at index `e`
 * must (a) fit entirely inside the history, (b) have at least `horizon` real
 * bars AFTER it, and (c) not overlap the query window. The query itself is the
 * tail of the history and is never returned as a match.
 */
export function computeEchoes(history: Candle[], params?: Partial<EchoesParams>): EchoesResult {
  const { window: W, horizon: H, topK, minScore } = { ...DEFAULT_ECHO_PARAMS, ...params }
  const n = history.length

  // Geometry guard: need a full query window (W) plus at least one candidate
  // that has H real bars after it without overlapping the query. The tightest
  // case requires n >= W + H + 1.
  if (W <= 0 || H <= 0 || n < W + H + 1) return emptyResult(W, H)

  // Query = closes of the most recent window: history[n - W .. n - 1].
  const query = new Array<number>(W)
  for (let i = 0; i < W; i++) query[i] = history[n - W + i]!.close

  // Candidate end index `e` ranges over [W - 1, eMax]:
  //   (a) window [e - W + 1 .. e] inside history  -> e >= W - 1
  //   (b) H real bars after it (e + H <= n - 1)    -> e <= n - 1 - H
  //   (c) no overlap with the query (e < n - W)    -> e <= n - W - 1
  const eMax = Math.min(n - 1 - H, n - W - 1)
  if (eMax < W - 1) return emptyResult(W, H)

  // Score every eligible candidate against the query on shape (Pearson is
  // already level-invariant, so we correlate raw closes — no z-normalise needed).
  const cand = new Array<number>(W)
  const matches: EchoMatch[] = []
  for (let e = W - 1; e <= eMax; e++) {
    const start = e - W + 1
    for (let i = 0; i < W; i++) cand[i] = history[start + i]!.close
    const score = pearson(query, cand)
    if (!Number.isFinite(score) || score < minScore) continue

    const base = history[e]!.close
    const pathReturns = new Array<number>(H)
    for (let k = 0; k < H; k++) {
      pathReturns[k] = base === 0 ? 0 : history[e + 1 + k]!.close / base - 1
    }

    matches.push({ endIndex: e, score, time: history[e]!.time, pathReturns })
  }

  // Best shapes first, then keep at most topK.
  matches.sort((a, b) => b.score - a.score)
  const kept = topK > 0 ? matches.slice(0, topK) : matches

  if (kept.length === 0) return { matches: [], stats: emptyStats(), queryLength: W, horizon: H }

  // Stats are computed on the return AT the horizon (the last forward bar) of
  // each kept match.
  const horizonReturns = kept.map((m) => m.pathReturns[H - 1]!)
  const count = horizonReturns.length
  let higher = 0
  let sum = 0
  for (const r of horizonReturns) {
    if (r > 0) higher++
    sum += r
  }

  const stats: EchoStats = {
    count,
    fractionHigher: higher / count,
    medianReturn: median(horizonReturns),
    meanReturn: sum / count,
    band: {
      p10: percentile(horizonReturns, 0.1),
      p50: percentile(horizonReturns, 0.5),
      p90: percentile(horizonReturns, 0.9),
    },
  }

  return { matches: kept, stats, queryLength: W, horizon: H }
}
