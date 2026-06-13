<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { computeRisk } from '~/utils/risk'

const { lastPrice } = useMarket()
const { drawings, selectedId } = useDrawings()

const accountSize = ref(10000)
const riskPct = ref(1)
const entry = ref<number | null>(null)
const stop = ref<number | null>(null)
const target = ref<number | null>(null)

// Seed entry with the live price the first time it's available.
watch(
  lastPrice,
  (p) => {
    if (entry.value == null && p != null) entry.value = Math.round(p * 100) / 100
  },
  { immediate: true },
)

const selectedPosition = computed(() =>
  drawings.value.find((d) => d.id === selectedId.value && d.type === 'position'),
)

function loadFromChart() {
  const pos = selectedPosition.value
  if (!pos) return
  entry.value = Math.round(pos.a.price * 100) / 100
  if (pos.stop != null) stop.value = Math.round(pos.stop * 100) / 100
  if (pos.target != null) target.value = Math.round(pos.target * 100) / 100
}

const result = computed(() =>
  computeRisk({
    accountSize: accountSize.value || 0,
    riskPct: riskPct.value || 0,
    entry: entry.value || 0,
    stop: stop.value || 0,
    target: target.value,
  }),
)
</script>

<template>
  <div class="panel">
    <div class="eyebrow">Calculateur de position</div>

    <button v-if="selectedPosition" class="from-chart" @click="loadFromChart">
      ↧ Charger la position sélectionnée
    </button>

    <div class="fields">
      <label class="field">
        <span>Capital ($)</span>
        <input v-model.number="accountSize" type="number" class="input mono" />
      </label>
      <label class="field">
        <span>Risque (%)</span>
        <input v-model.number="riskPct" type="number" step="0.1" class="input mono" />
      </label>
      <label class="field">
        <span>Entrée</span>
        <input v-model.number="entry" type="number" step="any" class="input mono" />
      </label>
      <label class="field">
        <span>Stop</span>
        <input v-model.number="stop" type="number" step="any" class="input mono" />
      </label>
      <label class="field span2">
        <span>Cible (optionnel)</span>
        <input v-model.number="target" type="number" step="any" class="input mono" />
      </label>
    </div>

    <div class="out" :class="{ invalid: !result.valid }">
      <div class="out-row">
        <span>Sens</span>
        <strong class="mono" :class="result.direction === 'long' ? 'up' : 'down'">
          {{ result.direction === 'long' ? 'LONG' : 'SHORT' }}
        </strong>
      </div>
      <div class="out-row"><span>Risque</span><strong class="mono">{{ result.valid ? formatPrice(result.riskAmount) + ' $' : '—' }}</strong></div>
      <div class="out-row"><span>Taille</span><strong class="mono">{{ result.valid ? result.quantity.toFixed(4) : '—' }}</strong></div>
      <div class="out-row"><span>Notionnel</span><strong class="mono">{{ result.valid ? formatPrice(result.notional) + ' $' : '—' }}</strong></div>
      <div class="out-row highlight">
        <span>Risk / Reward</span>
        <strong class="mono" :class="(result.rr ?? 0) >= 1 ? 'up' : 'down'">
          {{ result.rr != null ? result.rr.toFixed(2) + ' R' : '—' }}
        </strong>
      </div>
      <div class="out-row" v-if="result.reward != null">
        <span>Gain potentiel</span><strong class="mono up">{{ formatPrice(result.reward) }} $</strong>
      </div>
    </div>
  </div>
</template>

<style scoped>
.panel {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 14px;
}
.from-chart {
  font-size: 11.5px;
  color: var(--accent);
  background: var(--accent-dim);
  border: 1px solid rgba(224, 179, 65, 0.3);
  border-radius: var(--radius-sm);
  padding: 7px;
}
.fields {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 9px;
}
.field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.field.span2 {
  grid-column: span 2;
}
.field span {
  font-size: 10.5px;
  color: var(--text-3);
  letter-spacing: 0.03em;
  text-transform: uppercase;
}
.input {
  font-size: 13px;
  color: var(--text-0);
  background: var(--bg-2);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  padding: 8px 10px;
  width: 100%;
}
.input:focus {
  outline: none;
  border-color: var(--accent);
}
.out {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 12px;
  background: var(--bg-1);
  border: 1px solid var(--border);
  border-radius: var(--radius);
}
.out.invalid {
  opacity: 0.6;
}
.out-row {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  font-size: 12px;
  color: var(--text-2);
}
.out-row strong {
  color: var(--text-0);
  font-weight: 600;
}
.out-row.highlight {
  padding-top: 6px;
  border-top: 1px solid var(--border);
  font-size: 13px;
}
</style>
