import { ref, shallowRef, computed, type Ref, type ShallowRef } from 'vue'
import { searchShape, type ShapeMatch } from '~/analysis/shapeSearch'

interface SketchState {
  matches: ShallowRef<ShapeMatch[]>
  selected: Ref<number | null>
  searching: Ref<boolean>
  hasSearched: Ref<boolean>
  /** True while the chart is parked on a historical match instead of live. */
  exploring: Ref<boolean>
}

let state: SketchState | null = null

function createState(): SketchState {
  return {
    matches: shallowRef<ShapeMatch[]>([]),
    selected: ref<number | null>(null),
    searching: ref(false),
    hasSearched: ref(false),
    exploring: ref(false),
  }
}

export function useSketchSearch() {
  if (!state) state = createState()
  const s = state
  const { deepCandles } = useMarket()

  /**
   * Run a search from a freehand stroke. `values` is the sequence of drawn
   * y-values already flipped so that a higher value means a higher price.
   */
  function run(values: number[]) {
    s.searching.value = true
    s.hasSearched.value = true
    s.selected.value = null
    const matches = values.length >= 2 ? searchShape(deepCandles.value, values) : []
    s.matches.value = matches
    // Don't auto-jump: keep the live view, let the user click a result to travel.
    s.selected.value = null
    s.searching.value = false
  }

  function select(i: number | null) {
    s.selected.value = i
  }

  function setExploring(v: boolean) {
    s.exploring.value = v
  }

  function clear() {
    s.matches.value = []
    s.selected.value = null
    s.hasSearched.value = false
    s.exploring.value = false
  }

  const selectedMatch = computed(() =>
    s.selected.value != null ? (s.matches.value[s.selected.value] ?? null) : null,
  )

  return {
    matches: s.matches,
    selected: s.selected,
    selectedMatch,
    searching: s.searching,
    hasSearched: s.hasSearched,
    exploring: s.exploring,
    deepReady: useMarket().deepReady,
    run,
    select,
    setExploring,
    clear,
  }
}
