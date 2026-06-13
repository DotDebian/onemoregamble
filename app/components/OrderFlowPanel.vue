<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'

const { stats, lastPrice } = useMarket()
const { book } = useOrderBook()
const { futures } = useFutures()
import { WHALE_USD } from '~/indicators/liquidations'
const { tally1h, events: liqEvents, connected: liqConnected } = useLiquidations()

const whalesOnly = ref(false)
const recentLiqs = computed(() => {
  const arr = whalesOnly.value
    ? liqEvents.value.filter((e) => e.usd >= WHALE_USD)
    : liqEvents.value
  return arr.slice(-8).reverse()
})
const isWhale = (usd: number) => usd >= WHALE_USD
function fmtTime(sec: number): string {
  return new Date(sec * 1000).toLocaleTimeString('fr-FR')
}

const now = ref(Date.now())
let timer: ReturnType<typeof setInterval> | null = null
onMounted(() => {
  timer = setInterval(() => (now.value = Date.now()), 1000)
})
onBeforeUnmount(() => {
  if (timer) clearInterval(timer)
})

const range24h = computed(() => {
  const s = stats.value
  if (!s || s.low === 0) return null
  return ((s.high - s.low) / s.low) * 100
})

const fundingCountdown = computed(() => {
  if (!futures.value) return '—'
  const diff = Math.max(0, futures.value.nextFundingTime - now.value)
  const h = Math.floor(diff / 3.6e6)
  const m = Math.floor((diff % 3.6e6) / 6e4)
  const s = Math.floor((diff % 6e4) / 1000)
  return `${h}h ${m.toString().padStart(2, '0')}m ${s.toString().padStart(2, '0')}s`
})

const basis = computed(() => {
  if (!futures.value || lastPrice.value == null) return null
  return futures.value.markPrice - lastPrice.value
})

const topBids = computed(() => book.value?.bids.slice(0, 6) ?? [])
const topAsks = computed(() => (book.value?.asks.slice(0, 6) ?? []).slice().reverse())
const maxQty = computed(() => {
  const b = book.value
  if (!b) return 1
  return Math.max(...b.bids.slice(0, 6).map((l) => l.qty), ...b.asks.slice(0, 6).map((l) => l.qty), 1)
})
</script>

<template>
  <div class="panel">
    <!-- 24h stats -->
    <div class="block">
      <div class="eyebrow">Statistiques 24h</div>
      <dl class="grid2">
        <div class="row"><dt>Haut</dt><dd class="mono up">{{ formatPrice(stats?.high) }}</dd></div>
        <div class="row"><dt>Bas</dt><dd class="mono down">{{ formatPrice(stats?.low) }}</dd></div>
        <div class="row"><dt>Range</dt><dd class="mono">{{ range24h != null ? range24h.toFixed(2) + '%' : '—' }}</dd></div>
        <div class="row"><dt>Var.</dt><dd class="mono" :class="(stats?.changePct ?? 0) >= 0 ? 'up' : 'down'">{{ formatPct(stats?.changePct) }}</dd></div>
        <div class="row span2"><dt>Volume (quote)</dt><dd class="mono">{{ formatVolume(stats?.quoteVolume) }}</dd></div>
      </dl>
    </div>

    <!-- Order book imbalance -->
    <div class="block">
      <div class="eyebrow">Carnet d'ordres · top 20</div>
      <div v-if="book">
        <div class="imb-head">
          <span class="up">{{ (book.imbalance * 100).toFixed(0) }}% bid</span>
          <span class="spread mono">spread {{ formatPrice(book.spread, 2) }} ({{ book.spreadPct.toFixed(3) }}%)</span>
          <span class="down">{{ ((1 - book.imbalance) * 100).toFixed(0) }}% ask</span>
        </div>
        <div class="imb-bar">
          <div class="imb-bid" :style="{ width: book.imbalance * 100 + '%' }" />
          <div class="imb-ask" :style="{ width: (1 - book.imbalance) * 100 + '%' }" />
        </div>
        <div class="ladder">
          <div v-for="(l, i) in topAsks" :key="'a' + i" class="lvl ask">
            <span class="depth" :style="{ width: (l.qty / maxQty) * 100 + '%' }" />
            <span class="lvl-px mono">{{ formatPrice(l.price) }}</span>
            <span class="lvl-qty mono">{{ l.qty.toFixed(3) }}</span>
          </div>
          <div class="ladder-mid mono">{{ formatPrice(book.bestAsk) }} / {{ formatPrice(book.bestBid) }}</div>
          <div v-for="(l, i) in topBids" :key="'b' + i" class="lvl bid">
            <span class="depth" :style="{ width: (l.qty / maxQty) * 100 + '%' }" />
            <span class="lvl-px mono">{{ formatPrice(l.price) }}</span>
            <span class="lvl-qty mono">{{ l.qty.toFixed(3) }}</span>
          </div>
        </div>
      </div>
      <div v-else class="muted">Connexion au carnet…</div>
    </div>

    <!-- Futures -->
    <div class="block">
      <div class="eyebrow">Perpétuel (futures)</div>
      <dl class="grid2" v-if="futures">
        <div class="row">
          <dt>Funding</dt>
          <dd class="mono" :class="futures.fundingRate >= 0 ? 'down' : 'up'">
            {{ (futures.fundingRate * 100).toFixed(4) }}%
          </dd>
        </div>
        <div class="row"><dt>Prochain</dt><dd class="mono">{{ fundingCountdown }}</dd></div>
        <div class="row"><dt>Mark</dt><dd class="mono">{{ formatPrice(futures.markPrice) }}</dd></div>
        <div class="row"><dt>Basis</dt><dd class="mono" :class="(basis ?? 0) >= 0 ? 'up' : 'down'">{{ formatPrice(basis) }}</dd></div>
        <div class="row span2"><dt>Open Interest</dt><dd class="mono">{{ formatVolume(futures.openInterestUsd) }} $</dd></div>
      </dl>
      <div v-else class="muted">Chargement des données futures…</div>
    </div>

    <!-- Liquidations (real, live) -->
    <div class="block">
      <div class="eyebrow">
        Liquidations · 1h
        <span class="live-tag" :class="{ off: !liqConnected }">{{ liqConnected ? 'live' : 'hors-ligne' }}</span>
      </div>
      <div class="liq-tally">
        <div class="liq-card long">
          <span>Longs liquidés</span>
          <strong class="mono">{{ formatVolume(tally1h.long) }} $</strong>
        </div>
        <div class="liq-card short">
          <span>Shorts liquidés</span>
          <strong class="mono">{{ formatVolume(tally1h.short) }} $</strong>
        </div>
      </div>
      <div class="whale-row">
        <span class="whale-stat">🐋 {{ tally1h.whales }} whale{{ tally1h.whales > 1 ? 's' : '' }} · {{ formatVolume(tally1h.whaleUsd) }} $</span>
        <button class="whale-filter" :class="{ on: whalesOnly }" @click="whalesOnly = !whalesOnly">
          whales only
        </button>
      </div>
      <div v-if="recentLiqs.length" class="liq-feed">
        <div
          v-for="(e, i) in recentLiqs"
          :key="i"
          class="liq-row"
          :class="[e.side, { whale: isWhale(e.usd) }]"
        >
          <span class="liq-time mono">{{ fmtTime(e.time) }}</span>
          <span class="liq-tag">{{ e.side === 'long' ? 'LONG' : 'SHORT' }}</span>
          <span class="liq-px mono">{{ formatPrice(e.price) }}</span>
          <span class="liq-usd mono">{{ isWhale(e.usd) ? '🐋 ' : '' }}{{ formatVolume(e.usd) }} $</span>
        </div>
      </div>
      <div v-else class="muted">{{ whalesOnly ? 'Aucune whale récente.' : 'En écoute des liquidations…' }}</div>
    </div>
  </div>
</template>

<style scoped>
.panel {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 14px;
}
.block {
  display: flex;
  flex-direction: column;
  gap: 9px;
}
.grid2 {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 4px 14px;
  margin: 0;
}
.row {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 8px;
}
.row.span2 {
  grid-column: span 2;
}
.row dt {
  font-size: 11.5px;
  color: var(--text-2);
}
.row dd {
  margin: 0;
  font-size: 12.5px;
  color: var(--text-0);
}

.imb-head {
  display: flex;
  justify-content: space-between;
  font-size: 11px;
  font-weight: 600;
}
.spread {
  color: var(--text-3);
  font-weight: 400;
}
.imb-bar {
  display: flex;
  height: 7px;
  border-radius: 4px;
  overflow: hidden;
  margin-top: 5px;
}
.imb-bid {
  background: var(--up);
}
.imb-ask {
  background: var(--down);
}

.ladder {
  margin-top: 10px;
  display: flex;
  flex-direction: column;
  gap: 1px;
}
.lvl {
  position: relative;
  display: flex;
  justify-content: space-between;
  padding: 2px 6px;
  font-size: 11px;
  border-radius: 3px;
  overflow: hidden;
}
.lvl .depth {
  position: absolute;
  top: 0;
  bottom: 0;
  right: 0;
  z-index: 0;
}
.lvl.ask .depth {
  background: rgba(240, 85, 106, 0.14);
}
.lvl.bid .depth {
  background: rgba(38, 208, 124, 0.14);
}
.lvl-px,
.lvl-qty {
  position: relative;
  z-index: 1;
}
.lvl.ask .lvl-px {
  color: var(--down);
}
.lvl.bid .lvl-px {
  color: var(--up);
}
.lvl-qty {
  color: var(--text-2);
}
.ladder-mid {
  text-align: center;
  font-size: 11px;
  color: var(--text-3);
  padding: 4px 0;
}
.muted {
  font-size: 12px;
  color: var(--text-3);
}

.live-tag {
  font-size: 9px;
  font-weight: 600;
  color: var(--up);
  border: 1px solid rgba(38, 208, 124, 0.4);
  border-radius: 999px;
  padding: 1px 6px;
  margin-left: 6px;
  letter-spacing: 0.05em;
}
.live-tag.off {
  color: var(--warn);
  border-color: rgba(245, 165, 36, 0.4);
}
.liq-tally {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}
.liq-card {
  display: flex;
  flex-direction: column;
  gap: 3px;
  padding: 9px 11px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
  background: var(--bg-1);
}
.liq-card span {
  font-size: 10.5px;
  color: var(--text-3);
}
.liq-card strong {
  font-size: 13px;
}
.liq-card.long {
  border-color: rgba(240, 85, 106, 0.3);
}
.liq-card.long strong {
  color: var(--down);
}
.liq-card.short {
  border-color: rgba(38, 208, 124, 0.3);
}
.liq-card.short strong {
  color: var(--up);
}
.liq-feed {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin-top: 8px;
}
.liq-row {
  display: grid;
  grid-template-columns: auto auto 1fr auto;
  gap: 8px;
  align-items: center;
  font-size: 11px;
  padding: 3px 6px;
  border-radius: 3px;
}
.liq-row.long {
  background: rgba(240, 85, 106, 0.06);
}
.liq-row.short {
  background: rgba(38, 208, 124, 0.06);
}
.liq-time {
  color: var(--text-3);
}
.liq-tag {
  font-size: 9px;
  font-weight: 600;
  padding: 1px 5px;
  border-radius: 3px;
}
.liq-row.long .liq-tag {
  color: var(--down);
  background: rgba(240, 85, 106, 0.15);
}
.liq-row.short .liq-tag {
  color: var(--up);
  background: rgba(38, 208, 124, 0.15);
}
.liq-px {
  color: var(--text-1);
}
.liq-usd {
  color: var(--text-0);
  text-align: right;
}
.whale-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 8px;
  font-size: 11px;
}
.whale-stat {
  color: var(--accent);
}
.whale-filter {
  font-size: 10px;
  color: var(--text-3);
  background: var(--bg-2);
  border: 1px solid var(--border);
  border-radius: 999px;
  padding: 3px 9px;
  transition: all 0.13s ease;
}
.whale-filter.on {
  color: var(--bg-0);
  background: var(--accent);
  border-color: var(--accent);
}
.liq-row.whale {
  border-left: 2px solid var(--accent);
  background: var(--accent-dim);
}
</style>
