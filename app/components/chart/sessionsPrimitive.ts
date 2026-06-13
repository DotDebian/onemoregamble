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
import type { SessionSegment } from '~/indicators/sessions'

// Structural type for the bitmap render scope (lightweight-charts' renderer
// target comes from 'fancy-canvas', which pnpm doesn't hoist for direct import).
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

// A lightweight-charts series primitive that paints market-session bands as a
// translucent background behind the candles (zOrder: 'bottom'). Overlapping
// sessions stack, so e.g. the London↔New York window reads as a hotter zone.

class SessionsRenderer implements IPrimitivePaneRenderer {
  constructor(private readonly source: SessionsPrimitive) {}

  draw(target: RenderTarget) {
    const chart = this.source.chart
    if (!chart) return
    const ts = chart.timeScale()
    const barSpacing = ts.options().barSpacing ?? 6
    const half = barSpacing / 2

    target.useBitmapCoordinateSpace((scope) => {
      const ctx = scope.context
      const hpr = scope.horizontalPixelRatio
      const height = scope.bitmapSize.height
      const width = scope.mediaSize.width

      for (const seg of this.source.segments) {
        const a = ts.timeToCoordinate(seg.start as Time)
        const b = ts.timeToCoordinate(seg.end as Time)
        if (a === null && b === null) continue
        // Clamp to the pane edges so bands stay continuous while scrolling.
        const left = a === null ? 0 : a - half
        const right = b === null ? width : b + half
        if (right <= 0 || left >= width) continue
        ctx.fillStyle = seg.session.fill
        ctx.fillRect(
          Math.max(0, left) * hpr,
          0,
          (Math.min(width, right) - Math.max(0, left)) * hpr,
          height,
        )
      }
    })
  }
}

class SessionsPaneView implements IPrimitivePaneView {
  constructor(private readonly source: SessionsPrimitive) {}
  zOrder(): 'bottom' {
    return 'bottom'
  }
  renderer(): IPrimitivePaneRenderer {
    return new SessionsRenderer(this.source)
  }
}

export class SessionsPrimitive implements ISeriesPrimitive<Time> {
  chart: IChartApi | null = null
  segments: SessionSegment[] = []
  private series: ISeriesApi<SeriesType> | null = null
  private requestUpdate?: () => void
  private readonly paneView = new SessionsPaneView(this)

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

  setSegments(segments: SessionSegment[]): void {
    this.segments = segments
    this.requestUpdate?.()
  }

  updateAllViews(): void {}

  paneViews(): readonly IPrimitivePaneView[] {
    return [this.paneView]
  }
}
