<script setup lang="ts">
import { computed } from 'vue'
import { useWorkspaceStore } from '../stores/workspace'
import { contentLabel } from '@shared/links'

const ws = useWorkspaceStore()
defineProps<{ sidebarCollapsed: boolean }>()

const title = computed(() => (ws.current ? contentLabel(ws.current.file) || ws.current.file : ''))
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
  flex: 1;
  font-family: var(--serif);
  font-size: 1rem;
  color: var(--ink);
  text-transform: capitalize;
  overflow: hidden;
  text-overflow: ellipsis;
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
