<script setup lang="ts">
import { useWorkspaceStore } from '../stores/workspace'
import { lessonNumber, contentLabel } from '@shared/links'

import type { ContentSection } from '../stores/workspace'

const ws = useWorkspaceStore()
defineProps<{ collapsed: boolean }>()
const emit = defineEmits<{ toggle: []; sessions: [] }>()

function isActive(section: ContentSection, file: string): boolean {
  return ws.current?.section === section && ws.current?.file === file
}

function docLabel(file: string): string {
  const base = file.replace(/\.md$/i, '').toLowerCase()
  return base.charAt(0).toUpperCase() + base.slice(1)
}
</script>

<template>
  <aside :class="['sidebar', { collapsed }]">
    <div class="side-head">
      <button
        class="icon-btn"
        :title="collapsed ? 'Expand' : 'Collapse'"
        @click="emit('toggle')"
      >
        {{ collapsed ? '☰' : '«' }}
      </button>
      <strong
        v-if="!collapsed"
        class="ws-name"
      >{{ ws.config?.workspaceName ?? 'Workspace' }}</strong>
      <button
        v-if="!collapsed"
        class="icon-btn reveal"
        title="Reveal workspace in file manager"
        @click="ws.revealWorkspace()"
      >
        <svg
          width="15"
          height="15"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <path d="M3 7a2 2 0 0 1 2-2h3.6l2 2H19a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
        </svg>
      </button>
    </div>

    <!-- expanded: full lists -->
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

      <section
        v-if="ws.docs.length"
        class="group"
      >
        <p class="group-label">
          Workspace
        </p>
        <button
          v-for="file in ws.docs"
          :key="file"
          :class="['item', { active: isActive('doc', file) }]"
          @click="ws.openItem('doc', file)"
        >
          <span class="title">{{ docLabel(file) }}</span>
        </button>
      </section>
    </div>

    <!-- collapsed: numbers-only rail -->
    <div
      v-else
      class="rail"
    >
      <button
        v-for="file in ws.lessons"
        :key="file"
        :class="['rail-num', { active: isActive('lessons', file) }]"
        :title="contentLabel(file) || file"
        @click="ws.openItem('lessons', file)"
      >
        {{ lessonNumber(file) || '•' }}
      </button>
    </div>

    <button
      class="home"
      :class="{ icononly: collapsed }"
      title="Home"
      @click="emit('sessions')"
    >
      <span class="house">⌂</span><span
        v-if="!collapsed"
        class="home-label"
      >Home</span>
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
  width: 2.8rem;
}
.side-head {
  display: flex;
  align-items: center;
  height: var(--head-h);
  padding: 0 0.5rem;
  border-bottom: 1px solid var(--rule);
  box-sizing: border-box;
}
.icon-btn {
  font: inherit;
  border: 0;
  background: transparent;
  color: var(--ink-soft);
  cursor: pointer;
  font-size: 1rem;
  padding: 0.2rem 0.35rem;
}
.ws-name {
  font-family: var(--serif);
  font-size: 1rem;
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.reveal {
  display: flex;
  align-items: center;
  flex: 0 0 auto;
  color: var(--ink-soft);
}
.reveal:hover {
  color: var(--accent);
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

/* collapsed numbers rail */
.rail {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.25rem;
  padding: 0.5rem 0;
}
.rail-num {
  font: inherit;
  font-variant-numeric: tabular-nums;
  font-weight: 700;
  font-size: 0.85rem;
  width: 1.9rem;
  height: 1.9rem;
  border: 0;
  border-radius: 0.4rem;
  background: transparent;
  color: var(--accent);
  cursor: pointer;
}
.rail-num:hover {
  background: #efe7d8;
}
.rail-num.active {
  background: var(--accent);
  color: #fff;
}

.home {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-family: var(--sans);
  font-size: 0.82rem;
  text-align: left;
  border: 0;
  border-top: 1px solid var(--rule);
  background: transparent;
  color: var(--ink-soft);
  padding: 0.6rem 0.7rem;
  cursor: pointer;
}
.home.icononly {
  justify-content: center;
  padding: 0.6rem 0;
}
.home:hover {
  color: var(--accent);
}
.home .house {
  font-size: 1.05rem;
}
</style>
