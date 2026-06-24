import type { ChatEvent } from '@shared/chat'

/**
 * Incremental parser for Claude Code's `--output-format stream-json` output:
 * newline-delimited JSON. Buffers partial lines (a chunk may split a line
 * mid-JSON) and maps recognised messages to app-level ChatEvents. Never throws
 * on malformed input — unparseable lines are skipped.
 */
export class StreamParser {
  private buffer = ''

  /** Feed a stdout chunk; returns any ChatEvents completed by it. */
  push(chunk: string): ChatEvent[] {
    this.buffer += chunk
    const events: ChatEvent[] = []
    let nl: number
    while ((nl = this.buffer.indexOf('\n')) !== -1) {
      const line = this.buffer.slice(0, nl)
      this.buffer = this.buffer.slice(nl + 1)
      events.push(...parseLine(line))
    }
    return events
  }

  /** Flush any trailing buffered line (e.g. at process exit without newline). */
  flush(): ChatEvent[] {
    if (!this.buffer.trim()) {
      this.buffer = ''
      return []
    }
    const line = this.buffer
    this.buffer = ''
    return parseLine(line)
  }
}

/** Parse one stream-json line into zero or more ChatEvents. Pure, total. */
export function parseLine(line: string): ChatEvent[] {
  const trimmed = line.trim()
  if (!trimmed) return []
  let msg: Record<string, unknown>
  try {
    msg = JSON.parse(trimmed) as Record<string, unknown>
  } catch {
    return []
  }
  if (!msg || typeof msg.type !== 'string') return []

  switch (msg.type) {
    case 'assistant':
      return contentBlocks(msg).flatMap(blockToEvents)
    case 'result':
      return [
        {
          kind: 'result',
          text: typeof msg.result === 'string' ? msg.result : '',
          isError: msg.is_error === true || msg.subtype === 'error_max_turns' || msg.subtype === 'error_during_execution',
        },
      ]
    case 'system':
      return [{ kind: 'system', subtype: typeof msg.subtype === 'string' ? msg.subtype : 'unknown' }]
    default:
      return []
  }
}

function contentBlocks(msg: Record<string, unknown>): Record<string, unknown>[] {
  const message = msg.message
  if (!message || typeof message !== 'object') return []
  const content = (message as Record<string, unknown>).content
  if (!Array.isArray(content)) return []
  return content.filter((b): b is Record<string, unknown> => !!b && typeof b === 'object')
}

function blockToEvents(block: Record<string, unknown>): ChatEvent[] {
  if (block.type === 'text' && typeof block.text === 'string') {
    return [{ kind: 'assistant_text', text: block.text }]
  }
  if (block.type === 'tool_use' && typeof block.name === 'string') {
    return [{ kind: 'tool_use', name: block.name, input: block.input ?? null }]
  }
  return []
}

/** Encode a user turn as a stream-json input line (newline added by the caller). */
export function encodeUserTurn(text: string): string {
  return JSON.stringify({
    type: 'user',
    message: { role: 'user', content: [{ type: 'text', text }] },
  })
}
