<script setup lang="ts">
import { computed } from 'vue'

const { matches, selected, select, clear, searching, hasSearched, exploring, setExploring } =
  useSketchSearch()

// Return to the live chart and drop the active selection, so re-clicking the
// same card afterwards counts as a change and travels there again.
function exitLive() {
  setExploring(false)
  select(null)
}

const W = 104
const H = 36

function sparkPath(shape: number[]): string {
  const n = shape.length
  if (n < 2) return ''
  let min = Infinity
  let max = -Infinity
  for (const v of shape) {
    if (v < min) min = v
    if (v > max) max = v
  }
  const span = max - min || 1
  const pts = shape.map((v, i) => {
    const x = (i / (n - 1)) * (W - 4) + 2
    const y = H - 3 - ((v - min) / span) * (H - 6) // higher value → higher (smaller y)
    return `${x.toFixed(1)},${y.toFixed(1)}`
  })
  return `M${pts.join(' L')}`
}

const cards = computed(() =>
  matches.value.map((m, i) => ({
    i,
    d: sparkPath(m.shape),
    score: m.score,
    length: m.length,
    date: new Date(m.startTime * 1000).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
    }),
  })),
)
</script>

<template>
  <div v-if="hasSearched" class="sketch-results">
    <header class="sr-head">
      <span class="sr-title">
        Sketch search
        <span class="sr-count mono">{{ searching ? '…' : matches.length }}</span>
        <HelpDot id="sketch" />
      </span>
      <div class="sr-actions">
        <button v-if="exploring" class="sr-back" @click="exitLive()">← Retour au live</button>
        <button class="sr-close" title="Fermer" @click="clear()">✕</button>
      </div>
    </header>

    <div v-if="searching" class="sr-empty">Recherche dans l'historique…</div>
    <div v-else-if="!matches.length" class="sr-empty">
      Aucune correspondance — réessaie avec une figure plus marquée.
    </div>
    <div v-else class="sr-strip">
      <button
        v-for="c in cards"
        :key="c.i"
        class="sr-card"
        :class="{ sel: c.i === selected }"
        @click="select(c.i)"
      >
        <svg :viewBox="`0 0 ${W} ${H}`" class="sr-spark" preserveAspectRatio="none">
          <path :d="c.d" />
        </svg>
        <span class="sr-meta mono">
          <span class="sr-r">r {{ c.score.toFixed(2) }}</span>
          <span class="sr-date">{{ c.date }}</span>
        </span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.sketch-results {
  position: absolute;
  left: 50px;
  right: 70px;
  bottom: 10px;
  z-index: 7;
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 9px 11px;
  background: color-mix(in srgb, var(--bg-1) 92%, transparent);
  border: 1px solid var(--border-strong);
  border-radius: var(--radius);
  backdrop-filter: blur(9px);
  box-shadow: 0 10px 34px rgba(0, 0, 0, 0.45);
  pointer-events: auto;
}
.sr-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.sr-title {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--text-2);
  display: inline-flex;
  align-items: center;
  gap: 8px;
}
.sr-count {
  color: var(--accent);
  font-size: 12px;
}
.sr-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}
.sr-back {
  font-family: var(--font-mono);
  font-size: 10.5px;
  color: var(--accent);
  background: var(--accent-dim);
  border: 1px solid var(--accent);
  border-radius: 999px;
  padding: 4px 10px;
  transition: all 0.13s ease;
}
.sr-back:hover {
  background: var(--accent);
  color: var(--bg-0);
}
.sr-close {
  color: var(--text-3);
  background: transparent;
  border: none;
  font-size: 13px;
  line-height: 1;
  padding: 2px 4px;
}
.sr-close:hover {
  color: var(--text-0);
}
.sr-empty {
  font-size: 12px;
  color: var(--text-3);
  padding: 6px 2px;
}
.sr-strip {
  display: flex;
  gap: 7px;
  overflow-x: auto;
  padding-bottom: 3px;
}
.sr-card {
  flex: 0 0 auto;
  display: flex;
  flex-direction: column;
  gap: 4px;
  width: 116px;
  padding: 6px;
  background: var(--bg-2);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  transition: all 0.13s ease;
}
.sr-card:hover {
  border-color: var(--border-strong);
}
.sr-card.sel {
  border-color: var(--accent);
  background: var(--accent-dim);
}
.sr-spark {
  width: 100%;
  height: 36px;
  display: block;
}
.sr-spark path {
  fill: none;
  stroke: var(--text-2);
  stroke-width: 1.4;
  stroke-linejoin: round;
  stroke-linecap: round;
  vector-effect: non-scaling-stroke;
}
.sr-card.sel .sr-spark path {
  stroke: var(--accent);
}
.sr-meta {
  display: flex;
  justify-content: space-between;
  font-size: 9.5px;
}
.sr-r {
  color: var(--text-1);
  font-weight: 600;
}
.sr-date {
  color: var(--text-3);
}
</style>
