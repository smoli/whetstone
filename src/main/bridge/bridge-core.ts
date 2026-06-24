import type {
  LessonEvent,
  AgentCommand,
  ExerciseSubmission,
  QuizResult,
  HelpRequest,
  LessonFeedback,
  PatchLesson,
  ScheduleReview,
  RecordLearning,
} from '@shared/protocol'

/**
 * Workspace filesystem abstraction. All paths are workspace-relative.
 * Injected so BridgeCore stays pure and testable (no real fs in unit tests).
 */
export interface WorkspaceFs {
  /** File contents, or null if it does not exist. */
  read(rel: string): Promise<string | null>
  write(rel: string, content: string): Promise<void>
  /** Immediate child names of a directory; [] if the directory is absent. */
  list(relDir: string): Promise<string[]>
}

export interface WrittenArtifact {
  path: string
  content: string
}

/** A message broadcast over WebSocket to lessons. Mirrors a lesson-targeting command. */
export type BroadcastMessage = LessonFeedback | PatchLesson

export interface LessonEventResult {
  /** false when this event was a duplicate (already handled this session). */
  fresh: boolean
  artifacts: WrittenArtifact[]
  /** A synthesized user turn to feed the agent, or null if none is warranted. */
  prompt: string | null
}

export interface AgentCommandResult {
  fresh: boolean
  artifacts: WrittenArtifact[]
  broadcasts: BroadcastMessage[]
}

const EMPTY_EVENT: Omit<LessonEventResult, 'fresh'> = { artifacts: [], prompt: null }

/**
 * The pure heart of the bridge. Turns lesson events into recorded artifacts +
 * synthesized agent prompts, and agent commands into workspace writes + lesson
 * broadcasts. Dedupes by event/command id within a session.
 */
export class BridgeCore {
  private readonly seenEvents = new Set<string>()
  private readonly seenCommands = new Set<string>()

  constructor(private readonly fs: WorkspaceFs) {}

  async handleLessonEvent(event: LessonEvent): Promise<LessonEventResult> {
    if (this.seenEvents.has(event.eventId)) {
      return { fresh: false, ...EMPTY_EVENT }
    }
    this.seenEvents.add(event.eventId)

    switch (event.type) {
      case 'exercise_submission':
        return this.onExerciseSubmission(event)
      case 'quiz_result':
        return this.onQuizResult(event)
      case 'help_request':
        return this.onHelpRequest(event)
      case 'lesson_opened':
        return { fresh: true, artifacts: [], prompt: null }
    }
  }

  async applyAgentCommand(cmd: AgentCommand): Promise<AgentCommandResult> {
    if (this.seenCommands.has(cmd.commandId)) {
      return { fresh: false, artifacts: [], broadcasts: [] }
    }
    this.seenCommands.add(cmd.commandId)

    switch (cmd.type) {
      case 'lesson_feedback':
        return this.onLessonFeedback(cmd)
      case 'patch_lesson':
        return this.onPatchLesson(cmd)
      case 'schedule_review':
        return this.onScheduleReview(cmd)
      case 'record_learning':
        return this.onRecordLearning(cmd)
    }
  }

  // ── lesson events ─────────────────────────────────────────────────────────

  private async onExerciseSubmission(e: ExerciseSubmission): Promise<LessonEventResult> {
    const path = `lesson-entries/${e.lessonId}-${slug(e.promptId)}.md`
    const content =
      `# Lesson ${e.lessonId} — exercise: ${e.promptId}\n\n` +
      `_Submitted ${e.ts}_\n\n${e.text}\n`
    await this.fs.write(path, content)

    const prompt =
      `The learner submitted their response to exercise "${e.promptId}" in lesson ${e.lessonId}. ` +
      `It has been saved to ${path}. Here is what they wrote:\n\n${e.text}\n\n` +
      `Read it closely against the lesson's goal, then give them feedback inline using the ` +
      `lesson_feedback tool (lessonId "${e.lessonId}", anchorId "${slug(e.promptId)}"). ` +
      `If they demonstrated real understanding, also record_learning.`

    return { fresh: true, artifacts: [{ path, content }], prompt }
  }

  private async onQuizResult(e: QuizResult): Promise<LessonEventResult> {
    const path = `lesson-entries/${e.lessonId}-quiz.md`
    const lines = e.items.map(
      (it) =>
        `- Q${it.questionIndex + 1}${it.questionText ? ` (${it.questionText})` : ''}: ` +
        `${it.isCorrect ? '✓ correct' : '✗ wrong'}`,
    )
    const content =
      `# Lesson ${e.lessonId} — quiz results\n\n` +
      `_Completed ${e.ts}_\n\nScore: ${e.score.correct}/${e.score.total}\n\n` +
      lines.join('\n') +
      '\n'
    await this.fs.write(path, content)

    const wrong = e.items.filter((it) => !it.isCorrect)
    const wrongDesc = wrong.length
      ? wrong.map((it) => `Q${it.questionIndex + 1}${it.questionText ? ` "${it.questionText}"` : ''}`).join(', ')
      : 'none'
    const prompt =
      `The learner completed the quiz in lesson ${e.lessonId}, scoring ${e.score.correct}/${e.score.total}. ` +
      `Questions missed: ${wrongDesc}. Results saved to ${path}. ` +
      `Decide whether to record_learning (if they showed mastery) and use schedule_review to ` +
      `space a future review of this lesson — sooner if they struggled.`

    return { fresh: true, artifacts: [{ path, content }], prompt }
  }

  private async onHelpRequest(e: HelpRequest): Promise<LessonEventResult> {
    const question = e.question?.trim() ? e.question.trim() : 'Please explain this in more depth.'
    const prompt =
      `While reading lesson ${e.lessonId}, the learner asked for help on this passage: ` +
      `"${e.anchorText}". Their question: ${question} ` +
      `Answer it directly in chat, grounded in the lesson and their mission.`
    return { fresh: true, artifacts: [], prompt }
  }

  // ── agent commands ────────────────────────────────────────────────────────

  private async onLessonFeedback(cmd: LessonFeedback): Promise<AgentCommandResult> {
    return { fresh: true, artifacts: [], broadcasts: [cmd] }
  }

  private async onPatchLesson(cmd: PatchLesson): Promise<AgentCommandResult> {
    const sidecar = `lessons/${cmd.lessonId}.patches.json`
    const existing = await this.fs.read(sidecar)
    const patches: unknown[] = existing ? (JSON.parse(existing) as unknown[]) : []
    patches.push({
      commandId: cmd.commandId,
      selector: cmd.selector,
      mode: cmd.mode,
      html: cmd.html,
      ts: cmd.ts,
    })
    const content = JSON.stringify(patches, null, 2)
    await this.fs.write(sidecar, content)
    return { fresh: true, artifacts: [{ path: sidecar, content }], broadcasts: [cmd] }
  }

  private async onScheduleReview(cmd: ScheduleReview): Promise<AgentCommandResult> {
    const existing = await this.fs.read('reviews.json')
    const reviews: Record<string, unknown> = existing ? (JSON.parse(existing) as Record<string, unknown>) : {}
    reviews[cmd.lessonId] = {
      dueDate: cmd.dueDate,
      reason: cmd.reason ?? null,
      scheduledAt: cmd.ts,
    }
    const content = JSON.stringify(reviews, null, 2)
    await this.fs.write('reviews.json', content)
    return { fresh: true, artifacts: [{ path: 'reviews.json', content }], broadcasts: [] }
  }

  private async onRecordLearning(cmd: RecordLearning): Promise<AgentCommandResult> {
    const next = await this.nextSequence('learning-records')
    const path = `learning-records/${pad(next)}-${slug(cmd.title)}.md`
    const content = `# ${cmd.title}\n\n${cmd.body}\n`
    await this.fs.write(path, content)
    return { fresh: true, artifacts: [{ path, content }], broadcasts: [] }
  }

  /** Highest leading NNNN in a directory, + 1. Returns 1 for an empty/absent dir. */
  private async nextSequence(dir: string): Promise<number> {
    const names = await this.fs.list(dir)
    let max = 0
    for (const name of names) {
      const m = /^(\d{1,})-/.exec(name)
      if (m) max = Math.max(max, parseInt(m[1], 10))
    }
    return max + 1
  }
}

function pad(n: number): string {
  return String(n).padStart(4, '0')
}

function slug(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}
