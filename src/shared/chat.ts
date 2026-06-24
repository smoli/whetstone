/**
 * Chat-layer types shared between the Claude harness (main) and the renderer.
 * These are the app's view of what the agent is doing — decoupled from Claude
 * Code's raw stream-json wire format.
 */

export type ChatEvent =
  | { kind: 'assistant_text'; text: string }
  | { kind: 'tool_use'; name: string; input: unknown }
  | { kind: 'result'; text: string; isError: boolean }
  | { kind: 'system'; subtype: string }

/** A typed, user-safe error state. The agent's failures never surface raw. */
export interface ClaudeError {
  kind: 'error'
  message: string
  /** Process exit code, if the failure was a non-zero exit. */
  code?: number
}
