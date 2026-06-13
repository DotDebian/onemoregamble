<script setup lang="ts">
import { TOOLS, type DrawingTool } from '~/composables/useDrawings'

const { tool, setTool, selectedId, remove, clear, drawings } = useDrawings()

function pick(t: DrawingTool) {
  setTool(tool.value === t && t !== 'cursor' ? 'cursor' : t)
}
</script>

<template>
  <div class="toolbar">
    <button
      v-for="t in TOOLS"
      :key="t.id"
      class="tool"
      :class="{ active: tool === t.id }"
      :title="t.label"
      @click="pick(t.id)"
    >
      <!-- compact glyphs -->
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
        <template v-if="t.icon === 'cursor'"><path d="M5 3l6 16 2-7 7-2z" fill="currentColor" stroke="none" /></template>
        <template v-else-if="t.icon === 'hline'"><line x1="3" y1="12" x2="21" y2="12" /><circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" /></template>
        <template v-else-if="t.icon === 'trend'"><line x1="4" y1="19" x2="20" y2="6" /><circle cx="4" cy="19" r="1.6" fill="currentColor" stroke="none" /><circle cx="20" cy="6" r="1.6" fill="currentColor" stroke="none" /></template>
        <template v-else-if="t.icon === 'ray'"><line x1="4" y1="18" x2="22" y2="6" /><circle cx="4" cy="18" r="1.8" fill="currentColor" stroke="none" /></template>
        <template v-else-if="t.icon === 'rect'"><rect x="4" y="6" width="16" height="12" rx="1.5" /></template>
        <template v-else-if="t.icon === 'fib'"><line x1="4" y1="5" x2="20" y2="5" /><line x1="4" y1="10" x2="20" y2="10" /><line x1="4" y1="14" x2="20" y2="14" /><line x1="4" y1="19" x2="20" y2="19" /></template>
        <template v-else-if="t.icon === 'ruler'"><rect x="3" y="8" width="18" height="8" rx="1" transform="rotate(-12 12 12)" /><line x1="8" y1="9" x2="8" y2="12" /><line x1="12" y1="8" x2="12" y2="11" /><line x1="16" y1="7" x2="16" y2="10" /></template>
        <template v-else-if="t.icon === 'position'"><rect x="4" y="6" width="16" height="5" rx="1" /><rect x="4" y="13" width="16" height="5" rx="1" /></template>
      </svg>
    </button>

    <div class="tb-sep" />

    <button
      class="tool danger"
      :disabled="!selectedId"
      title="Supprimer la sélection (Suppr)"
      @click="selectedId && remove(selectedId)"
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
        <path d="M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13" />
      </svg>
    </button>
    <button
      class="tool danger"
      :disabled="!drawings.length"
      title="Tout effacer"
      @click="clear()"
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
        <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v5M14 11v5" />
      </svg>
    </button>
  </div>
</template>

<style scoped>
.toolbar {
  position: absolute;
  top: 50%;
  left: 8px;
  transform: translateY(-50%);
  z-index: 6;
  display: flex;
  flex-direction: column;
  gap: 3px;
  padding: 5px;
  background: color-mix(in srgb, var(--bg-1) 88%, transparent);
  border: 1px solid var(--border);
  border-radius: 12px;
  backdrop-filter: blur(8px);
}
.tool {
  display: grid;
  place-items: center;
  width: 32px;
  height: 32px;
  color: var(--text-2);
  background: transparent;
  border: 1px solid transparent;
  border-radius: 8px;
  transition: all 0.13s ease;
}
.tool:hover:not(:disabled) {
  color: var(--text-0);
  background: var(--bg-3);
}
.tool.active {
  color: var(--bg-0);
  background: var(--accent);
  border-color: var(--accent);
}
.tool:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}
.tool.danger:hover:not(:disabled) {
  color: var(--down);
}
.tb-sep {
  height: 1px;
  margin: 3px 4px;
  background: var(--border);
}
</style>
