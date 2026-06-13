import type { IndicatorDefinition } from './types'
import { emaIndicator } from './definitions/ema'
import { smaIndicator } from './definitions/sma'
import { bollingerIndicator } from './definitions/bollinger'
import { vwapIndicator } from './definitions/vwap'
import { vwapBandsIndicator } from './definitions/vwapBands'
import { rsiIndicator } from './definitions/rsi'
import { macdIndicator } from './definitions/macd'
import { atrIndicator } from './definitions/atr'
import { volumeIndicator } from './definitions/volume'
import { pivotsIndicator } from './definitions/pivots'
import { autoSrIndicator } from './definitions/autosr'
import { structureIndicator } from './definitions/structure'

// The registry. Adding a new indicator = drop a file in ./definitions and add
// it here. Order controls how it stacks in the panel and the pane layout.
export const INDICATORS: IndicatorDefinition[] = [
  emaIndicator,
  smaIndicator,
  bollingerIndicator,
  vwapIndicator,
  vwapBandsIndicator,
  pivotsIndicator,
  autoSrIndicator,
  structureIndicator,
  rsiIndicator,
  macdIndicator,
  atrIndicator,
  volumeIndicator,
]

export const INDICATOR_MAP: Record<string, IndicatorDefinition> = Object.fromEntries(
  INDICATORS.map((i) => [i.id, i]),
)

/**
 * Overlays drawn directly by the chart (their own primitive), not by the
 * generic series model — but still toggleable from the same selector.
 */
export interface SpecialOverlay {
  id: string
  name: string
  defaultEnabled: boolean
}
export const SPECIAL_OVERLAYS: SpecialOverlay[] = [
  { id: 'sessions', name: 'Sessions de marché', defaultEnabled: true },
  { id: 'volumeProfile', name: 'Volume Profile', defaultEnabled: false },
  { id: 'liquidations', name: 'Liquidations (heatmap)', defaultEnabled: false },
]

export function defaultEnabledIds(): string[] {
  return [
    ...INDICATORS.filter((i) => i.defaultEnabled).map((i) => i.id),
    ...SPECIAL_OVERLAYS.filter((o) => o.defaultEnabled).map((o) => o.id),
  ]
}

export * from './types'
export * from './sessions'
export * from './structure'
