import { shallowRef, ref, computed, type ShallowRef, type Ref } from 'vue'
import type { Candle, BinanceKline } from '~/types/market'
import { klineToCandle } from '~/types/market'

export type MarketStatus = 'idle' | 'loading' | 'live' | 'reconnecting' | 'error'

const REST_BASE = 'https://api.binance.com/api/v3'
const WS_BASE = 'wss://stream.binance.com:9443/ws'
const HISTORY_LIMIT = 1000
const MAX_CANDLES = 1500

export interface Ticker24h {
  high: number
  low: number
  volume: number
  quoteVolume: number
  changePct: number
  weightedAvg: number
}

export interface SymbolOption {
  symbol: string
  label: string
}

export const SYMBOLS: SymbolOption[] = [
  { symbol: 'BTCUSDT', label: 'BTC/USDT' },
  { symbol: 'ETHUSDT', label: 'ETH/USDT' },
  { symbol: 'SOLUSDT', label: 'SOL/USDT' },
  { symbol: 'BNBUSDT', label: 'BNB/USDT' },
  { symbol: 'XRPUSDT', label: 'XRP/USDT' },
  { symbol: 'DOGEUSDT', label: 'DOGE/USDT' },
]

export const INTERVALS = ['1m', '5m', '15m', '30m', '1h', '4h', '1d'] as const
export type Interval = (typeof INTERVALS)[number]

interface MarketState {
  candles: ShallowRef<Candle[]>
  lastTick: ShallowRef<{ candle: Candle; isNew: boolean } | null>
  reloadKey: Ref<number>
  ready: Ref<boolean>
  status: Ref<MarketStatus>
  error: Ref<string | null>
  symbol: Ref<string>
  interval: Ref<string>
  stats: Ref<Ticker24h | null>
}

let state: MarketState | null = null
let ws: WebSocket | null = null
let reconnectTimer: ReturnType<typeof setTimeout> | null = null
let statsTimer: ReturnType<typeof setInterval> | null = null
let reconnectDelay = 1000
let started = false
let epoch = 0 // bumps on every (re)config to invalidate stale async work

function createState(): MarketState {
  const config = useRuntimeConfig()
  return {
    candles: shallowRef<Candle[]>([]),
    lastTick: shallowRef<{ candle: Candle; isNew: boolean } | null>(null),
    reloadKey: ref(0),
    ready: ref(false),
    status: ref<MarketStatus>('idle'),
    error: ref<string | null>(null),
    symbol: ref(String(config.public.symbol || 'BTCUSDT')),
    interval: ref(String(config.public.interval || '5m')),
    stats: ref<Ticker24h | null>(null),
  }
}

async function loadHistory(s: MarketState, myEpoch: number) {
  s.status.value = 'loading'
  s.error.value = null
  const url = `${REST_BASE}/klines?symbol=${s.symbol.value}&interval=${s.interval.value}&limit=${HISTORY_LIMIT}`
  const raw = (await $fetch<BinanceKline[]>(url)) ?? []
  if (myEpoch !== epoch) return // config changed mid-flight; drop stale data
  s.candles.value = raw.map(klineToCandle)
  s.ready.value = true
  s.reloadKey.value++
}

interface Ticker24hRaw {
  highPrice: string
  lowPrice: string
  volume: string
  quoteVolume: string
  priceChangePercent: string
  weightedAvgPrice: string
}

async function fetchStats(s: MarketState, myEpoch: number) {
  try {
    const t = await $fetch<Ticker24hRaw>(`${REST_BASE}/ticker/24hr?symbol=${s.symbol.value}`)
    if (myEpoch !== epoch) return
    s.stats.value = {
      high: +t.highPrice,
      low: +t.lowPrice,
      volume: +t.volume,
      quoteVolume: +t.quoteVolume,
      changePct: +t.priceChangePercent,
      weightedAvg: +t.weightedAvgPrice,
    }
  } catch {
    // non-critical
  }
}

function applyTick(s: MarketState, candle: Candle) {
  const arr = s.candles.value
  const last = arr[arr.length - 1]
  let isNew = false
  let next: Candle[]
  if (last && candle.time === last.time) {
    next = arr.slice()
    next[next.length - 1] = candle
  } else if (!last || candle.time > last.time) {
    isNew = true
    next = arr.slice(-(MAX_CANDLES - 1))
    next.push(candle)
  } else {
    return
  }
  s.candles.value = next
  s.lastTick.value = { candle, isNew }
}

function connectWs(s: MarketState, myEpoch: number) {
  const stream = `${s.symbol.value.toLowerCase()}@kline_${s.interval.value}`
  ws = new WebSocket(`${WS_BASE}/${stream}`)

  ws.onopen = () => {
    if (myEpoch !== epoch) return
    s.status.value = 'live'
    reconnectDelay = 1000
  }

  ws.onmessage = (ev) => {
    if (myEpoch !== epoch) return
    try {
      const msg = JSON.parse(ev.data as string)
      const k = msg?.k
      if (!k) return
      applyTick(s, {
        time: Math.floor(k.t / 1000),
        open: +k.o,
        high: +k.h,
        low: +k.l,
        close: +k.c,
        volume: +k.v,
      })
    } catch {
      // ignore malformed frames
    }
  }

  ws.onerror = () => {
    if (myEpoch !== epoch) return
    s.status.value = 'reconnecting'
  }

  ws.onclose = () => {
    if (!started || myEpoch !== epoch) return
    s.status.value = 'reconnecting'
    scheduleReconnect(s, myEpoch)
  }
}

function scheduleReconnect(s: MarketState, myEpoch: number) {
  if (reconnectTimer) clearTimeout(reconnectTimer)
  reconnectTimer = setTimeout(async () => {
    if (myEpoch !== epoch) return
    try {
      await loadHistory(s, myEpoch)
      if (myEpoch !== epoch) return
      connectWs(s, myEpoch)
    } catch (e) {
      s.error.value = e instanceof Error ? e.message : 'reconnexion échouée'
      reconnectDelay = Math.min(reconnectDelay * 2, 30000)
      scheduleReconnect(s, myEpoch)
    }
  }, reconnectDelay)
}

async function boot(s: MarketState) {
  epoch++
  const myEpoch = epoch
  if (reconnectTimer) clearTimeout(reconnectTimer)
  if (statsTimer) clearInterval(statsTimer)
  ws?.close()
  ws = null
  reconnectDelay = 1000
  try {
    await loadHistory(s, myEpoch)
    if (myEpoch !== epoch) return
    connectWs(s, myEpoch)
    fetchStats(s, myEpoch)
    statsTimer = setInterval(() => fetchStats(s, myEpoch), 20000)
  } catch (e) {
    if (myEpoch !== epoch) return
    s.status.value = 'error'
    s.error.value = e instanceof Error ? e.message : 'chargement Binance échoué'
  }
}

export function useMarket() {
  if (!state) state = createState()
  const s = state

  async function start() {
    if (started) return
    started = true
    await boot(s)
  }

  function stop() {
    started = false
    epoch++
    if (reconnectTimer) clearTimeout(reconnectTimer)
    if (statsTimer) clearInterval(statsTimer)
    ws?.close()
    ws = null
  }

  function setSymbol(symbol: string) {
    if (symbol === s.symbol.value) return
    s.symbol.value = symbol
    s.ready.value = false
    if (started) boot(s)
  }

  function setInterval_(interval: string) {
    if (interval === s.interval.value) return
    s.interval.value = interval
    s.ready.value = false
    if (started) boot(s)
  }

  const lastPrice = computed(() => s.candles.value.at(-1)?.close ?? null)

  const dayChangePct = computed(() => {
    if (s.stats.value) return s.stats.value.changePct
    const arr = s.candles.value
    const last = arr.at(-1)
    if (!last) return null
    const cutoff = last.time - 24 * 3600
    const ref = arr.find((c) => c.time >= cutoff)
    if (!ref || ref.open === 0) return null
    return ((last.close - ref.open) / ref.open) * 100
  })

  return {
    candles: s.candles,
    lastTick: s.lastTick,
    reloadKey: s.reloadKey,
    ready: s.ready,
    status: s.status,
    error: s.error,
    symbol: s.symbol,
    interval: s.interval,
    stats: s.stats,
    lastPrice,
    dayChangePct,
    start,
    stop,
    setSymbol,
    setInterval: setInterval_,
  }
}
