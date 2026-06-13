<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { MODULES, MODULE_MAP, PHASES } from '~/content/formation'
import { renderMarkdown } from '~/utils/markdown'

const { isEnabled, toggle } = useIndicatorState()
const { send, streaming } = useChat()

const STORAGE_MODULE = 'omg.formation.module'
const STORAGE_PROGRESS = 'omg.formation.progress'

function loadProgress(): Record<string, number> {
  if (import.meta.client) {
    try {
      const raw = localStorage.getItem(STORAGE_PROGRESS)
      if (raw) return JSON.parse(raw)
    } catch {
      // ignore
    }
  }
  return {}
}
function loadModule(): string | null {
  if (import.meta.client) {
    const id = localStorage.getItem(STORAGE_MODULE)
    if (id && MODULES.some((m) => m.id === id)) return id
  }
  return null
}

const progress = ref<Record<string, number>>(loadProgress())
const activeModuleId = ref<string | null>(loadModule())

watch(
  progress,
  (v) => {
    if (import.meta.client) localStorage.setItem(STORAGE_PROGRESS, JSON.stringify(v))
  },
  { deep: true },
)
watch(activeModuleId, (v) => {
  if (import.meta.client) {
    if (v) localStorage.setItem(STORAGE_MODULE, v)
    else localStorage.removeItem(STORAGE_MODULE)
  }
})

const activeModule = computed(() => MODULES.find((m) => m.id === activeModuleId.value) ?? null)

// The pedagogical path with each phase's modules resolved from their ids.
const path = computed(() =>
  PHASES.map((p) => ({
    title: p.title,
    hint: p.hint,
    modules: p.moduleIds.map((id) => MODULE_MAP[id]!).filter(Boolean),
  })),
)

const idx = computed<number>({
  get: () => {
    const id = activeModuleId.value
    if (!id) return 0
    const v = progress.value[id] ?? 0
    const len = activeModule.value?.lessons.length ?? 0
    return Math.min(Math.max(v, 0), Math.max(0, len - 1))
  },
  set: (v) => {
    const id = activeModuleId.value
    if (id) progress.value = { ...progress.value, [id]: v }
  },
})

const lesson = computed(() => activeModule.value?.lessons[idx.value] ?? null)
const lessonCount = computed(() => activeModule.value?.lessons.length ?? 0)
const progressPct = computed(() =>
  lessonCount.value ? ((idx.value + 1) / lessonCount.value) * 100 : 0,
)

/** Has the user opened this module before? */
function visited(id: string): boolean {
  return id in progress.value
}
/** A subtle fill for the module card reflecting how far the user has gone. */
function modulePct(id: string): number {
  const m = MODULES.find((mm) => mm.id === id)
  if (!m || !visited(id)) return 0
  return (((progress.value[id] ?? 0) + 1) / m.lessons.length) * 100
}

function openModule(id: string) {
  activeModuleId.value = id
}
function backToModules() {
  activeModuleId.value = null
}

function enableIndicators() {
  if (!lesson.value) return
  for (const id of lesson.value.enable) {
    if (!isEnabled(id)) toggle(id)
  }
}

function analyze() {
  if (!lesson.value) return
  enableIndicators()
  send(lesson.value.prompt, { effort: lesson.value.effort })
}

function go(delta: number) {
  const next = idx.value + delta
  if (next >= 0 && next < lessonCount.value) idx.value = next
}
</script>

<template>
  <div class="panel">
    <!-- ───────────────── Module picker ───────────────── -->
    <template v-if="!activeModule">
      <header class="f-head">
        <div>
          <span class="eyebrow">Formation guidée · en direct</span>
          <p class="f-sub">Un parcours progressif. Suis les étapes, ou pioche selon ton niveau.</p>
        </div>
      </header>

      <div class="path">
        <section v-for="(phase, pi) in path" :key="phase.title" class="phase">
          <div class="phase-head">
            <span class="phase-step">{{ pi + 1 }}</span>
            <div class="phase-titles">
              <span class="phase-title">{{ phase.title }}</span>
              <span class="phase-hint">{{ phase.hint }}</span>
            </div>
          </div>
          <div class="modules">
            <button
              v-for="m in phase.modules"
              :key="m.id"
              class="module-card"
              @click="openModule(m.id)"
            >
              <span class="m-icon">{{ m.icon }}</span>
              <span class="m-main">
                <span class="m-top">
                  <span class="m-title">{{ m.title }}</span>
                  <span class="m-level" :class="'lvl-' + m.level.toLowerCase()">{{ m.level }}</span>
                </span>
                <span class="m-tagline">{{ m.tagline }}</span>
                <span class="m-meta">
                  <span class="m-count">{{ m.lessons.length }} leçons</span>
                  <span v-if="visited(m.id)" class="m-resume">· reprendre</span>
                </span>
                <span class="m-bar"><span class="m-bar-fill" :style="{ width: modulePct(m.id) + '%' }" /></span>
              </span>
              <span class="m-arrow">›</span>
            </button>
          </div>
        </section>
      </div>
    </template>

    <!-- ───────────────── Lesson view ───────────────── -->
    <template v-else-if="lesson">
      <header class="f-head">
        <button class="back-btn" @click="backToModules">‹ Tous les modules</button>
        <div class="module-name">
          <span class="m-icon sm">{{ activeModule.icon }}</span>
          <span>{{ activeModule.title }}</span>
        </div>
      </header>

      <div class="progress">
        <div class="progress-bar" :style="{ width: progressPct + '%' }" />
      </div>
      <div class="progress-meta">
        <span>Leçon {{ idx + 1 }} / {{ lessonCount }}</span>
        <div class="dots">
          <button
            v-for="(l, i) in activeModule.lessons"
            :key="l.id"
            class="dot"
            :class="{ active: i === idx, done: i < idx }"
            :title="l.title"
            @click="idx = i"
          />
        </div>
      </div>

      <article class="lesson">
        <h3 class="lesson-title">{{ lesson.title }}</h3>
        <p class="lesson-goal">🎯 {{ lesson.goal }}</p>
        <div class="lesson-body md" v-html="renderMarkdown(lesson.body)" />

        <div class="watch">
          <span class="watch-label">👀 À observer</span>
          <p>{{ lesson.watch }}</p>
        </div>

        <div class="actions">
          <button v-if="lesson.enable.length" class="btn ghost" @click="enableIndicators">
            Activer les indicateurs
          </button>
          <button class="btn primary" :disabled="streaming" @click="analyze">
            <span v-if="!streaming">⚡ Analyser le graphe maintenant</span>
            <span v-else>Analyse en cours…</span>
          </button>
        </div>
        <p class="hint">La réponse de l'assistant s'affiche dans le chat ci-dessous ↓</p>
      </article>

      <nav class="f-nav">
        <button class="nav-btn" :disabled="idx === 0" @click="go(-1)">◀ Précédent</button>
        <button class="nav-btn" :disabled="idx === lessonCount - 1" @click="go(1)">
          Suivant ▶
        </button>
      </nav>
    </template>
  </div>
</template>

<style scoped>
.panel {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 14px;
}
.f-sub {
  margin: 4px 0 0;
  font-size: 12px;
  color: var(--text-2);
}

/* ── Module picker ── */
.path {
  display: flex;
  flex-direction: column;
  gap: 18px;
}
.phase {
  display: flex;
  flex-direction: column;
  gap: 9px;
}
.phase-head {
  display: flex;
  align-items: center;
  gap: 10px;
}
.phase-step {
  display: grid;
  place-items: center;
  width: 22px;
  height: 22px;
  flex-shrink: 0;
  font-size: 11px;
  font-weight: 700;
  color: var(--accent);
  background: var(--accent-dim);
  border: 1px solid var(--accent);
  border-radius: 50%;
}
.phase-titles {
  display: flex;
  flex-direction: column;
  line-height: 1.25;
}
.phase-title {
  font-size: 12px;
  font-weight: 700;
  color: var(--text-0);
}
.phase-hint {
  font-size: 11px;
  color: var(--text-3);
}
.modules {
  display: flex;
  flex-direction: column;
  gap: 9px;
}
.module-card {
  display: flex;
  align-items: center;
  gap: 12px;
  text-align: left;
  padding: 12px;
  background: var(--bg-1);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  transition: all 0.14s ease;
}
.module-card:hover {
  border-color: var(--accent);
  background: var(--bg-2);
  transform: translateY(-1px);
}
.m-icon {
  font-size: 22px;
  line-height: 1;
  flex-shrink: 0;
}
.m-icon.sm {
  font-size: 15px;
}
.m-main {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
  flex: 1;
}
.m-top {
  display: flex;
  align-items: center;
  gap: 8px;
}
.m-title {
  font-size: 13.5px;
  font-weight: 700;
  color: var(--text-0);
}
.m-level {
  font-size: 9.5px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  padding: 2px 6px;
  border-radius: 999px;
  border: 1px solid var(--border);
  color: var(--text-3);
  white-space: nowrap;
}
.m-level.lvl-débutant {
  color: var(--up);
  border-color: var(--up-dim);
  background: var(--up-dim);
}
.m-level.lvl-intermédiaire {
  color: var(--accent);
  border-color: var(--accent-dim);
  background: var(--accent-dim);
}
.m-level.lvl-avancé {
  color: var(--down);
  border-color: var(--down-dim);
  background: var(--down-dim);
}
.m-level.lvl-transversal {
  color: var(--info);
  border-color: rgba(91, 141, 239, 0.22);
  background: rgba(91, 141, 239, 0.12);
}
.m-tagline {
  font-size: 12px;
  color: var(--text-2);
  line-height: 1.4;
}
.m-meta {
  display: flex;
  gap: 5px;
  font-size: 10.5px;
  color: var(--text-3);
  margin-top: 1px;
}
.m-resume {
  color: var(--accent);
}
.m-bar {
  display: block;
  height: 3px;
  margin-top: 5px;
  background: var(--bg-3);
  border-radius: 999px;
  overflow: hidden;
}
.m-bar-fill {
  display: block;
  height: 100%;
  background: var(--accent);
  border-radius: 999px;
  transition: width 0.3s ease;
}
.m-arrow {
  font-size: 20px;
  color: var(--text-3);
  flex-shrink: 0;
  transition: transform 0.14s ease, color 0.14s ease;
}
.module-card:hover .m-arrow {
  color: var(--accent);
  transform: translateX(2px);
}

/* ── Lesson view header ── */
.f-head {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.back-btn {
  align-self: flex-start;
  font-size: 11.5px;
  color: var(--text-2);
  background: transparent;
  border: none;
  padding: 0;
  transition: color 0.13s ease;
}
.back-btn:hover {
  color: var(--accent);
}
.module-name {
  display: flex;
  align-items: center;
  gap: 7px;
  font-size: 13px;
  font-weight: 700;
  color: var(--text-0);
}

.progress {
  height: 4px;
  background: var(--bg-2);
  border-radius: 999px;
  overflow: hidden;
}
.progress-bar {
  height: 100%;
  background: var(--accent);
  transition: width 0.3s ease;
}
.progress-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 11px;
  color: var(--text-3);
}
.dots {
  display: flex;
  gap: 5px;
  flex-wrap: wrap;
  justify-content: flex-end;
}
.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--bg-3);
  border: none;
  cursor: pointer;
  transition: all 0.13s ease;
}
.dot.done {
  background: var(--text-3);
}
.dot.active {
  background: var(--accent);
  box-shadow: 0 0 8px var(--accent);
}

.lesson {
  display: flex;
  flex-direction: column;
  gap: 11px;
  background: var(--bg-1);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 14px;
}
.lesson-title {
  margin: 0;
  font-size: 15px;
  font-weight: 700;
  color: var(--text-0);
}
.lesson-goal {
  margin: 0;
  font-size: 12.5px;
  color: var(--accent);
}
.lesson-body {
  font-size: 13px;
  line-height: 1.55;
  color: var(--text-1);
}
.lesson-body :deep(p) {
  margin: 0 0 8px;
}
.lesson-body :deep(ul) {
  margin: 4px 0 8px;
  padding-left: 18px;
}
.lesson-body :deep(ol) {
  margin: 4px 0 8px;
  padding-left: 18px;
}
.lesson-body :deep(li) {
  margin: 3px 0;
}
.lesson-body :deep(strong) {
  color: var(--text-0);
}
.lesson-body :deep(blockquote) {
  margin: 8px 0;
  padding: 8px 12px;
  border-left: 2px solid var(--accent);
  background: var(--accent-dim);
  border-radius: 0 7px 7px 0;
  color: var(--text-1);
}

.watch {
  padding: 10px 12px;
  background: var(--bg-2);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
}
.watch-label {
  font-size: 11px;
  font-weight: 600;
  color: var(--info);
}
.watch p {
  margin: 4px 0 0;
  font-size: 12.5px;
  color: var(--text-1);
  line-height: 1.45;
}

.actions {
  display: flex;
  flex-direction: column;
  gap: 7px;
}
.btn {
  font-size: 13px;
  font-weight: 500;
  border-radius: var(--radius-sm);
  padding: 10px 12px;
  transition: all 0.13s ease;
  border: 1px solid transparent;
}
.btn.primary {
  color: var(--bg-0);
  background: var(--accent);
}
.btn.primary:hover:not(:disabled) {
  filter: brightness(1.08);
}
.btn.primary:disabled {
  background: var(--bg-3);
  color: var(--text-3);
  cursor: not-allowed;
}
.btn.ghost {
  color: var(--text-1);
  background: var(--bg-2);
  border-color: var(--border);
}
.btn.ghost:hover {
  color: var(--text-0);
  border-color: var(--accent);
}
.hint {
  margin: 0;
  font-size: 11px;
  color: var(--text-3);
  text-align: center;
}

.f-nav {
  display: flex;
  justify-content: space-between;
  gap: 8px;
}
.nav-btn {
  flex: 1;
  font-size: 12px;
  color: var(--text-1);
  background: var(--bg-2);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  padding: 9px;
  transition: all 0.13s ease;
}
.nav-btn:hover:not(:disabled) {
  color: var(--text-0);
  border-color: var(--border-strong);
}
.nav-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
</style>
