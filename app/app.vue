<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount } from 'vue'
import { SYMBOLS, INTERVALS } from '~/composables/useMarket'

const { start, stop, lastPrice, dayChangePct, status, symbol, interval, setSymbol, setInterval } =
  useMarket()

onMounted(() => start())
onBeforeUnmount(() => stop())

const statusMeta = computed(() => {
  switch (status.value) {
    case 'live':
      return { label: 'En direct', cls: 'live' }
    case 'loading':
      return { label: 'Chargement', cls: 'pending' }
    case 'reconnecting':
      return { label: 'Reconnexion', cls: 'pending' }
    case 'error':
      return { label: 'Erreur', cls: 'err' }
    default:
      return { label: 'Inactif', cls: 'idle' }
  }
})
</script>

<template>
  <div class="app">
    <header class="topbar">
      <div class="brand">
        <svg class="logo" width="22" height="22" viewBox="0 0 24 24" fill="none">
          <rect x="3" y="9" width="3" height="11" rx="1" fill="var(--down)" />
          <rect x="4" y="5" width="1" height="4" fill="var(--down)" />
          <rect x="4" y="20" width="1" height="2" fill="var(--down)" />
          <rect x="10" y="6" width="3" height="9" rx="1" fill="var(--up)" />
          <rect x="11" y="3" width="1" height="3" fill="var(--up)" />
          <rect x="11" y="15" width="1" height="4" fill="var(--up)" />
          <rect x="17" y="10" width="3" height="7" rx="1" fill="var(--accent)" />
          <rect x="18" y="6" width="1" height="4" fill="var(--accent)" />
          <rect x="18" y="17" width="1" height="3" fill="var(--accent)" />
        </svg>
        <span class="brand-name">OneMoreGamble</span>
      </div>

      <div class="controls">
        <select class="sym-select" :value="symbol" @change="setSymbol(($event.target as HTMLSelectElement).value)">
          <option v-for="s in SYMBOLS" :key="s.symbol" :value="s.symbol">{{ s.label }}</option>
        </select>
        <div class="tf">
          <button
            v-for="iv in INTERVALS"
            :key="iv"
            class="tf-btn"
            :class="{ active: interval === iv }"
            @click="setInterval(iv)"
          >
            {{ iv }}
          </button>
        </div>
      </div>

      <div class="ticker">
        <div class="ticker-price mono">{{ formatPrice(lastPrice) }}</div>
        <div
          class="ticker-chg mono"
          :class="dayChangePct != null ? (dayChangePct >= 0 ? 'up' : 'down') : ''"
        >
          {{ formatPct(dayChangePct) }}
          <span class="ticker-chg-label">24h</span>
        </div>
      </div>

      <div class="status" :class="statusMeta.cls">
        <span class="status-dot" />
        {{ statusMeta.label }}
      </div>
    </header>

    <div class="workspace">
      <main class="chart-pane">
        <TradingChart />
      </main>
      <Sidebar />
    </div>
  </div>
</template>

<style scoped>
.app {
  display: grid;
  grid-template-rows: auto 1fr;
  height: 100vh;
  overflow: hidden;
}

.topbar {
  display: flex;
  align-items: center;
  gap: 20px;
  padding: 0 18px;
  height: 56px;
  border-bottom: 1px solid var(--border);
  background: color-mix(in srgb, var(--bg-1) 80%, transparent);
  backdrop-filter: blur(8px);
}
.brand {
  display: flex;
  align-items: center;
  gap: 10px;
}
.brand-name {
  font-size: 15px;
  font-weight: 700;
  letter-spacing: -0.01em;
  color: var(--text-0);
  white-space: nowrap;
}
.brand-name::first-letter {
  color: var(--accent);
}

.controls {
  display: flex;
  align-items: center;
  gap: 10px;
}
.sym-select {
  font-family: var(--font-sans);
  font-size: 13px;
  font-weight: 600;
  color: var(--text-0);
  background: var(--bg-2);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  padding: 7px 10px;
}
.sym-select:focus {
  outline: none;
  border-color: var(--accent);
}
.tf {
  display: flex;
  gap: 2px;
  padding: 2px;
  background: var(--bg-2);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
}
.tf-btn {
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--text-3);
  background: transparent;
  border: none;
  border-radius: 5px;
  padding: 5px 8px;
  transition: all 0.12s ease;
}
.tf-btn:hover {
  color: var(--text-1);
}
.tf-btn.active {
  color: var(--bg-0);
  background: var(--accent);
}

.ticker {
  display: flex;
  align-items: baseline;
  gap: 14px;
  margin-left: 6px;
}
.ticker-price {
  font-size: 20px;
  font-weight: 600;
  color: var(--text-0);
  letter-spacing: -0.01em;
}
.ticker-chg {
  display: flex;
  align-items: baseline;
  gap: 6px;
  font-size: 13px;
  font-weight: 500;
  color: var(--text-2);
}
.ticker-chg-label {
  font-size: 10px;
  color: var(--text-3);
}

.status {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 11px;
  font-weight: 500;
  letter-spacing: 0.03em;
  text-transform: uppercase;
  color: var(--text-2);
  white-space: nowrap;
}
.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--text-3);
}
.status.live .status-dot {
  background: var(--up);
  animation: pulse 2s infinite;
}
.status.pending .status-dot {
  background: var(--warn);
}
.status.err .status-dot {
  background: var(--down);
}
@keyframes pulse {
  0% {
    box-shadow: 0 0 0 0 rgba(38, 208, 124, 0.5);
  }
  70% {
    box-shadow: 0 0 0 6px rgba(38, 208, 124, 0);
  }
  100% {
    box-shadow: 0 0 0 0 rgba(38, 208, 124, 0);
  }
}

.workspace {
  display: flex;
  min-height: 0;
  overflow: hidden;
}
.chart-pane {
  flex: 1;
  min-width: 0;
  position: relative;
  padding: 8px;
}

@media (max-width: 980px) {
  .workspace {
    flex-direction: column;
    overflow-y: auto;
  }
  .chart-pane {
    height: 56vh;
    flex: none;
  }
  .tf-btn {
    padding: 5px 6px;
  }
}
</style>
