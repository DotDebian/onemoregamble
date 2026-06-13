import { findSwings, marketStructure } from '../structure'
import type { IndicatorDefinition, IndicatorMarker, SnapshotItem } from '../types'

export const structureIndicator: IndicatorDefinition = {
  id: 'structure',
  name: 'Structure (HH/HL)',
  category: 'structure',
  pane: 'price',
  defaultEnabled: false,
  describe: () => 'swings',
  compute(candles) {
    if (candles.length < 30) return { plots: [] }
    const { points } = marketStructure(findSwings(candles, 5, 5))
    const markers: IndicatorMarker[] = points.slice(-40).map((p) => ({
      time: p.time,
      position: p.type === 'high' ? 'aboveBar' : 'belowBar',
      color: p.label === 'HH' || p.label === 'HL' ? '#26d07c' : '#f0556a',
      shape: p.type === 'high' ? 'arrowDown' : 'arrowUp',
      text: p.label,
    }))
    return { plots: [], markers }
  },
  snapshot(candles) {
    if (candles.length < 30) return [{ label: 'Structure', value: '—' }]
    const { trend } = marketStructure(findSwings(candles, 5, 5))
    const map = {
      up: { v: 'Haussière', t: 'up' as const },
      down: { v: 'Baissière', t: 'down' as const },
      range: { v: 'Range', t: 'neutral' as const },
    }
    const m = map[trend]
    return [{ label: 'Tendance', value: m.v, tone: m.t }] as SnapshotItem[]
  },
}
