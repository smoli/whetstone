import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { WebSocket } from 'ws'
import { LessonServer } from './lesson-server'
import { Bridge } from './bridge'
import { BridgeCore } from './bridge-core'
import { NodeWorkspaceFs } from './workspace-fs'
import { buildAgentTools, type ToolDeps } from '../mcp/tools'

/**
 * Full-stack exercise of the bridge: a lesson client (WebSocket) and the lesson
 * POST endpoint on one side, the agent's MCP tools on the other. The only hop
 * not covered here is claude ↔ MCP-over-HTTP, which is verified live (M4).
 */

const TS = '2026-06-24T10:00:00.000Z'
const deps: ToolDeps = { now: () => new Date(TS), id: () => 'cmd-' + (idN++).toString() }
let idN = 0

let root: string
let server: LessonServer
let bridge: Bridge
let tools: ReturnType<typeof buildAgentTools>
let base: string
let prompts: string[]

function tool(name: string) {
  const t = tools.find((x) => x.name === name)
  if (!t) throw new Error(`no tool ${name}`)
  return t
}

async function post(event: unknown): Promise<Response> {
  return fetch(`${base}/events`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(event),
  })
}

/** Connect a lesson WS client and collect the messages it receives. */
async function lessonClient(): Promise<{ received: unknown[]; next: () => Promise<unknown>; close: () => void }> {
  const ws = new WebSocket(`${base.replace('http', 'ws')}/ws`)
  const received: unknown[] = []
  const waiters: ((v: unknown) => void)[] = []
  ws.on('message', (d) => {
    const msg = JSON.parse(d.toString())
    received.push(msg)
    waiters.shift()?.(msg)
  })
  await new Promise<void>((resolve) => ws.on('open', () => resolve()))
  return {
    received,
    next: () => new Promise((resolve) => waiters.push(resolve)),
    close: () => ws.close(),
  }
}

beforeEach(async () => {
  idN = 0
  prompts = []
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'teach-e2e-'))
  await fs.mkdir(path.join(root, 'lessons'), { recursive: true })
  await fs.writeFile(path.join(root, 'lessons', '0004.html'), '<html><body><div class="aside">old</div></body></html>')
  bridge = new Bridge(new BridgeCore(new NodeWorkspaceFs(root)))
  bridge.onPrompt((p) => prompts.push(p))
  tools = buildAgentTools(bridge, deps)
  server = new LessonServer({ bridge, workspaceRoot: root, port: 0 })
  const port = await server.listen()
  base = `http://127.0.0.1:${port}`
})

afterEach(async () => {
  await server.close()
  await fs.rm(root, { recursive: true, force: true })
})

describe('M4 — exercise submission → inline feedback', () => {
  it('records the entry, prompts the agent, and broadcasts feedback to the lesson', async () => {
    const client = await lessonClient()
    const nextMsg = client.next()
    await post({
      type: 'exercise_submission',
      eventId: 'e1',
      lessonId: '0004',
      promptId: 'vertical-slice',
      text: 'my slice',
      ts: TS,
    })
    expect(prompts[0]).toContain('lesson_feedback')
    expect(await fs.readFile(path.join(root, 'lesson-entries', '0004-vertical-slice.md'), 'utf8')).toContain('my slice')

    // agent responds via the MCP tool
    const res = await tool('lesson_feedback').handler({
      lessonId: '0004',
      anchorId: 'vertical-slice',
      html: '<p>Your LAND beat needs work.</p>',
    })
    expect(res.isError).toBeFalsy()
    expect(await nextMsg).toMatchObject({ type: 'lesson_feedback', anchorId: 'vertical-slice' })
    client.close()
  })
})

describe('M5 — quiz → learning record + spaced review', () => {
  it('prompts to schedule a review, then persists review + learning record', async () => {
    await post({
      type: 'quiz_result',
      eventId: 'q1',
      lessonId: '0004',
      items: [
        { questionIndex: 0, questionText: 'slice?', chosenIndex: 0, correctIndex: 0, isCorrect: true },
        { questionIndex: 1, questionText: 'felt?', chosenIndex: 1, correctIndex: 0, isCorrect: false },
        { questionIndex: 2, chosenIndex: 0, correctIndex: 0, isCorrect: true },
      ],
      score: { correct: 2, total: 3 },
      ts: TS,
    })
    expect(prompts[0]).toContain('schedule_review')
    expect(prompts[0]).toContain('felt?')

    await tool('schedule_review').handler({ lessonId: '0004', dueDate: '2026-07-01', reason: 'spacing' })
    await tool('record_learning').handler({ title: 'Understands vertical slices', body: 'Strong LAND beat.' })

    const reviews = JSON.parse(await fs.readFile(path.join(root, 'reviews.json'), 'utf8'))
    expect(reviews['0004'].dueDate).toBe('2026-07-01')
    const lr = await fs.readFile(path.join(root, 'learning-records', '0001-understands-vertical-slices.md'), 'utf8')
    expect(lr).toContain('# Understands vertical slices')
  })
})

describe('M6 — inline explain', () => {
  it('produces a scoped prompt with the anchor text and the question, no artifact', async () => {
    await post({
      type: 'help_request',
      eventId: 'h1',
      lessonId: '0004',
      anchorText: "Earn, don't tell",
      question: 'How without dialogue?',
      ts: TS,
    })
    expect(prompts[0]).toContain("Earn, don't tell")
    expect(prompts[0]).toContain('How without dialogue?')
    // help requests do not write a workspace artifact
    expect(await fs.readdir(root)).not.toContain('lesson-entries')
  })
})

describe('M7 — self-rewriting lesson', () => {
  it('broadcasts the patch to the lesson and persists it to a sidecar', async () => {
    const client = await lessonClient()
    const nextMsg = client.next()
    await tool('patch_lesson').handler({
      lessonId: '0004',
      selector: '.aside',
      mode: 'replace',
      html: '<div class="aside">moved the POV beat later</div>',
    })
    expect(await nextMsg).toMatchObject({ type: 'patch_lesson', selector: '.aside', mode: 'replace' })
    const sidecar = JSON.parse(await fs.readFile(path.join(root, 'lessons', '0004.patches.json'), 'utf8'))
    expect(sidecar[0].selector).toBe('.aside')
    client.close()
  })
})
