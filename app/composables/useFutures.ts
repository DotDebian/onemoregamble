import { ref, watch, type Ref } from 'vue'

const FAPI = 'https://fapi.binance.com/fapi/v1'

export interface FuturesState {
  markPrice: number
  fundingRate: number // as fraction (e.g. 0.0001)
  nextFundingTime: number // ms epoch
  openInterest: number // base asset
  openInterestUsd: number
}

let futures: Ref<FuturesState | null> | null = null
let timer: ReturnType<typeof setInterval> | null = null
let wired = false
let epoch = 0

interface PremiumRaw {
  markPrice: string
  lastFundingRate: string
  nextFundingTime: number
}
interface OpenInterestRaw {
  openInterest: string
}

async function refresh(symbol: string, state: Ref<FuturesState | null>, myEpoch: number) {
  try {
    const [premium, oi] = await Promise.all([
      $fetch<PremiumRaw>(`${FAPI}/premiumIndex?symbol=${symbol}`),
      $fetch<OpenInterestRaw>(`${FAPI}/openInterest?symbol=${symbol}`),
    ])
    if (myEpoch !== epoch) return
    const mark = +premium.markPrice
    const interest = +oi.openInterest
    state.value = {
      markPrice: mark,
      fundingRate: +premium.lastFundingRate,
      nextFundingTime: +premium.nextFundingTime,
      openInterest: interest,
      openInterestUsd: interest * mark,
    }
  } catch {
    if (myEpoch === epoch) state.value = null
  }
}

function start(symbol: string, state: Ref<FuturesState | null>) {
  epoch++
  const myEpoch = epoch
  if (timer) clearInterval(timer)
  state.value = null
  refresh(symbol, state, myEpoch)
  timer = setInterval(() => refresh(symbol, state, myEpoch), 30000)
}

export function useFutures() {
  if (!futures) futures = ref<FuturesState | null>(null)
  const state = futures
  const { symbol } = useMarket()

  if (!wired && import.meta.client) {
    wired = true
    start(symbol.value, state)
    watch(symbol, (s) => start(s, state))
  }

  return { futures: state }
}
