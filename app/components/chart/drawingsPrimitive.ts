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
import type { Drawing } from '~/composables/useDrawings'
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

const FIB_LEVELS = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1]

function fmtDelta(seconds: number): string {
  const s = Math.abs(seconds)
  const d = Math.floor(s / 86400)
  const h = Math.floor((s % 86400) / 3600)
  const m = Math.floor((s % 3600) / 60)
  if (d > 0) return `${d}j ${h}h`
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

class DrawingsRenderer implements IPrimitivePaneRenderer {
  constructor(private readonly source: DrawingsPrimitive) {}

  draw(target: RenderTarget) {
    const chart = this.source.chart
    const series = this.source.series
    if (!chart || !series) return
    const ts = chart.timeScale()
    const X = (t: number) => projectTimeToX(ts, this.source.projection, t)
    const Y = (p: number) => series.priceToCoordinate(p)

    target.useBitmapCoordinateSpace((scope) => {
      const ctx = scope.context
      const hpr = scope.horizontalPixelRatio
      const vpr = scope.verticalPixelRatio
      const W = scope.mediaSize.width

      const px = (v: number) => v * hpr
      const py = (v: number) => v * vpr

      const line = (
        x1: number,
        y1: number,
        x2: number,
        y2: number,
        color: string,
        width = 1.5,
        dash: number[] = [],
      ) => {
        ctx.strokeStyle = color
        ctx.lineWidth = Math.max(1, width * vpr)
        ctx.setLineDash(dash.map((d) => d * hpr))
        ctx.beginPath()
        ctx.moveTo(px(x1), py(y1))
        ctx.lineTo(px(x2), py(y2))
        ctx.stroke()
        ctx.setLineDash([])
      }

      const label = (x: number, y: number, text: string, color: string, bg = 'rgba(10,12,16,0.85)') => {
        ctx.font = `${11 * vpr}px 'IBM Plex Mono', monospace`
        const w = ctx.measureText(text).width + 8 * hpr
        const h = 16 * vpr
        ctx.fillStyle = bg
        ctx.fillRect(px(x), py(y) - h / 2, w, h)
        ctx.fillStyle = color
        ctx.textBaseline = 'middle'
        ctx.fillText(text, px(x) + 4 * hpr, py(y))
      }

      const handle = (x: number, y: number) => {
        const s = 4 * Math.max(hpr, vpr)
        ctx.fillStyle = '#e0b341'
        ctx.strokeStyle = '#0a0c10'
        ctx.lineWidth = 1 * vpr
        ctx.fillRect(px(x) - s, py(y) - s, s * 2, s * 2)
        ctx.strokeRect(px(x) - s, py(y) - s, s * 2, s * 2)
      }

      const all = this.source.draft
        ? [...this.source.drawings, this.source.draft]
        : this.source.drawings

      for (const d of all) {
        const sel = d.id === this.source.selectedId
        const accent = sel ? '#e0b341' : '#9aa7bd'

        if (d.type === 'horizontal') {
          const y = Y(d.a.price)
          if (y == null) continue
          line(0, y, W, y, '#e0b341', sel ? 2 : 1.5, [])
          label(6, y, d.a.price.toLocaleString('en-US', { maximumFractionDigits: 2 }), '#e0b341')
          if (sel) handle(W / 2, y)
          continue
        }

        const xa = X(d.a.time)
        const xb = X(d.b.time)
        const ya = Y(d.a.price)
        const yb = Y(d.b.price)

        if (d.type === 'trendline' || d.type === 'ray') {
          if (xa == null || xb == null || ya == null || yb == null) continue
          let ex: number = xb
          let ey: number = yb
          if (d.type === 'ray' && xb !== xa) {
            const slope = (yb - ya) / (xb - xa)
            ex = W
            ey = ya + slope * (W - xa)
          }
          line(xa, ya, ex, ey, accent, sel ? 2 : 1.5)
          if (sel) {
            handle(xa, ya)
            handle(xb, yb)
          }
          continue
        }

        if (d.type === 'rectangle') {
          if (ya == null || yb == null) continue
          const x1 = Math.max(0, Math.min(xa ?? 0, xb ?? W))
          const x2 = Math.min(W, Math.max(xa ?? 0, xb ?? W))
          const y1 = Math.min(ya, yb)
          const y2 = Math.max(ya, yb)
          ctx.fillStyle = 'rgba(91,141,239,0.12)'
          ctx.fillRect(px(x1), py(y1), px(x2 - x1), py(y2 - y1) - 0)
          ctx.strokeStyle = accent
          ctx.lineWidth = Math.max(1, (sel ? 1.6 : 1.2) * vpr)
          ctx.strokeRect(px(x1), py(y1), px(x2 - x1), py(y2 - y1))
          if (sel && xa != null && xb != null) {
            handle(xa, ya)
            handle(xb, yb)
          }
          continue
        }

        if (d.type === 'fib') {
          if (ya == null || yb == null) continue
          const lx = Math.max(0, Math.min(xa ?? 0, xb ?? W))
          const rx = xb == null && xa == null ? W : Math.max(xa ?? 0, xb ?? W)
          let prevY: number | null = null
          for (const r of FIB_LEVELS) {
            const price = d.b.price + (d.a.price - d.b.price) * r
            const y = Y(price)
            if (y == null) continue
            const col = r === 0 || r === 1 ? '#9aa7bd' : '#5b8def'
            line(lx, y, rx, y, col, 1, r === 0.5 ? [4, 3] : [])
            if (prevY != null) {
              ctx.fillStyle = 'rgba(91,141,239,0.05)'
              ctx.fillRect(px(lx), py(Math.min(prevY, y)), px(rx - lx), py(Math.abs(y - prevY)))
            }
            prevY = y
            label(lx + 2, y, `${(r * 100).toFixed(1)}%  ${price.toLocaleString('en-US', { maximumFractionDigits: 2 })}`, col)
          }
          if (sel && xa != null && xb != null && ya != null && yb != null) {
            handle(xa, ya)
            handle(xb, yb)
          }
          continue
        }

        if (d.type === 'measure') {
          if (xa == null || xb == null || ya == null || yb == null) continue
          const up = d.b.price >= d.a.price
          const col = up ? '#26d07c' : '#f0556a'
          ctx.fillStyle = up ? 'rgba(38,208,124,0.12)' : 'rgba(240,85,106,0.12)'
          ctx.fillRect(px(Math.min(xa, xb)), py(Math.min(ya, yb)), px(Math.abs(xb - xa)), py(Math.abs(yb - ya)))
          line(xa, ya, xb, yb, col, 1.5)
          const dPct = ((d.b.price - d.a.price) / d.a.price) * 100
          const txt = `${dPct >= 0 ? '+' : ''}${dPct.toFixed(2)}%  ·  ${fmtDelta(d.b.time - d.a.time)}`
          label((xa + xb) / 2 - 30, Math.min(ya, yb) - 12, txt, col)
          if (sel) {
            handle(xa, ya)
            handle(xb, yb)
          }
          continue
        }

        if (d.type === 'position') {
          const entry = d.a.price
          const stop = d.stop ?? entry
          const target = d.target ?? entry
          const yE = Y(entry)
          const yS = Y(stop)
          const yT = Y(target)
          if (yE == null || yS == null || yT == null) continue
          const x1 = Math.max(0, Math.min(xa ?? 0, xb ?? W))
          const x2 = Math.min(W, Math.max(xa ?? 0, xb ?? W))
          // reward zone (entry -> target)
          ctx.fillStyle = 'rgba(38,208,124,0.16)'
          ctx.fillRect(px(x1), py(Math.min(yE, yT)), px(x2 - x1), py(Math.abs(yT - yE)))
          // risk zone (entry -> stop)
          ctx.fillStyle = 'rgba(240,85,106,0.16)'
          ctx.fillRect(px(x1), py(Math.min(yE, yS)), px(x2 - x1), py(Math.abs(yS - yE)))
          line(x1, yE, x2, yE, '#e0b341', sel ? 2 : 1.5)
          line(x1, yS, x2, yS, '#f0556a', 1)
          line(x1, yT, x2, yT, '#26d07c', 1)
          const risk = Math.abs(entry - stop)
          const rr = risk > 0 ? Math.abs(target - entry) / risk : 0
          label(x1 + 2, yT, `RR ${rr.toFixed(2)}`, '#26d07c')
          if (sel) {
            handle((x1 + x2) / 2, yE)
            handle((x1 + x2) / 2, yS)
            handle((x1 + x2) / 2, yT)
          }
          continue
        }
      }
    })
  }
}

class DrawingsPaneView implements IPrimitivePaneView {
  constructor(private readonly source: DrawingsPrimitive) {}
  zOrder(): 'top' {
    return 'top'
  }
  renderer(): IPrimitivePaneRenderer {
    return new DrawingsRenderer(this.source)
  }
}

export class DrawingsPrimitive implements ISeriesPrimitive<Time> {
  chart: IChartApi | null = null
  series: ISeriesApi<SeriesType> | null = null
  drawings: Drawing[] = []
  draft: Drawing | null = null
  selectedId: string | null = null
  /** Bar geometry for extrapolating drawings past the live candle. */
  projection: TimeProjection | null = null
  private requestUpdate?: () => void
  private readonly paneView = new DrawingsPaneView(this)

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
  setData(
    drawings: Drawing[],
    selectedId: string | null,
    draft: Drawing | null,
    projection: TimeProjection | null,
  ): void {
    this.drawings = drawings
    this.selectedId = selectedId
    this.draft = draft
    this.projection = projection
    this.requestUpdate?.()
  }
  updateAllViews(): void {}
  paneViews(): readonly IPrimitivePaneView[] {
    return [this.paneView]
  }
}
