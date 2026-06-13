import { macd } from '../math'
import { lastFinite, type IndicatorDefinition, type SnapshotItem } from '../types'
import { formatNum } from '~/utils/format'

const FAST = 12
const SLOW = 26
const SIGNAL = 9
const UP = '#22c55e'
const DOWN = '#ef4444'

export const macdIndicator: IndicatorDefinition = {
  id: 'macd',
  name: 'MACD',
  category: 'oscillator',
  pane: 'separate',
  defaultEnabled: true,
  describe: () => `${FAST}, ${SLOW}, ${SIGNAL}`,
  compute(candles) {
    const { macd: line, signal, histogram } = macd(
      candles.map((c) => c.close),
      FAST,
      SLOW,
      SIGNAL,
    )
    return {
      plots: [
        {
          key: 'macdHist',
          label: 'Histogramme',
          kind: 'histogram',
          color: UP,
          data: candles.map((c, i) => ({
            time: c.time,
            value: histogram[i]!,
            color: (histogram[i] ?? 0) >= 0 ? 'rgba(34,197,94,0.6)' : 'rgba(239,68,68,0.6)',
          })),
        },
        {
          key: 'macdLine',
          label: 'MACD',
          kind: 'line',
          color: '#3b82f6',
          lineWidth: 2,
          data: candles.map((c, i) => ({ time: c.time, value: line[i]! })),
        },
        {
          key: 'macdSignal',
          label: 'Signal',
          kind: 'line',
          color: '#f5a524',
          lineWidth: 2,
          data: candles.map((c, i) => ({ time: c.time, value: signal[i]! })),
        },
      ],
    }
  },
  snapshot(_candles, result) {
    const hist = lastFinite(result.plots[0]!)?.value
    const line = lastFinite(result.plots[1]!)?.value
    const signal = lastFinite(result.plots[2]!)?.value
    const tone: SnapshotItem['tone'] =
      hist == null ? 'neutral' : hist >= 0 ? 'up' : 'down'
    return [
      { label: 'MACD', value: formatNum(line, 2), tone },
      { label: 'Signal', value: formatNum(signal, 2) },
      { label: 'Histogramme', value: formatNum(hist, 2), tone },
    ]
  },
}
