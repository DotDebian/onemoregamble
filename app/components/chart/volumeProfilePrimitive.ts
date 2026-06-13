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
import type { VolumeProfile } from '~/indicators/structure'

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

class VPRenderer implements IPrimitivePaneRenderer {
  constructor(private readonly source: VolumeProfilePrimitive) {}

  draw(target: RenderTarget) {
    const series = this.source.series
    const vp = this.source.profile
    if (!series || !vp || vp.maxVolume <= 0) return

    target.useBitmapCoordinateSpace((scope) => {
      const ctx = scope.context
      const hpr = scope.horizontalPixelRatio
      const vpr = scope.verticalPixelRatio
      const width = scope.mediaSize.width
      const maxBar = width * 0.3

      for (const bin of vp.bins) {
        if (bin.volume <= 0) continue
        const yHigh = series.priceToCoordinate(bin.high)
        const yLow = series.priceToCoordinate(bin.low)
        if (yHigh == null || yLow == null) continue
        const top = Math.min(yHigh, yLow)
        const h = Math.max(1, Math.abs(yLow - yHigh) - 1)
        const w = (bin.volume / vp.maxVolume) * maxBar
        const isPoc = bin.low <= vp.poc && vp.poc <= bin.high
        const inVA = bin.mid >= vp.val && bin.mid <= vp.vah
        ctx.fillStyle = isPoc
          ? 'rgba(224,179,65,0.5)'
          : inVA
            ? 'rgba(91,141,239,0.26)'
            : 'rgba(148,163,184,0.14)'
        ctx.fillRect((width - w) * hpr, top * vpr, w * hpr, h * vpr)
      }

      const yPoc = series.priceToCoordinate(vp.poc)
      if (yPoc != null) {
        ctx.strokeStyle = 'rgba(224,179,65,0.8)'
        ctx.lineWidth = Math.max(1, vpr)
        ctx.setLineDash([4 * hpr, 3 * hpr])
        ctx.beginPath()
        ctx.moveTo(0, yPoc * vpr)
        ctx.lineTo(width * hpr, yPoc * vpr)
        ctx.stroke()
        ctx.setLineDash([])
      }
    })
  }
}

class VPPaneView implements IPrimitivePaneView {
  constructor(private readonly source: VolumeProfilePrimitive) {}
  zOrder(): 'bottom' {
    return 'bottom'
  }
  renderer(): IPrimitivePaneRenderer {
    return new VPRenderer(this.source)
  }
}

export class VolumeProfilePrimitive implements ISeriesPrimitive<Time> {
  chart: IChartApi | null = null
  series: ISeriesApi<SeriesType> | null = null
  profile: VolumeProfile | null = null
  private requestUpdate?: () => void
  private readonly paneView = new VPPaneView(this)

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
  setProfile(profile: VolumeProfile | null): void {
    this.profile = profile
    this.requestUpdate?.()
  }
  updateAllViews(): void {}
  paneViews(): readonly IPrimitivePaneView[] {
    return [this.paneView]
  }
}
