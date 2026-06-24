import { describe, it, expect, beforeEach } from 'vitest'
import { BridgeCore, type WorkspaceFs } from './bridge-core'
import type { LessonEvent, AgentCommand } from '@shared/protocol'

const TS = '2026-06-24T10:00:00.000Z'

/** In-memory WorkspaceFs for tests. Paths are workspace-relative. */
class FakeFs implements WorkspaceFs {
  files = new Map<string, string>()

  async read(rel: string): Promise<string | null> {
    return this.files.has(rel) ? (this.files.get(rel) as string) : null
  }
  async write(rel: string, content: string): Promise<void> {
    this.files.set(rel, content)
  }
  async list(relDir: string): Promise<string[]> {
    const prefix = relDir.endsWith('/') ? relDir : relDir + '/'
    const names = new Set<string>()
    for (const path of this.files.keys()) {
      if (path.startsWith(prefix)) {
        const rest = path.slice(prefix.length)
        if (!rest.includes('/')) names.add(rest)
      }
    }
    return [...names]
  }
}

let fs: FakeFs
let core: BridgeCore

beforeEach(() => {
  fs = new FakeFs()
  core = new BridgeCore(fs)
})

describe('handleLessonEvent — exercise_submission', () => {
  const event: LessonEvent = {
    type: 'exercise_submission',
    eventId: 'e-sub-1',
    lessonId: '0004',
    promptId: 'vertical slice',
    text: 'SETUP — the boring world: walk the kid to day care…',
    ts: TS,
  }

  it('records the submission to lesson-entries/ and returns a synthesized prompt', async () => {
    const r = await core.handleLessonEvent(event)
    expect(r.fresh).toBe(true)
    expect(r.artifacts).toHaveLength(1)
    expect(r.artifacts[0].path).toBe('lesson-entries/0004-vertical-slice.md')
    expect(r.artifacts[0].content).toContain('boring world')
    // the file is actually written to the workspace
    expect(await fs.read('lesson-entries/0004-vertical-slice.md')).toContain('boring world')
    // prompt references the lesson, the file and the lesson_feedback tool
    expect(r.prompt).toBeTruthy()
    expect(r.prompt).toContain('0004')
    expect(r.prompt).toContain('lesson-entries/0004-vertical-slice.md')
    expect(r.prompt).toContain('lesson_feedback')
  })

  it('is idempotent — re-handling the same eventId does not double-write', async () => {
    await core.handleLessonEvent(event)
    const again = await core.handleLessonEvent(event)
    expect(again.fresh).toBe(false)
    expect(again.artifacts).toHaveLength(0)
    expect(fs.files.size).toBe(1)
  })
})

describe('handleLessonEvent — quiz_result', () => {
  const event: LessonEvent = {
    type: 'quiz_result',
    eventId: 'e-quiz-1',
    lessonId: '0004',
    items: [
      { questionIndex: 0, questionText: 'A vertical slice is…', chosenIndex: 0, correctIndex: 0, isCorrect: true },
      { questionIndex: 1, questionText: 'To make it FELT…', chosenIndex: 1, correctIndex: 0, isCorrect: false },
      { questionIndex: 2, chosenIndex: 0, correctIndex: 0, isCorrect: true },
    ],
    score: { correct: 2, total: 3 },
    ts: TS,
  }

  it('records results and summarises the score in the prompt', async () => {
    const r = await core.handleLessonEvent(event)
    expect(r.fresh).toBe(true)
    expect(r.artifacts[0].path).toBe('lesson-entries/0004-quiz.md')
    expect(r.prompt).toContain('2')
    expect(r.prompt).toContain('3')
    // the wrong question is surfaced to the agent
    expect(r.prompt).toContain('FELT')
    // nudges spaced repetition
    expect(r.prompt).toContain('schedule_review')
  })
})

describe('handleLessonEvent — help_request', () => {
  it('produces a scoped prompt with the anchor text and no artifact', async () => {
    const event: LessonEvent = {
      type: 'help_request',
      eventId: 'e-help-1',
      lessonId: '0004',
      anchorText: "Earn, don't tell",
      question: 'How do I do this without dialogue?',
      ts: TS,
    }
    const r = await core.handleLessonEvent(event)
    expect(r.artifacts).toHaveLength(0)
    expect(r.prompt).toContain("Earn, don't tell")
    expect(r.prompt).toContain('without dialogue')
  })
})

describe('handleLessonEvent — lesson_opened', () => {
  it('is handled with no artifact and no agent prompt (context only)', async () => {
    const event: LessonEvent = {
      type: 'lesson_opened',
      eventId: 'e-open-1',
      lessonId: '0002',
      ts: TS,
    }
    const r = await core.handleLessonEvent(event)
    expect(r.fresh).toBe(true)
    expect(r.artifacts).toHaveLength(0)
    expect(r.prompt).toBeNull()
  })
})

describe('applyAgentCommand — lesson_feedback', () => {
  it('broadcasts to the lesson and writes nothing', async () => {
    const cmd: AgentCommand = {
      type: 'lesson_feedback',
      commandId: 'c-fb-1',
      lessonId: '0004',
      anchorId: 'vertical-slice',
      html: '<p>Your LAND beat needs work.</p>',
      ts: TS,
    }
    const r = await core.applyAgentCommand(cmd)
    expect(r.fresh).toBe(true)
    expect(r.artifacts).toHaveLength(0)
    expect(r.broadcasts).toHaveLength(1)
    expect(r.broadcasts[0]).toMatchObject({ type: 'lesson_feedback', lessonId: '0004', anchorId: 'vertical-slice' })
  })

  it('is idempotent by commandId', async () => {
    const cmd: AgentCommand = {
      type: 'lesson_feedback',
      commandId: 'c-fb-dup',
      lessonId: '0004',
      html: '<p>hi</p>',
      ts: TS,
    }
    await core.applyAgentCommand(cmd)
    const again = await core.applyAgentCommand(cmd)
    expect(again.fresh).toBe(false)
    expect(again.broadcasts).toHaveLength(0)
  })
})

describe('applyAgentCommand — patch_lesson', () => {
  it('broadcasts the patch and persists it to a sidecar for replay', async () => {
    const cmd: AgentCommand = {
      type: 'patch_lesson',
      commandId: 'c-patch-1',
      lessonId: '0004',
      selector: '.aside',
      mode: 'replace',
      html: '<div class="aside">moved the POV beat later</div>',
      ts: TS,
    }
    const r = await core.applyAgentCommand(cmd)
    expect(r.broadcasts[0]).toMatchObject({ type: 'patch_lesson', selector: '.aside', mode: 'replace' })
    const sidecar = await fs.read('lessons/0004.patches.json')
    expect(sidecar).toBeTruthy()
    const patches = JSON.parse(sidecar as string)
    expect(patches).toHaveLength(1)
    expect(patches[0].selector).toBe('.aside')
  })

  it('appends successive patches to the sidecar', async () => {
    const mk = (id: string, sel: string): AgentCommand => ({
      type: 'patch_lesson', commandId: id, lessonId: '0004', selector: sel, mode: 'append', html: '<p>x</p>', ts: TS,
    })
    await core.applyAgentCommand(mk('p1', '.a'))
    await core.applyAgentCommand(mk('p2', '.b'))
    const patches = JSON.parse((await fs.read('lessons/0004.patches.json')) as string)
    expect(patches).toHaveLength(2)
  })
})

describe('applyAgentCommand — schedule_review', () => {
  it('writes the due date to reviews.json keyed by lesson, no broadcast', async () => {
    const cmd: AgentCommand = {
      type: 'schedule_review',
      commandId: 'c-rev-1',
      lessonId: '0004',
      dueDate: '2026-07-01',
      reason: 'spacing',
      ts: TS,
    }
    const r = await core.applyAgentCommand(cmd)
    expect(r.broadcasts).toHaveLength(0)
    const reviews = JSON.parse((await fs.read('reviews.json')) as string)
    expect(reviews['0004'].dueDate).toBe('2026-07-01')
  })

  it('a later schedule for the same lesson overwrites the earlier due date', async () => {
    await core.applyAgentCommand({ type: 'schedule_review', commandId: 'r1', lessonId: '0004', dueDate: '2026-07-01', ts: TS })
    await core.applyAgentCommand({ type: 'schedule_review', commandId: 'r2', lessonId: '0004', dueDate: '2026-08-01', ts: TS })
    const reviews = JSON.parse((await fs.read('reviews.json')) as string)
    expect(reviews['0004'].dueDate).toBe('2026-08-01')
  })
})

describe('applyAgentCommand — record_learning', () => {
  it('writes a numbered learning record, incrementing past existing ones', async () => {
    await fs.write('learning-records/0008-existing.md', '# old')
    const cmd: AgentCommand = {
      type: 'record_learning',
      commandId: 'c-lr-1',
      title: 'Learner understands vertical slices',
      body: 'Demonstrated a complete LAND beat without dialogue.',
      ts: TS,
    }
    const r = await core.applyAgentCommand(cmd)
    expect(r.artifacts[0].path).toBe('learning-records/0009-learner-understands-vertical-slices.md')
    expect(r.artifacts[0].content).toContain('# Learner understands vertical slices')
    expect(r.artifacts[0].content).toContain('LAND beat')
  })

  it('numbers from 0001 when none exist', async () => {
    const r = await core.applyAgentCommand({
      type: 'record_learning', commandId: 'c-lr-2', title: 'First insight', body: 'x', ts: TS,
    })
    expect(r.artifacts[0].path).toBe('learning-records/0001-first-insight.md')
  })
})
