import type { ITimeScaleApi, Logical, Time } from 'lightweight-charts'

/**
 * Bar geometry needed to extrapolate time <-> screen-x *past the last candle*.
 *
 * lightweight-charts only knows real bars, so `timeToCoordinate` /
 * `coordinateToTime` both return null in the empty area to the right of the
 * live candle. To let the user draw there (an in-progress position, a trendline
 * projected forward), we fall back to *logical* coordinates — which the chart
 * happily extrapolates — and convert using a fixed bar interval.
 */
export interface TimeProjection {
  /** Seconds per bar (constant for a given timeframe). */
  interval: number
  /** Time of the last real bar. */
  lastTime: number
  /** Logical index of the last real bar (= candles.length - 1). */
  lastIndex: number
}

/** Time -> x, extrapolating into the future when the time has no real bar. */
export function projectTimeToX(
  ts: ITimeScaleApi<Time>,
  proj: TimeProjection | null,
  time: number,
): number | null {
  const x = ts.timeToCoordinate(time as Time)
  if (x != null) return x
  if (!proj || proj.interval <= 0 || time <= proj.lastTime) return null
  const logical = (proj.lastIndex + (time - proj.lastTime) / proj.interval) as Logical
  return ts.logicalToCoordinate(logical)
}

/** x -> time, extrapolating into the future when x is past the last bar. */
export function projectXToTime(
  ts: ITimeScaleApi<Time>,
  proj: TimeProjection | null,
  x: number,
): number | null {
  const t = ts.coordinateToTime(x)
  if (t != null) return Number(t)
  if (!proj || proj.interval <= 0) return null
  const logical = ts.coordinateToLogical(x)
  if (logical == null) return null
  return proj.lastTime + (Number(logical) - proj.lastIndex) * proj.interval
}
