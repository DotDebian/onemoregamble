import { simpleMovingAverage } from '../math'
import { lastFinite, type IndicatorDefinition, type SnapshotItem } from '../types'
import { formatPrice } from '~/utils/format'

const PERIOD = 200
const COLOR = '#e11d48'

export const smaIndicator: IndicatorDefinition = {
  id: 'sma',
  name: 'SMA',
  category: 'overlay',
  pane: 'price',
  defaultEnabled: false,
  describe: () => String(PERIOD),
  compute(candles) {
    const sma = simpleMovingAverage(candles.map((c) => c.close), PERIOD)
    return {
      plots: [
        {
          key: `sma${PERIOD}`,
          label: `SMA ${PERIOD}`,
          kind: 'line',
          color: COLOR,
          lineWidth: 2,
          priceLineVisible: false,
          data: candles.map((c, i) => ({ time: c.time, value: sma[i]! })),
        },
      ],
    }
  },
  snapshot(candles, result) {
    const close = candles.at(-1)?.close
    const last = lastFinite(result.plots[0]!)
    const tone =
      last && close != null ? (close >= last.value ? 'up' : 'down') : 'neutral'
    const item: SnapshotItem = { label: `SMA ${PERIOD}`, value: formatPrice(last?.value), tone }
    return [item]
  },
}
