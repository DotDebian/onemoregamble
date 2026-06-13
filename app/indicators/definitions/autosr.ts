import { findSwings, clusterLevels } from '../structure'
import type { IndicatorDefinition, IndicatorPriceLine, SnapshotItem } from '../types'
import { formatPrice } from '~/utils/format'

const MAX_LEVELS = 6

export const autoSrIndicator: IndicatorDefinition = {
  id: 'autosr',
  name: 'Support/Résistance',
  category: 'structure',
  pane: 'price',
  defaultEnabled: false,
  describe: () => 'auto · swings',
  compute(candles) {
    if (candles.length < 30) return { plots: [] }
    const swings = findSwings(candles, 5, 5)
    const levels = clusterLevels(swings, 0.004)
      .filter((l) => l.touches >= 2)
      .slice(0, MAX_LEVELS)
    const close = candles.at(-1)?.close ?? 0
    const priceLines: IndicatorPriceLine[] = levels.map((l) => {
      const isRes = l.price >= close
      return {
        price: l.price,
        color: isRes ? 'rgba(240,85,106,0.7)' : 'rgba(38,208,124,0.7)',
        title: `${isRes ? 'R' : 'S'}·${l.touches}`,
        dash: l.touches >= 3 ? 'solid' : 'dashed',
        lineWidth: l.touches >= 4 ? 2 : 1,
      }
    })
    return { plots: [], priceLines }
  },
  snapshot(candles) {
    if (candles.length < 30) return [{ label: 'S/R', value: '—' }]
    const levels = clusterLevels(findSwings(candles, 5, 5), 0.004).filter((l) => l.touches >= 2)
    const close = candles.at(-1)?.close
    if (close == null || !levels.length) return [{ label: 'S/R', value: '—' }]
    const res = levels.filter((l) => l.price >= close).sort((a, b) => a.price - b.price)[0]
    const sup = levels.filter((l) => l.price < close).sort((a, b) => b.price - a.price)[0]
    return [
      { label: 'Résistance', value: res ? `${formatPrice(res.price)} ·${res.touches}` : '—', tone: 'down' },
      { label: 'Support', value: sup ? `${formatPrice(sup.price)} ·${sup.touches}` : '—', tone: 'up' },
    ] as SnapshotItem[]
  },
}
