import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import type { Bridge } from '../bridge/bridge'

/** Injectable id + clock so command construction is deterministic in tests. */
export interface ToolDeps {
  now(): Date
  id(): string
}

const defaultDeps: ToolDeps = {
  now: () => new Date(),
  id: () => randomUUID(),
}

export interface McpToolResult {
  content: { type: 'text'; text: string }[]
  isError?: boolean
}

/**
 * A transport-agnostic agent tool: a name, a human description, the zod input
 * shape (advertised to the agent), and a handler that validates raw args, builds
 * the AgentCommand, and runs it through the Bridge.
 */
export interface AgentTool {
  name: string
  description: string
  inputShape: z.ZodRawShape
  handler: (raw: unknown) => Promise<McpToolResult>
}

type BridgeLike = Pick<Bridge, 'runCommand'>

const lessonFeedbackInput = {
  lessonId: z.string().describe('Lesson file stem, e.g. "0004".'),
  anchorId: z.string().optional().describe('Anchor to render feedback beside; omit to append to the lesson.'),
  html: z.string().describe('The feedback, as a small HTML fragment.'),
}

const patchLessonInput = {
  lessonId: z.string(),
  selector: z.string().describe('CSS selector of the element to patch.'),
  mode: z.enum(['replace', 'append', 'before', 'after']),
  html: z.string().describe('HTML fragment to apply at the selector.'),
}

const scheduleReviewInput = {
  lessonId: z.string(),
  dueDate: z.string().describe('ISO date (YYYY-MM-DD) the spaced review is due.'),
  reason: z.string().optional(),
}

const recordLearningInput = {
  title: z.string().describe('Short title of what the learner now understands.'),
  body: z.string().describe('1–3 sentences: what was learned and why it steers future sessions.'),
}

export function buildAgentTools(bridge: BridgeLike, deps: ToolDeps = defaultDeps): AgentTool[] {
  function run(type: string, args: Record<string, unknown>): Promise<McpToolResult> {
    return bridge
      .runCommand({ type, commandId: deps.id(), ts: deps.now().toISOString(), ...args })
      .then((res) => {
        if (!res.ok) return errorResult(res.error)
        return okResult(`${type} applied${res.fresh ? '' : ' (duplicate, ignored)'}.`)
      })
  }

  function define(name: string, description: string, shape: z.ZodRawShape): AgentTool {
    const schema = z.object(shape)
    return {
      name,
      description,
      inputShape: shape,
      handler: async (raw) => {
        const parsed = schema.safeParse(raw)
        if (!parsed.success) {
          return errorResult(`invalid arguments: ${parsed.error.issues[0]?.message ?? 'unknown'}`)
        }
        return run(name, parsed.data as Record<string, unknown>)
      },
    }
  }

  return [
    define(
      'lesson_feedback',
      'Render feedback into the lesson the learner is viewing, inline beside an anchor (or appended).',
      lessonFeedbackInput,
    ),
    define(
      'patch_lesson',
      'Patch the live lesson: replace/insert HTML at a selector. The change is broadcast and persisted for replay.',
      patchLessonInput,
    ),
    define(
      'schedule_review',
      'Schedule a spaced-repetition review of a lesson by recording its due date.',
      scheduleReviewInput,
    ),
    define(
      'record_learning',
      'Write a learning record capturing demonstrated understanding that should steer future sessions.',
      recordLearningInput,
    ),
  ]
}

function okResult(text: string): McpToolResult {
  return { content: [{ type: 'text', text }] }
}

function errorResult(text: string): McpToolResult {
  return { content: [{ type: 'text', text }], isError: true }
}
