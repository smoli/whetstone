import { defineStore } from 'pinia'
import { ref } from 'vue'
import { foldChatEvent, type ChatMessage, type ChatEvent, type ClaudeError } from '@shared/chat'

export const useChatStore = defineStore('chat', () => {
  const messages = ref<ChatMessage[]>([])
  const error = ref<ClaudeError | null>(null)
  let counter = 0
  const nextId = () => `m${++counter}`

  function applyEvent(ev: ChatEvent): void {
    messages.value = foldChatEvent(messages.value, ev, nextId)
  }

  function applyError(err: ClaudeError): void {
    error.value = err
    messages.value = [...messages.value, { id: nextId(), role: 'system', text: err.message }]
  }

  function send(text: string): void {
    const trimmed = text.trim()
    if (!trimmed) return
    messages.value = [...messages.value, { id: nextId(), role: 'user', text: trimmed }]
    error.value = null
    window.teach.sendChat(trimmed)
  }

  return { messages, error, applyEvent, applyError, send }
})
