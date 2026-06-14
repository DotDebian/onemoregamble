// Shared numerical primitives for the shape-matching features (Echoes, Sketch
// search). Pure and framework-free — no charting-library import — so they
// unit-test cleanly and run identically on the server or in the browser.

/** Arithmetic mean (0 for an empty array). */
export function mean(xs: number[]): number {
  if (!xs.length) return 0
  let s = 0
  for (const x of xs) s += x
  return s / xs.length
}

/** Population standard deviation (0 for empty or constant series). */
export function stdDev(xs: number[]): number {
  const n = xs.length
  if (n === 0) return 0
  const m = mean(xs)
  let v = 0
  for (const x of xs) v += (x - m) * (x - m)
  return Math.sqrt(v / n)
}

/**
 * Z-normalise: subtract the mean, divide by the standard deviation. This is the
 * trick that makes shape matching *level- and scale-invariant* — a $63K BTC
 * swing and a $10K one collapse onto the same normalised curve, so they can
 * match on shape alone. A flat series (std 0) normalises to all-zeros.
 */
export function zNormalize(xs: number[]): number[] {
  const m = mean(xs)
  const sd = stdDev(xs)
  if (sd === 0) return xs.map(() => 0)
  return xs.map((x) => (x - m) / sd)
}

/**
 * Pearson correlation between two equal-length series, in [-1, 1]. Returns 0
 * when either series is flat (correlation undefined) or the lengths differ.
 * Pearson is itself shift- and positive-scale-invariant, so correlating raw
 * windows already ignores price level; z-normalising first is still useful when
 * a caller wants the normalised vectors for other purposes (e.g. distance).
 */
export function pearson(a: number[], b: number[]): number {
  const n = a.length
  if (n === 0 || n !== b.length) return 0
  const ma = mean(a)
  const mb = mean(b)
  let num = 0
  let da = 0
  let db = 0
  for (let i = 0; i < n; i++) {
    const xa = a[i]! - ma
    const xb = b[i]! - mb
    num += xa * xb
    da += xa * xa
    db += xb * xb
  }
  const den = Math.sqrt(da * db)
  return den === 0 ? 0 : num / den
}

/**
 * Resample a series to exactly `n` points by linear interpolation. Used to
 * compare a hand-drawn sketch (arbitrary number of captured points) against
 * fixed-length historical windows, and to compare windows of differing length.
 * Endpoints are always preserved.
 */
export function resample(xs: number[], n: number): number[] {
  if (n <= 0) return []
  if (xs.length === 0) return new Array<number>(n).fill(0)
  if (xs.length === 1) return new Array<number>(n).fill(xs[0]!)
  if (n === 1) return [xs[xs.length - 1]!]
  const out = new Array<number>(n)
  const step = (xs.length - 1) / (n - 1)
  for (let i = 0; i < n; i++) {
    const pos = i * step
    const lo = Math.floor(pos)
    const hi = Math.min(lo + 1, xs.length - 1)
    const frac = pos - lo
    out[i] = xs[lo]! * (1 - frac) + xs[hi]! * frac
  }
  return out
}

/** Median of a numeric array (NaN for empty). Does not mutate the input. */
export function median(xs: number[]): number {
  const n = xs.length
  if (n === 0) return NaN
  const s = xs.slice().sort((a, b) => a - b)
  const mid = n >> 1
  return n % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2
}
