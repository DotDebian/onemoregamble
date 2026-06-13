import { exponentialMovingAverage } from '../math'
import { lastFinite, type IndicatorDefinition, type IndicatorPlot, type SnapshotItem } from '../types'
import { formatPrice } from '~/utils/format'

const PERIODS = [
  { period: 9, color: '#f5a524' },
  { period: 21, color: '#3b82f6' },
  { period: 50, color: '#a855f7' },
]

export const emaIndicator: IndicatorDefinition = {
  id: 'ema',
  name: 'EMA',
  category: 'overlay',
  pane: 'price',
  defaultEnabled: true,
  describe: () => PERIODS.map((p) => p.period).join(' · '),
  compute(candles) {
    const closes = candles.map((c) => c.close)
    const plots: IndicatorPlot[] = PERIODS.map(({ period, color }) => {
      const ema = exponentialMovingAverage(closes, period)
      return {
        key: `ema${period}`,
        label: `EMA ${period}`,
        kind: 'line',
        color,
        lineWidth: 2,
        priceLineVisible: false,
        data: candles.map((c, i) => ({ time: c.time, value: ema[i]! })),
      }
    })
    return { plots }
  },
  snapshot(candles, result) {
    const close = candles.at(-1)?.close
    return result.plots.map((plot): SnapshotItem => {
      const last = lastFinite(plot)
      const tone =
        last && close != null ? (close >= last.value ? 'up' : 'down') : 'neutral'
      return { label: plot.label, value: formatPrice(last?.value), tone }
    })
  },
}
