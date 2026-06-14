<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import {
  createChart,
  createSeriesMarkers,
  CandlestickSeries,
  LineSeries,
  HistogramSeries,
  ColorType,
  CrosshairMode,
  LineStyle,
  type IChartApi,
  type ISeriesApi,
  type ISeriesMarkersPluginApi,
  type IPriceLine,
  type SeriesType,
  type SeriesMarker,
  type UTCTimestamp,
  type Time,
  type CandlestickData,
  type LineData,
  type HistogramData,
  type WhitespaceData,
  type MouseEventParams,
} from 'lightweight-charts'
import { SYMBOLS } from '~/composables/useMarket'
import { lastFinite } from '~/indicators'
import { SessionsPrimitive } from './chart/sessionsPrimitive'
import { VolumeProfilePrimitive } from './chart/volumeProfilePrimitive'
import { DrawingsPrimitive } from './chart/drawingsPrimitive'
import { LiquidationsPrimitive } from './chart/liquidationsPrimitive'
import { EchoesPrimitive } from './chart/echoesPrimitive'
import { SketchPrimitive } from './chart/sketchPrimitive'
import { projectTimeToX, projectXToTime, type TimeProjection } from './chart/timeProjection'
import { computeSessionSegments } from '~/indicators/sessions'
import { volumeProfile } from '~/indicators/structure'
import { estimateLiquidationHeatmap, aggregateLiquidations } from '~/indicators/liquidations'
import { SPECIAL_OVERLAYS } from '~/indicators'
import type { IndicatorPlot, LineDash } from '~/indicators'
import type { Candle } from '~/types/market'
import type { Drawing, DPoint } from '~/composables/useDrawings'

const { candles, deepCandles, lastTick, reloadKey, symbol, interval, extendHistory } = useMarket()
const { computedIndicators, structureKey } = useIndicators()
const { isEnabled } = useIndicatorState()

// Special overlays (sessions / volume profile / liquidations) aren't part of the
// indicator registry, so structureKey doesn't track them. This key fires the
// attach/detach refresh the moment one is toggled — including detaching the last
// one (where the tick-driven scheduleOverlays early-returns and never would).
const specialKey = computed(() =>
  SPECIAL_OVERLAYS.map((o) => `${o.id}:${isEnabled(o.id) ? 1 : 0}`).join('|'),
)
const { tool, drawings, selectedId, add, update, remove, select, setTool, uid, loadForSymbol } =
  useDrawings()
const { alerts: allAlerts } = useAlerts()
const symbolAlerts = computed(() => allAlerts.value.filter((a) => a.symbol === symbol.value))
const { events: liqEvents } = useLiquidations()
const {
  enabled: echoEnabled,
  result: echoResult,
  horizon: echoHorizon,
  pathsReturns: echoPaths,
  medianReturns: echoMedian,
  bandLow: echoLow,
  bandHigh: echoHigh,
} = useEchoes()
const {
  run: runSketch,
  selectedMatch: sketchMatch,
  clear: clearSketch,
  exploring,
  setExploring,
} = useSketchSearch()

const container = ref<HTMLDivElement | null>(null)
let chart: IChartApi | null = null
let candleSeries: ISeriesApi<'Candlestick'> | null = null
let markersApi: ISeriesMarkersPluginApi<Time> | null = null
let sessionsPrim: SessionsPrimitive | null = null
let vpPrim: VolumeProfilePrimitive | null = null
let vpAttached = false
let liqPrim: LiquidationsPrimitive | null = null
let liqAttached = false
let sessionsAttached = false
let drawingsPrim: DrawingsPrimitive | null = null
let echoesPrim: EchoesPrimitive | null = null
let sketchPrim: SketchPrimitive | null = null
let resizeObs: ResizeObserver | null = null
let extending = false // re-entrancy guard for scroll-back history loading

// Sketch-search freehand capture (media-space points during a single drag).
let sketching = false
let sketchPts: { x: number; y: number }[] = []
const plotSeries = new Map<string, ISeriesApi<SeriesType>>()
let indicatorLines: IPriceLine[] = []
let alertLines: IPriceLine[] = []

const legend = ref<{ o: number; h: number; l: number; c: number; change: number } | null>(null)
let hovering = false

// ---- per-pane legend (titles + indicator values at the crosshair) ----
interface LegendPlot {
  label: string
  color: string
  value: string
}
interface LegendGroup {
  name: string
  sub: string
  plots: LegendPlot[]
}
interface PaneLegend {
  key: string
  top: number
  isPrice: boolean
  title: string
  sub: string
  groups: LegendGroup[]
}
const paneLegends = ref<PaneLegend[]>([])
let lastCrosshair: MouseEventParams | null = null

const priceTitle = computed(() => {
  const label = SYMBOLS.find((s) => s.symbol === symbol.value)?.label ?? symbol.value
  return `${label} · ${interval.value}`
})

function fmtVal(category: string, v: number | undefined): string {
  if (v == null || !Number.isFinite(v)) return '—'
  if (category === 'volume') return formatVolume(v)
  if (category === 'oscillator') return formatNum(v, 2)
  return formatPrice(v)
}

// Value of a plot at the hovered time, or its last finite value when idle.
function plotValueAt(
  plot: IndicatorPlot,
  series: ISeriesApi<SeriesType> | undefined,
  param: MouseEventParams | null,
): number | undefined {
  if (param?.time && series) {
    const d = param.seriesData.get(series)
    if (d && 'value' in d && Number.isFinite(d.value)) return d.value as number
    return undefined // hovering a gap (e.g. VWAP session break)
  }
  return lastFinite(plot)?.value
}

// Rebuild the legend model. Mirrors the pane layout of rebuildIndicatorSeries:
// price pane (0) holds overlays, each 'separate' indicator gets its own pane.
function buildLegends(param: MouseEventParams | null) {
  if (!chart) {
    paneLegends.value = []
    return
  }
  // Historical exploration strips the studies — show only the price-pane title.
  if (exploring.value) {
    paneLegends.value = [
      { key: 'p0', top: 0, isPrice: true, title: priceTitle.value, sub: '', groups: [] },
    ]
    return
  }
  const panesApi = chart.panes()
  const tops: number[] = []
  let acc = 0
  for (let i = 0; i < panesApi.length; i++) {
    tops[i] = acc
    acc += panesApi[i]!.getHeight() + 1 // + separator
  }
  const byPane = new Map<number, LegendGroup[]>()
  let nextPane = 1
  for (const { def, result } of computedIndicators.value) {
    if (!result.plots.length) continue
    const paneIndex = def.pane === 'separate' ? nextPane++ : 0
    const plots = result.plots.map((plot) => ({
      label: plot.label,
      color: plot.color,
      value: fmtVal(def.category, plotValueAt(plot, plotSeries.get(plotId(def.id, plot.key)), param)),
    }))
    const arr = byPane.get(paneIndex) ?? []
    arr.push({ name: def.name, sub: def.describe?.() ?? '', plots })
    byPane.set(paneIndex, arr)
  }
  const out: PaneLegend[] = []
  for (let i = 0; i < panesApi.length; i++) {
    const groups = byPane.get(i) ?? []
    if (i === 0) {
      out.push({ key: 'p0', top: tops[i]!, isPrice: true, title: priceTitle.value, sub: '', groups })
    } else if (groups.length) {
      const g = groups[0]!
      out.push({ key: `p${i}`, top: tops[i]!, isPrice: false, title: g.name, sub: g.sub, groups })
    }
  }
  paneLegends.value = out
}

// Drawing interaction state
const draft = ref<Drawing | null>(null)
let pending = false
let dragWorking: Drawing | null = null
let dragState: { id: string; handle: string; last: DPoint } | null = null

const DASH: Record<LineDash, LineStyle> = {
  solid: LineStyle.Solid,
  dashed: LineStyle.Dashed,
  dotted: LineStyle.Dotted,
}

function plotId(defId: string, key: string) {
  return `${defId}:${key}`
}

// ---- series data conversion ----
function toCandleData(arr: Candle[] = candles.value): CandlestickData[] {
  return arr.map((c) => ({
    time: c.time as UTCTimestamp,
    open: c.open,
    high: c.high,
    low: c.low,
    close: c.close,
  }))
}
function toLineData(plot: IndicatorPlot): (LineData | WhitespaceData)[] {
  return plot.data.map((p) =>
    Number.isFinite(p.value)
      ? { time: p.time as UTCTimestamp, value: p.value }
      : { time: p.time as UTCTimestamp },
  )
}
function toHistData(plot: IndicatorPlot): (HistogramData | WhitespaceData)[] {
  return plot.data.map((p) =>
    Number.isFinite(p.value)
      ? { time: p.time as UTCTimestamp, value: p.value, color: p.color }
      : { time: p.time as UTCTimestamp },
  )
}

// ---- indicator series (plots) ----
function rebuildIndicatorSeries() {
  if (!chart) return
  for (const s of plotSeries.values()) chart.removeSeries(s)
  plotSeries.clear()
  for (let i = chart.panes().length - 1; i >= 1; i--) chart.removePane(i)

  let nextPane = 1
  for (const { def, result } of computedIndicators.value) {
    if (!result.plots.length) continue
    const paneIndex = def.pane === 'separate' ? nextPane++ : 0
    const isVolume = def.category === 'volume'
    for (const plot of result.plots) {
      let series: ISeriesApi<SeriesType>
      if (plot.kind === 'histogram') {
        series = chart.addSeries(
          HistogramSeries,
          {
            color: plot.color,
            priceLineVisible: false,
            lastValueVisible: false,
            priceFormat: isVolume ? { type: 'volume' } : undefined,
          },
          paneIndex,
        )
        series.setData(toHistData(plot))
      } else {
        series = chart.addSeries(
          LineSeries,
          {
            color: plot.color,
            lineWidth: (plot.lineWidth ?? 2) as 1 | 2 | 3 | 4,
            priceLineVisible: plot.priceLineVisible ?? false,
            lastValueVisible: plot.priceLineVisible ?? false,
            crosshairMarkerVisible: true,
          },
          paneIndex,
        )
        series.setData(toLineData(plot))
      }
      plotSeries.set(plotId(def.id, plot.key), series)
    }
  }
  const panes = chart.panes()
  if (panes[0]) panes[0].setStretchFactor(5)
}

// ---- indicator price-lines + markers (pivots, S/R, structure) ----
function applyIndicatorExtras() {
  if (!candleSeries) return
  for (const l of indicatorLines) candleSeries.removePriceLine(l)
  indicatorLines = []
  const markers: SeriesMarker<Time>[] = []
  for (const { result } of computedIndicators.value) {
    for (const pl of result.priceLines ?? []) {
      indicatorLines.push(
        candleSeries.createPriceLine({
          price: pl.price,
          color: pl.color,
          lineWidth: (pl.lineWidth ?? 1) as 1 | 2 | 3 | 4,
          lineStyle: DASH[pl.dash ?? 'solid'],
          axisLabelVisible: true,
          title: pl.title,
        }),
      )
    }
    for (const m of result.markers ?? []) {
      markers.push({
        time: m.time as UTCTimestamp,
        position: m.position,
        color: m.color,
        shape: m.shape,
        text: m.text,
      })
    }
  }
  markers.sort((a, b) => (a.time as number) - (b.time as number))
  markersApi?.setMarkers(markers)
}

// ---- alert price-lines ----
function applyAlertLines() {
  if (!candleSeries) return
  for (const l of alertLines) candleSeries.removePriceLine(l)
  alertLines = []
  for (const a of symbolAlerts.value) {
    if (a.type !== 'price' || !a.enabled) continue
    alertLines.push(
      candleSeries.createPriceLine({
        price: a.value,
        color: a.triggered ? '#5c6776' : '#e0b341',
        lineWidth: 1,
        lineStyle: LineStyle.Dashed,
        axisLabelVisible: true,
        title: a.triggered ? '⏰✓' : '⏰',
      }),
    )
  }
}

// ---- sessions + volume profile overlays ----
function refreshSessions() {
  if (!candleSeries || !sessionsPrim) return
  if (isEnabled('sessions')) {
    if (!sessionsAttached) {
      candleSeries.attachPrimitive(sessionsPrim)
      sessionsAttached = true
    }
    sessionsPrim.setSegments(computeSessionSegments(candles.value))
  } else if (sessionsAttached) {
    candleSeries.detachPrimitive(sessionsPrim)
    sessionsAttached = false
  }
}

function visibleCandles(): Candle[] {
  if (!chart) return candles.value
  const lr = chart.timeScale().getVisibleLogicalRange()
  const all = candles.value
  if (!lr) return all
  const from = Math.max(0, Math.floor(lr.from))
  const to = Math.min(all.length, Math.ceil(lr.to) + 1)
  return all.slice(from, to)
}

function refreshVolumeProfile() {
  if (!candleSeries || !vpPrim) return
  if (isEnabled('volumeProfile')) {
    if (!vpAttached) {
      candleSeries.attachPrimitive(vpPrim)
      vpAttached = true
    }
    vpPrim.setProfile(volumeProfile(visibleCandles(), 48))
  } else if (vpAttached) {
    vpPrim.setProfile(null)
    candleSeries.detachPrimitive(vpPrim)
    vpAttached = false
  }
}

function refreshLiquidations() {
  if (!candleSeries || !liqPrim) return
  if (isEnabled('liquidations')) {
    if (!liqAttached) {
      candleSeries.attachPrimitive(liqPrim)
      liqAttached = true
    }
    const hm = estimateLiquidationHeatmap(visibleCandles())
    liqPrim.setHeatmap(hm)
    liqPrim.setRealProfile(
      hm ? aggregateLiquidations(liqEvents.value, hm.priceMin, hm.priceMax, hm.buckets.length) : null,
    )
    liqPrim.setEvents(liqEvents.value)
  } else if (liqAttached) {
    candleSeries.detachPrimitive(liqPrim)
    liqAttached = false
  }
}

// Bar geometry so drawings can extend past the live candle (positions, rays).
function timeProjection(): TimeProjection | null {
  const arr = candles.value
  const n = arr.length
  if (n < 2) return null
  const lastTime = arr[n - 1]!.time
  const interval = lastTime - arr[n - 2]!.time
  if (interval <= 0) return null
  return { interval, lastTime, lastIndex: n - 1 }
}

// ---- drawings render ----
function renderDrawings() {
  if (!drawingsPrim) return
  const list = dragWorking
    ? drawings.value.map((d) => (d.id === dragWorking!.id ? dragWorking! : d))
    : drawings.value
  drawingsPrim.setData(list, selectedId.value, draft.value, timeProjection())
}

// Full chart (re)build from the live buffer — candles, studies, overlays, view.
function fullSync() {
  if (!chart || !candleSeries) return
  candleSeries.setData(toCandleData())
  rebuildIndicatorSeries()
  applyIndicatorExtras()
  applyAlertLines()
  refreshSessions()
  refreshVolumeProfile()
  refreshLiquidations()
  renderDrawings()
  refreshEchoes()
  chart.timeScale().fitContent()
  const last = candles.value.at(-1)
  if (last && !hovering) updateLegend(last)
  buildLegends(lastCrosshair)
}

// ---- sketch-search historical exploration ----
// Park the chart on a matched window anywhere in the deep buffer (which extends
// well past the live series). We swap the candle data to the full deep history
// and strip the live studies for a clean "shape inspector"; restoreLive() rebuilds.
function stripStudies() {
  if (!chart || !candleSeries) return
  for (const s of plotSeries.values()) chart.removeSeries(s)
  plotSeries.clear()
  for (let i = chart.panes().length - 1; i >= 1; i--) chart.removePane(i)
  for (const l of indicatorLines) candleSeries.removePriceLine(l)
  indicatorLines = []
  markersApi?.setMarkers([])
  if (sessionsAttached && sessionsPrim) {
    candleSeries.detachPrimitive(sessionsPrim)
    sessionsAttached = false
  }
  if (vpAttached && vpPrim) {
    vpPrim.setProfile(null)
    candleSeries.detachPrimitive(vpPrim)
    vpAttached = false
  }
  if (liqAttached && liqPrim) {
    candleSeries.detachPrimitive(liqPrim)
    liqAttached = false
  }
}

function jumpToMatch(m: { startTime: number; endTime: number }) {
  if (!chart || !candleSeries) return
  if (!exploring.value) {
    stripStudies()
    candleSeries.setData(toCandleData(deepCandles.value))
    setExploring(true)
    refreshEchoes() // gated off while exploring
    buildLegends(lastCrosshair) // collapse to the price-only legend
  }
  sketchPrim?.setHighlight({ startTime: m.startTime, endTime: m.endTime })
  const span = Math.max(m.endTime - m.startTime, 1)
  const pad = span * 0.8
  try {
    chart.timeScale().setVisibleRange({
      from: (m.startTime - pad) as Time,
      to: (m.endTime + pad) as Time,
    })
  } catch {
    // the library clamps out-of-range bounds; ignore
  }
}

function restoreLive() {
  sketchPrim?.setHighlight(null)
  fullSync() // rebuilds candles, studies and overlays from the live buffer
  chart
    ?.timeScale()
    .applyOptions({ rightOffset: echoEnabled.value ? Math.min(90, echoHorizon.value + 8) : 4 })
}

// Reveal more past as the user scrolls toward the left edge, by pulling the next
// chunk from the in-memory deep buffer (no network). The view is pinned to the
// same time range so prepending bars doesn't make the chart jump.
function maybeExtendHistory() {
  if (!chart || !candleSeries || exploring.value || extending) return
  const lr = chart.timeScale().getVisibleLogicalRange()
  // Only when the user has scrolled to the left edge of the loaded bars while the
  // live edge is off-screen to the right — never on the initial fit-all (where
  // from≈0 but the whole series, including the live edge, is in view).
  if (!lr || lr.from > 30 || lr.to >= candles.value.length - 5) return
  extending = true
  const before = chart.timeScale().getVisibleRange()
  if (extendHistory()) {
    candleSeries.setData(toCandleData())
    rebuildIndicatorSeries()
    applyIndicatorExtras()
    applyAlertLines()
    refreshSessions()
    renderDrawings()
    refreshEchoes()
    if (before) {
      try {
        chart.timeScale().setVisibleRange(before)
      } catch {
        // ignore — the library clamps if the saved range no longer fits
      }
    }
  }
  extending = false
}

// ---- echoes forward projection ----
function refreshEchoes() {
  if (!echoesPrim) return
  const on = echoEnabled.value && !exploring.value
  echoesPrim.setData({
    enabled: on,
    lastClose: candles.value.at(-1)?.close ?? null,
    projection: timeProjection(),
    horizon: echoHorizon.value,
    paths: on ? echoPaths.value : [],
    median: on ? echoMedian.value : [],
    bandLow: on ? echoLow.value : [],
    bandHigh: on ? echoHigh.value : [],
  })
}

// ---- pointer helpers ----
function evtXY(ev: PointerEvent) {
  const rect = container.value!.getBoundingClientRect()
  return { x: ev.clientX - rect.left, y: ev.clientY - rect.top }
}
function toData(x: number, y: number): DPoint | null {
  if (!chart || !candleSeries) return null
  const price = candleSeries.coordinateToPrice(y)
  // Project into the future when the click lands past the live candle, so the
  // point doesn't collapse back onto the last bar (lets you place a position).
  const time = projectXToTime(chart.timeScale(), timeProjection(), x)
  if (price == null || time == null) return null
  return { time: Number(time), price: Number(price) }
}
function sx(p: DPoint): number | null {
  return projectTimeToX(chart!.timeScale(), timeProjection(), p.time)
}
function sy(price: number): number | null {
  const y = candleSeries!.priceToCoordinate(price)
  return y == null ? null : y
}
function distSeg(px: number, py: number, x1: number, y1: number, x2: number, y2: number) {
  const dx = x2 - x1
  const dy = y2 - y1
  const len2 = dx * dx + dy * dy
  let t = len2 ? ((px - x1) * dx + (py - y1) * dy) / len2 : 0
  t = Math.max(0, Math.min(1, t))
  const cx = x1 + t * dx
  const cy = y1 + t * dy
  return Math.hypot(px - cx, py - cy)
}

function hitTest(x: number, y: number): { d: Drawing; handle: string } | null {
  const HIT = 7
  for (let i = drawings.value.length - 1; i >= 0; i--) {
    const d = drawings.value[i]!
    if (d.type === 'horizontal') {
      const yy = sy(d.a.price)
      if (yy != null && Math.abs(y - yy) < HIT) return { d, handle: 'a' }
      continue
    }
    const xa = sx(d.a)
    const xb = sx(d.b)
    const ya = sy(d.a.price)
    const yb = sy(d.b.price)
    const near = (hx: number | null, hy: number | null) =>
      hx != null && hy != null && Math.hypot(x - hx, y - hy) < HIT
    if (d.type === 'position') {
      const cx = ((xa ?? 0) + (xb ?? 0)) / 2
      const yE = sy(d.a.price)
      const yS = sy(d.stop ?? d.a.price)
      const yT = sy(d.target ?? d.a.price)
      if (near(cx, yE)) return { d, handle: 'entry' }
      if (near(cx, yS)) return { d, handle: 'stop' }
      if (near(cx, yT)) return { d, handle: 'target' }
      if (xa != null && xb != null && yE != null && yS != null && yT != null) {
        const top = Math.min(yE, yS, yT)
        const bot = Math.max(yE, yS, yT)
        if (x >= Math.min(xa, xb) && x <= Math.max(xa, xb) && y >= top && y <= bot)
          return { d, handle: 'body' }
      }
      continue
    }
    if (near(xa, ya)) return { d, handle: 'a' }
    if (near(xb, yb)) return { d, handle: 'b' }
    if (xa != null && xb != null && ya != null && yb != null) {
      if (d.type === 'rectangle' || d.type === 'fib') {
        if (
          x >= Math.min(xa, xb) - HIT &&
          x <= Math.max(xa, xb) + HIT &&
          y >= Math.min(ya, yb) - HIT &&
          y <= Math.max(ya, yb) + HIT
        )
          return { d, handle: 'body' }
      } else {
        // trendline / ray / measure
        if (distSeg(x, y, xa, ya, xb, yb) < HIT) return { d, handle: 'body' }
      }
    }
  }
  return null
}

function makePosition(entry: DPoint, end: DPoint): Drawing {
  const target = end.price
  const stop = entry.price - (target - entry.price) // default 1R
  return {
    id: uid(),
    type: 'position',
    a: { time: entry.time, price: entry.price },
    b: { time: end.time, price: target },
    stop,
    target,
  }
}

// ---- pointer handlers ----
function onPointerDown(ev: PointerEvent) {
  if (!container.value) return
  const { x, y } = evtXY(ev)

  if (tool.value === 'sketch') {
    sketching = true
    sketchPts = [{ x, y }]
    try {
      container.value.setPointerCapture(ev.pointerId)
    } catch {
      // capture is a nicety; the move/up handlers work without it
    }
    sketchPrim?.setStroke(sketchPts.slice())
    return
  }

  const p = toData(x, y)
  if (!p) return

  if (tool.value === 'cursor') {
    const hit = hitTest(x, y)
    if (hit) {
      select(hit.d.id)
      dragState = { id: hit.d.id, handle: hit.handle, last: p }
      dragWorking = { ...hit.d }
      chart?.applyOptions({ handleScroll: false, handleScale: false })
      container.value.setPointerCapture(ev.pointerId)
      renderDrawings()
    } else {
      select(null)
      renderDrawings()
    }
    return
  }

  // creation
  if (tool.value === 'horizontal') {
    const d: Drawing = { id: uid(), type: 'horizontal', a: p, b: p }
    add(d)
    select(d.id)
    setTool('cursor')
    return
  }

  if (!pending) {
    pending = true
    draft.value =
      tool.value === 'position'
        ? makePosition(p, p)
        : { id: uid(), type: tool.value, a: p, b: p }
    renderDrawings()
  } else {
    // finalize 2-point
    const base = draft.value!
    const final: Drawing =
      tool.value === 'position' ? makePosition(base.a, p) : { ...base, b: p }
    add(final)
    pending = false
    draft.value = null
    select(final.id)
    setTool('cursor')
    renderDrawings()
  }
}

function onPointerMove(ev: PointerEvent) {
  if (!container.value) return
  const { x, y } = evtXY(ev)

  if (sketching) {
    sketchPts.push({ x, y })
    sketchPrim?.setStroke(sketchPts.slice())
    return
  }

  if (pending && draft.value) {
    const p = toData(x, y)
    if (p) {
      draft.value =
        tool.value === 'position'
          ? makePosition(draft.value.a, p)
          : { ...draft.value, b: p }
      renderDrawings()
    }
    return
  }

  if (dragState && dragWorking) {
    const p = toData(x, y)
    if (!p) return
    const dt = p.time - dragState.last.time
    const dp = p.price - dragState.last.price
    const d = dragWorking
    if (dragState.handle === 'a') {
      d.a = d.type === 'horizontal' ? { ...d.a, price: p.price } : p
    } else if (dragState.handle === 'b') {
      d.b = p
    } else if (dragState.handle === 'entry') {
      d.a = { ...d.a, price: p.price }
    } else if (dragState.handle === 'stop') {
      d.stop = p.price
    } else if (dragState.handle === 'target') {
      d.target = p.price
      d.b = { ...d.b, price: p.price }
    } else {
      // body translate
      d.a = { time: d.a.time + dt, price: d.a.price + dp }
      d.b = { time: d.b.time + dt, price: d.b.price + dp }
      if (d.stop != null) d.stop += dp
      if (d.target != null) d.target += dp
    }
    dragState.last = p
    renderDrawings()
    return
  }

  // hover cursor feedback
  if (tool.value === 'cursor' && container.value) {
    container.value.style.cursor = hitTest(x, y) ? 'pointer' : 'default'
  }
}

function finalizeSketch() {
  const pts = sketchPts
  sketchPts = []
  sketchPrim?.setStroke([])
  if (pts.length >= 2) {
    // left→right order, flip Y so a higher drawn point = a higher price
    const sorted = pts.slice().sort((a, b) => a.x - b.x)
    runSketch(sorted.map((q) => -q.y))
  }
  setTool('cursor')
}

function onPointerUp(ev: PointerEvent) {
  if (sketching) {
    sketching = false
    try {
      container.value?.releasePointerCapture?.(ev.pointerId)
    } catch {
      // pointer may not have been captured (e.g. synthetic events)
    }
    finalizeSketch()
    return
  }
  if (dragState && dragWorking) {
    update(dragWorking.id, dragWorking)
    dragWorking = null
    dragState = null
    chart?.applyOptions({ handleScroll: true, handleScale: true })
    container.value?.releasePointerCapture?.(ev.pointerId)
    renderDrawings()
  }
}

function onKeydown(ev: KeyboardEvent) {
  const el = document.activeElement
  if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA')) return
  if ((ev.key === 'Delete' || ev.key === 'Backspace') && selectedId.value) {
    ev.preventDefault()
    remove(selectedId.value)
    renderDrawings()
  } else if (ev.key === 'Escape') {
    pending = false
    draft.value = null
    select(null)
    setTool('cursor')
    renderDrawings()
  }
}

function updateLegend(c: { open: number; high: number; low: number; close: number }) {
  legend.value = {
    o: c.open,
    h: c.high,
    l: c.low,
    c: c.close,
    change: c.open ? ((c.close - c.open) / c.open) * 100 : 0,
  }
}

let overlayRaf = 0
function scheduleOverlays() {
  if (exploring.value) return
  if (!isEnabled('volumeProfile') && !isEnabled('liquidations')) return
  if (overlayRaf) return
  overlayRaf = requestAnimationFrame(() => {
    overlayRaf = 0
    refreshVolumeProfile()
    refreshLiquidations()
  })
}

onMounted(() => {
  if (!container.value) return
  loadForSymbol(symbol.value)

  chart = createChart(container.value, {
    autoSize: true,
    layout: {
      background: { type: ColorType.Solid, color: 'transparent' },
      textColor: '#9aa7bd',
      fontFamily: "'IBM Plex Mono', ui-monospace, 'SF Mono', Menlo, monospace",
      panes: { separatorColor: 'rgba(148,163,184,0.12)', separatorHoverColor: 'rgba(148,163,184,0.25)' },
    },
    grid: {
      vertLines: { color: 'rgba(148,163,184,0.05)' },
      horzLines: { color: 'rgba(148,163,184,0.05)' },
    },
    crosshair: { mode: CrosshairMode.Normal },
    rightPriceScale: { borderColor: 'rgba(148,163,184,0.15)' },
    timeScale: {
      borderColor: 'rgba(148,163,184,0.15)',
      timeVisible: true,
      secondsVisible: false,
      rightOffset: 4,
    },
  })

  candleSeries = chart.addSeries(CandlestickSeries, {
    upColor: '#26d07c',
    downColor: '#f0556a',
    borderUpColor: '#26d07c',
    borderDownColor: '#f0556a',
    wickUpColor: '#26d07c',
    wickDownColor: '#f0556a',
    priceLineColor: 'rgba(148,163,184,0.4)',
  })

  markersApi = createSeriesMarkers(candleSeries, [])
  sessionsPrim = new SessionsPrimitive()
  vpPrim = new VolumeProfilePrimitive()
  liqPrim = new LiquidationsPrimitive()
  drawingsPrim = new DrawingsPrimitive()
  candleSeries.attachPrimitive(drawingsPrim)
  echoesPrim = new EchoesPrimitive()
  candleSeries.attachPrimitive(echoesPrim)
  sketchPrim = new SketchPrimitive()
  candleSeries.attachPrimitive(sketchPrim)

  chart.subscribeCrosshairMove((param) => {
    lastCrosshair = param
    const data =
      param.time && candleSeries
        ? (param.seriesData.get(candleSeries) as CandlestickData | undefined)
        : undefined
    if (data) {
      hovering = true
      updateLegend(data)
    } else {
      hovering = false
      const last = candles.value.at(-1)
      if (last) updateLegend(last)
    }
    buildLegends(param)
  })

  chart.timeScale().subscribeVisibleLogicalRangeChange(() => {
    scheduleOverlays()
    maybeExtendHistory()
  })

  if (candles.value.length) fullSync()

  watch(reloadKey, fullSync)
  watch(structureKey, () => {
    if (exploring.value) return
    rebuildIndicatorSeries()
    applyIndicatorExtras()
    buildLegends(lastCrosshair)
  })

  // special-overlay toggles (sessions / volume profile / liquidations) — attach
  // or detach immediately, including when the last one is turned off.
  watch(specialKey, () => {
    if (exploring.value) return
    refreshSessions()
    refreshVolumeProfile()
    refreshLiquidations()
  })

  // live liquidation events → refresh bubbles + real heatmap
  watch(
    liqEvents,
    () => {
      if (liqAttached) refreshLiquidations()
    },
    { deep: true },
  )

  watch(lastTick, (tick) => {
    if (!tick || !candleSeries) return
    if (exploring.value) return // parked on history — don't mutate the deep series
    candleSeries.update({
      time: tick.candle.time as UTCTimestamp,
      open: tick.candle.open,
      high: tick.candle.high,
      low: tick.candle.low,
      close: tick.candle.close,
    })
    for (const { def, result } of computedIndicators.value) {
      for (const plot of result.plots) {
        const series = plotSeries.get(plotId(def.id, plot.key))
        const point = plot.data[plot.data.length - 1]
        if (!series || !point) continue
        const value = Number.isFinite(point.value)
          ? plot.kind === 'histogram'
            ? { time: point.time as UTCTimestamp, value: point.value, color: point.color }
            : { time: point.time as UTCTimestamp, value: point.value }
          : { time: point.time as UTCTimestamp }
        series.update(value)
      }
    }
    if (tick.isNew) {
      refreshSessions()
      applyIndicatorExtras()
      // New bar shifts the projection origin — refresh so future-anchored
      // drawings stay put instead of sliding a bar to the right.
      renderDrawings()
    }
    scheduleOverlays()
    refreshEchoes()
    if (!hovering) updateLegend(tick.candle)
    buildLegends(lastCrosshair)
  })

  // re-render drawings when the store changes
  watch([drawings, selectedId], () => renderDrawings(), { deep: true })

  // echoes overlay: re-project when toggled or when a fresh scan lands
  watch([echoEnabled, echoResult], () => refreshEchoes())

  // reveal the future region so the projected horizon is actually on-screen;
  // restore the normal right margin when the projection is turned off.
  watch([echoEnabled, echoHorizon], ([on, h]) => {
    if (!chart) return
    chart.timeScale().applyOptions({ rightOffset: on ? Math.min(90, h + 8) : 4 })
  })

  // sketch-search: selecting a match parks the chart on that historical window
  // (anywhere in the deep buffer); clearing the selection drops the highlight.
  watch(sketchMatch, (m) => {
    if (m) jumpToMatch(m)
    else sketchPrim?.setHighlight(null)
  })

  // "Retour au live" flips exploring off → rebuild the live chart.
  watch(exploring, (v, was) => {
    if (was && !v) restoreLive()
  })

  // alerts → chart lines
  watch(symbolAlerts, () => applyAlertLines(), { deep: true })

  // reload persisted drawings on symbol change
  watch(symbol, (s) => {
    loadForSymbol(s)
    applyAlertLines()
    renderDrawings()
    // sketch matches index into the previous symbol's deep buffer — drop them
    clearSketch()
    sketchPrim?.setHighlight(null)
  })

  // tool change → disable chart pan while drawing
  watch(tool, (t) => {
    if (!chart || !container.value) return
    const drawing = t !== 'cursor'
    chart.applyOptions({ handleScroll: !drawing, handleScale: !drawing })
    container.value.style.cursor = drawing ? 'crosshair' : 'default'
    if (!drawing) {
      pending = false
      draft.value = null
      renderDrawings()
    }
  })

  const el = container.value
  el.addEventListener('pointerdown', onPointerDown)
  el.addEventListener('pointermove', onPointerMove)
  el.addEventListener('pointerup', onPointerUp)
  window.addEventListener('keydown', onKeydown)

  // Pane heights drive legend Y offsets — recompute on container resize.
  resizeObs = new ResizeObserver(() => buildLegends(lastCrosshair))
  resizeObs.observe(el)
})

onBeforeUnmount(() => {
  const el = container.value
  el?.removeEventListener('pointerdown', onPointerDown)
  el?.removeEventListener('pointermove', onPointerMove)
  el?.removeEventListener('pointerup', onPointerUp)
  window.removeEventListener('keydown', onKeydown)
  resizeObs?.disconnect()
  resizeObs = null
  chart?.remove()
  chart = null
  candleSeries = null
  markersApi = null
  sessionsPrim = null
  vpPrim = null
  liqPrim = null
  drawingsPrim = null
  echoesPrim = null
  sketchPrim = null
  plotSeries.clear()
})
</script>

<template>
  <div class="chart-wrap">
    <div ref="container" class="chart-canvas" />
    <ChartToolbar />
    <SketchResults />
    <div class="pane-legends">
      <div v-for="p in paneLegends" :key="p.key" class="pane-legend" :style="{ top: `${p.top}px` }">
        <!-- header row: pane title (+ OHLC for the price pane) -->
        <div class="leg-row">
          <span class="leg-title">{{ p.title }}</span>
          <span v-if="p.sub" class="leg-sub">{{ p.sub }}</span>
          <template v-if="p.isPrice && legend">
            <span class="leg-ohlc">
              <span class="lp"><i>O</i>{{ formatPrice(legend.o) }}</span>
              <span class="lp"><i>H</i>{{ formatPrice(legend.h) }}</span>
              <span class="lp"><i>L</i>{{ formatPrice(legend.l) }}</span>
              <span class="lp"><i>C</i>{{ formatPrice(legend.c) }}</span>
              <span class="leg-change" :class="legend.change >= 0 ? 'up' : 'down'">
                {{ formatPct(legend.change) }}
              </span>
            </span>
          </template>
          <!-- separate pane: its single indicator's values sit on the title row -->
          <template v-else-if="!p.isPrice">
            <span
              v-for="pl in p.groups[0]?.plots"
              :key="pl.label"
              class="leg-val"
              :style="{ color: pl.color }"
              :title="pl.label"
            >{{ pl.value }}</span>
          </template>
        </div>
        <!-- price pane: one row per overlay indicator -->
        <template v-if="p.isPrice">
          <div v-for="g in p.groups" :key="g.name" class="leg-row leg-ind">
            <span class="leg-gname">{{ g.name }}</span>
            <span v-if="g.sub" class="leg-sub">{{ g.sub }}</span>
            <span
              v-for="pl in g.plots"
              :key="pl.label"
              class="leg-val"
              :style="{ color: pl.color }"
              :title="pl.label"
            >{{ pl.value }}</span>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<style scoped>
.chart-wrap {
  position: relative;
  width: 100%;
  height: 100%;
  min-height: 0;
}
.chart-canvas {
  position: absolute;
  inset: 0;
}
/* Per-pane legend overlay — titles + live indicator values at the crosshair. */
.pane-legends {
  position: absolute;
  inset: 0;
  z-index: 4;
  pointer-events: none;
}
.pane-legend {
  position: absolute;
  left: 52px;
  right: 64px;
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding-top: 6px;
  font-family: var(--font-mono);
  font-size: 11.5px;
  font-variant-numeric: tabular-nums;
  line-height: 1.3;
}
.leg-row {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 4px 10px;
  width: fit-content;
  max-width: 100%;
  padding: 2px 8px;
  border-radius: 6px;
  background: color-mix(in srgb, var(--bg-0) 62%, transparent);
  backdrop-filter: blur(5px);
}
.leg-ind {
  background: color-mix(in srgb, var(--bg-0) 48%, transparent);
}
.leg-title {
  color: var(--text-0);
  font-weight: 600;
  letter-spacing: 0.02em;
}
.leg-gname {
  color: var(--text-1);
  font-weight: 500;
}
.leg-sub {
  color: var(--text-3);
  font-size: 10.5px;
}
.leg-ohlc {
  display: inline-flex;
  flex-wrap: wrap;
  gap: 10px;
  color: var(--text-2);
}
.lp {
  display: inline-flex;
  gap: 4px;
  align-items: baseline;
}
.lp i {
  color: var(--text-3);
  font-style: normal;
}
.leg-val {
  font-weight: 500;
}
.leg-change.up {
  color: var(--up);
}
.leg-change.down {
  color: var(--down);
}
</style>
