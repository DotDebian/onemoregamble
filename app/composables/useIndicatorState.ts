import { ref, watch, type Ref } from 'vue'
import { defaultEnabledIds } from '~/indicators'

const STORAGE_KEY = 'omg.indicators.enabled'

let enabled: Ref<string[]> | null = null

function load(): string[] {
  if (import.meta.client) {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) return JSON.parse(raw)
    } catch {
      // ignore
    }
  }
  return defaultEnabledIds()
}

export function useIndicatorState() {
  if (!enabled) {
    enabled = ref<string[]>(load())
    watch(
      enabled,
      (val) => {
        if (import.meta.client) {
          try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(val))
          } catch {
            // ignore quota / privacy mode
          }
        }
      },
      { deep: true },
    )
  }
  const e = enabled

  function isEnabled(id: string): boolean {
    return e.value.includes(id)
  }

  function toggle(id: string) {
    e.value = e.value.includes(id) ? e.value.filter((x) => x !== id) : [...e.value, id]
  }

  return { enabled: e, isEnabled, toggle }
}
