<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import LessonPane from './components/LessonPane.vue'
import ChatPane from './components/ChatPane.vue'
import { useChatStore } from './stores/chat'
import { useWorkspaceStore } from './stores/workspace'

const chat = useChatStore()
const ws = useWorkspaceStore()
let offEvent: (() => void) | null = null
let offError: (() => void) | null = null

onMounted(async () => {
  offEvent = window.teach.onChatEvent((e) => chat.applyEvent(e))
  offError = window.teach.onChatError((e) => chat.applyError(e))
  await ws.load()
})

onUnmounted(() => {
  offEvent?.()
  offError?.()
})
</script>

<template>
  <main class="app">
    <LessonPane class="pane pane--lesson" />
    <ChatPane class="pane pane--chat" />
  </main>
</template>

<style>
:root {
  --rule: #e2e2e0;
}
html,
body,
#app {
  height: 100%;
  margin: 0;
}
body {
  font-family: system-ui, -apple-system, sans-serif;
  color: #1a1a1a;
}
.app {
  display: grid;
  grid-template-columns: 1fr 26rem;
  height: 100vh;
}
.pane {
  min-height: 0;
}
</style>
