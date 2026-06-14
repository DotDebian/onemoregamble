import { ref, shallowRef, computed, watch, type Ref, type ShallowRef } from 'vue'
import { mergeCandlePages } from '~/types/market'
import { median } from '~/analysis/correlate'
import {
  computeEchoes,
  DEFAULT_ECHO_PARAMS,
  type EchoesParams,
  type EchoesResult,
} from '~/analysis/echoes'

const DEEP_CAP = 6000

/** Per-step reduction across a set of forward paths (median / percentile cone). */
function perStep(paths: number[][], horizon: number, pick: (vals: number[]) => number): number[] {
  const out = new Array<number>(horizon).fill(0)
  if (!paths.length) return out
  for (let k = 0; k < horizon; k++) {
    const col: number[] = []
    for (const p of paths) if (k < p.length && Number.isFinite(p[k]!)) col.push(p[k]!)
    out[k] = col.length ? pick(col) : 0
  }
  return out
}

function percentile(values: number[], q: number): number {
  const s = values.slice().sort((a, b) => a - b)
  if (!s.length) return 0
  if (s.length === 1) return s[0]!
  const pos = q * (s.length - 1)
  const lo = Math.floor(pos)
  const hi = Math.min(lo + 1, s.length - 1)
  return s[lo]! + (s[hi]! - s[lo]!) * (pos - lo)
}

interface EchoesState {
  params: Ref<EchoesParams>
  enabled: Ref<boolean>
  result: ShallowRef<EchoesResult | null>
  scanning: Ref<boolean>
  scanCount: Ref<number>
  scan: () => void
}

let state: EchoesState | null = null

function createState(): EchoesState {
  const market = useMarket()
  const params = ref<EchoesParams>({ ...DEFAULT_ECHO_PARAMS })
  const enabled = ref(false)
  const result = shallowRef<EchoesResult | null>(null)
  const scanning = ref(false)
  const scanCount = ref(0)

  function scan() {
    // Merge the deep snapshot with the live tail so the *query* (the most recent
    // `window` bars) reflects the latest closed candle, not the load-time state.
    const hist = mergeCandlePages([market.deepCandles.value, market.candles.value], DEEP_CAP)
    const p = params.value
    if (hist.length < p.window + p.horizon + 1) {
      result.value = null
      return
    }
    scanning.value = true
    result.value = computeEchoes(hist, p)
    scanning.value = false
    scanCount.value++
  }

  // Recompute when a new deep buffer lands (symbol/timeframe change) and on each
  // newly-closed bar — NOT on every tick, so the chart's hot path stays cheap.
  watch(market.deepReloadKey, scan)
  watch(market.lastTick, (t) => {
    if (t?.isNew && (enabled.value || result.value)) scan()
  })
  // Debounce param edits so dragging a slider doesn't fire a scan per pixel.
  let paramTimer: ReturnType<typeof setTimeout> | null = null
  watch(
    params,
    () => {
      if (!market.deepReady.value) return
      if (paramTimer) clearTimeout(paramTimer)
      paramTimer = setTimeout(scan, 120)
    },
    { deep: true },
  )

  return { params, enabled, result, scanning, scanCount, scan }
}

export function useEchoes() {
  if (!state) state = createState()
  const s = state
  const { deepReady, candles } = useMarket()

  const matches = computed(() => s.result.value?.matches ?? [])
  const horizon = computed(() => s.result.value?.horizon ?? s.params.value.horizon)
  const stats = computed(() => s.result.value?.stats ?? null)

  const pathsReturns = computed(() => matches.value.map((m) => m.pathReturns))
  const medianReturns = computed(() => perStep(pathsReturns.value, horizon.value, (c) => median(c)))
  const bandLow = computed(() => perStep(pathsReturns.value, horizon.value, (c) => percentile(c, 0.1)))
  const bandHigh = computed(() => perStep(pathsReturns.value, horizon.value, (c) => percentile(c, 0.9)))

  const lastClose = computed(() => candles.value.at(-1)?.close ?? null)

  return {
    params: s.params,
    enabled: s.enabled,
    result: s.result,
    scanning: s.scanning,
    scanCount: s.scanCount,
    matches,
    horizon,
    stats,
    pathsReturns,
    medianReturns,
    bandLow,
    bandHigh,
    lastClose,
    deepReady,
    scan: s.scan,
  }
}
