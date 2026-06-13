import { ref, type Ref } from 'vue'

// Which indicator's detail modal is open (null = closed). Singleton.
let activeId: Ref<string | null> | null = null

export function useEducation() {
  if (!activeId) activeId = ref<string | null>(null)
  const id = activeId
  return {
    activeId: id,
    open: (indicatorId: string) => (id.value = indicatorId),
    close: () => (id.value = null),
  }
}
