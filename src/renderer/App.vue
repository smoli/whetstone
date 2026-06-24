<script setup lang="ts">
import { onMounted, ref, watch, toRaw } from 'vue'
import Sidebar from './components/Sidebar.vue'
import LessonPane from './components/LessonPane.vue'
import ChatPane from './components/ChatPane.vue'
import Welcome from './components/Welcome.vue'
import { useChatStore } from './stores/chat'
import { useWorkspaceStore } from './stores/workspace'

const chat = useChatStore()
const ws = useWorkspaceStore()

// Resizable chat sidebar (persisted).
const chatWidth = ref(loadNum('teach.chatWidth', 420, 320, 900))
const dragging = ref(false)
// Collapsible left sidebar (persisted).
const sidebarCollapsed = ref(localStorage.getItem('teach.sidebarCollapsed') === '1')

function loadNum(key: string, dflt: number, min: number, max: number): number {
  const v = Number(localStorage.getItem(key))
  return v >= min && v <= max ? v : dflt
}

function toggleSidebar(): void {
  sidebarCollapsed.value = !sidebarCollapsed.value
  localStorage.setItem('teach.sidebarCollapsed', sidebarCollapsed.value ? '1' : '0')
}

function startDrag(): void {
  dragging.value = true
  const move = (ev: PointerEvent) => {
    chatWidth.value = Math.min(900, Math.max(320, window.innerWidth - ev.clientX))
  }
  const up = () => {
    dragging.value = false
    window.removeEventListener('pointermove', move)
    window.removeEventListener('pointerup', up)
    localStorage.setItem('teach.chatWidth', String(chatWidth.value))
  }
  window.addEventListener('pointermove', move)
  window.addEventListener('pointerup', up)
}

/** Run after a workspace becomes active (fresh open or restored). */
function enterWorkspace(): void {
  chat.reset()
  if (ws.session.messages.length) chat.load(ws.session.messages)
  if (!ws.session.resumed) {
    chat.markBusy()
    window.teach.startSession()
  }
}

onMounted(async () => {
  window.teach.onChatEvent((e) => chat.applyEvent(e))
  window.teach.onChatError((e) => chat.applyError(e))

  // The content iframe (bridge.js) announces which page it shows, so we sync the
  // sidebar highlight + history even when an in-page link drove the navigation.
  window.addEventListener('message', (e: MessageEvent) => {
    const d = e.data as { source?: string; kind?: string; section?: string; file?: string } | null
    if (!ws.active || !d || d.source !== 'teach-bridge' || d.kind !== 'navigated' || !d.file) return
    ws.onNavigated(d.section === 'reference' ? 'reference' : 'lessons', d.file)
  })

  watch(
    () => ws.active,
    (now, prev) => {
      if (now && !prev) enterWorkspace()
    },
  )
  await ws.loadLauncher()

  // On each idle: persist the transcript and refresh content lists so lessons or
  // references the agent just created appear in the sidebar.
  watch(
    () => chat.busy,
    (b) => {
      if (b || !ws.active) return
      if (chat.messages.length) window.teach.saveSession(JSON.parse(JSON.stringify(toRaw(chat.messages))))
      void ws.refreshContents()
    },
  )
})
</script>

<template>
  <Welcome v-if="!ws.active" />
  <main
    v-else
    class="app"
  >
    <Sidebar
      :collapsed="sidebarCollapsed"
      @toggle="toggleSidebar"
      @sessions="ws.toLauncher()"
    />
    <LessonPane
      class="pane pane--content"
      :sidebar-collapsed="sidebarCollapsed"
    />
    <div
      class="splitter"
      :class="{ dragging }"
      @pointerdown="startDrag"
    />
    <ChatPane
      class="pane pane--chat"
      :style="{ width: chatWidth + 'px' }"
    />
  </main>
</template>

<style>
:root {
  --ink: #2b2622;
  --ink-soft: #5c544c;
  --paper: #fdfaf4;
  --paper-card: #f6f0e6;
  --rule: #e0d7c7;
  --accent: #b5532a;
  --accent-soft: #e9b08e;
  --good: #4f7a4a;
  --bad: #a3503c;
  --link: #9c4a24;
  --serif: "Iowan Old Style", "Palatino Linotype", Palatino, Georgia, serif;
  --sans: "Inter", "Helvetica Neue", Arial, sans-serif;
  --head-h: 3rem;
}
html,
body,
#app {
  height: 100%;
  margin: 0;
}
body {
  font-family: var(--sans);
  color: var(--ink);
  background: var(--paper);
}
.app {
  display: flex;
  height: 100vh;
  overflow: hidden;
}
.pane {
  min-width: 0;
  min-height: 0;
}
.pane--content {
  flex: 1;
}
.pane--chat {
  flex: 0 0 auto;
}
.splitter {
  flex: 0 0 6px;
  cursor: col-resize;
  background: var(--rule);
  transition: background 0.12s;
}
.splitter:hover,
.splitter.dragging {
  background: var(--accent-soft);
}
</style>
