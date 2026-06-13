// In-memory store of *real* liquidation events, fed continuously by the Nitro
// plugin (server/plugins/liquidations.ts). Survives browser reloads and
// accumulates for as long as the server process runs. Auto-imported by Nitro.

export interface ServerLiqEvent {
  symbol: string
  time: number // unix seconds
  price: number
  usd: number
  side: 'long' | 'short'
}

export const TRACKED_SYMBOLS = new Set([
  'BTCUSDT',
  'ETHUSDT',
  'SOLUSDT',
  'BNBUSDT',
  'XRPUSDT',
  'DOGEUSDT',
])

const MAX_PER_SYMBOL = 2500
const MAX_AGE = 24 * 3600 // seconds

const store = new Map<string, ServerLiqEvent[]>()
const subscribers = new Set<(e: ServerLiqEvent) => void>()
let connected = false
let lastEventAt = 0

export function setLiqConnected(b: boolean): void {
  connected = b
}

export function liqStatus(): { connected: boolean; lastEventAt: number; total: number } {
  let total = 0
  for (const arr of store.values()) total += arr.length
  return { connected, lastEventAt, total }
}

export function addLiq(e: ServerLiqEvent): void {
  if (!TRACKED_SYMBOLS.has(e.symbol)) return
  lastEventAt = e.time
  const cutoff = e.time - MAX_AGE
  const arr = (store.get(e.symbol) ?? []).filter((x) => x.time >= cutoff)
  arr.push(e)
  store.set(e.symbol, arr.slice(-MAX_PER_SYMBOL))
  for (const cb of subscribers) {
    try {
      cb(e)
    } catch {
      // ignore broken subscriber
    }
  }
}

export function getLiqs(symbol: string, since = 0): ServerLiqEvent[] {
  return (store.get(symbol) ?? []).filter((e) => e.time >= since)
}

export function subscribeLiqs(cb: (e: ServerLiqEvent) => void): () => void {
  subscribers.add(cb)
  return () => subscribers.delete(cb)
}
