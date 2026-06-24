import { describe, it, expect, beforeEach } from 'vitest'
import { ClaudeHarness, wireBridgeToClaude, type ChildLike, type SpawnFn } from './harness'
import type { ChatEvent, ClaudeError } from '@shared/chat'

/** Controllable fake child process. */
class FakeChild implements ChildLike {
  stdinWrites: string[] = []
  killed = false
  private handlers: Record<string, ((arg: never) => void)[]> = {}
  stdoutData: ((chunk: string) => void)[] = []
  stderrData: ((chunk: string) => void)[] = []

  stdin = { write: (d: string) => void this.stdinWrites.push(d) }
  stdout = { on: (_e: 'data', cb: (c: string) => void) => void this.stdoutData.push(cb) }
  stderr = { on: (_e: 'data', cb: (c: string) => void) => void this.stderrData.push(cb) }

  on(event: 'exit', cb: (code: number | null) => void): this
  on(event: 'error', cb: (err: Error) => void): this
  on(event: string, cb: (arg: never) => void): this {
    ;(this.handlers[event] ??= []).push(cb)
    return this
  }
  kill() {
    this.killed = true
  }

  emitStdout(chunk: string) {
    this.stdoutData.forEach((cb) => cb(chunk))
  }
  emitExit(code: number | null) {
    ;(this.handlers.exit ?? []).forEach((cb) => (cb as (c: number | null) => void)(code))
  }
  emitError(err: Error) {
    ;(this.handlers.error ?? []).forEach((cb) => (cb as (e: Error) => void)(err))
  }
}

let child: FakeChild
let spawned: { command: string; args: string[]; cwd: string } | null
const spawn: SpawnFn = (command, args, options) => {
  spawned = { command, args, cwd: options.cwd }
  child = new FakeChild()
  return child
}

function makeHarness() {
  return new ClaudeHarness({ spawn, workspaceRoot: '/ws/game-design', claudePath: 'claude' })
}

beforeEach(() => {
  spawned = null
})

describe('ClaudeHarness.start', () => {
  it('spawns claude in the workspace cwd requesting stream-json both ways', () => {
    makeHarness().start()
    expect(spawned?.command).toBe('claude')
    expect(spawned?.cwd).toBe('/ws/game-design')
    expect(spawned?.args).toContain('stream-json')
    expect(spawned?.args.join(' ')).toContain('--input-format')
    expect(spawned?.args.join(' ')).toContain('--output-format')
  })

  it('passes extra args (e.g. mcp config) through', () => {
    new ClaudeHarness({ spawn, workspaceRoot: '/ws', extraArgs: ['--mcp-config', '/tmp/mcp.json'] }).start()
    expect(spawned?.args).toContain('--mcp-config')
    expect(spawned?.args).toContain('/tmp/mcp.json')
  })
})

describe('ClaudeHarness.send', () => {
  it('writes a stream-json user turn to stdin', () => {
    const h = makeHarness()
    h.start()
    h.send('teach me about slices')
    expect(child.stdinWrites).toHaveLength(1)
    expect(child.stdinWrites[0].endsWith('\n')).toBe(true)
    const parsed = JSON.parse(child.stdinWrites[0])
    expect(parsed.message.content[0].text).toBe('teach me about slices')
  })
})

describe('ClaudeHarness stdout → events', () => {
  it('emits mapped ChatEvents, buffering partial lines', () => {
    const h = makeHarness()
    const events: ChatEvent[] = []
    h.onEvent((e) => events.push(e))
    h.start()
    const line = JSON.stringify({ type: 'assistant', message: { content: [{ type: 'text', text: 'hi' }] } })
    child.emitStdout(line.slice(0, 10))
    expect(events).toHaveLength(0)
    child.emitStdout(line.slice(10) + '\n')
    expect(events).toEqual([{ kind: 'assistant_text', text: 'hi' }])
  })
})

describe('ClaudeHarness errors (never raw)', () => {
  it('surfaces a spawn error as a typed ClaudeError', () => {
    const h = makeHarness()
    const errors: ClaudeError[] = []
    h.onError((e) => errors.push(e))
    h.start()
    child.emitError(new Error('ENOENT claude not found'))
    expect(errors).toHaveLength(1)
    expect(errors[0].kind).toBe('error')
    expect(typeof errors[0].message).toBe('string')
  })

  it('treats a non-zero exit as an error with the code, and closes', () => {
    const h = makeHarness()
    const errors: ClaudeError[] = []
    let closed = false
    h.onError((e) => errors.push(e))
    h.onClose(() => (closed = true))
    h.start()
    child.emitExit(1)
    expect(errors[0].code).toBe(1)
    expect(closed).toBe(true)
  })

  it('a clean exit closes without an error', () => {
    const h = makeHarness()
    const errors: ClaudeError[] = []
    let closed = false
    h.onError((e) => errors.push(e))
    h.onClose(() => (closed = true))
    h.start()
    child.emitExit(0)
    expect(errors).toHaveLength(0)
    expect(closed).toBe(true)
  })
})

describe('wireBridgeToClaude', () => {
  it('forwards synthesized bridge prompts to the harness as user turns', () => {
    const sent: string[] = []
    const fakeBridge = { onPrompt: (cb: (p: string) => void) => cb('synthesized prompt') }
    const fakeHarness = { send: (p: string) => void sent.push(p) }
    wireBridgeToClaude(fakeBridge, fakeHarness)
    expect(sent).toEqual(['synthesized prompt'])
  })
})
