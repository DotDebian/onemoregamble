<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { SYMBOLS } from '~/composables/useMarket'

const { clock, deepReady, symbol, interval } = useMarketClock()

// Live UTC clock for the "now" highlight on the dial and grid.
const now = ref(new Date())
let timer: ReturnType<typeof setInterval> | null = null
onMounted(() => {
  timer = setInterval(() => (now.value = new Date()), 30_000)
})
onBeforeUnmount(() => {
  if (timer) clearInterval(timer)
})
const curHour = computed(() => now.value.getUTCHours())
const curDow = computed(() => now.value.getUTCDay())
const utcLabel = computed(
  () =>
    `${String(now.value.getUTCHours()).padStart(2, '0')}:${String(now.value.getUTCMinutes()).padStart(2, '0')}`,
)

const symLabel = computed(() => SYMBOLS.find((s) => s.symbol === symbol.value)?.label ?? symbol.value)

// --- dial geometry ---
const CX = 110
const CY = 110
const R_IN = 36
const R_OUT = 100

// Weekday display order: Monday-first (crypto trades 24/7, but Mon→Sun reads
// naturally). getUTCDay() is 0=Sun..6=Sat, so we remap for display only.
const DOW_ORDER = [1, 2, 3, 4, 5, 6, 0]
const DOW_LABEL = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam']

interface HourBar {
  h: number
  x1: number
  y1: number
  x2: number
  y2: number
  up: boolean
  vol: number
  ret: number
  volume: number
  count: number
}

const view = computed(() => {
  const c = clock.value
  const vols = c.byHour.map((b) => (b.count > 0 ? b.avgVolatility : 0))
  const maxVol = Math.max(1e-9, ...vols)
  const maxVolume = Math.max(1e-9, ...c.byHour.map((b) => b.avgVolume))

  const hours: HourBar[] = c.byHour.map((b) => {
    const theta = (b.index * 15 * Math.PI) / 180 // 0 at top, clockwise
    const dx = Math.sin(theta)
    const dy = -Math.cos(theta)
    const len = b.count > 0 ? (b.avgVolatility / maxVol) * (R_OUT - R_IN) : 0
    return {
      h: b.index,
      x1: CX + R_IN * dx,
      y1: CY + R_IN * dy,
      x2: CX + (R_IN + Math.max(len, b.count > 0 ? 2 : 0)) * dx,
      y2: CY + (R_IN + Math.max(len, b.count > 0 ? 2 : 0)) * dy,
      up: b.avgReturn >= 0,
      vol: b.avgVolatility,
      ret: b.avgReturn,
      volume: b.avgVolume,
      count: b.count,
    }
  })

  // Tick label anchors every 3h, just outside the ring.
  const ticks = [0, 3, 6, 9, 12, 15, 18, 21].map((h) => {
    const theta = (h * 15 * Math.PI) / 180
    return { h, x: CX + (R_OUT + 11) * Math.sin(theta), y: CY + (R_OUT + 11) * -Math.cos(theta) }
  })

  // Volume micro-bars (linear, under the dial).
  const volBars = c.byHour.map((b) => ({
    h: b.index,
    pct: b.count > 0 ? b.avgVolume / maxVolume : 0,
  }))

  // Weekday strip (Monday-first).
  const dowMaxVol = Math.max(1e-9, ...c.byDow.map((b) => (b.count > 0 ? b.avgVolatility : 0)))
  const dows = DOW_ORDER.map((idx) => {
    const b = c.byDow[idx]!
    return {
      idx,
      label: DOW_LABEL[idx]!,
      pct: b.count > 0 ? b.avgVolatility / dowMaxVol : 0,
      up: b.avgReturn >= 0,
      ret: b.avgReturn,
      count: b.count,
    }
  })

  // Heat grid max (volatility) for opacity scaling.
  let gridMax = 1e-9
  for (const row of c.grid) for (const v of row) if (Number.isFinite(v)) gridMax = Math.max(gridMax, v)

  // Readouts: hottest / deadest hours, most bullish / bearish hours.
  const active = c.byHour.filter((b) => b.count > 0)
  const byVolDesc = [...active].sort((a, b) => b.avgVolatility - a.avgVolatility)
  const byRetDesc = [...active].sort((a, b) => b.avgReturn - a.avgReturn)
  const hottest = byVolDesc.slice(0, 3).map((b) => b.index)
  const deadest = byVolDesc.slice(-3).reverse().map((b) => b.index)
  const bullish = byRetDesc[0]
  const bearish = byRetDesc.at(-1)

  return {
    hours,
    ticks,
    volBars,
    dows,
    gridMax,
    hottest,
    deadest,
    bullish,
    bearish,
    total: c.totalCandles,
  }
})

function gridFill(dow: number, hour: number): string {
  const v = clock.value.grid[dow]?.[hour]
  if (v == null || !Number.isFinite(v)) return 'transparent'
  const o = Math.min(1, v / view.value.gridMax)
  return `color-mix(in srgb, var(--accent) ${Math.round(8 + o * 92)}%, transparent)`
}

function hh(h: number): string {
  return `${String(h).padStart(2, '0')}h`
}
</script>

<template>
  <section class="panel">
    <header class="panel-head">
      <div>
        <div class="title-row"><span class="eyebrow">Horloge de marché</span><HelpDot id="clock" /></div>
        <div class="sub mono">{{ symLabel }} · {{ interval }} · {{ view.total }} bougies · UTC</div>
      </div>
      <div class="utc-now mono">{{ utcLabel }} <i>UTC</i></div>
    </header>

    <div v-if="!deepReady && !view.total" class="empty">
      Chargement de l'historique profond…
    </div>

    <template v-else>
      <!-- Radial dial: 24 hours, length = volatility, color = direction -->
      <div class="dial-wrap">
        <svg viewBox="0 0 220 232" class="dial">
          <!-- guide rings -->
          <circle :cx="CX" :cy="CY" :r="R_OUT" class="ring" />
          <circle :cx="CX" :cy="CY" :r="(R_IN + R_OUT) / 2" class="ring faint" />
          <circle :cx="CX" :cy="CY" :r="R_IN" class="ring" />

          <!-- hour bars -->
          <line
            v-for="b in view.hours"
            :key="b.h"
            :x1="b.x1"
            :y1="b.y1"
            :x2="b.x2"
            :y2="b.y2"
            class="hbar"
            :class="{ up: b.up, down: !b.up, current: b.h === curHour }"
          >
            <title>{{ hh(b.h) }} · vol {{ formatPct(b.vol * 100) }} · dir {{ formatPct(b.ret * 100) }}</title>
          </line>

          <!-- current-hour marker dot -->
          <circle
            v-for="b in view.hours.filter((x) => x.h === curHour)"
            :key="`cur${b.h}`"
            :cx="b.x2"
            :cy="b.y2"
            r="3.4"
            class="cur-dot"
          />

          <!-- hour tick labels every 3h -->
          <text v-for="t in view.ticks" :key="`t${t.h}`" :x="t.x" :y="t.y" class="tick">{{ t.h }}</text>

          <!-- center readout -->
          <text :x="CX" :y="CY - 4" class="ctr-h">{{ utcLabel }}</text>
          <text :x="CX" :y="CY + 11" class="ctr-s">UTC</text>
        </svg>

        <ul class="legend">
          <li><span class="sw up" /> haussier</li>
          <li><span class="sw down" /> baissier</li>
          <li><span class="sw len" /> longueur = volatilité</li>
        </ul>
      </div>

      <!-- volume by hour -->
      <div class="block">
        <div class="block-title eyebrow">Volume par heure</div>
        <div class="vol-row">
          <div v-for="v in view.volBars" :key="`v${v.h}`" class="vol-col" :title="`${hh(v.h)}`">
            <div class="vol-bar" :style="{ height: `${Math.max(2, v.pct * 100)}%`, opacity: 0.35 + v.pct * 0.65 }" />
          </div>
        </div>
        <div class="vol-axis mono"><span>00h</span><span>06h</span><span>12h</span><span>18h</span><span>23h</span></div>
      </div>

      <!-- temps forts -->
      <div class="block readouts">
        <div class="ro">
          <span class="ro-k eyebrow">Plus actif</span>
          <span class="ro-v mono">{{ view.hottest.map(hh).join(' · ') || '—' }}</span>
        </div>
        <div class="ro">
          <span class="ro-k eyebrow">Heures mortes</span>
          <span class="ro-v mono dim">{{ view.deadest.map(hh).join(' · ') || '—' }}</span>
        </div>
        <div class="ro">
          <span class="ro-k eyebrow">Plus haussier</span>
          <span class="ro-v mono up">{{ view.bullish ? `${hh(view.bullish.index)}  ${formatPct(view.bullish.avgReturn * 100)}` : '—' }}</span>
        </div>
        <div class="ro">
          <span class="ro-k eyebrow">Plus baissier</span>
          <span class="ro-v mono down">{{ view.bearish ? `${hh(view.bearish.index)}  ${formatPct(view.bearish.avgReturn * 100)}` : '—' }}</span>
        </div>
      </div>

      <!-- weekday strip -->
      <div class="block">
        <div class="block-title eyebrow">Volatilité par jour</div>
        <div class="dow-row">
          <div v-for="d in view.dows" :key="d.idx" class="dow" :class="{ current: d.idx === curDow }">
            <div class="dow-track">
              <div class="dow-fill" :class="d.up ? 'up' : 'down'" :style="{ height: `${Math.max(3, d.pct * 100)}%` }" />
            </div>
            <span class="dow-lbl">{{ d.label }}</span>
          </div>
        </div>
      </div>

      <!-- hour × weekday heat grid -->
      <div class="block">
        <div class="block-title eyebrow">Activité heure × jour</div>
        <div class="grid">
          <div class="grid-corner" />
          <div v-for="h in 24" :key="`gh${h - 1}`" class="grid-hlbl mono">
            <span v-if="(h - 1) % 6 === 0">{{ h - 1 }}</span>
          </div>
          <template v-for="idx in DOW_ORDER" :key="`gr${idx}`">
            <div class="grid-dlbl">{{ DOW_LABEL[idx] }}</div>
            <div
              v-for="h in 24"
              :key="`c${idx}-${h - 1}`"
              class="grid-cell"
              :class="{ current: idx === curDow && h - 1 === curHour }"
              :style="{ background: gridFill(idx, h - 1) }"
              :title="`${DOW_LABEL[idx]} ${hh(h - 1)}`"
            />
          </template>
        </div>
      </div>
    </template>
  </section>
</template>

<style scoped>
.panel {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 14px 14px 22px;
}
.panel-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
}
.title-row {
  display: flex;
  align-items: center;
  gap: 7px;
}
.sub {
  font-size: 10.5px;
  color: var(--text-3);
  margin-top: 3px;
}
.utc-now {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-0);
}
.utc-now i {
  font-style: normal;
  font-size: 9.5px;
  color: var(--text-3);
  letter-spacing: 0.1em;
}
.empty {
  font-size: 12.5px;
  color: var(--text-3);
  padding: 24px 0;
  text-align: center;
}

/* --- dial --- */
.dial-wrap {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}
.dial {
  width: 100%;
  max-width: 280px;
}
.ring {
  fill: none;
  stroke: var(--border);
  stroke-width: 1;
}
.ring.faint {
  stroke: var(--border);
  opacity: 0.45;
  stroke-dasharray: 2 4;
}
.hbar {
  stroke-width: 5;
  stroke-linecap: round;
  transition: opacity 0.15s ease;
}
.hbar.up {
  stroke: var(--up);
}
.hbar.down {
  stroke: var(--down);
}
.hbar.current {
  stroke-width: 6.5;
}
.cur-dot {
  fill: var(--accent);
  stroke: var(--bg-0);
  stroke-width: 1.5;
}
.tick {
  fill: var(--text-3);
  font-family: var(--font-mono);
  font-size: 9px;
  text-anchor: middle;
  dominant-baseline: middle;
}
.ctr-h {
  fill: var(--text-0);
  font-family: var(--font-mono);
  font-size: 15px;
  font-weight: 600;
  text-anchor: middle;
}
.ctr-s {
  fill: var(--text-3);
  font-family: var(--font-mono);
  font-size: 8px;
  letter-spacing: 0.12em;
  text-anchor: middle;
}
.legend {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin: 0;
  padding: 0;
  list-style: none;
  font-size: 10.5px;
  color: var(--text-3);
}
.legend li {
  display: inline-flex;
  align-items: center;
  gap: 5px;
}
.sw {
  width: 10px;
  height: 3px;
  border-radius: 2px;
}
.sw.up {
  background: var(--up);
}
.sw.down {
  background: var(--down);
}
.sw.len {
  background: linear-gradient(90deg, var(--text-3), var(--text-1));
  width: 14px;
}

/* --- shared blocks --- */
.block {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.block-title {
  padding-left: 1px;
}

/* --- volume row --- */
.vol-row {
  display: flex;
  align-items: flex-end;
  gap: 2px;
  height: 42px;
  padding: 0 1px;
}
.vol-col {
  flex: 1;
  height: 100%;
  display: flex;
  align-items: flex-end;
}
.vol-bar {
  width: 100%;
  background: var(--accent);
  border-radius: 1.5px;
}
.vol-axis {
  display: flex;
  justify-content: space-between;
  font-size: 9px;
  color: var(--text-3);
}

/* --- readouts --- */
.readouts {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}
.ro {
  display: flex;
  flex-direction: column;
  gap: 3px;
  padding: 9px 11px;
  background: var(--bg-1);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
}
.ro-v {
  font-size: 12.5px;
  font-weight: 500;
  color: var(--text-0);
}
.ro-v.dim {
  color: var(--text-2);
}
.ro-v.up {
  color: var(--up);
}
.ro-v.down {
  color: var(--down);
}

/* --- weekday strip --- */
.dow-row {
  display: flex;
  gap: 6px;
  height: 64px;
}
.dow {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 5px;
}
.dow-track {
  flex: 1;
  width: 100%;
  display: flex;
  align-items: flex-end;
  background: var(--bg-1);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  overflow: hidden;
}
.dow.current .dow-track {
  border-color: var(--accent);
}
.dow-fill {
  width: 100%;
  border-radius: 3px 3px 0 0;
}
.dow-fill.up {
  background: var(--up);
}
.dow-fill.down {
  background: var(--down);
}
.dow-lbl {
  font-size: 10px;
  color: var(--text-3);
}
.dow.current .dow-lbl {
  color: var(--accent);
}

/* --- heat grid --- */
.grid {
  display: grid;
  grid-template-columns: 26px repeat(24, 1fr);
  gap: 1.5px;
  align-items: center;
}
.grid-corner {
  grid-column: 1;
}
.grid-hlbl {
  font-size: 8px;
  color: var(--text-3);
  text-align: left;
  height: 12px;
}
.grid-dlbl {
  font-size: 10px;
  color: var(--text-3);
  padding-right: 4px;
  text-align: right;
}
.grid-cell {
  aspect-ratio: 1;
  border-radius: 2px;
  background: transparent;
  box-shadow: inset 0 0 0 1px var(--border);
}
.grid-cell.current {
  box-shadow: inset 0 0 0 1.5px var(--accent);
}
</style>
