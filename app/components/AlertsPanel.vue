<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { describeAlert, type AlertType, type AlertDirection } from '~/composables/useAlerts'

const { symbol, lastPrice } = useMarket()
const { alerts, add, remove, toggle, rearm, requestPermission } = useAlerts()
const list = computed(() => alerts.value.filter((a) => a.symbol === symbol.value))

const type = ref<AlertType>('price')
const direction = ref<AlertDirection>('above')
const value = ref<number | null>(null)

const permission = ref<NotificationPermission | 'unsupported'>('unsupported')
onMounted(() => {
  if (import.meta.client && 'Notification' in window) permission.value = Notification.permission
})

const placeholder = computed(() => {
  if (type.value === 'price') return lastPrice.value ? String(Math.round(lastPrice.value)) : 'prix'
  if (type.value === 'rsi') return '70'
  return '50' // EMA period
})

function submit() {
  if (value.value == null || Number.isNaN(value.value)) return
  add({
    symbol: symbol.value,
    type: type.value,
    direction: direction.value,
    value: value.value,
    enabled: true,
  })
  value.value = null
}

async function enableNotifs() {
  await requestPermission()
  if ('Notification' in window) permission.value = Notification.permission
}
</script>

<template>
  <div class="panel">
    <div v-if="permission === 'default'" class="notif-cta">
      <span>Activer les notifications navigateur ?</span>
      <button @click="enableNotifs">Activer</button>
    </div>

    <form class="alert-form" @submit.prevent="submit">
      <div class="seg">
        <button type="button" :class="{ on: type === 'price' }" @click="type = 'price'">Prix</button>
        <button type="button" :class="{ on: type === 'rsi' }" @click="type = 'rsi'">RSI</button>
        <button type="button" :class="{ on: type === 'ema' }" @click="type = 'ema'">EMA</button>
      </div>
      <div class="form-row">
        <select v-model="direction" class="select">
          <option value="above">{{ type === 'ema' ? 'croise au-dessus' : 'au-dessus (≥)' }}</option>
          <option value="below">{{ type === 'ema' ? 'croise en-dessous' : 'en-dessous (≤)' }}</option>
        </select>
        <input
          v-model.number="value"
          type="number"
          step="any"
          class="input"
          :placeholder="type === 'ema' ? 'période EMA' : placeholder"
        />
        <button type="submit" class="add-btn" :disabled="value == null">+</button>
      </div>
    </form>

    <div class="list">
      <div v-if="!list.length" class="muted">Aucune alerte sur {{ symbol }}.</div>
      <div v-for="a in list" :key="a.id" class="alert" :class="{ off: !a.enabled, fired: a.triggered }">
        <button class="dot-btn" :title="a.enabled ? 'Désactiver' : 'Activer'" @click="toggle(a.id)">
          <span class="dot" :class="{ on: a.enabled, fired: a.triggered }" />
        </button>
        <span class="desc">{{ describeAlert(a) }}</span>
        <button v-if="a.triggered" class="mini" title="Réarmer" @click="rearm(a.id)">↻</button>
        <button class="mini del" title="Supprimer" @click="remove(a.id)">✕</button>
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
.notif-cta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  font-size: 11.5px;
  color: var(--accent);
  padding: 8px 10px;
  background: var(--accent-dim);
  border: 1px solid rgba(224, 179, 65, 0.3);
  border-radius: var(--radius-sm);
}
.notif-cta button {
  font-size: 11px;
  color: var(--bg-0);
  background: var(--accent);
  border: none;
  border-radius: 5px;
  padding: 3px 10px;
}

.alert-form {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.seg {
  display: flex;
  gap: 4px;
}
.seg button {
  flex: 1;
  font-size: 11.5px;
  color: var(--text-2);
  background: var(--bg-2);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  padding: 6px;
  transition: all 0.13s ease;
}
.seg button.on {
  color: var(--bg-0);
  background: var(--accent);
  border-color: var(--accent);
}
.form-row {
  display: flex;
  gap: 6px;
}
.select,
.input {
  font-family: var(--font-sans);
  font-size: 12px;
  color: var(--text-0);
  background: var(--bg-2);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  padding: 7px 9px;
}
.select {
  flex: 1.2;
}
.input {
  flex: 1;
  min-width: 0;
  font-family: var(--font-mono);
}
.select:focus,
.input:focus {
  outline: none;
  border-color: var(--accent);
}
.add-btn {
  width: 34px;
  font-size: 16px;
  color: var(--bg-0);
  background: var(--accent);
  border: none;
  border-radius: var(--radius-sm);
}
.add-btn:disabled {
  background: var(--bg-3);
  color: var(--text-3);
}

.list {
  display: flex;
  flex-direction: column;
  gap: 5px;
}
.alert {
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 7px 10px;
  background: var(--bg-1);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
}
.alert.off {
  opacity: 0.5;
}
.alert.fired {
  border-color: rgba(224, 179, 65, 0.4);
  background: var(--accent-dim);
}
.dot-btn {
  background: none;
  border: none;
  padding: 0;
  display: grid;
  place-items: center;
}
.dot {
  width: 9px;
  height: 9px;
  border-radius: 50%;
  background: var(--text-3);
}
.dot.on {
  background: var(--up);
}
.dot.fired {
  background: var(--accent);
  box-shadow: 0 0 8px var(--accent);
}
.desc {
  flex: 1;
  font-size: 12px;
  color: var(--text-1);
}
.mini {
  font-size: 12px;
  color: var(--text-3);
  background: none;
  border: none;
  padding: 2px 4px;
}
.mini:hover {
  color: var(--text-0);
}
.mini.del:hover {
  color: var(--down);
}
.muted {
  font-size: 12px;
  color: var(--text-3);
}
</style>
