import { ref } from 'vue'
import { lastFinite, sessionStatuses } from '~/indicators'
import {
  estimateLiquidationHeatmap,
  hottestCluster,
  aggregateLiquidations,
  hottestRealCluster,
} from '~/indicators/liquidations'

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

interface MarketContext {
  symbol: string
  interval: string
  time?: string
  price?: number
  candle?: { o: number; h: number; l: number; c: number; v: number }
  stats24h?: { high: number; low: number; changePct: number; quoteVolume: number }
  futures?: { fundingRate: number; openInterestUsd: number; markPrice: number }
  orderBook?: { imbalance: number; spreadPct: number }
  liquidations?: {
    long1h: number
    short1h: number
    whales: number
    whaleUsd: number
    estCluster?: { price: number; side: 'long' | 'short' }
    realCluster?: { price: number; usd: number; side: 'long' | 'short' }
  }
  indicators?: { name: string; describe?: string; items: { label: string; value: string }[] }[]
  sessions?: { name: string; open: boolean; eta: string }[]
}

const messages = ref<ChatMessage[]>([])
const streaming = ref(false)
const errorCode = ref<string | null>(null)

function fmtDur(min: number): string {
  const h = Math.floor(min / 60)
  const m = min % 60
  return h > 0 ? `${h}h${m.toString().padStart(2, '0')}` : `${m}m`
}

export function useChat() {
  const { candles, lastPrice, symbol, interval, stats } = useMarket()
  const { computedIndicators } = useIndicators()
  const { futures } = useFutures()
  const { book } = useOrderBook()
  const { tally1h, events: liqEvents } = useLiquidations()

  function buildContext(): MarketContext {
    const last = candles.value.at(-1)
    const nowSec = Math.floor(Date.now() / 1000)

    const indicators = computedIndicators.value.map((ci) => {
      const items = ci.def.snapshot
        ? ci.def.snapshot(candles.value, ci.result)
        : ci.result.plots.map((p) => {
            const lf = lastFinite(p)
            return { label: p.label, value: lf ? formatNum(lf.value) : '—' }
          })
      return {
        name: ci.def.name,
        describe: ci.def.describe?.(),
        items: items.map((i) => ({ label: i.label, value: i.value })),
      }
    })

    const sessionsCtx = sessionStatuses(nowSec).map((s) => ({
      name: s.session.name,
      open: s.open,
      eta: `${s.open ? 'ferme dans ' : 'ouvre dans '}${fmtDur(s.minutesToChange)}`,
    }))

    return {
      symbol: symbol.value,
      interval: interval.value,
      time: last ? new Date(last.time * 1000).toISOString() : new Date().toISOString(),
      price: lastPrice.value ?? undefined,
      candle: last
        ? { o: last.open, h: last.high, l: last.low, c: last.close, v: last.volume }
        : undefined,
      stats24h: stats.value
        ? {
            high: stats.value.high,
            low: stats.value.low,
            changePct: stats.value.changePct,
            quoteVolume: stats.value.quoteVolume,
          }
        : undefined,
      futures: futures.value
        ? {
            fundingRate: futures.value.fundingRate,
            openInterestUsd: futures.value.openInterestUsd,
            markPrice: futures.value.markPrice,
          }
        : undefined,
      orderBook: book.value
        ? { imbalance: book.value.imbalance, spreadPct: book.value.spreadPct }
        : undefined,
      liquidations: (() => {
        const hm = estimateLiquidationHeatmap(candles.value.slice(-300))
        const real = hm
          ? aggregateLiquidations(liqEvents.value, hm.priceMin, hm.priceMax, hm.buckets.length)
          : null
        return {
          long1h: tally1h.value.long,
          short1h: tally1h.value.short,
          whales: tally1h.value.whales,
          whaleUsd: tally1h.value.whaleUsd,
          estCluster: hottestCluster(hm) ?? undefined,
          realCluster: hottestRealCluster(real) ?? undefined,
        }
      })(),
      indicators,
      sessions: sessionsCtx,
    }
  }

  async function send(text: string, opts?: { effort?: string }) {
    const content = text.trim()
    if (!content || streaming.value) return
    errorCode.value = null
    messages.value.push({ role: 'user', content })

    const history = messages.value.map((m) => ({ role: m.role, content: m.content }))
    const idx = messages.value.push({ role: 'assistant', content: '' }) - 1
    streaming.value = true

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: history, context: buildContext(), effort: opts?.effort }),
      })

      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => null)
        errorCode.value = data?.error ?? `http_${res.status}`
        messages.value[idx]!.content =
          data?.message ?? `Erreur ${res.status}. Vérifie la configuration du serveur.`
        return
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        messages.value[idx]!.content += decoder.decode(value, { stream: true })
      }
    } catch {
      errorCode.value = 'network'
      messages.value[idx]!.content = 'Erreur réseau — le serveur est-il démarré ?'
    } finally {
      streaming.value = false
    }
  }

  function reset() {
    messages.value = []
    errorCode.value = null
  }

  return { messages, streaming, errorCode, send, reset }
}
