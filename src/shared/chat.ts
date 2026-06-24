/**
 * Chat-layer types shared between the Claude harness (main) and the renderer.
 * These are the app's view of what the agent is doing — decoupled from Claude
 * Code's raw stream-json wire format.
 */

export type ChatEvent =
  | { kind: 'assistant_text'; text: string }
  | { kind: 'tool_use'; name: string; input: unknown }
  | { kind: 'result'; text: string; isError: boolean }
  | { kind: 'system'; subtype: string; sessionId?: string }

/** A typed, user-safe error state. The agent's failures never surface raw. */
export interface ClaudeError {
  kind: 'error'
  message: string
  /** Process exit code, if the failure was a non-zero exit. */
  code?: number
}

/** A message as shown in the chat pane. */
export interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'tool' | 'system'
  text: string
  /** For tool messages, the tool that was called. */
  toolName?: string
  /** For tool messages, how many consecutive tool calls were collapsed here. */
  count?: number
  /** True while the assistant is still streaming into this message. */
  pending?: boolean
}

/** Human-readable summaries for the agent's bridge tool calls. */
const TOOL_LABELS: Record<string, string> = {
  lesson_feedback: 'sent feedback into your lesson',
  patch_lesson: 'updated your lesson',
  schedule_review: 'scheduled a review',
  record_learning: 'recorded what you learned',
}

/**
 * Fold a ChatEvent into the running message list. Pure: returns a new array.
 * Streaming assistant text accumulates into the current pending message; a tool
 * use or result finalizes it.
 */
export function foldChatEvent(
  messages: ChatMessage[],
  ev: ChatEvent,
  nextId: () => string,
): ChatMessage[] {
  const last = messages[messages.length - 1]

  switch (ev.kind) {
    case 'assistant_text': {
      if (last && last.role === 'assistant' && last.pending) {
        const updated = { ...last, text: last.text + ev.text }
        return [...messages.slice(0, -1), updated]
      }
      return [...messages, { id: nextId(), role: 'assistant', text: ev.text, pending: true }]
    }
    case 'tool_use': {
      const label = TOOL_LABELS[ev.name] ?? `ran ${ev.name}`
      // Collapse a run of consecutive tool calls into one message that shows the
      // current tool, keeping a count of how many ran.
      if (last && last.role === 'tool') {
        const merged = { ...last, toolName: ev.name, text: label, count: (last.count ?? 1) + 1 }
        return [...messages.slice(0, -1), merged]
      }
      const finalized = finalizePending(messages)
      return [...finalized, { id: nextId(), role: 'tool', toolName: ev.name, text: label, count: 1 }]
    }
    case 'result': {
      const finalized = finalizePending(messages)
      if (ev.isError) {
        return [...finalized, { id: nextId(), role: 'system', text: 'The teaching agent reported an error.' }]
      }
      return finalized
    }
    case 'system':
      return messages
  }
}

function finalizePending(messages: ChatMessage[]): ChatMessage[] {
  const last = messages[messages.length - 1]
  if (last && last.pending) {
    return [...messages.slice(0, -1), { ...last, pending: false }]
  }
  return messages
}
