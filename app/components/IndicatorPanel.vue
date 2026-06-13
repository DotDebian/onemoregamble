<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { INDICATORS, SPECIAL_OVERLAYS, lastFinite, sessionStatuses } from '~/indicators'
import type { SnapshotItem } from '~/indicators'

const toggleables = [
  ...INDICATORS.map((i) => ({ id: i.id, name: i.name })),
  ...SPECIAL_OVERLAYS.map((o) => ({ id: o.id, name: o.name })),
]

const { candles } = useMarket()
const { computedIndicators } = useIndicators()
const { isEnabled, toggle } = useIndicatorState()

// Chart overlays without a recap card (so they still get a "?" somewhere).
const activeChartOverlays = computed(() =>
  SPECIAL_OVERLAYS.filter((o) => o.id !== 'sessions' && isEnabled(o.id)),
)

const showSelector = ref(false)

const recap = computed(() =>
  computedIndicators.value.map((ci) => {
    const items: SnapshotItem[] = ci.def.snapshot
      ? ci.def.snapshot(candles.value, ci.result)
      : ci.result.plots.map((p) => {
          const lf = lastFinite(p)
          return { label: p.label, value: lf ? formatNum(lf.value) : '—' }
        })
    return { def: ci.def, items }
  }),
)

// Sessions are clock-based — tick a local "now" so status stays current.
const now = ref(Math.floor(Date.now() / 1000))
let timer: ReturnType<typeof setInterval> | null = null
onMounted(() => {
  timer = setInterval(() => (now.value = Math.floor(Date.now() / 1000)), 15000)
})
onBeforeUnmount(() => {
  if (timer) clearInterval(timer)
})

const sessions = computed(() => sessionStatuses(now.value))

function fmtDuration(min: number): string {
  const h = Math.floor(min / 60)
  const m = min % 60
  return h > 0 ? `${h}h${m.toString().padStart(2, '0')}` : `${m}m`
}
</script>

<template>
  <section class="panel">
    <header class="panel-head">
      <span class="eyebrow">Récapitulatif · instant T</span>
      <button class="cfg-btn" :class="{ active: showSelector }" @click="showSelector = !showSelector">
        Indicateurs
      </button>
    </header>

    <!-- Indicator on/off selector -->
    <transition name="collapse">
      <div v-if="showSelector" class="selector">
        <button
          v-for="ind in toggleables"
          :key="ind.id"
          class="chip-toggle"
          :class="{ on: isEnabled(ind.id) }"
          @click="toggle(ind.id)"
        >
          <span class="dot" />
          {{ ind.name }}
        </button>
      </div>
    </transition>

    <!-- Market sessions -->
    <div class="block">
      <div class="block-head">
        <span class="block-title eyebrow">Sessions de marché</span>
        <HelpDot id="sessions" />
      </div>
      <div class="sessions">
        <div
          v-for="s in sessions"
          :key="s.session.id"
          class="session"
          :class="{ open: s.open }"
        >
          <span class="session-dot" :style="{ background: s.session.accent }" />
          <span class="session-name">{{ s.session.name }}</span>
          <span class="session-status" :class="s.open ? 'is-open' : 'is-closed'">
            {{ s.open ? 'ouvert' : 'fermé' }}
          </span>
          <span class="session-eta mono">
            {{ s.open ? '−' : '+' }}{{ fmtDuration(s.minutesToChange) }}
          </span>
        </div>
      </div>
    </div>

    <!-- Indicator recap -->
    <div class="block recap-block">
      <div class="block-title eyebrow">Indicateurs ({{ recap.length }})</div>
      <div v-if="!recap.length" class="empty">Aucun indicateur actif.</div>
      <div v-for="group in recap" :key="group.def.id" class="ind-card">
        <div class="ind-card-head">
          <span class="ind-name-wrap">
            <span class="ind-name">{{ group.def.name }}</span>
            <HelpDot :id="group.def.id" />
          </span>
          <span v-if="group.def.describe" class="ind-desc mono">{{ group.def.describe() }}</span>
        </div>
        <dl class="ind-rows">
          <div v-for="item in group.items" :key="item.label" class="ind-row">
            <dt>{{ item.label }}</dt>
            <dd class="mono" :class="`tone-${item.tone ?? 'neutral'}`">{{ item.value }}</dd>
          </div>
        </dl>
      </div>
    </div>

    <!-- Chart overlays (no recap card) -->
    <div v-if="activeChartOverlays.length" class="block">
      <div class="block-title eyebrow">Overlays graphiques</div>
      <div class="overlays">
        <div v-for="o in activeChartOverlays" :key="o.id" class="overlay-row">
          <span class="overlay-name">{{ o.name }}</span>
          <HelpDot :id="o.id" />
        </div>
      </div>
    </div>
  </section>
</template>


<style scoped>
.panel {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 14px 14px 18px;
}
.panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.cfg-btn {
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--text-2);
  background: var(--bg-2);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  padding: 5px 10px;
  transition: all 0.15s ease;
}
.cfg-btn:hover {
  color: var(--text-0);
  border-color: var(--border-strong);
}
.cfg-btn.active {
  color: var(--accent);
  border-color: var(--accent);
  background: var(--accent-dim);
}

.selector {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding: 12px;
  background: var(--bg-1);
  border: 1px solid var(--border);
  border-radius: var(--radius);
}
.chip-toggle {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--text-3);
  background: var(--bg-2);
  border: 1px solid var(--border);
  border-radius: 999px;
  padding: 5px 11px 5px 9px;
  transition: all 0.15s ease;
}
.chip-toggle .dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--text-3);
  transition: all 0.15s ease;
}
.chip-toggle.on {
  color: var(--text-0);
  border-color: var(--border-strong);
  background: var(--bg-3);
}
.chip-toggle.on .dot {
  background: var(--accent);
  box-shadow: 0 0 8px var(--accent);
}

.block {
  display: flex;
  flex-direction: column;
  gap: 9px;
}
.block-title {
  padding-left: 1px;
}
.block-head {
  display: flex;
  align-items: center;
  gap: 7px;
}
.ind-name-wrap {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.overlays {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.overlay-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 11px;
  background: var(--bg-1);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
}
.overlay-name {
  font-size: 12.5px;
  color: var(--text-1);
}

.sessions {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.session {
  display: grid;
  grid-template-columns: auto 1fr auto auto;
  align-items: center;
  gap: 9px;
  padding: 7px 11px;
  background: var(--bg-1);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  opacity: 0.6;
  transition: opacity 0.2s ease;
}
.session.open {
  opacity: 1;
  border-color: var(--border-strong);
}
.session-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}
.session.open .session-dot {
  box-shadow: 0 0 9px currentColor;
}
.session-name {
  font-size: 12.5px;
  color: var(--text-1);
}
.session-status {
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}
.session-status.is-open {
  color: var(--up);
}
.session-status.is-closed {
  color: var(--text-3);
}
.session-eta {
  font-size: 11px;
  color: var(--text-3);
  min-width: 46px;
  text-align: right;
}

.recap-block {
  gap: 8px;
}
.ind-card {
  background: var(--bg-1);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 10px 12px;
}
.ind-card-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin-bottom: 7px;
}
.ind-name {
  font-size: 12.5px;
  font-weight: 600;
  color: var(--text-0);
}
.ind-desc {
  font-size: 10.5px;
  color: var(--text-3);
}
.ind-rows {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 3px 14px;
  margin: 0;
}
.ind-row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
}
.ind-row dt {
  font-size: 11.5px;
  color: var(--text-2);
}
.ind-row dd {
  margin: 0;
  font-size: 12px;
  font-weight: 500;
}

.tone-up {
  color: var(--up);
}
.tone-down {
  color: var(--down);
}
.tone-warn {
  color: var(--warn);
}
.tone-info {
  color: var(--info);
}
.tone-neutral {
  color: var(--text-0);
}

.empty {
  font-size: 12px;
  color: var(--text-3);
  padding: 6px 0;
}

.collapse-enter-active,
.collapse-leave-active {
  transition: all 0.2s ease;
  overflow: hidden;
}
.collapse-enter-from,
.collapse-leave-to {
  opacity: 0;
  transform: translateY(-4px);
  max-height: 0;
}
.collapse-enter-to,
.collapse-leave-from {
  max-height: 240px;
}
</style>
