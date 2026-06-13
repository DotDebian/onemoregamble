import type {
  IChartApi,
  ISeriesApi,
  ISeriesPrimitive,
  IPrimitivePaneView,
  IPrimitivePaneRenderer,
  SeriesAttachedParameter,
  SeriesType,
  Time,
} from 'lightweight-charts'
import { WHALE_USD, type LiqHeatmap, type RealLiqProfile } from '~/indicators/liquidations'
import type { LiqEvent } from '~/composables/useLiquidations'

interface BitmapScope {
  context: CanvasRenderingContext2D
  bitmapSize: { width: number; height: number }
  mediaSize: { width: number; height: number }
  horizontalPixelRatio: number
  verticalPixelRatio: number
}
interface RenderTarget {
  useBitmapCoordinateSpace(callback: (scope: BitmapScope) => void): void
}

function heat(t: number): string {
  const c = Math.max(0, Math.min(1, t))
  let r: number
  let g: number
  let b: number
  if (c < 0.5) {
    const k = c / 0.5
    r = 91 + (224 - 91) * k
    g = 141 + (179 - 141) * k
    b = 239 + (65 - 239) * k
  } else {
    const k = (c - 0.5) / 0.5
    r = 224 + (255 - 224) * k
    g = 179 + (235 - 179) * k
    b = 65 + (170 - 65) * k
  }
  return `rgba(${r | 0},${g | 0},${b | 0},${(0.06 + 0.4 * c).toFixed(3)})`
}

// Background: estimated leverage bands (full width) + real liquidation strip (right edge).
class HeatmapRenderer implements IPrimitivePaneRenderer {
  constructor(private readonly source: LiquidationsPrimitive) {}
  draw(target: RenderTarget) {
    const series = this.source.series
    if (!series) return
    const hm = this.source.heatmap
    const rp = this.source.realProfile
    target.useBitmapCoordinateSpace((scope) => {
      const ctx = scope.context
      const hpr = scope.horizontalPixelRatio
      const vpr = scope.verticalPixelRatio
      const W = scope.mediaSize.width

      // Estimated leverage heatmap (predictive magnets)
      if (hm && hm.max > 0) {
        for (const b of hm.buckets) {
          const tot = b.longMag + b.shortMag
          const t = tot / hm.max
          if (t < 0.04) continue
          const yHigh = series.priceToCoordinate(b.high)
          const yLow = series.priceToCoordinate(b.low)
          if (yHigh == null || yLow == null) continue
          const top = Math.min(yHigh, yLow)
          const h = Math.max(1, Math.abs(yLow - yHigh))
          ctx.fillStyle = heat(t)
          ctx.fillRect(0, top * vpr, W * hpr, h * vpr)
        }
      }

      // Real liquidations by price (right-edge strip — where it actually happened)
      if (rp && rp.max > 0) {
        const stripMax = W * 0.1
        for (const b of rp.buckets) {
          const tot = b.long + b.short
          if (tot <= 0) continue
          const yHigh = series.priceToCoordinate(b.high)
          const yLow = series.priceToCoordinate(b.low)
          if (yHigh == null || yLow == null) continue
          const top = Math.min(yHigh, yLow)
          const h = Math.max(1, Math.abs(yLow - yHigh))
          const w = (tot / rp.max) * stripMax
          const long = b.long >= b.short
          const a = (0.3 + 0.55 * (tot / rp.max)).toFixed(3)
          ctx.fillStyle = long ? `rgba(240,85,106,${a})` : `rgba(38,208,124,${a})`
          ctx.fillRect((W - w) * hpr, top * vpr, w * hpr, h * vpr)
        }
      }
    })
  }
}

// Foreground: individual real liquidation events, whales emphasised.
class BubblesRenderer implements IPrimitivePaneRenderer {
  constructor(private readonly source: LiquidationsPrimitive) {}
  draw(target: RenderTarget) {
    const chart = this.source.chart
    const series = this.source.series
    if (!chart || !series || !this.source.events.length) return
    const ts = chart.timeScale()
    target.useBitmapCoordinateSpace((scope) => {
      const ctx = scope.context
      const hpr = scope.horizontalPixelRatio
      const vpr = scope.verticalPixelRatio
      const pr = Math.max(hpr, vpr)
      for (const e of this.source.events) {
        const x = ts.timeToCoordinate(e.time as Time)
        const y = series.priceToCoordinate(e.price)
        if (x == null || y == null) continue
        const whale = e.usd >= WHALE_USD
        const base = Math.max(2.5, Math.min(20, 2.5 + Math.log10(e.usd / 1000 + 1) * 3.2))
        const r = whale ? Math.max(9, base) : base
        const long = e.side === 'long'
        const cx = x * hpr
        const cy = y * vpr
        ctx.beginPath()
        ctx.arc(cx, cy, r * pr, 0, Math.PI * 2)
        ctx.fillStyle = long
          ? `rgba(240,85,106,${whale ? 0.6 : 0.45})`
          : `rgba(38,208,124,${whale ? 0.6 : 0.45})`
        ctx.fill()
        ctx.lineWidth = 1 * vpr
        ctx.strokeStyle = long ? 'rgba(240,85,106,0.9)' : 'rgba(38,208,124,0.9)'
        ctx.stroke()
        if (whale) {
          // gold halo for whales
          ctx.beginPath()
          ctx.arc(cx, cy, (r + 3) * pr, 0, Math.PI * 2)
          ctx.lineWidth = 1.5 * vpr
          ctx.strokeStyle = 'rgba(224,179,65,0.9)'
          ctx.stroke()
        }
      }
    })
  }
}

class HeatmapView implements IPrimitivePaneView {
  constructor(private readonly source: LiquidationsPrimitive) {}
  zOrder(): 'bottom' {
    return 'bottom'
  }
  renderer(): IPrimitivePaneRenderer {
    return new HeatmapRenderer(this.source)
  }
}
class BubblesView implements IPrimitivePaneView {
  constructor(private readonly source: LiquidationsPrimitive) {}
  zOrder(): 'top' {
    return 'top'
  }
  renderer(): IPrimitivePaneRenderer {
    return new BubblesRenderer(this.source)
  }
}

export class LiquidationsPrimitive implements ISeriesPrimitive<Time> {
  chart: IChartApi | null = null
  series: ISeriesApi<SeriesType> | null = null
  heatmap: LiqHeatmap | null = null
  realProfile: RealLiqProfile | null = null
  events: LiqEvent[] = []
  private requestUpdate?: () => void
  private readonly views = [new HeatmapView(this), new BubblesView(this)]

  attached(param: SeriesAttachedParameter<Time>): void {
    this.chart = param.chart
    this.series = param.series
    this.requestUpdate = param.requestUpdate
  }
  detached(): void {
    this.chart = null
    this.series = null
    this.requestUpdate = undefined
  }
  setHeatmap(hm: LiqHeatmap | null): void {
    this.heatmap = hm
    this.requestUpdate?.()
  }
  setRealProfile(p: RealLiqProfile | null): void {
    this.realProfile = p
    this.requestUpdate?.()
  }
  setEvents(events: LiqEvent[]): void {
    this.events = events
    this.requestUpdate?.()
  }
  updateAllViews(): void {}
  paneViews(): readonly IPrimitivePaneView[] {
    return this.views
  }
}
