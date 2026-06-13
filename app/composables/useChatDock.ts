import { ref, type Ref } from 'vue'

// Shared UI state for the assistant dock at the bottom of the sidebar:
// whether it's collapsed (header only) and, when expanded, its pixel height.
// Singleton — both Sidebar (the drag splitter) and ChatPanel (the collapse
// button) read/write the same instance. Persisted to localStorage.

const STORAGE_KEY = 'omg.chatdock'

/** Minimum expanded height (px) — keeps composer + a couple messages visible. */
export const CHAT_MIN_H = 150

let collapsed: Ref<boolean> | null = null
let height: Ref<number> | null = null

function load(): { collapsed: boolean; height: number } {
  const fallback = { collapsed: false, height: 360 }
  if (import.meta.client) {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const v = JSON.parse(raw)
        return {
          collapsed: !!v.collapsed,
          height: Number.isFinite(v.height) ? Math.max(CHAT_MIN_H, v.height) : fallback.height,
        }
      }
    } catch {
      // ignore
    }
  }
  return fallback
}

export function useChatDock() {
  if (!collapsed || !height) {
    const init = load()
    collapsed = ref(init.collapsed)
    height = ref(init.height)
  }
  const c = collapsed
  const h = height

  function persist() {
    if (import.meta.client) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ collapsed: c.value, height: h.value }))
      } catch {
        // ignore quota / privacy mode
      }
    }
  }

  function toggle() {
    c.value = !c.value
    persist()
  }

  function expand() {
    if (c.value) {
      c.value = false
      persist()
    }
  }

  /** Set the expanded height (px), clamped to [CHAT_MIN_H, max]. */
  function setHeight(px: number, max: number) {
    h.value = Math.round(Math.min(Math.max(px, CHAT_MIN_H), max))
    persist()
  }

  return { collapsed: c, height: h, toggle, expand, setHeight }
}
