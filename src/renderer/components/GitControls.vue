<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useWorkspaceStore } from '../stores/workspace'

const { t } = useI18n()
const ws = useWorkspaceStore()
const commitMsg = ref('')
const commitStatus = ref('')
const remoteUrl = ref('')
const showRemote = ref(false)
const pushing = ref(false)
// The changed-files list is collapsed by default to keep the panel compact.
const showChanges = ref(false)

// One-letter status glyph for the file list.
const STATUS_GLYPH: Record<string, string> = {
  modified: 'M',
  added: 'A',
  deleted: 'D',
  renamed: 'R',
  untracked: '?',
}

async function commit(): Promise<void> {
  commitStatus.value = '…'
  const res = await ws.commit(commitMsg.value)
  commitStatus.value = res.message
  if (res.ok) commitMsg.value = ''
}

async function push(): Promise<void> {
  // No remote yet → reveal the URL field first; require it before pushing.
  if (!ws.git.hasRemote && !showRemote.value) {
    showRemote.value = true
    return
  }
  if (!ws.git.hasRemote && !remoteUrl.value.trim()) return
  pushing.value = true
  commitStatus.value = t('git.pushing')
  const res = await ws.push(remoteUrl.value.trim() || null)
  commitStatus.value = res.message
  pushing.value = false
  if (res.ok) {
    remoteUrl.value = ''
    showRemote.value = false
  }
}
</script>

<template>
  <section class="git">
    <p class="git-label">
      {{ t('git.title') }}
      <span
        v-if="ws.git.branch"
        class="branch"
      >
        <span
          v-if="ws.git.dirty"
          class="dirty-dot"
          :title="t('git.uncommitted')"
        >●</span>{{ ws.git.branch }}</span>
    </p>
    <div
      v-if="ws.git.changed.length"
      class="changes"
    >
      <button
        class="changes-toggle"
        :aria-expanded="showChanges"
        @click="showChanges = !showChanges"
      >
        <span
          class="chevron"
          :class="{ open: showChanges }"
        >›</span>
        {{ t('git.changedFiles', { count: ws.git.changed.length }, ws.git.changed.length) }}
      </button>
      <ul
        v-if="showChanges"
        class="changes-list"
      >
        <li
          v-for="f in ws.git.changed"
          :key="f.path"
          class="change"
          :title="`${t('git.status.' + f.status)} · ${f.path}`"
        >
          <span :class="['glyph', f.status]">{{ STATUS_GLYPH[f.status] }}</span>
          <span class="change-path">{{ f.path }}</span>
        </li>
      </ul>
    </div>
    <input
      v-model="commitMsg"
      class="g-input"
      type="text"
      :disabled="!ws.git.dirty"
      :placeholder="ws.git.dirty ? t('git.commitPlaceholder') : t('git.nothing')"
      @keydown.enter="commit"
    >
    <div class="g-row">
      <button
        class="g-btn commit"
        :disabled="!ws.git.dirty"
        :title="ws.git.dirty ? t('git.commitAll') : t('git.nothing')"
        @click="commit"
      >
        {{ t('git.commit') }}
      </button>
      <button
        class="g-btn"
        :disabled="pushing"
        :title="ws.git.hasRemote ? t('git.pushTo', { url: ws.git.remoteUrl }) : t('git.setRemote')"
        @click="push"
      >
        {{ t('git.push') }}
      </button>
    </div>
    <input
      v-if="showRemote && !ws.git.hasRemote"
      v-model="remoteUrl"
      class="g-input"
      type="text"
      :placeholder="t('git.remotePlaceholder')"
      @keydown.enter="push"
    >
    <p
      v-if="commitStatus"
      class="g-status"
    >
      {{ commitStatus }}
    </p>
  </section>
</template>

<style scoped>
.git {
  border-top: 1px solid var(--rule);
  padding: 0.5rem 0.6rem;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}
.git-label {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.5rem;
  font-size: 0.66rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--accent);
  font-weight: 700;
  margin: 0 0 0.1rem 0.1rem;
}
.branch {
  font-size: 0.7rem;
  letter-spacing: 0;
  text-transform: none;
  font-weight: 600;
  color: var(--ink-soft);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.dirty-dot {
  color: var(--accent);
  font-size: 0.6rem;
  margin-right: 0.3rem;
  vertical-align: middle;
}
.changes-toggle {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  width: 100%;
  border: 0;
  background: transparent;
  color: var(--ink-soft);
  font: inherit;
  font-size: 0.72rem;
  padding: 0.1rem 0.1rem;
  cursor: pointer;
}
.changes-toggle:hover {
  color: var(--ink);
}
.chevron {
  display: inline-block;
  transition: transform 0.12s ease;
  font-size: 0.85rem;
  line-height: 1;
}
.chevron.open {
  transform: rotate(90deg);
}
.changes-list {
  list-style: none;
  margin: 0.2rem 0 0;
  padding: 0;
  max-height: 9rem;
  overflow-y: auto;
}
.change {
  display: flex;
  align-items: baseline;
  gap: 0.4rem;
  font-size: 0.72rem;
  padding: 0.08rem 0.1rem;
}
.change-path {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--ink-soft);
}
.glyph {
  flex: 0 0 auto;
  width: 0.9rem;
  text-align: center;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}
.glyph.modified {
  color: var(--accent);
}
.glyph.added {
  color: var(--good);
}
.glyph.deleted {
  color: var(--bad);
}
.glyph.renamed {
  color: var(--link);
}
.glyph.untracked {
  color: var(--ink-soft);
}
.g-input {
  font: inherit;
  font-size: 0.78rem;
  padding: 0.3rem 0.45rem;
  border: 1px solid var(--rule);
  border-radius: 0.4rem;
  background: var(--field);
  color: var(--ink);
  width: 100%;
  box-sizing: border-box;
}
.g-input:disabled {
  background: var(--paper);
  color: var(--ink-soft);
  cursor: not-allowed;
}
.g-row {
  display: flex;
  gap: 0.4rem;
}
.g-btn {
  flex: 1;
  font-family: var(--sans);
  font-size: 0.76rem;
  font-weight: 600;
  padding: 0.3rem 0.5rem;
  border: 1px solid var(--rule);
  border-radius: 0.4rem;
  background: var(--field);
  color: var(--ink);
  cursor: pointer;
}
.g-btn:not(.commit):not(:disabled):hover {
  background: var(--field-hover);
}
.g-btn.commit {
  border-color: var(--accent);
  background: var(--accent);
  color: #fff;
}
.g-btn.commit:not(:disabled):hover {
  filter: brightness(1.08);
}
.g-btn:disabled {
  opacity: 0.5;
  cursor: default;
}
.g-status {
  font-size: 0.74rem;
  color: var(--ink-soft);
  margin: 0;
  word-break: break-word;
}
</style>
