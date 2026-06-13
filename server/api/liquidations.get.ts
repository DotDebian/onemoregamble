export default defineEventHandler((event) => {
  const q = getQuery(event)
  const symbol = String(q.symbol || 'BTCUSDT')
  const since = q.since ? Number(q.since) : 0
  return { events: getLiqs(symbol, since), status: liqStatus() }
})
