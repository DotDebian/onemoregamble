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
import { projectTimeToX, type TimeProjection } from './timeProjection'

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

/** Everything the renderer needs to draw the forward projection, set per frame. */
export interface EchoesViewData {
  enabled: boolean
  lastClose: number | null
  projection: TimeProjection | null
  horizon: number
  /** One entry per match: fractional returns relative to lastClose, length=horizon. */
  paths: number[][]
  median: number[]
  bandLow: number[]
  bandHigh: number[]
}

class EchoesRenderer implements IPrimitivePaneRenderer {
  constructor(private readonly source: EchoesPrimitive) {}

  draw(target: RenderTarget) {
    const v = this.source.view
    const chart = this.source.chart
    const series = this.source.series
    if (!v.enabled || !chart || !series || v.lastClose == null || !v.projection) return
    const proj = v.projection
    const lastClose = v.lastClose
    const ts = chart.timeScale()

    const X = (step: number) => projectTimeToX(ts, proj, proj.lastTime + step * proj.interval)
    const Y = (ret: number) => series.priceToCoordinate(lastClose * (1 + ret))
    const x0 = projectTimeToX(ts, proj, proj.lastTime)
    const y0 = series.priceToCoordinate(lastClose)
    if (x0 == null || y0 == null) return

    target.useBitmapCoordinateSpace((scope) => {
      const ctx = scope.context
      const hpr = scope.horizontalPixelRatio
      const vpr = scope.verticalPixelRatio
      const px = (x: number) => x * hpr
      const py = (y: number) => y * vpr
      const H = v.horizon

      // 1) percentile cone (faint fill between p10 and p90 paths)
      if (v.bandHigh.length === H && v.bandLow.length === H) {
        ctx.beginPath()
        ctx.moveTo(px(x0), py(y0))
        for (let k = 0; k < H; k++) {
          const x = X(k + 1)
          const y = Y(v.bandHigh[k]!)
          if (x != null && y != null) ctx.lineTo(px(x), py(y))
        }
        for (let k = H - 1; k >= 0; k--) {
          const x = X(k + 1)
          const y = Y(v.bandLow[k]!)
          if (x != null && y != null) ctx.lineTo(px(x), py(y))
        }
        ctx.closePath()
        ctx.fillStyle = 'rgba(224,179,65,0.10)'
        ctx.fill()
      }

      // 2) individual match paths (thin, faint, neutral)
      ctx.strokeStyle = 'rgba(154,167,189,0.20)'
      ctx.lineWidth = Math.max(1, 1 * vpr)
      for (const path of v.paths) {
        ctx.beginPath()
        ctx.moveTo(px(x0), py(y0))
        for (let k = 0; k < path.length; k++) {
          const x = X(k + 1)
          const y = Y(path[k]!)
          if (x != null && y != null) ctx.lineTo(px(x), py(y))
        }
        ctx.stroke()
      }

      // 3) median path (bold gold)
      if (v.median.length === H) {
        ctx.strokeStyle = '#e0b341'
        ctx.lineWidth = Math.max(1.5, 2 * vpr)
        ctx.beginPath()
        ctx.moveTo(px(x0), py(y0))
        let endX: number | null = null
        let endY: number | null = null
        for (let k = 0; k < H; k++) {
          const x = X(k + 1)
          const y = Y(v.median[k]!)
          if (x != null && y != null) {
            ctx.lineTo(px(x), py(y))
            endX = x
            endY = y
          }
        }
        ctx.stroke()

        // end label: median forward return at the horizon
        if (endX != null && endY != null) {
          const r = v.median[H - 1]!
          const txt = `${r >= 0 ? '+' : ''}${(r * 100).toFixed(2)}%`
          ctx.font = `${11 * vpr}px 'IBM Plex Mono', monospace`
          const w = ctx.measureText(txt).width + 8 * hpr
          ctx.fillStyle = 'rgba(10,12,16,0.85)'
          ctx.fillRect(px(endX) + 4 * hpr, py(endY) - 8 * vpr, w, 16 * vpr)
          ctx.fillStyle = '#e0b341'
          ctx.textBaseline = 'middle'
          ctx.fillText(txt, px(endX) + 8 * hpr, py(endY))
        }
      }

      // anchor dot at the live close
      ctx.fillStyle = '#e0b341'
      ctx.beginPath()
      ctx.arc(px(x0), py(y0), 3 * Math.max(hpr, vpr), 0, Math.PI * 2)
      ctx.fill()
    })
  }
}

class EchoesPaneView implements IPrimitivePaneView {
  constructor(private readonly source: EchoesPrimitive) {}
  zOrder(): 'top' {
    return 'top'
  }
  renderer(): IPrimitivePaneRenderer {
    return new EchoesRenderer(this.source)
  }
}

export class EchoesPrimitive implements ISeriesPrimitive<Time> {
  chart: IChartApi | null = null
  series: ISeriesApi<SeriesType> | null = null
  view: EchoesViewData = {
    enabled: false,
    lastClose: null,
    projection: null,
    horizon: 0,
    paths: [],
    median: [],
    bandLow: [],
    bandHigh: [],
  }
  private requestUpdate?: () => void
  private readonly paneView = new EchoesPaneView(this)

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
  setData(view: EchoesViewData): void {
    this.view = view
    this.requestUpdate?.()
  }
  updateAllViews(): void {}
  paneViews(): readonly IPrimitivePaneView[] {
    return [this.paneView]
  }
}
