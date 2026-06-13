import type { Candle, Time } from '~/types/market'

export type PlotKind = 'line' | 'histogram'

export interface PlotPoint {
  time: Time
  value: number
  /** Optional per-bar color (histograms). */
  color?: string
}

export interface IndicatorPlot {
  key: string
  label: string
  kind: PlotKind
  color: string
  lineWidth?: number
  /** Drop the price axis label for noisy overlays. */
  priceLineVisible?: boolean
  data: PlotPoint[]
}

/** Where the indicator draws: over the candles, or in its own stacked pane. */
export type PaneTarget = 'price' | 'separate'

export type SnapshotTone = 'up' | 'down' | 'neutral' | 'warn' | 'info'

export interface SnapshotItem {
  label: string
  value: string
  tone?: SnapshotTone
}

export type IndicatorCategory = 'overlay' | 'oscillator' | 'volume' | 'structure'

export type LineDash = 'solid' | 'dashed' | 'dotted'

/** A horizontal level drawn across the price pane (pivots, S/R, …). */
export interface IndicatorPriceLine {
  price: number
  color: string
  title: string
  dash?: LineDash
  lineWidth?: number
}

/** A marker placed on a candle (structure labels, signals, …). */
export interface IndicatorMarker {
  time: Time
  position: 'aboveBar' | 'belowBar' | 'inBar'
  color: string
  shape: 'circle' | 'square' | 'arrowUp' | 'arrowDown'
  text?: string
}

export interface IndicatorResult {
  plots: IndicatorPlot[]
  priceLines?: IndicatorPriceLine[]
  markers?: IndicatorMarker[]
}

export interface IndicatorDefinition {
  id: string
  name: string
  category: IndicatorCategory
  pane: PaneTarget
  /** Shown enabled on first load. */
  defaultEnabled: boolean
  /** Static description of the configured params (e.g. "9, 21, 50"). */
  describe?: () => string
  compute: (candles: Candle[]) => IndicatorResult
  /**
   * Recap values for the last candle. If omitted, the panel falls back to the
   * last finite value of every plot.
   */
  snapshot?: (candles: Candle[], result: IndicatorResult) => SnapshotItem[]
}

/** Last finite point of a plot (live candle may still be forming). */
export function lastFinite(plot: IndicatorPlot): PlotPoint | undefined {
  for (let i = plot.data.length - 1; i >= 0; i--) {
    const p = plot.data[i]!
    if (Number.isFinite(p.value)) return p
  }
  return undefined
}
