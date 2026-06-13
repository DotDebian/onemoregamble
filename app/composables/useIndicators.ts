import { computed } from 'vue'
import { INDICATORS } from '~/indicators'
import type { IndicatorDefinition, IndicatorResult } from '~/indicators'

export interface ComputedIndicator {
  def: IndicatorDefinition
  result: IndicatorResult
}

/**
 * Reactively computes every enabled indicator from the live candles.
 * Recomputes when candles tick or the enabled set changes. Both the chart and
 * the recap panel consume this, so the math runs once per update.
 */
export function useIndicators() {
  const { candles } = useMarket()
  const { enabled } = useIndicatorState()

  const computedIndicators = computed<ComputedIndicator[]>(() => {
    const data = candles.value
    if (!data.length) return []
    const out: ComputedIndicator[] = []
    for (const def of INDICATORS) {
      if (!enabled.value.includes(def.id)) continue
      out.push({ def, result: def.compute(data) })
    }
    return out
  })

  // A stable signature of the pane/series structure — lets the chart tell a
  // plain data tick apart from a layout change that needs a rebuild.
  const structureKey = computed(() =>
    computedIndicators.value
      .map((c) => `${c.def.id}:${c.result.plots.map((p) => p.key).join(',')}`)
      .join('|'),
  )

  return { computedIndicators, structureKey }
}
