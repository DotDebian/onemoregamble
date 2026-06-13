import { averageTrueRange } from '../math'
import { lastFinite, type IndicatorDefinition, type SnapshotItem } from '../types'
import { formatPrice } from '~/utils/format'

const PERIOD = 14

export const atrIndicator: IndicatorDefinition = {
  id: 'atr',
  name: 'ATR',
  category: 'oscillator',
  pane: 'separate',
  defaultEnabled: false,
  describe: () => String(PERIOD),
  compute(candles) {
    const atr = averageTrueRange(
      candles.map((c) => c.high),
      candles.map((c) => c.low),
      candles.map((c) => c.close),
      PERIOD,
    )
    return {
      plots: [
        {
          key: 'atr',
          label: `ATR ${PERIOD}`,
          kind: 'line',
          color: '#fb7185',
          lineWidth: 2,
          data: candles.map((c, i) => ({ time: c.time, value: atr[i]! })),
        },
      ],
    }
  },
  snapshot(candles, result) {
    const atr = lastFinite(result.plots[0]!)?.value
    const close = candles.at(-1)?.close
    // ATR as a % of price — a readable volatility gauge.
    const pct = atr != null && close ? (atr / close) * 100 : undefined
    const item: SnapshotItem = {
      label: `ATR ${PERIOD}`,
      value: `${formatPrice(atr)}${pct != null ? ` (${pct.toFixed(2)}%)` : ''}`,
      tone: 'info',
    }
    return [item]
  },
}
