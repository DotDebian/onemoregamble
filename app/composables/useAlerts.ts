import { ref, computed, watch, type Ref } from 'vue'
import { relativeStrengthIndex, exponentialMovingAverage } from '~/indicators/math'

export type AlertType = 'price' | 'rsi' | 'ema'
export type AlertDirection = 'above' | 'below'

export interface Alert {
  id: string
  symbol: string
  type: AlertType
  direction: AlertDirection
  /** price level, RSI threshold, or EMA period (for type 'ema') */
  value: number
  enabled: boolean
  triggered: boolean
  note?: string
}

const STORAGE_KEY = 'omg.alerts'

let alerts: Ref<Alert[]> | null = null
let lastTriggered: Ref<Alert | null> | null = null
let wired = false
const lastState = new Map<string, boolean>()

function uid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `a_${Date.now().toString(36)}_${Math.floor(Math.random() * 1e6).toString(36)}`
}

function load(): Alert[] {
  if (!import.meta.client) return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw)
  } catch {
    // ignore
  }
  return []
}

function persist(list: Alert[]) {
  if (!import.meta.client) return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list))
  } catch {
    // ignore
  }
}

function conditionMet(alert: Alert, closes: number[]): boolean | null {
  const price = closes[closes.length - 1]
  if (price == null) return null
  if (alert.type === 'price') {
    return alert.direction === 'above' ? price >= alert.value : price <= alert.value
  }
  if (alert.type === 'rsi') {
    const rsi = relativeStrengthIndex(closes, 14)
    const v = rsi[rsi.length - 1]
    if (v == null || Number.isNaN(v)) return null
    return alert.direction === 'above' ? v >= alert.value : v <= alert.value
  }
  // ema: price vs EMA(period)
  const ema = exponentialMovingAverage(closes, Math.round(alert.value))
  const v = ema[ema.length - 1]
  if (v == null || Number.isNaN(v)) return null
  return alert.direction === 'above' ? price >= v : price <= v
}

function fireNotification(alert: Alert) {
  if (!import.meta.client) return
  const title = `Alerte ${alert.symbol}`
  const body = describeAlert(alert)
  if ('Notification' in window && Notification.permission === 'granted') {
    try {
      new Notification(title, { body })
    } catch {
      // ignore
    }
  }
}

export function describeAlert(a: Alert): string {
  const dir = a.direction === 'above' ? '≥' : '≤'
  if (a.type === 'price') return `Prix ${dir} ${a.value}`
  if (a.type === 'rsi') return `RSI(14) ${dir} ${a.value}`
  return `Prix ${a.direction === 'above' ? 'croise au-dessus' : 'croise en-dessous'} EMA ${a.value}`
}

export function useAlerts() {
  if (!alerts) alerts = ref<Alert[]>(load())
  if (!lastTriggered) lastTriggered = ref<Alert | null>(null)
  const list = alerts
  const triggered = lastTriggered

  const { candles, symbol } = useMarket()

  // Single evaluation watcher across the app.
  if (!wired && import.meta.client) {
    wired = true
    watch(candles, (arr) => {
      if (!arr.length) return
      const closes = arr.map((c) => c.close)
      const sym = symbol.value
      let mutated = false
      for (const alert of list.value) {
        if (!alert.enabled || alert.triggered || alert.symbol !== sym) continue
        const met = conditionMet(alert, closes)
        if (met == null) continue
        const prev = lastState.get(alert.id)
        lastState.set(alert.id, met)
        if (prev === undefined) continue // arm on first observation
        if (!prev && met) {
          alert.triggered = true
          mutated = true
          triggered.value = alert
          fireNotification(alert)
        }
      }
      if (mutated) {
        list.value = [...list.value]
        persist(list.value)
      }
    })
  }

  const forSymbol = (sym: string) => computed(() => list.value.filter((a) => a.symbol === sym))

  function add(a: Omit<Alert, 'id' | 'triggered'>) {
    const alert: Alert = { ...a, id: uid(), triggered: false }
    list.value = [...list.value, alert]
    persist(list.value)
  }

  function remove(id: string) {
    list.value = list.value.filter((a) => a.id !== id)
    lastState.delete(id)
    persist(list.value)
  }

  function toggle(id: string) {
    list.value = list.value.map((a) =>
      a.id === id ? { ...a, enabled: !a.enabled, triggered: false } : a,
    )
    lastState.delete(id)
    persist(list.value)
  }

  function rearm(id: string) {
    list.value = list.value.map((a) => (a.id === id ? { ...a, triggered: false } : a))
    lastState.delete(id)
    persist(list.value)
  }

  function clear(sym?: string) {
    list.value = sym ? list.value.filter((a) => a.symbol !== sym) : []
    persist(list.value)
  }

  async function requestPermission() {
    if (import.meta.client && 'Notification' in window && Notification.permission === 'default') {
      try {
        await Notification.requestPermission()
      } catch {
        // ignore
      }
    }
  }

  return { alerts: list, lastTriggered: triggered, forSymbol, add, remove, toggle, rearm, clear, requestPermission }
}
