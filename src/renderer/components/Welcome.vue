<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useWorkspaceStore } from '../stores/workspace'
import { formatRelativeTime } from '@shared/time'

const { t } = useI18n()
const ws = useWorkspaceStore()
const emit = defineEmits<{ entered: [] }>()
const topic = ref('')
const busy = ref(false)
const error = ref('')
const now = Date.now()

function when(iso?: string): string {
  return formatRelativeTime(iso, now)
}

async function run(fn: () => Promise<boolean>): Promise<void> {
  busy.value = true
  error.value = ''
  try {
    if (await fn()) emit('entered')
  } catch {
    error.value = t('welcome.openError')
  } finally {
    busy.value = false
  }
}

const openFolder = () => run(() => ws.openFolder())
const openRecent = (p: string) => run(() => ws.openRecent(p))
const create = () => run(() => ws.newSession(topic.value))

const CREDIT_URL = 'https://www.aihero.dev/learn-anything-with-my-teach-skill'
function openCredit(): void {
  window.teach.openExternal(CREDIT_URL)
}
</script>

<template>
  <div class="welcome">
    <div class="panel">
      <p class="eyebrow">
        Whetstone
        <span
          v-if="ws.version"
          class="version"
        >v{{ ws.version }}</span>
      </p>
      <h1>{{ t('welcome.tagline') }}</h1>

      <div class="actions">
        <button
          class="primary"
          :disabled="busy"
          @click="openFolder"
        >
          {{ t('welcome.openFolder') }}
        </button>
      </div>

      <div class="new">
        <input
          v-model="topic"
          type="text"
          :placeholder="t('welcome.topicPlaceholder')"
          @keydown.enter="create"
        >
        <button
          :disabled="busy"
          @click="create"
        >
          {{ t('welcome.newSession') }}
        </button>
      </div>

      <div
        v-if="ws.recent.length"
        class="recent"
      >
        <p class="label">
          {{ t('welcome.recent') }}
        </p>
        <button
          v-for="r in ws.recent"
          :key="r.path"
          class="recent-item"
          :disabled="busy"
          :title="r.path"
          @click="openRecent(r.path)"
        >
          <span class="row">
            <span class="name">{{ r.subtitle || r.name }}</span>
            <span
              v-if="when(r.openedAt)"
              class="ago"
            >{{ when(r.openedAt) }}</span>
          </span>
          <span class="path">{{ r.path }}</span>
        </button>
      </div>

      <p
        v-if="error"
        class="error"
      >
        {{ error }}
      </p>

      <p class="credit">
        {{ t('welcome.creditPrefix') }} <em>{{ t('welcome.creditSkill') }}</em> {{ t('welcome.creditSuffix') }}
        <a
          href="https://www.aihero.dev/learn-anything-with-my-teach-skill"
          @click.prevent="openCredit"
        >learn-anything-with-my-teach-skill</a>
      </p>
    </div>
  </div>
</template>

<style scoped>
.welcome {
  height: 100%;
  display: grid;
  place-items: center;
  background: var(--paper);
}
.panel {
  width: min(34rem, 90vw);
}
.eyebrow {
  font-size: 0.72rem;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--accent);
  font-weight: 600;
  margin: 0 0 0.4rem;
}
.version {
  margin-left: 0.5rem;
  color: var(--ink-soft);
  font-weight: 500;
  letter-spacing: 0.08em;
}
h1 {
  font-family: var(--serif);
  font-weight: 600;
  font-size: 1.9rem;
  margin: 0 0 1.6rem;
  color: var(--ink);
}
.actions {
  margin-bottom: 0.8rem;
}
button {
  font-family: var(--sans);
  font-weight: 600;
  font-size: 0.9rem;
  border: 1px solid var(--rule);
  border-radius: 0.5rem;
  background: var(--field);
  color: var(--ink);
  padding: 0.55rem 1rem;
  cursor: pointer;
}
button:disabled {
  opacity: 0.5;
  cursor: default;
}
button.primary {
  background: var(--accent);
  color: #fff;
  border-color: var(--accent);
}
.new {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1.6rem;
}
.new input {
  flex: 1;
  font: inherit;
  font-size: 0.9rem;
  padding: 0.5rem 0.7rem;
  border: 1px solid var(--rule);
  border-radius: 0.5rem;
  background: var(--field);
  color: var(--ink);
}
.recent .label {
  font-size: 0.68rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--ink-soft);
  font-weight: 600;
  margin: 0 0 0.5rem;
}
.recent-item {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  width: 100%;
  text-align: left;
  gap: 0.15rem;
  margin-bottom: 0.4rem;
  background: var(--paper-card);
}
.recent-item .row {
  display: flex;
  width: 100%;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.6rem;
}
.recent-item .name {
  font-weight: 600;
}
.recent-item .ago {
  font-weight: 400;
  font-size: 0.72rem;
  color: var(--ink-soft);
  flex: 0 0 auto;
}
.recent-item .path {
  font-weight: 400;
  font-size: 0.74rem;
  color: var(--ink-soft);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 100%;
}
.error {
  color: var(--bad);
  font-size: 0.85rem;
  margin-top: 1rem;
}
.credit {
  margin-top: 2rem;
  padding-top: 1rem;
  border-top: 1px solid var(--rule);
  font-size: 0.76rem;
  color: var(--ink-soft);
}
.credit a {
  color: var(--link);
  border-bottom: 1px solid var(--accent-soft);
  cursor: pointer;
  text-decoration: none;
}
</style>
