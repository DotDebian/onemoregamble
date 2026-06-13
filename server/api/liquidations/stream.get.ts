// SSE stream of live liquidations for one symbol.
export default defineEventHandler((event) => {
  const q = getQuery(event)
  const symbol = String(q.symbol || 'BTCUSDT')

  setHeader(event, 'content-type', 'text/event-stream')
  setHeader(event, 'cache-control', 'no-cache, no-transform')
  setHeader(event, 'connection', 'keep-alive')
  setHeader(event, 'x-accel-buffering', 'no')

  const encoder = new TextEncoder()
  let unsub: () => void = () => {}
  let hb: ReturnType<typeof setInterval> | null = null

  return new ReadableStream<Uint8Array>({
    start(controller) {
      unsub = subscribeLiqs((e) => {
        if (e.symbol !== symbol) return
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(e)}\n\n`))
        } catch {
          // stream closed
        }
      })
      hb = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(': ping\n\n'))
        } catch {
          // stream closed
        }
      }, 15000)
    },
    cancel() {
      unsub()
      if (hb) clearInterval(hb)
    },
  })
})
