import { describe, it, expect, beforeEach } from 'vitest'
import { Bridge, type BroadcastClient } from './bridge'
import { BridgeCore, type WorkspaceFs } from './bridge-core'

const TS = '2026-06-24T10:00:00.000Z'

class FakeFs implements WorkspaceFs {
  files = new Map<string, string>()
  async read(rel: string) {
    return this.files.get(rel) ?? null
  }
  async write(rel: string, content: string) {
    this.files.set(rel, content)
  }
  async list() {
    return []
  }
}

class FakeClient implements BroadcastClient {
  received: string[] = []
  send(data: string) {
    this.received.push(data)
  }
}

let bridge: Bridge

beforeEach(() => {
  bridge = new Bridge(new BridgeCore(new FakeFs()))
})

describe('ingestEvent', () => {
  it('emits a synthesized prompt for a valid event', async () => {
    const prompts: string[] = []
    bridge.onPrompt((p) => prompts.push(p))
    const r = await bridge.ingestEvent({
      type: 'exercise_submission',
      eventId: 'e1',
      lessonId: '0004',
      promptId: 'slice',
      text: 'my slice',
      ts: TS,
    })
    expect(r.ok).toBe(true)
    expect(prompts).toHaveLength(1)
    expect(prompts[0]).toContain('0004')
  })

  it('does not emit a prompt for lesson_opened', async () => {
    const prompts: string[] = []
    bridge.onPrompt((p) => prompts.push(p))
    await bridge.ingestEvent({ type: 'lesson_opened', eventId: 'o1', lessonId: '0001', ts: TS })
    expect(prompts).toHaveLength(0)
  })

  it('returns a typed failure (no throw) on malformed input', async () => {
    const r = await bridge.ingestEvent({ type: 'bogus' })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(typeof r.error).toBe('string')
  })
})

describe('runCommand + broadcast', () => {
  it('broadcasts lesson-targeting commands as JSON to all clients', async () => {
    const a = new FakeClient()
    const b = new FakeClient()
    bridge.addClient(a)
    bridge.addClient(b)
    const r = await bridge.runCommand({
      type: 'lesson_feedback',
      commandId: 'c1',
      lessonId: '0004',
      html: '<p>nice</p>',
      ts: TS,
    })
    expect(r.ok).toBe(true)
    expect(a.received).toHaveLength(1)
    expect(JSON.parse(a.received[0])).toMatchObject({ type: 'lesson_feedback', lessonId: '0004' })
    expect(b.received).toHaveLength(1)
  })

  it('does not broadcast workspace-only commands', async () => {
    const a = new FakeClient()
    bridge.addClient(a)
    await bridge.runCommand({
      type: 'schedule_review',
      commandId: 'c2',
      lessonId: '0004',
      dueDate: '2026-07-01',
      ts: TS,
    })
    expect(a.received).toHaveLength(0)
  })

  it('stops sending to a removed client', async () => {
    const a = new FakeClient()
    bridge.addClient(a)
    bridge.removeClient(a)
    await bridge.runCommand({ type: 'lesson_feedback', commandId: 'c3', lessonId: '0004', html: '<p>x</p>', ts: TS })
    expect(a.received).toHaveLength(0)
  })

  it('rejects a malformed command without throwing', async () => {
    const r = await bridge.runCommand({ type: 'patch_lesson', commandId: 'c4', lessonId: '0004', mode: 'sideways' })
    expect(r.ok).toBe(false)
  })
})
