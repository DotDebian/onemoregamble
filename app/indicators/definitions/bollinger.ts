import { simpleMovingAverage, rollingStdDev } from '../math'
import { lastFinite, type IndicatorDefinition, type SnapshotItem } from '../types'
import { formatPrice } from '~/utils/format'

const PERIOD = 20
const MULT = 2

export const bollingerIndicator: IndicatorDefinition = {
  id: 'bollinger',
  name: 'Bollinger Bands',
  category: 'overlay',
  pane: 'price',
  defaultEnabled: true,
  describe: () => `${PERIOD}, ${MULT}σ`,
  compute(candles) {
    const closes = candles.map((c) => c.close)
    const basis = simpleMovingAverage(closes, PERIOD)
    const dev = rollingStdDev(closes, PERIOD)
    const band = '#94a3b8'
    return {
      plots: [
        {
          key: 'bbUpper',
          label: 'BB Upper',
          kind: 'line',
          color: band,
          lineWidth: 1,
          priceLineVisible: false,
          data: candles.map((c, i) => ({ time: c.time, value: basis[i]! + MULT * dev[i]! })),
        },
        {
          key: 'bbBasis',
          label: 'BB Basis',
          kind: 'line',
          color: '#64748b',
          lineWidth: 1,
          priceLineVisible: false,
          data: candles.map((c, i) => ({ time: c.time, value: basis[i]! })),
        },
        {
          key: 'bbLower',
          label: 'BB Lower',
          kind: 'line',
          color: band,
          lineWidth: 1,
          priceLineVisible: false,
          data: candles.map((c, i) => ({ time: c.time, value: basis[i]! - MULT * dev[i]! })),
        },
      ],
    }
  },
  snapshot(candles, result) {
    const upper = lastFinite(result.plots[0]!)?.value
    const basis = lastFinite(result.plots[1]!)?.value
    const lower = lastFinite(result.plots[2]!)?.value
    const close = candles.at(-1)?.close
    // %B: where price sits inside the band (0 = lower, 1 = upper).
    let pctB: number | undefined
    let tone: SnapshotItem['tone'] = 'neutral'
    if (upper != null && lower != null && close != null && upper !== lower) {
      pctB = (close - lower) / (upper - lower)
      if (pctB >= 1) tone = 'warn'
      else if (pctB <= 0) tone = 'warn'
    }
    return [
      { label: 'BB Upper', value: formatPrice(upper) },
      { label: 'BB Basis', value: formatPrice(basis), tone },
      { label: 'BB Lower', value: formatPrice(lower) },
      { label: '%B', value: pctB == null ? '—' : pctB.toFixed(2), tone },
    ]
  },
}
