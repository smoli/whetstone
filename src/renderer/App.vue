<script setup lang="ts">
import { onMounted, ref, watch, toRaw } from 'vue'
import TitleBar from './components/TitleBar.vue'
import SkillUpdateDialog from './components/SkillUpdateDialog.vue'
import Sidebar from './components/Sidebar.vue'
import LessonPane from './components/LessonPane.vue'
import ChatPane from './components/ChatPane.vue'
import Welcome from './components/Welcome.vue'
import { useChatStore } from './stores/chat'
import { useWorkspaceStore } from './stores/workspace'
import { persistableMessages } from '@shared/chat'
import { chatWidthFromPointer, CHAT_WIDTH_MIN, CHAT_WIDTH_MAX, CHAT_WIDTH_DEFAULT } from '@shared/layout'

const chat = useChatStore()
const ws = useWorkspaceStore()

// Resizable chat sidebar (persisted).
const chatWidth = ref(loadNum('teach.chatWidth', CHAT_WIDTH_DEFAULT, CHAT_WIDTH_MIN, CHAT_WIDTH_MAX))
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

function startDrag(ev: PointerEvent): void {
  dragging.value = true
  // Capture the pointer on the splitter so move/up keep arriving even when the
  // cursor crosses the lesson iframe — without capture the iframe swallows them,
  // stalling the drag and eating the release.
  const handle = ev.currentTarget as HTMLElement
  handle.setPointerCapture(ev.pointerId)
  const move = (e: PointerEvent) => {
    chatWidth.value = chatWidthFromPointer(window.innerWidth, e.clientX)
  }
  const up = (e: PointerEvent) => {
    dragging.value = false
    handle.releasePointerCapture(e.pointerId)
    handle.removeEventListener('pointermove', move)
    handle.removeEventListener('pointerup', up)
    localStorage.setItem('teach.chatWidth', String(chatWidth.value))
  }
  handle.addEventListener('pointermove', move)
  handle.addEventListener('pointerup', up)
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
    const section = d.section === 'reference' ? 'reference' : d.section === 'doc' ? 'doc' : 'lessons'
    ws.onNavigated(section, d.file)
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
      // Persist only durable history — transient error banners are stripped so a
      // momentary failure never replays as stale chat on the next open.
      if (chat.messages.length) {
        const durable = persistableMessages(toRaw(chat.messages))
        window.teach.saveSession(JSON.parse(JSON.stringify(durable)))
      }
      void ws.refreshContents()
    },
  )
})
</script>

<template>
  <div class="window">
    <TitleBar />
    <SkillUpdateDialog />
    <Welcome
      v-if="!ws.active"
      class="view"
    />
    <main
      v-else
      class="app view"
      :class="{ dragging }"
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
  </div>
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
.window {
  display: flex;
  flex-direction: column;
  height: 100vh;
  overflow: hidden;
}
.view {
  flex: 1;
  min-height: 0;
}
.app {
  display: flex;
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
/* While dragging, stop the lesson iframe from intercepting the pointer (hover,
   text selection) so the resize stays smooth across the whole window. */
.app.dragging iframe {
  pointer-events: none;
}
</style>
