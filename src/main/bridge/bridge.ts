import { EventEmitter } from 'node:events'
import {
  parseLessonEvent,
  parseAgentCommand,
} from '@shared/protocol'
import type { BridgeCore, WrittenArtifact, BroadcastMessage } from './bridge-core'

/** Anything that can receive a broadcast (a real WebSocket, or a fake in tests). */
export interface BroadcastClient {
  send(data: string): void
}

export type IngestResult =
  | { ok: true; fresh: boolean; artifacts: WrittenArtifact[] }
  | { ok: false; error: string }

export type CommandResult =
  | { ok: true; fresh: boolean; artifacts: WrittenArtifact[]; broadcasts: BroadcastMessage[] }
  | { ok: false; error: string }

/**
 * Coordinator that both the HTTP/WS lesson server and the MCP server delegate to.
 * Owns the BridgeCore, the set of connected lesson clients, and the channel that
 * hands synthesized prompts to the Claude harness.
 */
export class Bridge {
  private readonly clients = new Set<BroadcastClient>()
  private readonly emitter = new EventEmitter()

  constructor(private readonly core: BridgeCore) {}

  addClient(c: BroadcastClient): void {
    this.clients.add(c)
  }

  removeClient(c: BroadcastClient): void {
    this.clients.delete(c)
  }

  /** Subscribe to synthesized agent prompts produced by lesson events. */
  onPrompt(cb: (prompt: string) => void): void {
    this.emitter.on('prompt', cb)
  }

  /** Handle an untrusted lesson event payload (e.g. a POST body). */
  async ingestEvent(raw: unknown): Promise<IngestResult> {
    const parsed = parseLessonEvent(raw)
    if (!parsed.ok) return { ok: false, error: parsed.error }
    const res = await this.core.handleLessonEvent(parsed.value)
    if (res.prompt) this.emitter.emit('prompt', res.prompt)
    return { ok: true, fresh: res.fresh, artifacts: res.artifacts }
  }

  /** Handle an agent command (from the MCP server) and broadcast any lesson updates. */
  async runCommand(raw: unknown): Promise<CommandResult> {
    const parsed = parseAgentCommand(raw)
    if (!parsed.ok) return { ok: false, error: parsed.error }
    const res = await this.core.applyAgentCommand(parsed.value)
    for (const msg of res.broadcasts) this.broadcast(msg)
    return { ok: true, fresh: res.fresh, artifacts: res.artifacts, broadcasts: res.broadcasts }
  }

  private broadcast(msg: BroadcastMessage): void {
    const data = JSON.stringify(msg)
    for (const c of this.clients) c.send(data)
  }
}
