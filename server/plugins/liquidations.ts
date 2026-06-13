import { WebSocket, type RawData } from 'ws'

// Continuously subscribes to Binance Futures' all-symbols liquidation stream
// and feeds the in-memory store. One server-side connection covers every
// tracked symbol; clients read history + SSE from /api/liquidations.
//
// We use the `ws` package rather than the runtime global WebSocket: Nitro's
// unenv layer can shim the global to a no-op, which silently never connects.

const STREAM = 'wss://fstream.binance.com/ws/!forceOrder@arr'

export default defineNitroPlugin(() => {
  let ws: WebSocket | null = null
  let retry = 1000
  let stopped = false

  const schedule = () => {
    if (stopped) return
    setTimeout(connect, retry)
    retry = Math.min(retry * 2, 30000)
  }

  const onDown = () => {
    setLiqConnected(false)
    try {
      ws?.removeAllListeners()
      ws?.close()
    } catch {
      // ignore
    }
    ws = null
    schedule()
  }

  function connect() {
    if (stopped) return
    console.log('[liq] connecting to fstream…')
    try {
      ws = new WebSocket(STREAM)
    } catch (e) {
      console.log('[liq] construct failed', (e as Error)?.message)
      schedule()
      return
    }

    ws.on('open', () => {
      retry = 1000
      setLiqConnected(true)
      console.log('[liq] connected ✓')
    })

    ws.on('message', (data: RawData) => {
      try {
        const o = JSON.parse(data.toString())?.o
        if (!o) return
        const symbol = String(o.s)
        if (!TRACKED_SYMBOLS.has(symbol)) return
        const price = +(o.ap || o.p)
        const qty = +o.q
        if (!Number.isFinite(price) || !Number.isFinite(qty)) return
        addLiq({
          symbol,
          time: Math.floor((o.T ?? Date.now()) / 1000),
          price,
          usd: qty * price,
          side: o.S === 'SELL' ? 'long' : 'short',
        })
      } catch {
        // ignore malformed frame
      }
    })

    ws.on('close', (code: number) => {
      console.log('[liq] close', code)
      onDown()
    })
    ws.on('error', (e: Error) => {
      console.log('[liq] error', e?.message)
      onDown()
    })
  }

  connect()
})
