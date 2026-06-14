import type { IndicatorDefinition, IndicatorPlot } from '../types'

// Volume-weighted std-dev bands around the (daily-reset) VWAP.
export const vwapBandsIndicator: IndicatorDefinition = {
  id: 'vwapBands',
  name: 'VWAP Bands',
  category: 'overlay',
  pane: 'price',
  defaultEnabled: false,
  describe: () => '±1σ / ±2σ',
  compute(candles) {
    let cumPV = 0
    let cumV = 0
    let cumPV2 = 0
    let day = -1
    const vwap: number[] = []
    const sd: number[] = []
    // Whitespace the session-open bar so the bands break cleanly at the UTC
    // reset instead of drawing a vertical connector across midnight (mirrors
    // the VWAP line). Volume is still accumulated; only the plot point is gapped.
    const broke: boolean[] = []
    candles.forEach((c, i) => {
      const d = Math.floor(c.time / 86400)
      const reset = d !== day
      if (reset) {
        day = d
        cumPV = 0
        cumV = 0
        cumPV2 = 0
      }
      const tp = (c.high + c.low + c.close) / 3
      cumPV += tp * c.volume
      cumV += c.volume
      cumPV2 += tp * tp * c.volume
      const v = cumV > 0 ? cumPV / cumV : NaN
      const variance = cumV > 0 ? Math.max(0, cumPV2 / cumV - v * v) : NaN
      vwap.push(v)
      sd.push(Math.sqrt(variance))
      broke.push(reset && i > 0)
    })
    const mk = (mult: number, sign: number) =>
      candles.map((c, i) => ({
        time: c.time,
        value: broke[i] ? NaN : vwap[i]! + sign * mult * sd[i]!,
      }))
    const teal = (a: number) => `rgba(20,184,166,${a})`
    const plots: IndicatorPlot[] = [
      { key: 'vwapU2', label: '+2σ', kind: 'line', color: teal(0.45), lineWidth: 1, priceLineVisible: false, data: mk(2, 1) },
      { key: 'vwapU1', label: '+1σ', kind: 'line', color: teal(0.3), lineWidth: 1, priceLineVisible: false, data: mk(1, 1) },
      { key: 'vwapL1', label: '-1σ', kind: 'line', color: teal(0.3), lineWidth: 1, priceLineVisible: false, data: mk(1, -1) },
      { key: 'vwapL2', label: '-2σ', kind: 'line', color: teal(0.45), lineWidth: 1, priceLineVisible: false, data: mk(2, -1) },
    ]
    return { plots }
  },
}
