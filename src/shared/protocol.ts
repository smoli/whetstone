import { z } from 'zod'

/**
 * The interaction protocol — the typed contract between a lesson (HTML running
 * in the webview) and the teaching agent (Claude Code).
 *
 * Two families:
 *   - LessonEvent   lesson → agent   (the user did something in the lesson)
 *   - AgentCommand  agent → lesson   (the agent acts on the lesson / workspace)
 *
 * Everything here is pure and side-effect free. Parsing never throws: callers at
 * the network boundary get a typed Result so malformed input can't crash the app.
 */

export const PROTOCOL_VERSION = '1'

/** Common fields on every message. */
const base = {
  /** ISO-8601 timestamp set by the originator. */
  ts: z.string().datetime(),
}

const lessonBase = {
  ...base,
  /** Stable id used for idempotent handling (dedupe re-POSTs). */
  eventId: z.string().min(1),
  /** Lesson file stem, e.g. "0004". */
  lessonId: z.string().min(1),
}

// ── LessonEvent (lesson → agent) ────────────────────────────────────────────

export const ExerciseSubmissionSchema = z.object({
  type: z.literal('exercise_submission'),
  ...lessonBase,
  /** Which exercise within the lesson (a lesson may have several). */
  promptId: z.string().min(1),
  text: z.string().min(1),
})

export const QuizItemResultSchema = z.object({
  questionIndex: z.number().int().nonnegative(),
  questionText: z.string().optional(),
  chosenIndex: z.number().int().nonnegative(),
  correctIndex: z.number().int().nonnegative(),
  isCorrect: z.boolean(),
})

export const QuizResultSchema = z.object({
  type: z.literal('quiz_result'),
  ...lessonBase,
  items: z.array(QuizItemResultSchema).min(1),
  score: z.object({
    correct: z.number().int().nonnegative(),
    total: z.number().int().positive(),
  }),
})

export const HelpRequestSchema = z.object({
  type: z.literal('help_request'),
  ...lessonBase,
  /** Anchor id of the element the user asked about, if available. */
  anchorId: z.string().optional(),
  /** The text the user clicked "explain" on. */
  anchorText: z.string().min(1),
  /** An optional free-text question the user typed. */
  question: z.string().optional(),
})

export const LessonOpenedSchema = z.object({
  type: z.literal('lesson_opened'),
  ...lessonBase,
})

export const LessonEventSchema = z.discriminatedUnion('type', [
  ExerciseSubmissionSchema,
  QuizResultSchema,
  HelpRequestSchema,
  LessonOpenedSchema,
])

export type ExerciseSubmission = z.infer<typeof ExerciseSubmissionSchema>
export type QuizResult = z.infer<typeof QuizResultSchema>
export type QuizItemResult = z.infer<typeof QuizItemResultSchema>
export type HelpRequest = z.infer<typeof HelpRequestSchema>
export type LessonOpened = z.infer<typeof LessonOpenedSchema>
export type LessonEvent = z.infer<typeof LessonEventSchema>
export type LessonEventType = LessonEvent['type']

// ── AgentCommand (agent → lesson / workspace) ───────────────────────────────

const commandBase = {
  ...base,
  /** Stable id for idempotent handling. */
  commandId: z.string().min(1),
}

export const LessonFeedbackSchema = z.object({
  type: z.literal('lesson_feedback'),
  ...commandBase,
  lessonId: z.string().min(1),
  /** Anchor to render feedback beside; omitted → append to the lesson. */
  anchorId: z.string().optional(),
  html: z.string().min(1),
})

export const PatchMode = z.enum(['replace', 'append', 'before', 'after'])
export type PatchMode = z.infer<typeof PatchMode>

export const PatchLessonSchema = z.object({
  type: z.literal('patch_lesson'),
  ...commandBase,
  lessonId: z.string().min(1),
  selector: z.string().min(1),
  mode: PatchMode,
  html: z.string().min(1),
})

export const ScheduleReviewSchema = z.object({
  type: z.literal('schedule_review'),
  ...commandBase,
  lessonId: z.string().min(1),
  /** ISO date (YYYY-MM-DD) the review is due. */
  dueDate: z.string().min(1),
  reason: z.string().optional(),
})

export const RecordLearningSchema = z.object({
  type: z.literal('record_learning'),
  ...commandBase,
  title: z.string().min(1),
  body: z.string().min(1),
})

export const AgentCommandSchema = z.discriminatedUnion('type', [
  LessonFeedbackSchema,
  PatchLessonSchema,
  ScheduleReviewSchema,
  RecordLearningSchema,
])

export type LessonFeedback = z.infer<typeof LessonFeedbackSchema>
export type PatchLesson = z.infer<typeof PatchLessonSchema>
export type ScheduleReview = z.infer<typeof ScheduleReviewSchema>
export type RecordLearning = z.infer<typeof RecordLearningSchema>
export type AgentCommand = z.infer<typeof AgentCommandSchema>
export type AgentCommandType = AgentCommand['type']

// ── Parse helpers (never throw) ─────────────────────────────────────────────

export type ParseResult<T> = { ok: true; value: T } | { ok: false; error: string }

function toResult<T>(parsed: z.SafeParseReturnType<unknown, T>): ParseResult<T> {
  if (parsed.success) return { ok: true, value: parsed.data }
  const issue = parsed.error.issues[0]
  const path = issue?.path.length ? ` at ${issue.path.join('.')}` : ''
  return { ok: false, error: `${issue?.message ?? 'invalid'}${path}` }
}

export function parseLessonEvent(input: unknown): ParseResult<LessonEvent> {
  return toResult(LessonEventSchema.safeParse(input))
}

export function parseAgentCommand(input: unknown): ParseResult<AgentCommand> {
  return toResult(AgentCommandSchema.safeParse(input))
}
