import { defineStore } from 'pinia'
import { ref } from 'vue'
import { foldChatEvent, type ChatMessage, type ChatEvent, type ClaudeError } from '@shared/chat'

export const useChatStore = defineStore('chat', () => {
  const messages = ref<ChatMessage[]>([])
  const error = ref<ClaudeError | null>(null)
  /** True while the agent is working on a turn (drives the thinking timer). */
  const busy = ref(false)
  /** Epoch ms when the current busy period began, or null. */
  const startedAt = ref<number | null>(null)
  let counter = 0
  const nextId = () => `m${++counter}`

  function markBusy(): void {
    if (!busy.value) {
      busy.value = true
      startedAt.value = Date.now()
    }
  }

  function clearBusy(): void {
    busy.value = false
    startedAt.value = null
  }

  function applyEvent(ev: ChatEvent): void {
    if (ev.kind === 'assistant_text' || ev.kind === 'tool_use') markBusy()
    if (ev.kind === 'result') clearBusy()
    messages.value = foldChatEvent(messages.value, ev, nextId)
  }

  function applyError(err: ClaudeError): void {
    clearBusy()
    error.value = err
    messages.value = [...messages.value, { id: nextId(), role: 'system', text: err.message }]
  }

  function send(text: string): void {
    const trimmed = text.trim()
    if (!trimmed) return
    messages.value = [...messages.value, { id: nextId(), role: 'user', text: trimmed }]
    error.value = null
    markBusy()
    window.teach.sendChat(trimmed)
  }

  /** Restore a persisted transcript (on resume). */
  function load(saved: ChatMessage[]): void {
    messages.value = saved
    counter = saved.length
  }

  return { messages, error, busy, startedAt, applyEvent, applyError, send, load, markBusy }
})
