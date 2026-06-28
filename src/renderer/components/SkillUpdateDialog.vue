<script setup lang="ts">
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useWorkspaceStore } from '../stores/workspace'

const { t } = useI18n()
const ws = useWorkspaceStore()
const busy = ref(false)

const show = computed(() => !!ws.skillUpdate?.available)
const bundled = computed(() => ws.skillUpdate?.bundledVersion ?? '—')
const current = computed(() => ws.skillUpdate?.workspaceVersion ?? 'unversioned')

async function update(): Promise<void> {
  busy.value = true
  try {
    await ws.updateSkill()
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div
    v-if="show"
    class="overlay"
  >
    <div
      class="dialog"
      role="dialog"
      aria-modal="true"
    >
      <h2>{{ t('skillUpdate.title') }}</h2>
      <p class="lead">
        {{ t('skillUpdate.lead') }}
      </p>
      <p class="versions">
        <span class="v-cur">v{{ current }}</span>
        <span class="arrow">→</span>
        <span class="v-new">v{{ bundled }}</span>
      </p>
      <p class="note">
        {{ t('skillUpdate.detail') }}
      </p>
      <div class="actions">
        <button
          class="ghost"
          :disabled="busy"
          @click="ws.dismissSkillUpdate()"
        >
          {{ t('skillUpdate.notNow') }}
        </button>
        <button
          class="primary"
          :disabled="busy"
          @click="update"
        >
          {{ busy ? t('skillUpdate.updating') : t('skillUpdate.update') }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.overlay {
  position: fixed;
  inset: 0;
  background: rgba(20, 16, 13, 0.55);
  display: grid;
  place-items: center;
  z-index: 50;
}
.dialog {
  width: min(30rem, 90vw);
  background: var(--paper);
  border: 1px solid var(--rule);
  border-radius: 0.6rem;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.3);
  padding: 1.4rem 1.5rem;
}
h2 {
  font-family: var(--serif);
  font-size: 1.15rem;
  margin: 0 0 0.5rem;
  color: var(--ink);
}
.lead {
  margin: 0 0 0.8rem;
  color: var(--ink);
}
.versions {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  margin: 0 0 0.8rem;
  font-variant-numeric: tabular-nums;
}
.v-cur {
  color: var(--ink-soft);
}
.arrow {
  color: var(--ink-soft);
}
.v-new {
  color: var(--accent);
  font-weight: 700;
}
.note {
  font-size: 0.84rem;
  color: var(--ink-soft);
  margin: 0 0 1.2rem;
}
.note code {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 0.8rem;
}
.actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.6rem;
}
button {
  font: inherit;
  font-size: 0.86rem;
  font-weight: 600;
  padding: 0.45rem 0.9rem;
  border-radius: 0.4rem;
  cursor: pointer;
}
.ghost {
  border: 1px solid var(--rule);
  background: var(--field);
  color: var(--ink);
}
.primary {
  border: 1px solid var(--accent);
  background: var(--accent);
  color: #fff;
}
button:disabled {
  opacity: 0.6;
  cursor: default;
}
</style>
