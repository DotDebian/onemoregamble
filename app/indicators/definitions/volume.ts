import { simpleMovingAverage } from '../math'
import { lastFinite, type IndicatorDefinition, type SnapshotItem } from '../types'
import { formatVolume } from '~/utils/format'

export const volumeIndicator: IndicatorDefinition = {
  id: 'volume',
  name: 'Volume',
  category: 'volume',
  pane: 'separate',
  defaultEnabled: true,
  describe: () => 'avec MA 20',
  compute(candles) {
    const volMa = simpleMovingAverage(candles.map((c) => c.volume), 20)
    return {
      plots: [
        {
          key: 'vol',
          label: 'Volume',
          kind: 'histogram',
          color: '#64748b',
          data: candles.map((c) => ({
            time: c.time,
            value: c.volume,
            color: c.close >= c.open ? 'rgba(34,197,94,0.5)' : 'rgba(239,68,68,0.5)',
          })),
        },
        {
          key: 'volMa',
          label: 'Vol MA 20',
          kind: 'line',
          color: '#eab308',
          lineWidth: 1,
          data: candles.map((c, i) => ({ time: c.time, value: volMa[i]! })),
        },
      ],
    }
  },
  snapshot(candles, result) {
    const vol = candles.at(-1)?.volume
    const ma = lastFinite(result.plots[1]!)?.value
    const tone: SnapshotItem['tone'] =
      vol != null && ma != null ? (vol >= ma ? 'up' : 'down') : 'neutral'
    return [
      { label: 'Volume', value: formatVolume(vol), tone },
      { label: 'Vol MA 20', value: formatVolume(ma) },
    ]
  },
}
