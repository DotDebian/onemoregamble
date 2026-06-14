<script setup lang="ts">
import { computed } from 'vue'

const { params, enabled, stats, matches, horizon, scanning, deepReady, scan } = useEchoes()

const sentence = computed(() => {
  const s = stats.value
  if (!s || s.count === 0) return null
  const higher = Math.round(s.fractionHigher * 100)
  return {
    count: s.count,
    higher,
    horizon: horizon.value,
    median: formatPct(s.medianReturn * 100),
    medianUp: s.medianReturn >= 0,
  }
})

const cards = computed(() => {
  const s = stats.value
  if (!s) return []
  return [
    { k: 'Échos', v: String(s.count), tone: 'neutral' },
    { k: 'Plus haut', v: `${Math.round(s.fractionHigher * 100)}%`, tone: s.fractionHigher >= 0.5 ? 'up' : 'down' },
    { k: 'Médiane', v: formatPct(s.medianReturn * 100), tone: s.medianReturn >= 0 ? 'up' : 'down' },
    { k: 'Moyenne', v: formatPct(s.meanReturn * 100), tone: s.meanReturn >= 0 ? 'up' : 'down' },
    { k: 'p10', v: formatPct(s.band.p10 * 100), tone: 'dim' },
    { k: 'p90', v: formatPct(s.band.p90 * 100), tone: 'dim' },
  ]
})

const topMatches = computed(() =>
  matches.value.slice(0, 12).map((m) => {
    const ret = m.pathReturns.at(-1) ?? 0
    return {
      time: m.time,
      date: new Date(m.time * 1000).toLocaleString('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        year: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      }),
      score: m.score,
      ret,
      up: ret >= 0,
    }
  }),
)
</script>

<template>
  <section class="panel">
    <header class="panel-head">
      <div>
        <div class="title-row"><span class="eyebrow">Echoes</span><HelpDot id="echoes" /></div>
        <div class="sub">La figure d'aujourd'hui a déjà eu lieu — voici ce qui a suivi.</div>
      </div>
    </header>

    <!-- controls -->
    <div class="controls">
      <button class="chip-toggle" :class="{ on: enabled }" @click="enabled = !enabled">
        <span class="dot" />
        Projection sur le graphique
      </button>
      <button class="scan-btn" :disabled="!deepReady || scanning" @click="scan()">
        {{ scanning ? 'Analyse…' : 'Scanner' }}
      </button>
    </div>

    <div v-if="!deepReady" class="empty">Chargement de l'historique profond…</div>

    <template v-else>
      <!-- headline sentence -->
      <p v-if="sentence" class="headline">
        <b>{{ sentence.count }}</b> échos · <b :class="sentence.higher >= 50 ? 'up' : 'down'">{{ sentence.higher }}%</b>
        clôturent plus haut après <b>{{ sentence.horizon }}</b> barres · médiane
        <b :class="sentence.medianUp ? 'up' : 'down'">{{ sentence.median }}</b>
      </p>
      <p v-else class="empty">Aucun écho au-dessus du seuil. Baisse la corrélation min. ou élargis la fenêtre.</p>

      <!-- stat cards -->
      <div v-if="cards.length" class="cards">
        <div v-for="c in cards" :key="c.k" class="card">
          <span class="card-k eyebrow">{{ c.k }}</span>
          <span class="card-v mono" :class="`tone-${c.tone}`">{{ c.v }}</span>
        </div>
      </div>

      <!-- parameters -->
      <div class="params">
        <label class="param">
          <span class="param-lbl">Fenêtre <b class="mono">{{ params.window }}</b></span>
          <input v-model.number="params.window" type="range" min="12" max="120" step="2" />
        </label>
        <label class="param">
          <span class="param-lbl">Horizon <b class="mono">{{ params.horizon }}</b></span>
          <input v-model.number="params.horizon" type="range" min="4" max="60" step="1" />
        </label>
        <label class="param">
          <span class="param-lbl">Corrélation min. <b class="mono">{{ params.minScore.toFixed(2) }}</b></span>
          <input v-model.number="params.minScore" type="range" min="0.5" max="0.97" step="0.01" />
        </label>
        <label class="param">
          <span class="param-lbl">Max échos <b class="mono">{{ params.topK }}</b></span>
          <input v-model.number="params.topK" type="range" min="5" max="60" step="1" />
        </label>
      </div>

      <!-- match list -->
      <div v-if="topMatches.length" class="block">
        <div class="block-title eyebrow">Correspondances ({{ matches.length }})</div>
        <div class="matches">
          <div v-for="m in topMatches" :key="m.time" class="match">
            <span class="m-date mono">{{ m.date }}</span>
            <span class="m-score mono">r {{ m.score.toFixed(2) }}</span>
            <span class="m-ret mono" :class="m.up ? 'up' : 'down'">{{ formatPct(m.ret * 100) }}</span>
          </div>
        </div>
      </div>
    </template>
  </section>
</template>

<style scoped>
.panel {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 14px 14px 22px;
}
.title-row {
  display: flex;
  align-items: center;
  gap: 7px;
}
.sub {
  font-size: 11px;
  color: var(--text-3);
  margin-top: 3px;
  max-width: 30ch;
}

.controls {
  display: flex;
  align-items: center;
  gap: 8px;
}
.chip-toggle {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  font-size: 12px;
  color: var(--text-3);
  background: var(--bg-2);
  border: 1px solid var(--border);
  border-radius: 999px;
  padding: 6px 12px 6px 10px;
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
  border-color: var(--accent);
  background: var(--accent-dim);
}
.chip-toggle.on .dot {
  background: var(--accent);
  box-shadow: 0 0 8px var(--accent);
}
.scan-btn {
  margin-left: auto;
  font-family: var(--font-mono);
  font-size: 11.5px;
  color: var(--bg-0);
  background: var(--accent);
  border: 1px solid var(--accent);
  border-radius: var(--radius-sm);
  padding: 6px 14px;
  transition: all 0.15s ease;
}
.scan-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.headline {
  margin: 0;
  font-size: 13px;
  line-height: 1.5;
  color: var(--text-1);
  padding: 11px 13px;
  background: var(--bg-1);
  border: 1px solid var(--border);
  border-left: 2px solid var(--accent);
  border-radius: var(--radius-sm);
}
.headline b {
  color: var(--text-0);
  font-weight: 600;
}
.headline b.up,
.up {
  color: var(--up);
}
.headline b.down,
.down {
  color: var(--down);
}

.cards {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 7px;
}
.card {
  display: flex;
  flex-direction: column;
  gap: 3px;
  padding: 8px 10px;
  background: var(--bg-1);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
}
.card-v {
  font-size: 14px;
  font-weight: 600;
}
.tone-up {
  color: var(--up);
}
.tone-down {
  color: var(--down);
}
.tone-neutral {
  color: var(--text-0);
}
.tone-dim {
  color: var(--text-2);
}

.params {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px 13px;
  background: var(--bg-1);
  border: 1px solid var(--border);
  border-radius: var(--radius);
}
.param {
  display: flex;
  flex-direction: column;
  gap: 5px;
}
.param-lbl {
  display: flex;
  justify-content: space-between;
  font-size: 11.5px;
  color: var(--text-2);
}
.param-lbl b {
  color: var(--accent);
  font-weight: 500;
}
.param input[type='range'] {
  width: 100%;
  height: 3px;
  accent-color: var(--accent);
  cursor: pointer;
}

.block {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.matches {
  display: flex;
  flex-direction: column;
  gap: 3px;
  max-height: 230px;
  overflow-y: auto;
}
.match {
  display: grid;
  grid-template-columns: 1fr auto auto;
  align-items: center;
  gap: 10px;
  padding: 6px 10px;
  background: var(--bg-1);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  font-size: 11.5px;
}
.m-date {
  color: var(--text-2);
}
.m-score {
  color: var(--text-3);
}
.m-ret {
  font-weight: 600;
  min-width: 56px;
  text-align: right;
}

.empty {
  font-size: 12px;
  color: var(--text-3);
  padding: 10px 0;
}
</style>
