import { computed } from 'vue'
import { computeMarketClock, type MarketClockResult } from '~/analysis/marketClock'

/**
 * Reactive 24h × weekday profile of the deep history buffer. Recomputes only
 * when the deep buffer is (re)loaded — i.e. on symbol/timeframe change — not on
 * every live tick, so the aggregation over thousands of candles runs once.
 */
export function useMarketClock() {
  const { deepCandles, deepReady, symbol, interval } = useMarket()
  const clock = computed<MarketClockResult>(() => computeMarketClock(deepCandles.value))
  return { clock, deepReady, symbol, interval }
}
