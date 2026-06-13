import { ref, computed, watch, type Ref } from 'vue'
import { WHALE_USD } from '~/indicators/liquidations'

const MAX_EVENTS = 1000

export interface LiqEvent {
  time: number // unix seconds
  price: number
  usd: number
  side: 'long' | 'short'
  symbol?: string
}

let events: Ref<LiqEvent[]> | null = null
let serverConnected: Ref<boolean> | null = null
let es: EventSource | null = null
let wired = false

interface LiqResponse {
  events: LiqEvent[]
  status?: { connected: boolean; total: number; lastEventAt: number }
}

const keyOf = (e: LiqEvent) => `${e.time}-${e.price}-${e.usd}-${e.side}`

async function connect(symbol: string, state: Ref<LiqEvent[]>, status: Ref<boolean>) {
  es?.close()
  es = null
  state.value = []

  // Persisted history from the server (survives reloads).
  try {
    const r = await $fetch<LiqResponse>('/api/liquidations', { query: { symbol } })
    state.value = (r?.events ?? []).slice(-MAX_EVENTS)
    status.value = r?.status?.connected ?? false
  } catch {
    status.value = false
    // server may be down; SSE may still backfill nothing — degrade quietly
  }

  if (!import.meta.client) return

  // Live push via SSE (the browser never touches Binance futures directly).
  const seen = new Set(state.value.map(keyOf))
  es = new EventSource(`/api/liquidations/stream?symbol=${encodeURIComponent(symbol)}`)
  es.onmessage = (ev) => {
    try {
      const e = JSON.parse(ev.data) as LiqEvent
      const k = keyOf(e)
      if (seen.has(k)) return
      seen.add(k)
      state.value = [...state.value, e].slice(-MAX_EVENTS)
    } catch {
      // ignore
    }
  }
}

export function useLiquidations() {
  if (!events) events = ref<LiqEvent[]>([])
  if (!serverConnected) serverConnected = ref(false)
  const state = events
  const connected = serverConnected
  const { symbol } = useMarket()

  if (!wired && import.meta.client) {
    wired = true
    connect(symbol.value, state, connected)
    watch(symbol, (s) => connect(s, state, connected))
  }

  /** Long/short notional + whale activity over the last hour. */
  const tally1h = computed(() => {
    const cutoff = Math.floor(Date.now() / 1000) - 3600
    let long = 0
    let short = 0
    let whales = 0
    let whaleUsd = 0
    for (const e of state.value) {
      if (e.time < cutoff) continue
      if (e.side === 'long') long += e.usd
      else short += e.usd
      if (e.usd >= WHALE_USD) {
        whales++
        whaleUsd += e.usd
      }
    }
    return { long, short, whales, whaleUsd }
  })

  return { events: state, tally1h, connected }
}
