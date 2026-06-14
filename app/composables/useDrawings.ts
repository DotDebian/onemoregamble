import { ref, watch, type Ref } from 'vue'

export type DrawingTool =
  | 'cursor'
  | 'horizontal'
  | 'trendline'
  | 'ray'
  | 'rectangle'
  | 'fib'
  | 'measure'
  | 'position'
  | 'sketch'

export interface DPoint {
  time: number
  price: number
}

export interface Drawing {
  id: string
  type: Exclude<DrawingTool, 'cursor'>
  a: DPoint
  b: DPoint
  /** position tool only */
  stop?: number
  target?: number
}

export const TOOLS: { id: DrawingTool; label: string; icon: string; points: 1 | 2 }[] = [
  { id: 'cursor', label: 'Curseur', icon: 'cursor', points: 1 },
  { id: 'horizontal', label: 'Ligne horizontale', icon: 'hline', points: 1 },
  { id: 'trendline', label: 'Trendline', icon: 'trend', points: 2 },
  { id: 'ray', label: 'Ray (demi-droite)', icon: 'ray', points: 2 },
  { id: 'rectangle', label: 'Rectangle / zone', icon: 'rect', points: 2 },
  { id: 'fib', label: 'Fibonacci', icon: 'fib', points: 2 },
  { id: 'measure', label: 'Mesure', icon: 'ruler', points: 2 },
  { id: 'position', label: 'Position / Risk-Reward', icon: 'position', points: 2 },
  { id: 'sketch', label: 'Sketch search — dessine une figure', icon: 'sketch', points: 2 },
]

function storageKey(symbol: string) {
  return `omg.drawings.${symbol}`
}

function uid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `d_${Date.now().toString(36)}_${Math.floor(Math.random() * 1e6).toString(36)}`
}

let activeTool: Ref<DrawingTool> | null = null
let drawings: Ref<Drawing[]> | null = null
let selectedId: Ref<string | null> | null = null
let currentSymbol = ''

function load(symbol: string): Drawing[] {
  if (!import.meta.client) return []
  try {
    const raw = localStorage.getItem(storageKey(symbol))
    if (raw) return JSON.parse(raw)
  } catch {
    // ignore
  }
  return []
}

function persist(symbol: string, list: Drawing[]) {
  if (!import.meta.client) return
  try {
    localStorage.setItem(storageKey(symbol), JSON.stringify(list))
  } catch {
    // ignore
  }
}

export function useDrawings() {
  if (!activeTool) activeTool = ref<DrawingTool>('cursor')
  if (!selectedId) selectedId = ref<string | null>(null)
  if (!drawings) drawings = ref<Drawing[]>([])

  const tool = activeTool
  const list = drawings
  const selected = selectedId

  /** Switch the persisted set when the symbol changes. */
  function loadForSymbol(symbol: string) {
    currentSymbol = symbol
    list.value = load(symbol)
    selected.value = null
  }

  function setTool(t: DrawingTool) {
    tool.value = t
    if (t !== 'cursor') selected.value = null
  }

  function add(d: Drawing) {
    list.value = [...list.value, d]
    persist(currentSymbol, list.value)
  }

  function update(id: string, patch: Partial<Drawing>) {
    list.value = list.value.map((d) => (d.id === id ? { ...d, ...patch } : d))
    persist(currentSymbol, list.value)
  }

  function remove(id: string) {
    list.value = list.value.filter((d) => d.id !== id)
    if (selected.value === id) selected.value = null
    persist(currentSymbol, list.value)
  }

  function clear() {
    list.value = []
    selected.value = null
    persist(currentSymbol, list.value)
  }

  function select(id: string | null) {
    selected.value = id
  }

  return {
    tool,
    drawings: list,
    selectedId: selected,
    loadForSymbol,
    setTool,
    add,
    update,
    remove,
    clear,
    select,
    uid,
  }
}
