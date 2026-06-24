<script setup lang="ts">
import { ref } from 'vue'
import { useWorkspaceStore } from '../stores/workspace'

const ws = useWorkspaceStore()
const commitMsg = ref('')
const commitStatus = ref('')

function label(file: string): string {
  return file
    .replace(/\.html?$/, '')
    .replace(/^\d+-/, '')
    .replace(/-/g, ' ')
}

async function commit(): Promise<void> {
  commitStatus.value = '…'
  const res = await ws.commit(commitMsg.value)
  commitStatus.value = res.message
  if (res.ok) commitMsg.value = ''
}
</script>

<template>
  <section class="lesson">
    <header class="lesson-head">
      <div class="bar">
        <strong class="ws-name">{{ ws.config?.workspaceName ?? 'Workspace' }}</strong>
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
        <button
          class="switch-btn"
          title="Switch session"
          @click="ws.toLauncher()"
        >
          Sessions
        </button>
      </div>
      <p
        v-if="commitStatus"
        class="commit-status"
      >
        {{ commitStatus }}
      </p>
      <nav class="lesson-nav">
        <button
          v-for="file in ws.lessons"
          :key="file"
          :class="{ active: file === ws.currentLesson }"
          @click="ws.open(file)"
        >
          {{ label(file) }}
        </button>
      </nav>
    </header>
    <iframe
      v-if="ws.currentUrl"
      :src="ws.currentUrl"
      class="lesson-frame"
      title="lesson"
    />
    <div
      v-else
      class="lesson-empty"
    >
      No lessons yet — ask your teacher to begin.
    </div>
  </section>
</template>

<style scoped>
.lesson {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--paper);
}
.lesson-head {
  padding: 0.6rem 1rem;
  border-bottom: 1px solid var(--rule);
  background: var(--paper-card);
}
.bar {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}
.ws-name {
  font-family: var(--serif);
  font-size: 1.05rem;
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
  width: 14rem;
}
.commit-btn,
.switch-btn {
  font-family: var(--sans);
  font-size: 0.78rem;
  font-weight: 600;
  padding: 0.3rem 0.7rem;
  border: 1px solid var(--rule);
  border-radius: 0.4rem;
  background: #fff;
  color: var(--ink);
  cursor: pointer;
}
.commit-btn {
  background: var(--accent);
  color: #fff;
  border-color: var(--accent);
}
.commit-status {
  margin: 0.4rem 0 0;
  font-size: 0.76rem;
  color: var(--ink-soft);
}
.lesson-nav {
  display: flex;
  gap: 0.4rem;
  flex-wrap: wrap;
  margin-top: 0.5rem;
}
.lesson-nav button {
  font-family: var(--sans);
  font-size: 0.8rem;
  padding: 0.2rem 0.5rem;
  border: 1px solid var(--rule);
  background: #fff;
  color: var(--ink);
  border-radius: 0.3rem;
  cursor: pointer;
}
.lesson-nav button.active {
  background: var(--accent);
  color: #fff;
  border-color: var(--accent);
}
.lesson-frame {
  flex: 1;
  border: 0;
  width: 100%;
  background: #fff;
}
.lesson-empty {
  flex: 1;
  display: grid;
  place-items: center;
  color: var(--ink-soft);
}
</style>
