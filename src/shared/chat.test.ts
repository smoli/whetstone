import { describe, it, expect } from 'vitest'
import {
  foldChatEvent,
  isAuthErrorText,
  persistableMessages,
  AUTH_EXPIRED_MESSAGE,
  type ChatMessage,
} from './chat'

let n = 0
const nextId = () => `m${++n}`

function fold(events: Parameters<typeof foldChatEvent>[1][]): ChatMessage[] {
  n = 0
  return events.reduce((msgs, ev) => foldChatEvent(msgs, ev, nextId), [] as ChatMessage[])
}

describe('foldChatEvent', () => {
  it('accumulates streamed assistant text into one pending message', () => {
    const msgs = fold([
      { kind: 'assistant_text', text: 'Hello ' },
      { kind: 'assistant_text', text: 'there' },
    ])
    expect(msgs).toHaveLength(1)
    expect(msgs[0]).toMatchObject({ role: 'assistant', text: 'Hello there', pending: true })
  })

  it('a result finalizes the pending assistant message', () => {
    const msgs = fold([
      { kind: 'assistant_text', text: 'Done.' },
      { kind: 'result', text: 'Done.', isError: false },
    ])
    expect(msgs).toHaveLength(1)
    expect(msgs[0].pending).toBe(false)
  })

  it('a tool use finalizes text and adds a labelled tool message', () => {
    const msgs = fold([
      { kind: 'assistant_text', text: 'Let me update your lesson.' },
      { kind: 'tool_use', name: 'lesson_feedback', input: {} },
    ])
    expect(msgs).toHaveLength(2)
    expect(msgs[0].pending).toBe(false)
    expect(msgs[1]).toMatchObject({ role: 'tool', toolName: 'lesson_feedback' })
    expect(msgs[1].text).toContain('feedback')
  })

  it('collapses consecutive tool calls into one message showing the current tool', () => {
    const msgs = fold([
      { kind: 'tool_use', name: 'patch_lesson', input: {} },
      { kind: 'tool_use', name: 'schedule_review', input: {} },
      { kind: 'tool_use', name: 'record_learning', input: {} },
    ])
    expect(msgs).toHaveLength(1)
    expect(msgs[0]).toMatchObject({ role: 'tool', toolName: 'record_learning', count: 3 })
  })

  it('starts a new assistant message after a tool interruption', () => {
    const msgs = fold([
      { kind: 'assistant_text', text: 'First.' },
      { kind: 'tool_use', name: 'patch_lesson', input: {} },
      { kind: 'assistant_text', text: 'Second.' },
    ])
    expect(msgs).toHaveLength(3)
    expect(msgs[2]).toMatchObject({ role: 'assistant', text: 'Second.', pending: true })
  })

  it('an error result appends a user-safe system message', () => {
    const msgs = fold([{ kind: 'result', text: '', isError: true }])
    expect(msgs).toHaveLength(1)
    expect(msgs[0].role).toBe('system')
    expect(msgs[0].text).not.toContain('stack')
  })

  it('marks the error-result system message transient so it is not persisted', () => {
    const msgs = fold([{ kind: 'result', text: '', isError: true }])
    expect(msgs[0].transient).toBe(true)
  })

  it('ignores system events', () => {
    const msgs = fold([{ kind: 'system', subtype: 'init' }])
    expect(msgs).toHaveLength(0)
  })

  it('labels an unknown tool generically', () => {
    const msgs = fold([{ kind: 'tool_use', name: 'mystery_tool', input: {} }])
    expect(msgs[0].text).toContain('mystery_tool')
  })
})

describe('isAuthErrorText', () => {
  it('detects claude authentication failures', () => {
    expect(isAuthErrorText('Failed to authenticate. API Error: 401 Invalid authentication credentials')).toBe(true)
    expect(isAuthErrorText('API Error: 401')).toBe(true)
    expect(isAuthErrorText('invalid authentication credentials')).toBe(true)
    expect(isAuthErrorText('Unauthorized')).toBe(true)
  })

  it('does not flag ordinary lesson content', () => {
    expect(isAuthErrorText('The 401k retirement plan has 400 participants.')).toBe(false)
    expect(isAuthErrorText('Let me update your lesson.')).toBe(false)
  })

  it('exposes an actionable, user-safe message', () => {
    expect(AUTH_EXPIRED_MESSAGE).toMatch(/login/i)
    expect(AUTH_EXPIRED_MESSAGE).not.toMatch(/401|stack/i)
  })
})

describe('persistableMessages', () => {
  it('drops transient error/system banners', () => {
    const msgs: ChatMessage[] = [
      { id: 'm1', role: 'user', text: 'hi' },
      { id: 'm2', role: 'assistant', text: 'hello' },
      { id: 'm3', role: 'system', text: 'login expired', transient: true },
    ]
    expect(persistableMessages(msgs).map((m) => m.id)).toEqual(['m1', 'm2'])
  })

  it('keeps a normal transcript intact', () => {
    const msgs: ChatMessage[] = [{ id: 'm1', role: 'user', text: 'hi' }]
    expect(persistableMessages(msgs)).toEqual(msgs)
  })
})
