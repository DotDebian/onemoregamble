import { pivotPoints, priorDayHLC } from '../structure'
import type { IndicatorDefinition, IndicatorPriceLine, SnapshotItem } from '../types'
import { formatPrice } from '~/utils/format'

export const pivotsIndicator: IndicatorDefinition = {
  id: 'pivots',
  name: 'Pivots (J)',
  category: 'structure',
  pane: 'price',
  defaultEnabled: false,
  describe: () => 'classiques · veille',
  compute(candles) {
    const hlc = priorDayHLC(candles)
    if (!hlc) return { plots: [] }
    const p = pivotPoints(hlc.high, hlc.low, hlc.close)
    const r = '#f0556a'
    const s = '#26d07c'
    const priceLines: IndicatorPriceLine[] = [
      { price: p.r3, color: r, title: 'R3', dash: 'dotted' },
      { price: p.r2, color: r, title: 'R2', dash: 'dashed' },
      { price: p.r1, color: r, title: 'R1' },
      { price: p.pp, color: '#e0b341', title: 'PP', lineWidth: 2 },
      { price: p.s1, color: s, title: 'S1' },
      { price: p.s2, color: s, title: 'S2', dash: 'dashed' },
      { price: p.s3, color: s, title: 'S3', dash: 'dotted' },
    ]
    return { plots: [], priceLines }
  },
  snapshot(candles) {
    const hlc = priorDayHLC(candles)
    if (!hlc) return [{ label: 'Pivots', value: '—' }]
    const p = pivotPoints(hlc.high, hlc.low, hlc.close)
    const close = candles.at(-1)?.close
    const levels: [string, number][] = [
      ['R3', p.r3], ['R2', p.r2], ['R1', p.r1], ['PP', p.pp], ['S1', p.s1], ['S2', p.s2], ['S3', p.s3],
    ]
    const items: SnapshotItem[] = [{ label: 'PP', value: formatPrice(p.pp), tone: 'info' }]
    if (close != null) {
      let nearest = levels[0]!
      let best = Infinity
      for (const lvl of levels) {
        const d = Math.abs(lvl[1] - close)
        if (d < best) {
          best = d
          nearest = lvl
        }
      }
      items.unshift({ label: `Plus proche (${nearest[0]})`, value: formatPrice(nearest[1]), tone: 'warn' })
    }
    return items
  },
}
