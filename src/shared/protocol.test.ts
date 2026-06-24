import { describe, it, expect } from 'vitest'
import {
  PROTOCOL_VERSION,
  parseLessonEvent,
  parseAgentCommand,
  type LessonEvent,
  type AgentCommand,
} from './protocol'

const TS = '2026-06-24T10:00:00.000Z'

describe('protocol version', () => {
  it('exposes a version string', () => {
    expect(typeof PROTOCOL_VERSION).toBe('string')
    expect(PROTOCOL_VERSION.length).toBeGreaterThan(0)
  })
})

describe('parseLessonEvent', () => {
  it('parses an exercise_submission', () => {
    const r = parseLessonEvent({
      type: 'exercise_submission',
      eventId: 'e1',
      lessonId: '0004',
      promptId: 'vertical-slice',
      text: 'SETUP — the boring world…',
      ts: TS,
    })
    expect(r.ok).toBe(true)
    if (r.ok) {
      // discriminated-union narrowing works
      expect(r.value.type).toBe('exercise_submission')
      if (r.value.type === 'exercise_submission') {
        expect(r.value.text).toContain('boring world')
      }
    }
  })

  it('parses a quiz_result with per-item grading', () => {
    const r = parseLessonEvent({
      type: 'quiz_result',
      eventId: 'e2',
      lessonId: '0004',
      items: [
        { questionIndex: 0, chosenIndex: 0, correctIndex: 0, isCorrect: true },
        { questionIndex: 1, chosenIndex: 1, correctIndex: 0, isCorrect: false },
      ],
      score: { correct: 1, total: 2 },
      ts: TS,
    })
    expect(r.ok).toBe(true)
    if (r.ok && r.value.type === 'quiz_result') {
      expect(r.value.score.total).toBe(2)
      expect(r.value.items[1].isCorrect).toBe(false)
    }
  })

  it('parses a help_request (inline explain)', () => {
    const r = parseLessonEvent({
      type: 'help_request',
      eventId: 'e3',
      lessonId: '0004',
      anchorText: "Earn, don't tell",
      question: 'What does this mean in practice?',
      ts: TS,
    })
    expect(r.ok).toBe(true)
    if (r.ok && r.value.type === 'help_request') {
      expect(r.value.anchorText).toContain('Earn')
    }
  })

  it('parses a lesson_opened event', () => {
    const r = parseLessonEvent({
      type: 'lesson_opened',
      eventId: 'e4',
      lessonId: '0004',
      ts: TS,
    })
    expect(r.ok).toBe(true)
  })

  it('rejects an unknown event type with a typed error (no throw)', () => {
    const r = parseLessonEvent({ type: 'nonsense', eventId: 'x', lessonId: '0', ts: TS })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(typeof r.error).toBe('string')
  })

  it('rejects a malformed exercise_submission (missing text)', () => {
    const r = parseLessonEvent({
      type: 'exercise_submission',
      eventId: 'e1',
      lessonId: '0004',
      promptId: 'vertical-slice',
      ts: TS,
    })
    expect(r.ok).toBe(false)
  })

  it('rejects a non-ISO timestamp', () => {
    const r = parseLessonEvent({
      type: 'lesson_opened',
      eventId: 'e4',
      lessonId: '0004',
      ts: 'last tuesday',
    })
    expect(r.ok).toBe(false)
  })

  it('does not throw on garbage input', () => {
    expect(() => parseLessonEvent(null)).not.toThrow()
    expect(() => parseLessonEvent(42)).not.toThrow()
    expect(parseLessonEvent(undefined).ok).toBe(false)
  })
})

describe('parseAgentCommand', () => {
  it('parses lesson_feedback', () => {
    const r = parseAgentCommand({
      type: 'lesson_feedback',
      commandId: 'c1',
      lessonId: '0004',
      anchorId: 'vertical-slice',
      html: '<p>Your LAND beat needs work…</p>',
      ts: TS,
    })
    expect(r.ok).toBe(true)
    if (r.ok && r.value.type === 'lesson_feedback') {
      expect(r.value.html).toContain('LAND')
    }
  })

  it('parses patch_lesson with a mode', () => {
    const r = parseAgentCommand({
      type: 'patch_lesson',
      commandId: 'c2',
      lessonId: '0004',
      selector: '.aside',
      mode: 'replace',
      html: '<div class="aside">updated</div>',
      ts: TS,
    })
    expect(r.ok).toBe(true)
    if (r.ok && r.value.type === 'patch_lesson') {
      expect(r.value.mode).toBe('replace')
    }
  })

  it('rejects patch_lesson with an invalid mode', () => {
    const r = parseAgentCommand({
      type: 'patch_lesson',
      commandId: 'c2',
      lessonId: '0004',
      selector: '.aside',
      mode: 'sideways',
      html: '<div></div>',
      ts: TS,
    })
    expect(r.ok).toBe(false)
  })

  it('parses schedule_review', () => {
    const r = parseAgentCommand({
      type: 'schedule_review',
      commandId: 'c3',
      lessonId: '0004',
      dueDate: '2026-07-01',
      reason: 'spacing',
      ts: TS,
    })
    expect(r.ok).toBe(true)
  })

  it('parses record_learning', () => {
    const r = parseAgentCommand({
      type: 'record_learning',
      commandId: 'c4',
      title: 'Learner understands vertical slices',
      body: 'Demonstrated by a complete LAND beat without dialogue.',
      ts: TS,
    })
    expect(r.ok).toBe(true)
  })

  it('rejects an unknown command type', () => {
    const r = parseAgentCommand({ type: 'launch_missiles', commandId: 'c', ts: TS })
    expect(r.ok).toBe(false)
  })
})

describe('type exports compile', () => {
  it('LessonEvent and AgentCommand are usable as types', () => {
    const e: LessonEvent = {
      type: 'lesson_opened',
      eventId: 'e',
      lessonId: '0001',
      ts: TS,
    }
    const c: AgentCommand = {
      type: 'schedule_review',
      commandId: 'c',
      lessonId: '0001',
      dueDate: '2026-07-01',
      ts: TS,
    }
    expect(e.type).toBe('lesson_opened')
    expect(c.type).toBe('schedule_review')
  })
})
