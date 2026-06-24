<script setup lang="ts">
import { ref, computed } from 'vue'
import { useWorkspaceStore } from '../stores/workspace'
import { contentLabel } from '@shared/links'

const ws = useWorkspaceStore()
const commitMsg = ref('')
const commitStatus = ref('')

const title = computed(() => (ws.current ? contentLabel(ws.current.file) || ws.current.file : ''))

async function commit(): Promise<void> {
  commitStatus.value = '…'
  const res = await ws.commit(commitMsg.value)
  commitStatus.value = res.message
  if (res.ok) commitMsg.value = ''
}
</script>

<template>
  <section class="content">
    <header class="content-head">
      <div class="bar">
        <span class="ws-name">{{ ws.config?.workspaceName ?? 'Workspace' }}</span>
        <span
          v-if="title"
          class="sep"
        >›</span>
        <span class="title">{{ title }}</span>
        <div class="spacer" />
        <input
          v-model="commitMsg"
          class="commit-msg"
          type="text"
          placeholder="Commit message…"
          @keydown.enter="commit"
        >
        <button
          class="commit-btn"
          @click="commit"
        >
          Commit
        </button>
        <span
          v-if="commitStatus"
          class="commit-status"
        >{{ commitStatus }}</span>
      </div>
    </header>
    <iframe
      v-if="ws.currentUrl"
      :src="ws.currentUrl"
      class="content-frame"
      title="content"
    />
    <div
      v-else
      class="content-empty"
    >
      No lessons yet — ask your teacher to begin.
    </div>
  </section>
</template>

<style scoped>
.content {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--paper);
}
.content-head {
  height: var(--head-h);
  padding: 0 1rem;
  border-bottom: 1px solid var(--rule);
  background: var(--paper-card);
  display: flex;
  align-items: center;
  box-sizing: border-box;
}
.bar {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  width: 100%;
}
.ws-name {
  font-family: var(--serif);
  font-size: 1rem;
  font-weight: 600;
  flex: 0 0 auto;
}
.sep {
  color: var(--ink-soft);
  flex: 0 0 auto;
}
.title {
  font-family: var(--serif);
  font-size: 1rem;
  color: var(--ink-soft);
  text-transform: capitalize;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.spacer {
  flex: 1;
}
.commit-msg {
  font: inherit;
  font-size: 0.8rem;
  padding: 0.3rem 0.5rem;
  border: 1px solid var(--rule);
  border-radius: 0.4rem;
  background: #fff;
  color: var(--ink);
  width: 13rem;
}
.commit-btn {
  font-family: var(--sans);
  font-size: 0.78rem;
  font-weight: 600;
  padding: 0.3rem 0.7rem;
  border: 1px solid var(--accent);
  border-radius: 0.4rem;
  background: var(--accent);
  color: #fff;
  cursor: pointer;
}
.commit-status {
  font-size: 0.76rem;
  color: var(--ink-soft);
  white-space: nowrap;
}
.content-frame {
  flex: 1;
  border: 0;
  width: 100%;
  background: #fff;
}
.content-empty {
  flex: 1;
  display: grid;
  place-items: center;
  color: var(--ink-soft);
}
</style>
