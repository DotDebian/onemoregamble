<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount } from 'vue'
import { EDUCATION } from '~/content/education'

const { activeId, close } = useEducation()
const edu = computed(() => (activeId.value ? EDUCATION[activeId.value] : null))

function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape') close()
}
onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="edu" class="modal-backdrop" @click.self="close">
        <div class="modal" role="dialog" aria-modal="true">
          <header class="modal-head">
            <h3>{{ edu.name }}</h3>
            <button class="modal-close" aria-label="Fermer" @click="close">✕</button>
          </header>
          <div class="modal-body">
            <p class="lead">{{ edu.short }}</p>

            <section>
              <h4>C'est quoi&nbsp;?</h4>
              <p>{{ edu.what }}</p>
            </section>

            <section>
              <h4>Sur le graphe</h4>
              <p>{{ edu.read }}</p>
            </section>

            <section>
              <h4>Signaux clés</h4>
              <ul>
                <li v-for="(s, i) in edu.signals" :key="i">{{ s }}</li>
              </ul>
            </section>

            <section v-if="edu.tip" class="tip">
              <h4>💡 Conseil débutant</h4>
              <p>{{ edu.tip }}</p>
            </section>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.modal-backdrop {
  position: fixed;
  inset: 0;
  z-index: 200;
  display: grid;
  place-items: center;
  padding: 24px;
  background: rgba(5, 7, 10, 0.7);
  backdrop-filter: blur(3px);
}
.modal {
  width: min(560px, 100%);
  max-height: 86vh;
  overflow-y: auto;
  background: var(--bg-1);
  border: 1px solid var(--border-strong);
  border-radius: 14px;
  box-shadow: 0 24px 70px rgba(0, 0, 0, 0.6);
}
.modal-head {
  position: sticky;
  top: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 16px 18px;
  background: var(--bg-1);
  border-bottom: 1px solid var(--border);
}
.modal-head h3 {
  margin: 0;
  font-size: 15px;
  font-weight: 700;
  color: var(--text-0);
}
.modal-close {
  flex-shrink: 0;
  width: 28px;
  height: 28px;
  font-size: 13px;
  color: var(--text-2);
  background: var(--bg-2);
  border: 1px solid var(--border);
  border-radius: 7px;
  transition: all 0.13s ease;
}
.modal-close:hover {
  color: var(--text-0);
  border-color: var(--border-strong);
}
.modal-body {
  padding: 16px 18px 20px;
}
.lead {
  margin: 0 0 16px;
  font-size: 13.5px;
  line-height: 1.5;
  color: var(--text-1);
  padding: 11px 13px;
  background: var(--bg-2);
  border-left: 2px solid var(--accent);
  border-radius: 0 8px 8px 0;
}
.modal-body section {
  margin-bottom: 16px;
}
.modal-body h4 {
  margin: 0 0 6px;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--text-3);
}
.modal-body p {
  margin: 0;
  font-size: 13px;
  line-height: 1.55;
  color: var(--text-1);
}
.modal-body ul {
  margin: 0;
  padding-left: 18px;
}
.modal-body li {
  font-size: 13px;
  line-height: 1.5;
  color: var(--text-1);
  margin-bottom: 4px;
}
.tip p {
  color: var(--accent);
}

.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.18s ease;
}
.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}
</style>
