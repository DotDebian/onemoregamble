import { relativeStrengthIndex } from '../math'
import { lastFinite, type IndicatorDefinition, type SnapshotItem } from '../types'
import { formatNum } from '~/utils/format'

const PERIOD = 14

export const rsiIndicator: IndicatorDefinition = {
  id: 'rsi',
  name: 'RSI',
  category: 'oscillator',
  pane: 'separate',
  defaultEnabled: true,
  describe: () => String(PERIOD),
  compute(candles) {
    const rsi = relativeStrengthIndex(candles.map((c) => c.close), PERIOD)
    return {
      plots: [
        {
          key: 'rsi',
          label: `RSI ${PERIOD}`,
          kind: 'line',
          color: '#d946ef',
          lineWidth: 2,
          data: candles.map((c, i) => ({ time: c.time, value: rsi[i]! })),
        },
      ],
    }
  },
  snapshot(_candles, result) {
    const v = lastFinite(result.plots[0]!)?.value
    let tone: SnapshotItem['tone'] = 'neutral'
    let note = ''
    if (v != null) {
      if (v >= 70) {
        tone = 'warn'
        note = ' · surachat'
      } else if (v <= 30) {
        tone = 'warn'
        note = ' · survente'
      } else if (v >= 50) {
        tone = 'up'
      } else {
        tone = 'down'
      }
    }
    return [{ label: `RSI ${PERIOD}`, value: `${formatNum(v, 1)}${note}`, tone }]
  },
}
