<script setup lang="ts">
import { ref, computed } from 'vue'
import { useWorkspaceStore } from '../stores/workspace'
import { contentLabel } from '@shared/links'

const ws = useWorkspaceStore()
defineProps<{ sidebarCollapsed: boolean }>()
const commitMsg = ref('')
const commitStatus = ref('')
const remoteUrl = ref('')
const showRemote = ref(false)
const pushing = ref(false)

const title = computed(() => (ws.current ? contentLabel(ws.current.file) || ws.current.file : ''))

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
  <section class="content">
    <header class="content-head">
      <div class="bar">
        <button
          class="nav-btn"
          title="Back"
          :disabled="!ws.canBack"
          @click="ws.back()"
        >
          ‹
        </button>
        <button
          class="nav-btn"
          title="Forward"
          :disabled="!ws.canForward"
          @click="ws.forward()"
        >
          ›
        </button>
        <template v-if="sidebarCollapsed">
          <span class="ws-name">{{ ws.config?.workspaceName ?? 'Workspace' }}</span>
          <span
            v-if="title"
            class="sep"
          >›</span>
        </template>
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
        <input
          v-if="showRemote && !ws.git.hasRemote"
          v-model="remoteUrl"
          class="commit-msg remote"
          type="text"
          placeholder="git@github.com:you/course.git"
          @keydown.enter="push"
        >
        <button
          v-if="ws.git.isRepo"
          class="push-btn"
          :disabled="pushing"
          :title="ws.git.hasRemote ? `Push to ${ws.git.remoteUrl}` : 'Set a remote and push'"
          @click="push"
        >
          Push
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
.nav-btn {
  font: inherit;
  font-size: 1.1rem;
  line-height: 1;
  width: 1.6rem;
  height: 1.6rem;
  border: 1px solid var(--rule);
  border-radius: 0.35rem;
  background: #fff;
  color: var(--ink);
  cursor: pointer;
  flex: 0 0 auto;
}
.nav-btn:disabled {
  opacity: 0.4;
  cursor: default;
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
  color: var(--ink);
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
.commit-msg.remote {
  width: 16rem;
}
.push-btn {
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
.push-btn:disabled {
  opacity: 0.5;
  cursor: default;
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
