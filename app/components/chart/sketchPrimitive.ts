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

export interface SketchHighlight {
  startTime: number
  endTime: number
}

class SketchRenderer implements IPrimitivePaneRenderer {
  constructor(private readonly source: SketchPrimitive) {}

  draw(target: RenderTarget) {
    const chart = this.source.chart
    if (!chart) return
    const ts = chart.timeScale()

    target.useBitmapCoordinateSpace((scope) => {
      const ctx = scope.context
      const hpr = scope.horizontalPixelRatio
      const vpr = scope.verticalPixelRatio
      const H = scope.mediaSize.height

      // 1) highlighted match window (translucent vertical band)
      const hl = this.source.highlight
      if (hl) {
        const xa = ts.timeToCoordinate(hl.startTime as Time)
        const xb = ts.timeToCoordinate(hl.endTime as Time)
        if (xa != null || xb != null) {
          const x1 = (xa ?? xb)! * hpr
          const x2 = (xb ?? xa)! * hpr
          ctx.fillStyle = 'rgba(224,179,65,0.12)'
          ctx.fillRect(Math.min(x1, x2), 0, Math.abs(x2 - x1), H * vpr)
          ctx.strokeStyle = 'rgba(224,179,65,0.8)'
          ctx.lineWidth = Math.max(1, 1 * hpr)
          ctx.setLineDash([4 * hpr, 3 * hpr])
          for (const x of [x1, x2]) {
            ctx.beginPath()
            ctx.moveTo(x, 0)
            ctx.lineTo(x, H * vpr)
            ctx.stroke()
          }
          ctx.setLineDash([])
        }
      }

      // 2) live freehand stroke (media-space points captured during the drag)
      const pts = this.source.stroke
      if (pts.length > 1) {
        ctx.strokeStyle = '#e0b341'
        ctx.lineWidth = Math.max(1.5, 2 * vpr)
        ctx.lineJoin = 'round'
        ctx.lineCap = 'round'
        ctx.beginPath()
        ctx.moveTo(pts[0]!.x * hpr, pts[0]!.y * vpr)
        for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i]!.x * hpr, pts[i]!.y * vpr)
        ctx.stroke()
      }
    })
  }
}

class SketchPaneView implements IPrimitivePaneView {
  constructor(private readonly source: SketchPrimitive) {}
  zOrder(): 'top' {
    return 'top'
  }
  renderer(): IPrimitivePaneRenderer {
    return new SketchRenderer(this.source)
  }
}

export class SketchPrimitive implements ISeriesPrimitive<Time> {
  chart: IChartApi | null = null
  series: ISeriesApi<SeriesType> | null = null
  stroke: { x: number; y: number }[] = []
  highlight: SketchHighlight | null = null
  private requestUpdate?: () => void
  private readonly paneView = new SketchPaneView(this)

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
  setStroke(stroke: { x: number; y: number }[]): void {
    this.stroke = stroke
    this.requestUpdate?.()
  }
  setHighlight(hl: SketchHighlight | null): void {
    this.highlight = hl
    this.requestUpdate?.()
  }
  updateAllViews(): void {}
  paneViews(): readonly IPrimitivePaneView[] {
    return [this.paneView]
  }
}
