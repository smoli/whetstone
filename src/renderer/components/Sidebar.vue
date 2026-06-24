<script setup lang="ts">
import { useWorkspaceStore } from '../stores/workspace'
import { lessonNumber, contentLabel } from '@shared/links'

const ws = useWorkspaceStore()
defineProps<{ collapsed: boolean }>()
const emit = defineEmits<{ toggle: []; sessions: [] }>()

function isActive(section: 'lessons' | 'reference', file: string): boolean {
  return ws.current?.section === section && ws.current?.file === file
}
</script>

<template>
  <aside :class="['sidebar', { collapsed }]">
    <div class="side-head">
      <button
        class="icon-btn"
        title="Collapse"
        @click="emit('toggle')"
      >
        {{ collapsed ? '☰' : '«' }}
      </button>
      <strong
        v-if="!collapsed"
        class="ws-name"
      >{{ ws.config?.workspaceName ?? 'Workspace' }}</strong>
    </div>

    <div
      v-if="!collapsed"
      class="side-body"
    >
      <section class="group">
        <p class="group-label">
          Lessons
        </p>
        <p
          v-if="!ws.lessons.length"
          class="empty"
        >
          No lessons yet.
        </p>
        <button
          v-for="file in ws.lessons"
          :key="file"
          :class="['item', { active: isActive('lessons', file) }]"
          @click="ws.openItem('lessons', file)"
        >
          <span
            v-if="lessonNumber(file)"
            class="num"
          >{{ lessonNumber(file) }}</span>
          <span class="title">{{ contentLabel(file) || file }}</span>
        </button>
      </section>

      <section
        v-if="ws.references.length"
        class="group"
      >
        <p class="group-label">
          References
        </p>
        <button
          v-for="file in ws.references"
          :key="file"
          :class="['item', { active: isActive('reference', file) }]"
          @click="ws.openItem('reference', file)"
        >
          <span class="title">{{ contentLabel(file) || file }}</span>
        </button>
      </section>
    </div>

    <button
      v-if="!collapsed"
      class="sessions"
      @click="emit('sessions')"
    >
      ← Sessions
    </button>
  </aside>
</template>

<style scoped>
.sidebar {
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 15rem;
  background: var(--paper-card);
  border-right: 1px solid var(--rule);
  transition: width 0.12s;
}
.sidebar.collapsed {
  width: 2.6rem;
}
.side-head {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.55rem 0.6rem;
  border-bottom: 1px solid var(--rule);
}
.icon-btn {
  font: inherit;
  border: 0;
  background: transparent;
  color: var(--ink-soft);
  cursor: pointer;
  font-size: 0.95rem;
  padding: 0.1rem 0.3rem;
}
.ws-name {
  font-family: var(--serif);
  font-size: 0.98rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.side-body {
  flex: 1;
  overflow-y: auto;
  padding: 0.6rem 0.5rem;
}
.group + .group {
  margin-top: 1rem;
}
.group-label {
  font-size: 0.66rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--accent);
  font-weight: 700;
  margin: 0 0 0.4rem 0.3rem;
}
.empty {
  font-size: 0.8rem;
  color: var(--ink-soft);
  margin: 0 0 0 0.3rem;
}
.item {
  display: flex;
  align-items: baseline;
  gap: 0.5rem;
  width: 100%;
  text-align: left;
  font: inherit;
  font-size: 0.86rem;
  padding: 0.35rem 0.45rem;
  border: 0;
  border-radius: 0.35rem;
  background: transparent;
  color: var(--ink);
  cursor: pointer;
}
.item:hover {
  background: #efe7d8;
}
.item.active {
  background: var(--accent);
  color: #fff;
}
.item .num {
  font-variant-numeric: tabular-nums;
  font-weight: 700;
  color: var(--accent);
  min-width: 1.1rem;
  text-align: right;
}
.item.active .num {
  color: #fff;
}
.item .title {
  text-transform: capitalize;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.sessions {
  font-family: var(--sans);
  font-size: 0.78rem;
  text-align: left;
  border: 0;
  border-top: 1px solid var(--rule);
  background: transparent;
  color: var(--ink-soft);
  padding: 0.6rem 0.8rem;
  cursor: pointer;
}
.sessions:hover {
  color: var(--accent);
}
</style>
