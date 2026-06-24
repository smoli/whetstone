import type { ModelOption } from '@shared/ipc'
import type { ChatMessage } from '@shared/chat'

/** Selectable models. 'default' omits --model (claude's configured default). */
export const MODELS: ModelOption[] = [
  { id: 'default', label: 'Default' },
  { id: 'opus', label: 'Opus 4.8' },
  { id: 'sonnet', label: 'Sonnet 4.6' },
  { id: 'haiku', label: 'Haiku 4.5' },
]

/** Per-workspace persisted desktop session. */
export interface SessionFile {
  sessionId: string | null
  model: string
  messages: ChatMessage[]
  updatedAt: string
}

export interface BuildArgsOptions {
  mcpConfigPath: string
  /** Model id; 'default'/empty omits the flag. */
  model?: string
  /** Resume this session id instead of starting fresh. */
  resumeId?: string | null
  /** Dir whose .claude/skills/ should be loaded regardless of cwd. */
  skillHome?: string | null
}

/**
 * Build the extra argv for the claude subprocess. Pure so the resume/model/skill
 * wiring is testable without spawning anything.
 */
export function buildExtraArgs(opts: BuildArgsOptions): string[] {
  const args = ['--mcp-config', opts.mcpConfigPath, '--permission-mode', 'bypassPermissions']
  if (opts.skillHome) args.push('--add-dir', opts.skillHome)
  if (opts.model && opts.model !== 'default') args.push('--model', opts.model)
  if (opts.resumeId) args.push('--resume', opts.resumeId)
  return args
}

/** Parse a persisted session file; returns null if absent/corrupt. */
export function parseSessionFile(raw: string | null): SessionFile | null {
  if (!raw) return null
  try {
    const obj = JSON.parse(raw) as Partial<SessionFile>
    return {
      sessionId: typeof obj.sessionId === 'string' ? obj.sessionId : null,
      model: typeof obj.model === 'string' ? obj.model : 'default',
      messages: Array.isArray(obj.messages) ? (obj.messages as ChatMessage[]) : [],
      updatedAt: typeof obj.updatedAt === 'string' ? obj.updatedAt : '',
    }
  } catch {
    return null
  }
}
