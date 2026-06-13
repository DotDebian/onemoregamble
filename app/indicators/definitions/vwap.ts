import { lastFinite, type IndicatorDefinition, type SnapshotItem } from '../types'
import { formatPrice } from '~/utils/format'

/** Session VWAP — cumulative, reset at each UTC midnight (intraday convention). */
export const vwapIndicator: IndicatorDefinition = {
  id: 'vwap',
  name: 'VWAP',
  category: 'overlay',
  pane: 'price',
  defaultEnabled: true,
  describe: () => 'daily reset',
  compute(candles) {
    let cumPV = 0
    let cumV = 0
    let currentDay = -1
    const data = candles.map((c) => {
      const day = Math.floor(c.time / 86400)
      if (day !== currentDay) {
        currentDay = day
        cumPV = 0
        cumV = 0
      }
      const typical = (c.high + c.low + c.close) / 3
      cumPV += typical * c.volume
      cumV += c.volume
      return { time: c.time, value: cumV > 0 ? cumPV / cumV : NaN }
    })
    return {
      plots: [
        {
          key: 'vwap',
          label: 'VWAP',
          kind: 'line',
          color: '#14b8a6',
          lineWidth: 2,
          priceLineVisible: true,
          data,
        },
      ],
    }
  },
  snapshot(candles, result) {
    const vwap = lastFinite(result.plots[0]!)?.value
    const close = candles.at(-1)?.close
    const tone: SnapshotItem['tone'] =
      vwap != null && close != null ? (close >= vwap ? 'up' : 'down') : 'neutral'
    return [{ label: 'VWAP', value: formatPrice(vwap), tone }]
  },
}
