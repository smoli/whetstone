import type { ChatEvent, ClaudeError } from '@shared/chat'
import { StreamParser, encodeUserTurn } from './stream-parser'

/** Minimal child-process surface the harness needs — injectable for tests. */
export interface ChildLike {
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
      for (const ev of this.parser.push(chunk.toString())) this.eventCb(ev)
    })
    child.on('error', (err) => {
      this.errorCb({ kind: 'error', message: safeMessage(err) })
    })
    child.on('exit', (code) => {
      for (const ev of this.parser.flush()) this.eventCb(ev)
      if (!this.stopped && code !== 0 && code !== null) {
        this.errorCb({ kind: 'error', message: `the teaching agent exited unexpectedly`, code })
      }
      this.closeCb()
    })
  }

  send(prompt: string): void {
    if (!this.child) throw new Error('harness not started')
    this.child.stdin.write(encodeUserTurn(prompt) + '\n')
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
    this.child?.kill()
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
