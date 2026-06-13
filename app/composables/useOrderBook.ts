import { ref, watch, type Ref } from 'vue'

const WS_BASE = 'wss://stream.binance.com:9443/ws'

export interface BookLevel {
  price: number
  qty: number
}
export interface BookState {
  bids: BookLevel[]
  asks: BookLevel[]
  bestBid: number
  bestAsk: number
  spread: number
  spreadPct: number
  bidVol: number
  askVol: number
  /** 0..1, share of top-of-book volume on the bid side */
  imbalance: number
}

let book: Ref<BookState | null> | null = null
let ws: WebSocket | null = null
let wired = false
let lastApply = 0

function connect(symbol: string, state: Ref<BookState | null>) {
  ws?.close()
  state.value = null
  ws = new WebSocket(`${WS_BASE}/${symbol.toLowerCase()}@depth20@100ms`)
  ws.onmessage = (ev) => {
    const now = Date.now()
    if (now - lastApply < 150) return // throttle to ~7 fps
    lastApply = now
    try {
      const msg = JSON.parse(ev.data as string)
      const bids: BookLevel[] = (msg.bids ?? []).map((b: string[]) => ({ price: +b[0]!, qty: +b[1]! }))
      const asks: BookLevel[] = (msg.asks ?? []).map((a: string[]) => ({ price: +a[0]!, qty: +a[1]! }))
      if (!bids.length || !asks.length) return
      const bidVol = bids.reduce((s, l) => s + l.qty, 0)
      const askVol = asks.reduce((s, l) => s + l.qty, 0)
      const bestBid = bids[0]!.price
      const bestAsk = asks[0]!.price
      const spread = bestAsk - bestBid
      state.value = {
        bids,
        asks,
        bestBid,
        bestAsk,
        spread,
        spreadPct: bestBid > 0 ? (spread / bestBid) * 100 : 0,
        bidVol,
        askVol,
        imbalance: bidVol + askVol > 0 ? bidVol / (bidVol + askVol) : 0.5,
      }
    } catch {
      // ignore
    }
  }
}

export function useOrderBook() {
  if (!book) book = ref<BookState | null>(null)
  const state = book
  const { symbol } = useMarket()

  if (!wired && import.meta.client) {
    wired = true
    connect(symbol.value, state)
    watch(symbol, (s) => connect(s, state))
  }

  return { book: state }
}
