<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted } from 'vue'
import { renderMarkdown } from '~/utils/markdown'
import { useChatDock } from '~/composables/useChatDock'

const { messages, streaming, send, reset } = useChat()
const { collapsed, toggle, expand } = useChatDock()

// Friendly label derived from the configured model id (e.g. claude-sonnet-4-6
// → "Claude Sonnet 4.6"), so the header never drifts from the real model.
const modelLabel = computed(() => {
  const id = String(useRuntimeConfig().public.model || '')
  const m = id.match(/^claude-([a-z]+)-(\d+)(?:-(\d+))?/i)
  if (!m) return id || 'Claude'
  const name = m[1]!.charAt(0).toUpperCase() + m[1]!.slice(1)
  const ver = m[3] ? `${m[2]}.${m[3]}` : m[2]
  return `Claude ${name} ${ver}`
})

const draft = ref('')
const scroller = ref<HTMLDivElement | null>(null)
const keyConfigured = ref<boolean | null>(null)

const suggestions = [
  'Analyse la dernière bougie et le contexte immédiat.',
  'Que disent le RSI et le MACD en ce moment ?',
  'Quelle session est active et quel impact possible ?',
]

onMounted(async () => {
  try {
    const status = await $fetch<{ configured: boolean }>('/api/chat-status')
    keyConfigured.value = status.configured
  } catch {
    keyConfigured.value = false
  }
})

async function submit() {
  const text = draft.value
  if (!text.trim() || streaming.value) return
  draft.value = ''
  await send(text)
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    submit()
  }
}

function useSuggestion(s: string) {
  draft.value = s
  submit()
}

watch(
  [messages, streaming],
  async () => {
    await nextTick()
    if (scroller.value) scroller.value.scrollTop = scroller.value.scrollHeight
  },
  { deep: true },
)

// Auto-expand when a response starts streaming (e.g. triggered from a lesson
// while the assistant was collapsed) so the user actually sees the answer.
watch(streaming, (v) => {
  if (v) expand()
})
</script>

<template>
  <section class="chat">
    <header class="chat-head" :class="{ clickable: collapsed }" @click="collapsed && expand()">
      <div class="chat-title">
        <span class="spark" />
        <span>Assistant</span>
        <span v-if="!collapsed" class="model-tag mono">{{ modelLabel }}</span>
        <span v-else-if="messages.length" class="msg-count">{{ messages.length }}</span>
      </div>
      <div class="head-actions">
        <button
          v-if="messages.length && !collapsed"
          class="reset-btn"
          title="Effacer"
          @click.stop="reset"
        >
          Effacer
        </button>
        <button
          class="icon-btn"
          :title="collapsed ? 'Agrandir l\'assistant' : 'Réduire l\'assistant'"
          :aria-expanded="!collapsed"
          @click.stop="toggle"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" :class="{ flip: collapsed }">
            <path d="M6 9L12 15L18 9" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </button>
      </div>
    </header>

    <div v-if="keyConfigured === false && !collapsed" class="key-banner">
      Clé API absente. Ajoute <code>ANTHROPIC_API_KEY</code> dans <code>.env</code> puis relance
      <code>pnpm dev</code>.
    </div>

    <div v-show="!collapsed" ref="scroller" class="chat-body">
      <div v-if="!messages.length" class="empty">
        <p class="empty-lead">
          Pose une question sur le graphique. L'assistant reçoit le snapshot des indicateurs et des
          sessions à l'instant T.
        </p>
        <div class="suggestions">
          <button v-for="s in suggestions" :key="s" class="suggestion" @click="useSuggestion(s)">
            {{ s }}
          </button>
        </div>
      </div>

      <div
        v-for="(m, i) in messages"
        :key="i"
        class="msg"
        :class="m.role"
      >
        <div class="msg-role eyebrow">{{ m.role === 'user' ? 'Vous' : 'Assistant' }}</div>
        <div v-if="m.role === 'assistant'" class="msg-body md" v-html="renderMarkdown(m.content)" />
        <div v-else class="msg-body">{{ m.content }}</div>
        <span v-if="streaming && i === messages.length - 1 && m.role === 'assistant' && !m.content" class="typing">
          <span /><span /><span />
        </span>
      </div>
    </div>

    <form v-show="!collapsed" class="composer" @submit.prevent="submit">
      <textarea
        v-model="draft"
        class="composer-input"
        rows="1"
        placeholder="Demande une analyse…"
        :disabled="streaming"
        @keydown="onKeydown"
      />
      <button class="send-btn" type="submit" :disabled="streaming || !draft.trim()">
        <svg v-if="!streaming" width="16" height="16" viewBox="0 0 24 24" fill="none">
          <path d="M4 12L20 4L13 20L11 13L4 12Z" fill="currentColor" />
        </svg>
        <span v-else class="spinner" />
      </button>
    </form>
  </section>
</template>

<style scoped>
.chat {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}
.chat-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 14px;
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}
.chat-head.clickable {
  cursor: pointer;
}
.chat-head.clickable:hover {
  background: var(--bg-2);
}
.head-actions {
  display: flex;
  align-items: center;
  gap: 6px;
}
.icon-btn {
  display: grid;
  place-items: center;
  width: 26px;
  height: 26px;
  color: var(--text-3);
  background: transparent;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  transition: all 0.15s ease;
}
.icon-btn:hover {
  color: var(--text-0);
  border-color: var(--border-strong);
}
.icon-btn svg {
  transition: transform 0.2s ease;
}
.icon-btn svg.flip {
  transform: rotate(180deg);
}
.msg-count {
  display: grid;
  place-items: center;
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  font-size: 10px;
  font-weight: 600;
  color: var(--bg-0);
  background: var(--accent);
  border-radius: 999px;
}
.chat-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-0);
}
.spark {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--accent);
  box-shadow: 0 0 10px var(--accent);
}
.model-tag {
  font-size: 10px;
  font-weight: 500;
  color: var(--text-3);
  padding: 2px 7px;
  border: 1px solid var(--border);
  border-radius: 999px;
}
.reset-btn {
  font-size: 11px;
  color: var(--text-3);
  background: transparent;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  padding: 4px 9px;
  transition: all 0.15s ease;
}
.reset-btn:hover {
  color: var(--down);
  border-color: var(--down);
}

.key-banner {
  margin: 10px 12px 0;
  padding: 9px 11px;
  font-size: 11.5px;
  color: var(--warn);
  background: rgba(245, 165, 36, 0.08);
  border: 1px solid rgba(245, 165, 36, 0.3);
  border-radius: var(--radius-sm);
}
.key-banner code {
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--text-0);
}

.chat-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.empty {
  display: flex;
  flex-direction: column;
  gap: 14px;
  margin: auto 0;
}
.empty-lead {
  margin: 0;
  font-size: 13px;
  color: var(--text-2);
  line-height: 1.5;
}
.suggestions {
  display: flex;
  flex-direction: column;
  gap: 7px;
}
.suggestion {
  text-align: left;
  font-size: 12.5px;
  color: var(--text-1);
  background: var(--bg-2);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  padding: 9px 12px;
  transition: all 0.15s ease;
}
.suggestion:hover {
  color: var(--text-0);
  border-color: var(--accent);
  background: var(--bg-3);
}

.msg {
  display: flex;
  flex-direction: column;
  gap: 5px;
}
.msg-role {
  color: var(--text-3);
}
.msg.user .msg-role {
  color: var(--accent);
}
.msg-body {
  font-size: 13px;
  line-height: 1.55;
  color: var(--text-1);
  white-space: pre-wrap;
  word-break: break-word;
}
.msg.user .msg-body {
  color: var(--text-0);
  background: var(--bg-2);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  padding: 9px 12px;
}

/* Rendered markdown */
.md :deep(p) {
  margin: 0 0 8px;
}
.md :deep(p:last-child) {
  margin-bottom: 0;
}
.md :deep(h4) {
  margin: 10px 0 6px;
  font-size: 12px;
  color: var(--text-0);
  letter-spacing: 0.02em;
}
.md :deep(ul) {
  margin: 4px 0 8px;
  padding-left: 18px;
}
.md :deep(li) {
  margin: 2px 0;
}
.md :deep(strong) {
  color: var(--text-0);
  font-weight: 600;
}
.md :deep(code) {
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--accent);
  background: var(--accent-dim);
  padding: 1px 5px;
  border-radius: 4px;
}
.md :deep(h1),
.md :deep(h2),
.md :deep(h3) {
  margin: 11px 0 6px;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-0);
  letter-spacing: 0.01em;
}
.md :deep(ol) {
  margin: 4px 0 8px;
  padding-left: 20px;
}
.md :deep(pre) {
  margin: 8px 0;
  padding: 10px 12px;
  background: var(--bg-2);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  overflow-x: auto;
}
.md :deep(pre code) {
  display: block;
  font-family: var(--font-mono);
  font-size: 12px;
  line-height: 1.5;
  color: var(--text-1);
  background: none;
  padding: 0;
  white-space: pre;
}
.md :deep(table) {
  width: 100%;
  border-collapse: collapse;
  margin: 8px 0;
  font-size: 12px;
}
.md :deep(th),
.md :deep(td) {
  border: 1px solid var(--border);
  padding: 5px 8px;
  text-align: left;
  vertical-align: top;
}
.md :deep(th) {
  background: var(--bg-2);
  color: var(--text-0);
  font-weight: 600;
}
.md :deep(td) {
  color: var(--text-1);
}
.md :deep(a) {
  color: var(--accent);
  text-decoration: underline;
}

.typing {
  display: inline-flex;
  gap: 4px;
  padding-top: 2px;
}
.typing span {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--text-3);
  animation: blink 1.2s infinite ease-in-out;
}
.typing span:nth-child(2) {
  animation-delay: 0.2s;
}
.typing span:nth-child(3) {
  animation-delay: 0.4s;
}
@keyframes blink {
  0%, 60%, 100% {
    opacity: 0.25;
  }
  30% {
    opacity: 1;
  }
}

.composer {
  display: flex;
  gap: 8px;
  align-items: flex-end;
  padding: 12px 14px;
  border-top: 1px solid var(--border);
}
.composer-input {
  flex: 1;
  resize: none;
  max-height: 120px;
  font-family: var(--font-sans);
  font-size: 13px;
  color: var(--text-0);
  background: var(--bg-2);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  padding: 10px 12px;
  line-height: 1.4;
  transition: border-color 0.15s ease;
}
.composer-input:focus {
  outline: none;
  border-color: var(--accent);
}
.composer-input::placeholder {
  color: var(--text-3);
}
.send-btn {
  display: grid;
  place-items: center;
  width: 38px;
  height: 38px;
  flex-shrink: 0;
  color: var(--bg-0);
  background: var(--accent);
  border: none;
  border-radius: var(--radius-sm);
  transition: all 0.15s ease;
}
.send-btn:hover:not(:disabled) {
  filter: brightness(1.1);
}
.send-btn:disabled {
  background: var(--bg-3);
  color: var(--text-3);
  cursor: not-allowed;
}
.spinner {
  width: 15px;
  height: 15px;
  border: 2px solid var(--text-3);
  border-top-color: var(--text-0);
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
