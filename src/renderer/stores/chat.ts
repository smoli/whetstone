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
    // A transient banner: shown live, but stripped before the transcript is
    // persisted so a momentary failure never replays as stale history.
    messages.value = [...messages.value, { id: nextId(), role: 'system', text: err.message, transient: true }]
  }

  function send(text: string): void {
    const trimmed = text.trim()
    if (!trimmed) return
    // Drop any stale error banner — this turn is the retry.
    messages.value = [...messages.value.filter((m) => !m.transient), { id: nextId(), role: 'user', text: trimmed }]
    error.value = null
    markBusy()
    window.teach.sendChat(trimmed)
  }

  /** Restore a persisted transcript (on resume). */
  function load(saved: ChatMessage[]): void {
    messages.value = saved
    counter = saved.length
  }

  /** Clear all state (on workspace switch). */
  function reset(): void {
    messages.value = []
    error.value = null
    clearBusy()
    counter = 0
  }

  return { messages, error, busy, startedAt, applyEvent, applyError, send, load, reset, markBusy }
})
