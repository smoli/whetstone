import type { ChatEvent, ClaudeError } from '@shared/chat'
import { AUTH_EXPIRED_MESSAGE, isAuthErrorText } from '@shared/chat'
import { StreamParser, encodeUserTurn } from './stream-parser'

/** Minimal child-process surface the harness needs — injectable for tests. */
export interface ChildLike {
  /** OS process id, for tree-killing the child's descendants. */
  pid?: number
  stdin: { write(data: string): void }
  stdout: { on(event: 'data', cb: (chunk: Buffer | string) => void): void }
  stderr?: { on(event: 'data', cb: (chunk: Buffer | string) => void): void }
  on(event: 'exit', cb: (code: number | null) => void): unknown
  on(event: 'error', cb: (err: Error) => void): unknown
  kill(): void
}

export type SpawnFn = (command: string, args: string[], options: { cwd: string }) => ChildLike

export interface ClaudeHarnessOptions {
  spawn: SpawnFn
  /** Workspace dir; the spawned claude's cwd so the teach skill's paths resolve. */
  workspaceRoot: string
  claudePath?: string
  /** Extra argv, e.g. ['--mcp-config', path] to connect the bridge MCP server. */
  extraArgs?: string[]
  /**
   * Kill the child's whole process tree. On Windows a bare `kill()` leaves
   * claude's descendants (node, ripgrep, MCP) orphaned; inject a tree-killer
   * (e.g. `taskkill /T /F`) to reap them. Omitted → falls back to `kill()`.
   */
  killTree?: (pid: number) => void
}

/**
 * Wraps a long-lived `claude` subprocess in stream-json mode. Synthesized turns
 * are written to stdin; stdout is parsed into ChatEvents. Failures surface as a
 * typed ClaudeError — never raw.
 */
export class ClaudeHarness {
  private readonly parser = new StreamParser()
  private child: ChildLike | null = null
  private stopped = false
  /** Whether an auth failure was already surfaced for the current turn. */
  private authReported = false
  private eventCb: (e: ChatEvent) => void = () => {}
  private errorCb: (e: ClaudeError) => void = () => {}
  private closeCb: () => void = () => {}

  constructor(private readonly opts: ClaudeHarnessOptions) {}

  start(): void {
    const args = [
      '--print',
      '--input-format',
      'stream-json',
      '--output-format',
      'stream-json',
      '--verbose',
      ...(this.opts.extraArgs ?? []),
    ]
    const child = this.opts.spawn(this.opts.claudePath ?? 'claude', args, { cwd: this.opts.workspaceRoot })
    this.child = child

    child.stdout.on('data', (chunk) => {
      for (const ev of this.parser.push(chunk.toString())) {
        if (!this.interceptAuth(ev)) this.eventCb(ev)
      }
    })
    // Surface claude's stderr (incl. --verbose / MCP connection diagnostics) to
    // the dev console; never forwarded to the chat UI. A 401 can land here too.
    child.stderr?.on('data', (chunk) => {
      const text = chunk.toString().trimEnd()
      if (text) console.error('[claude]', text)
      if (text && isAuthErrorText(text)) this.reportAuth()
    })
    child.on('error', (err) => {
      this.errorCb({ kind: 'error', message: safeMessage(err) })
    })
    child.on('exit', (code) => {
      for (const ev of this.parser.flush()) {
        if (!this.interceptAuth(ev)) this.eventCb(ev)
      }
      // A surfaced auth failure already explains the exit — don't double-report.
      if (!this.stopped && code !== 0 && code !== null && !this.authReported) {
        this.errorCb({ kind: 'error', message: `the teaching agent exited unexpectedly`, code })
      }
      this.closeCb()
    })
  }

  send(prompt: string): void {
    if (!this.child) throw new Error('harness not started')
    // A new turn may succeed where the last failed (e.g. after re-login).
    this.authReported = false
    this.child.stdin.write(encodeUserTurn(prompt) + '\n')
  }

  /**
   * Turn an auth-failure event into a typed, actionable error and swallow the
   * raw 401 text so it never lands in the transcript. Also drops the generic
   * error-result that trails an already-reported auth failure. Returns true if
   * the event was handled (and should not be forwarded).
   */
  private interceptAuth(ev: ChatEvent): boolean {
    const text = ev.kind === 'assistant_text' || ev.kind === 'result' ? ev.text : ''
    if (text && isAuthErrorText(text)) {
      this.reportAuth()
      return true
    }
    if (ev.kind === 'result' && ev.isError && this.authReported) return true
    return false
  }

  private reportAuth(): void {
    if (this.authReported) return
    this.authReported = true
    this.errorCb({ kind: 'error', reason: 'auth', message: AUTH_EXPIRED_MESSAGE })
  }

  onEvent(cb: (e: ChatEvent) => void): void {
    this.eventCb = cb
  }
  onError(cb: (e: ClaudeError) => void): void {
    this.errorCb = cb
  }
  onClose(cb: () => void): void {
    this.closeCb = cb
  }

  stop(): void {
    this.stopped = true
    const pid = this.child?.pid
    if (this.opts.killTree && typeof pid === 'number') this.opts.killTree(pid)
    else this.child?.kill()
  }
}

/** Forward synthesized bridge prompts to the harness as user turns. */
export function wireBridgeToClaude(
  bridge: { onPrompt(cb: (prompt: string) => void): void },
  harness: { send(prompt: string): void },
): void {
  bridge.onPrompt((prompt) => harness.send(prompt))
}

function safeMessage(err: Error): string {
  // Surface a short, user-readable reason — never a stack or anything sensitive.
  return err.message.includes('ENOENT')
    ? 'could not launch the teaching agent (claude not found on PATH)'
    : 'the teaching agent failed to start'
}
