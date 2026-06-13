<script setup lang="ts">
import { ref, computed, onBeforeUnmount } from 'vue'
import { EDUCATION } from '~/content/education'

const props = defineProps<{ id: string }>()
const { open } = useEducation()

const edu = computed(() => EDUCATION[props.id])
const show = ref(false)
const pos = ref({ x: 0, y: 0 })
const dot = ref<HTMLButtonElement | null>(null)
let hideTimer: ReturnType<typeof setTimeout> | null = null

function place() {
  if (!dot.value) return
  const r = dot.value.getBoundingClientRect()
  pos.value = { x: r.left + r.width / 2, y: r.top }
}
function showTip() {
  if (hideTimer) {
    clearTimeout(hideTimer)
    hideTimer = null
  }
  place()
  show.value = true
}
// Small delay so moving the cursor from the dot onto the tooltip doesn't hide it.
function scheduleHide() {
  if (hideTimer) clearTimeout(hideTimer)
  hideTimer = setTimeout(() => {
    show.value = false
    hideTimer = null
  }, 160)
}
function openModal() {
  show.value = false
  open(props.id)
}

onBeforeUnmount(() => {
  if (hideTimer) clearTimeout(hideTimer)
})
</script>

<template>
  <button
    v-if="edu"
    ref="dot"
    class="help-dot"
    type="button"
    aria-label="Aide"
    @mouseenter="showTip"
    @mouseleave="scheduleHide"
    @click.stop="openModal"
  >
    ?
  </button>
  <Teleport to="body">
    <div
      v-if="show && edu"
      class="help-tip"
      :style="{ left: pos.x + 'px', top: pos.y + 'px' }"
      @mouseenter="showTip"
      @mouseleave="scheduleHide"
      @click="openModal"
    >
      {{ edu.short }}
      <span class="help-tip-cta">Cliquer pour en savoir plus →</span>
    </div>
  </Teleport>
</template>

<style scoped>
.help-dot {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  padding: 0;
  flex-shrink: 0;
  font-family: var(--font-sans);
  font-size: 10px;
  font-weight: 700;
  line-height: 1;
  text-align: center;
  color: var(--text-3);
  background: var(--bg-2);
  border: 1px solid var(--border);
  border-radius: 50%;
  cursor: help;
  transition: all 0.13s ease;
}
.help-dot:hover {
  color: var(--bg-0);
  background: var(--accent);
  border-color: var(--accent);
}
.help-tip {
  position: fixed;
  z-index: 100;
  transform: translate(-50%, calc(-100% - 8px));
  max-width: 260px;
  width: max-content;
  padding: 9px 12px;
  font-family: var(--font-sans);
  font-size: 11.5px;
  line-height: 1.45;
  color: var(--text-1);
  background: var(--bg-3);
  border: 1px solid var(--border-strong);
  border-radius: 8px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.45);
  cursor: pointer;
}
.help-tip-cta {
  display: block;
  margin-top: 6px;
  font-size: 10px;
  font-weight: 600;
  color: var(--accent);
}
</style>
