<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch, toRaw } from 'vue'
import LessonPane from './components/LessonPane.vue'
import ChatPane from './components/ChatPane.vue'
import { useChatStore } from './stores/chat'
import { useWorkspaceStore } from './stores/workspace'

const chat = useChatStore()
const ws = useWorkspaceStore()
let offEvent: (() => void) | null = null
let offError: (() => void) | null = null

// Resizable chat sidebar (persisted).
const chatWidth = ref(loadWidth())
const dragging = ref(false)

function loadWidth(): number {
  const v = Number(localStorage.getItem('teach.chatWidth'))
  return v >= 320 && v <= 900 ? v : 420
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

onMounted(async () => {
  offEvent = window.teach.onChatEvent((e) => chat.applyEvent(e))
  offError = window.teach.onChatError((e) => chat.applyError(e))
  await ws.load()
  // Restore a prior transcript if we resumed a session; otherwise bootstrap.
  if (ws.session.messages.length) chat.load(ws.session.messages)
  if (ws.session.resumed) {
    // Resumed: agent context is already restored, no /teach needed.
  } else {
    chat.markBusy()
    window.teach.startSession()
  }

  // Persist the transcript whenever the agent goes idle, so the next launch can
  // resume it (the agent side resumes via --resume; this restores the UI).
  watch(
    () => chat.busy,
    (b) => {
      if (!b && chat.messages.length) {
        window.teach.saveSession(JSON.parse(JSON.stringify(toRaw(chat.messages))))
      }
    },
  )
})

onUnmounted(() => {
  offEvent?.()
  offError?.()
})
</script>

<template>
  <main class="app">
    <LessonPane class="pane pane--lesson" />
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
.pane--lesson {
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
