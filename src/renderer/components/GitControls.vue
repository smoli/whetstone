<script setup lang="ts">
import { ref } from 'vue'
import { useWorkspaceStore } from '../stores/workspace'

const ws = useWorkspaceStore()
const commitMsg = ref('')
const commitStatus = ref('')
const remoteUrl = ref('')
const showRemote = ref(false)
const pushing = ref(false)

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
  commitStatus.value = 'Pushing…'
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
      Git
      <span
        v-if="ws.git.branch"
        class="branch"
      >
        <span
          v-if="ws.git.dirty"
          class="dirty-dot"
          title="Uncommitted changes"
        >●</span>{{ ws.git.branch }}</span>
    </p>
    <input
      v-model="commitMsg"
      class="g-input"
      type="text"
      :disabled="!ws.git.dirty"
      :placeholder="ws.git.dirty ? 'Commit message…' : 'Nothing to commit'"
      @keydown.enter="commit"
    >
    <div class="g-row">
      <button
        class="g-btn commit"
        :disabled="!ws.git.dirty"
        :title="ws.git.dirty ? 'Commit all changes' : 'Nothing to commit'"
        @click="commit"
      >
        Commit
      </button>
      <button
        class="g-btn"
        :disabled="pushing"
        :title="ws.git.hasRemote ? `Push to ${ws.git.remoteUrl}` : 'Set a remote and push'"
        @click="push"
      >
        Push
      </button>
    </div>
    <input
      v-if="showRemote && !ws.git.hasRemote"
      v-model="remoteUrl"
      class="g-input"
      type="text"
      placeholder="git@github.com:you/course.git"
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
