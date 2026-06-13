// Pure mathematical primitives shared by the indicator definitions.
// Each returns an array aligned 1:1 with the input (NaN where undefined),
// which makes them trivial to map onto chart series and to unit-test.

export function simpleMovingAverage(values: number[], period: number): number[] {
  const out = new Array<number>(values.length).fill(NaN)
  if (period <= 0) return out
  let sum = 0
  for (let i = 0; i < values.length; i++) {
    sum += values[i]!
    if (i >= period) sum -= values[i - period]!
    if (i >= period - 1) out[i] = sum / period
  }
  return out
}

export function exponentialMovingAverage(values: number[], period: number): number[] {
  const out = new Array<number>(values.length).fill(NaN)
  if (period <= 0 || values.length < period) return out
  const k = 2 / (period + 1)
  // Seed with the SMA of the first `period` values (standard convention).
  let seed = 0
  for (let i = 0; i < period; i++) seed += values[i]!
  let prev = seed / period
  out[period - 1] = prev
  for (let i = period; i < values.length; i++) {
    prev = values[i]! * k + prev * (1 - k)
    out[i] = prev
  }
  return out
}

/** Rolling population standard deviation over `period`. */
export function rollingStdDev(values: number[], period: number): number[] {
  const out = new Array<number>(values.length).fill(NaN)
  if (period <= 0) return out
  let sum = 0
  let sumSq = 0
  for (let i = 0; i < values.length; i++) {
    const v = values[i]!
    sum += v
    sumSq += v * v
    if (i >= period) {
      const old = values[i - period]!
      sum -= old
      sumSq -= old * old
    }
    if (i >= period - 1) {
      const mean = sum / period
      const variance = Math.max(0, sumSq / period - mean * mean)
      out[i] = Math.sqrt(variance)
    }
  }
  return out
}

/** Wilder's RSI. Returns values in 0..100, NaN until enough data. */
export function relativeStrengthIndex(closes: number[], period: number): number[] {
  const out = new Array<number>(closes.length).fill(NaN)
  if (closes.length <= period) return out
  let avgGain = 0
  let avgLoss = 0
  // Seed averages over the first `period` deltas.
  for (let i = 1; i <= period; i++) {
    const delta = closes[i]! - closes[i - 1]!
    if (delta >= 0) avgGain += delta
    else avgLoss -= delta
  }
  avgGain /= period
  avgLoss /= period
  out[period] = rsiFrom(avgGain, avgLoss)
  for (let i = period + 1; i < closes.length; i++) {
    const delta = closes[i]! - closes[i - 1]!
    const gain = delta > 0 ? delta : 0
    const loss = delta < 0 ? -delta : 0
    avgGain = (avgGain * (period - 1) + gain) / period
    avgLoss = (avgLoss * (period - 1) + loss) / period
    out[i] = rsiFrom(avgGain, avgLoss)
  }
  return out
}

function rsiFrom(avgGain: number, avgLoss: number): number {
  if (avgLoss === 0) return 100
  const rs = avgGain / avgLoss
  return 100 - 100 / (1 + rs)
}

export interface MacdResult {
  macd: number[]
  signal: number[]
  histogram: number[]
}

export function macd(
  closes: number[],
  fast: number,
  slow: number,
  signalPeriod: number,
): MacdResult {
  const emaFast = exponentialMovingAverage(closes, fast)
  const emaSlow = exponentialMovingAverage(closes, slow)
  const macdLine = closes.map((_, i) =>
    Number.isNaN(emaFast[i]!) || Number.isNaN(emaSlow[i]!) ? NaN : emaFast[i]! - emaSlow[i]!,
  )
  // Signal = EMA of the MACD line, computed only over its defined portion.
  const firstDefined = macdLine.findIndex((v) => !Number.isNaN(v))
  const signal = new Array<number>(closes.length).fill(NaN)
  if (firstDefined >= 0) {
    const slice = macdLine.slice(firstDefined)
    const sig = exponentialMovingAverage(slice, signalPeriod)
    for (let i = 0; i < sig.length; i++) signal[firstDefined + i] = sig[i]!
  }
  const histogram = macdLine.map((v, i) =>
    Number.isNaN(v) || Number.isNaN(signal[i]!) ? NaN : v - signal[i]!,
  )
  return { macd: macdLine, signal, histogram }
}

/** Wilder's ATR (Average True Range). */
export function averageTrueRange(
  high: number[],
  low: number[],
  close: number[],
  period: number,
): number[] {
  const n = close.length
  const out = new Array<number>(n).fill(NaN)
  if (n <= period) return out
  const tr = new Array<number>(n).fill(NaN)
  tr[0] = high[0]! - low[0]!
  for (let i = 1; i < n; i++) {
    tr[i] = Math.max(
      high[i]! - low[i]!,
      Math.abs(high[i]! - close[i - 1]!),
      Math.abs(low[i]! - close[i - 1]!),
    )
  }
  let atr = 0
  for (let i = 1; i <= period; i++) atr += tr[i]!
  atr /= period
  out[period] = atr
  for (let i = period + 1; i < n; i++) {
    atr = (atr * (period - 1) + tr[i]!) / period
    out[i] = atr
  }
  return out
}
