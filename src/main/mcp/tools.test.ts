import { describe, it, expect, beforeEach } from 'vitest'
import { buildAgentTools, type ToolDeps } from './tools'
import type { Bridge, CommandResult } from '../bridge/bridge'

const deps: ToolDeps = {
  now: () => new Date('2026-06-24T10:00:00.000Z'),
  id: () => 'fixed-id',
}

class FakeBridge {
  calls: unknown[] = []
  result: CommandResult = { ok: true, fresh: true, artifacts: [], broadcasts: [] }
  async runCommand(raw: unknown): Promise<CommandResult> {
    this.calls.push(raw)
    return this.result
  }
}

let bridge: FakeBridge
let tools: ReturnType<typeof buildAgentTools>

beforeEach(() => {
  bridge = new FakeBridge()
  tools = buildAgentTools(bridge as unknown as Pick<Bridge, 'runCommand'>, deps)
})

function tool(name: string) {
  const t = tools.find((x) => x.name === name)
  if (!t) throw new Error(`no tool ${name}`)
  return t
}

describe('buildAgentTools', () => {
  it('exposes exactly the four agent tools', () => {
    expect(tools.map((t) => t.name).sort()).toEqual([
      'lesson_feedback',
      'patch_lesson',
      'record_learning',
      'schedule_review',
    ])
  })

  it('lesson_feedback builds a command with injected id+ts and calls the bridge', async () => {
    const res = await tool('lesson_feedback').handler({
      lessonId: '0004',
      anchorId: 'slice',
      html: '<p>nice</p>',
    })
    expect(res.isError).toBeFalsy()
    expect(bridge.calls[0]).toEqual({
      type: 'lesson_feedback',
      commandId: 'fixed-id',
      ts: '2026-06-24T10:00:00.000Z',
      lessonId: '0004',
      anchorId: 'slice',
      html: '<p>nice</p>',
    })
  })

  it('patch_lesson passes selector + mode through', async () => {
    await tool('patch_lesson').handler({
      lessonId: '0004',
      selector: '.aside',
      mode: 'replace',
      html: '<div>x</div>',
    })
    expect(bridge.calls[0]).toMatchObject({ type: 'patch_lesson', selector: '.aside', mode: 'replace' })
  })

  it('schedule_review and record_learning reach the bridge', async () => {
    await tool('schedule_review').handler({ lessonId: '0004', dueDate: '2026-07-01' })
    await tool('record_learning').handler({ title: 'Got it', body: 'evidence' })
    expect(bridge.calls).toHaveLength(2)
    expect(bridge.calls[0]).toMatchObject({ type: 'schedule_review', dueDate: '2026-07-01' })
    expect(bridge.calls[1]).toMatchObject({ type: 'record_learning', title: 'Got it' })
  })

  it('returns isError and does not call the bridge on invalid args', async () => {
    const res = await tool('patch_lesson').handler({ lessonId: '0004', mode: 'sideways' })
    expect(res.isError).toBe(true)
    expect(bridge.calls).toHaveLength(0)
  })

  it('surfaces a bridge failure as a tool error', async () => {
    bridge.result = { ok: false, error: 'boom' }
    const res = await tool('lesson_feedback').handler({ lessonId: '0004', html: '<p>x</p>' })
    expect(res.isError).toBe(true)
    expect(res.content[0].text).toContain('boom')
  })
})
