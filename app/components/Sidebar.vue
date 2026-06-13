<script setup lang="ts">
import { ref, watch } from 'vue'
import { describeAlert } from '~/composables/useAlerts'
import { useChatDock, CHAT_MIN_H } from '~/composables/useChatDock'

const tabs = [
  { id: 'ind', label: 'Indicateurs' },
  { id: 'form', label: 'Formation' },
  { id: 'flow', label: 'Order flow' },
  { id: 'alerts', label: 'Alertes' },
  { id: 'risk', label: 'Risque' },
] as const
type TabId = (typeof tabs)[number]['id']
const active = ref<TabId>('ind')

const { lastTriggered } = useAlerts()
const toast = ref<string | null>(null)
let toastTimer: ReturnType<typeof setTimeout> | null = null
watch(lastTriggered, (a) => {
  if (!a) return
  toast.value = `${a.symbol} — ${describeAlert(a)}`
  if (toastTimer) clearTimeout(toastTimer)
  toastTimer = setTimeout(() => (toast.value = null), 8000)
})

// --- Assistant dock: collapse + drag-to-resize ---
const { collapsed, height, setHeight } = useChatDock()
const sidebarEl = ref<HTMLElement | null>(null)
const dragging = ref(false)
/** Minimum height left for the top (tabs) section while dragging. */
const TOP_MIN = 170

function startDrag(e: PointerEvent) {
  if (!sidebarEl.value) return
  dragging.value = true
  try {
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  } catch {
    // ignore — capture is a nicety, the move handler still works
  }
  e.preventDefault()
}

function onDrag(e: PointerEvent) {
  if (!dragging.value || !sidebarEl.value) return
  const rect = sidebarEl.value.getBoundingClientRect()
  // Distance from the pointer to the sidebar's bottom edge = desired chat height.
  const next = rect.bottom - e.clientY
  const max = rect.height - TOP_MIN
  setHeight(next, Math.max(CHAT_MIN_H, max))
}

function endDrag(e: PointerEvent) {
  if (!dragging.value) return
  dragging.value = false
  try {
    ;(e.target as HTMLElement).releasePointerCapture(e.pointerId)
  } catch {
    // ignore
  }
}
</script>

<template>
  <aside
    ref="sidebarEl"
    class="sidebar"
    :class="{ dragging, 'chat-collapsed': collapsed }"
    :style="{ '--chat-h': collapsed ? 'auto' : height + 'px' }"
  >
    <div class="sidebar-top">
      <nav class="tabs">
        <button
          v-for="t in tabs"
          :key="t.id"
          class="tab"
          :class="{ active: active === t.id }"
          @click="active = t.id"
        >
          {{ t.label }}
        </button>
      </nav>
      <div class="tab-body">
        <IndicatorPanel v-if="active === 'ind'" />
        <FormationPanel v-else-if="active === 'form'" />
        <OrderFlowPanel v-else-if="active === 'flow'" />
        <AlertsPanel v-else-if="active === 'alerts'" />
        <RiskPanel v-else-if="active === 'risk'" />
      </div>
    </div>

    <div
      v-show="!collapsed"
      class="splitter"
      role="separator"
      aria-orientation="horizontal"
      title="Glisser pour régler la taille de l'assistant"
      @pointerdown="startDrag"
      @pointermove="onDrag"
      @pointerup="endDrag"
      @pointercancel="endDrag"
    >
      <span class="splitter-grip" />
    </div>

    <div class="sidebar-bottom">
      <ChatPanel />
    </div>

    <transition name="toast">
      <div v-if="toast" class="alert-toast" @click="toast = null">
        <span class="toast-bell">⏰</span>
        <span>{{ toast }}</span>
      </div>
    </transition>

    <IndicatorModal />
  </aside>
</template>

<style scoped>
.sidebar {
  position: relative;
  display: flex;
  flex-direction: column;
  width: clamp(380px, 28vw, 460px);
  border-left: 1px solid var(--border);
  background: color-mix(in srgb, var(--bg-1) 60%, transparent);
  min-height: 0;
}
.sidebar-top {
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  flex-direction: column;
}
.tabs {
  display: flex;
  flex-shrink: 0;
  border-bottom: 1px solid var(--border);
  background: var(--bg-1);
}
.tab {
  flex: 1;
  font-size: 11px;
  font-weight: 500;
  white-space: nowrap;
  color: var(--text-3);
  background: transparent;
  border: none;
  border-bottom: 2px solid transparent;
  padding: 11px 2px;
  transition: all 0.13s ease;
}
.tab:hover {
  color: var(--text-1);
}
.tab.active {
  color: var(--text-0);
  border-bottom-color: var(--accent);
}
.tab-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
}
.sidebar-bottom {
  flex: 0 0 auto;
  height: var(--chat-h, 360px);
  min-height: 0;
  border-top: 1px solid var(--border);
}
/* When expanded, the splitter carries the divider line; avoid doubling it. */
.sidebar:not(.chat-collapsed) .sidebar-bottom {
  border-top: none;
}

/* Drag handle between the tabs section and the assistant dock. */
.splitter {
  flex: 0 0 auto;
  height: 11px;
  display: grid;
  place-items: center;
  border-top: 1px solid var(--border);
  background: var(--bg-1);
  cursor: row-resize;
  touch-action: none;
  transition: background 0.13s ease;
}
.splitter:hover {
  background: var(--bg-2);
}
.splitter-grip {
  width: 34px;
  height: 3px;
  border-radius: 999px;
  background: var(--border-strong);
  transition: background 0.13s ease;
}
.splitter:hover .splitter-grip,
.sidebar.dragging .splitter-grip {
  background: var(--accent);
}
.sidebar.dragging {
  cursor: row-resize;
  user-select: none;
}

@media (max-width: 980px) {
  .sidebar {
    width: 100%;
    border-left: none;
    border-top: 1px solid var(--border);
  }
  .sidebar-top {
    flex: none;
    height: 60vh;
  }
  /* On mobile the panes stack and scroll; ignore the desktop drag height. */
  .sidebar-bottom {
    flex: none;
    height: 80vh;
  }
  .sidebar.chat-collapsed .sidebar-bottom {
    height: auto;
  }
  .splitter {
    display: none;
  }
}

.alert-toast {
  position: absolute;
  top: 52px;
  left: 14px;
  right: 14px;
  z-index: 20;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 11px 14px;
  font-size: 12.5px;
  color: var(--text-0);
  background: var(--bg-3);
  border: 1px solid var(--accent);
  border-radius: var(--radius);
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.5);
  cursor: pointer;
}
.toast-bell {
  font-size: 15px;
}
.toast-enter-active,
.toast-leave-active {
  transition: all 0.25s ease;
}
.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}
</style>
