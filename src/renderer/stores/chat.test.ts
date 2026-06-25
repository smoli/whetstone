import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useChatStore } from './chat'
import { AUTH_EXPIRED_MESSAGE } from '@shared/chat'

const sendChat = vi.fn()

beforeEach(() => {
  setActivePinia(createPinia())
  sendChat.mockClear()
  // The store reaches the main process through this preload surface.
  ;(globalThis as unknown as { window: unknown }).window = { teach: { sendChat } }
})

describe('useChatStore.applyError', () => {
  it('shows the error as a transient banner that is never persisted', () => {
    const chat = useChatStore()
    chat.applyError({ kind: 'error', reason: 'auth', message: AUTH_EXPIRED_MESSAGE })
    expect(chat.error?.reason).toBe('auth')
    expect(chat.messages).toHaveLength(1)
    expect(chat.messages[0]).toMatchObject({ role: 'system', text: AUTH_EXPIRED_MESSAGE, transient: true })
  })
})

describe('useChatStore.send', () => {
  it('clears a stale transient error banner when the user retries', () => {
    const chat = useChatStore()
    chat.applyError({ kind: 'error', reason: 'auth', message: AUTH_EXPIRED_MESSAGE })
    chat.send('try again')
    expect(chat.messages.map((m) => m.role)).toEqual(['user'])
    expect(chat.error).toBeNull()
    expect(sendChat).toHaveBeenCalledWith('try again')
  })

  it('keeps real transcript history when sending', () => {
    const chat = useChatStore()
    chat.applyEvent({ kind: 'assistant_text', text: 'Hello' })
    chat.applyEvent({ kind: 'result', text: 'Hello', isError: false })
    chat.send('next')
    expect(chat.messages.map((m) => m.role)).toEqual(['assistant', 'user'])
  })
})
