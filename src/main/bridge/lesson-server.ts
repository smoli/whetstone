import http from 'node:http'
import path from 'node:path'
import { promises as fs } from 'node:fs'
import { WebSocketServer, type WebSocket } from 'ws'
import type { Bridge, BroadcastClient } from './bridge'

const CONTENT_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.woff2': 'font/woff2',
}

export interface LessonServerOptions {
  bridge: Bridge
  /** Absolute path to the active teaching workspace (serves lessons/ and assets/). */
  workspaceRoot: string
  /** Port to bind; 0 picks a free ephemeral port (tests). */
  port?: number
  host?: string
}

/**
 * Thin HTTP + WebSocket server wrapping the Bridge:
 *   GET  /healthz        liveness
 *   POST /events         a LessonEvent → bridge.ingestEvent
 *   GET  /lessons/*      static lesson HTML from the workspace
 *   GET  /assets/*       static shared assets from the workspace
 *   WS   /ws             a lesson client; receives AgentCommand broadcasts
 */
export class LessonServer {
  private readonly server: http.Server
  private readonly wss: WebSocketServer
  private readonly opts: LessonServerOptions

  constructor(opts: LessonServerOptions) {
    this.opts = opts
    this.server = http.createServer((req, res) => {
      this.handle(req, res).catch((err) => {
        res.statusCode = 500
        res.end(JSON.stringify({ ok: false, error: 'internal error' }))
        // never leak err detail to the client; log server-side
        console.error('[lesson-server]', (err as Error).message)
      })
    })
    this.wss = new WebSocketServer({ server: this.server, path: '/ws' })
    this.wss.on('connection', (ws: WebSocket) => {
      const client: BroadcastClient = { send: (data) => ws.send(data) }
      this.opts.bridge.addClient(client)
      ws.on('close', () => this.opts.bridge.removeClient(client))
      ws.on('error', () => this.opts.bridge.removeClient(client))
    })
  }

  listen(): Promise<number> {
    return new Promise((resolve) => {
      this.server.listen(this.opts.port ?? 0, this.opts.host ?? '127.0.0.1', () => {
        const addr = this.server.address()
        resolve(typeof addr === 'object' && addr ? addr.port : 0)
      })
    })
  }

  close(): Promise<void> {
    return new Promise((resolve) => {
      this.wss.clients.forEach((c) => c.terminate())
      this.wss.close(() => this.server.close(() => resolve()))
    })
  }

  private async handle(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    const url = new URL(req.url ?? '/', 'http://localhost')

    if (req.method === 'GET' && url.pathname === '/healthz') {
      return json(res, 200, { ok: true })
    }

    if (req.method === 'POST' && url.pathname === '/events') {
      const body = await readBody(req)
      let payload: unknown
      try {
        payload = JSON.parse(body)
      } catch {
        return json(res, 400, { ok: false, error: 'invalid JSON' })
      }
      const result = await this.opts.bridge.ingestEvent(payload)
      return json(res, result.ok ? 200 : 422, result)
    }

    if (req.method === 'GET' && (url.pathname.startsWith('/lessons/') || url.pathname.startsWith('/assets/'))) {
      return this.serveStatic(url.pathname, res)
    }

    return json(res, 404, { ok: false, error: 'not found' })
  }

  private async serveStatic(pathname: string, res: http.ServerResponse): Promise<void> {
    const rel = decodeURIComponent(pathname.replace(/^\/+/, ''))
    const abs = path.resolve(this.opts.workspaceRoot, rel)
    const rootWithSep = path.resolve(this.opts.workspaceRoot) + path.sep
    if (!abs.startsWith(rootWithSep)) {
      return json(res, 403, { ok: false, error: 'forbidden' })
    }
    try {
      const data = await fs.readFile(abs)
      res.statusCode = 200
      res.setHeader('content-type', CONTENT_TYPES[path.extname(abs)] ?? 'application/octet-stream')
      res.end(data)
    } catch {
      return json(res, 404, { ok: false, error: 'not found' })
    }
  }
}

function json(res: http.ServerResponse, status: number, body: unknown): void {
  res.statusCode = status
  res.setHeader('content-type', 'application/json; charset=utf-8')
  res.end(JSON.stringify(body))
}

function readBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = ''
    req.on('data', (chunk) => {
      data += chunk
      if (data.length > 5_000_000) reject(new Error('body too large'))
    })
    req.on('end', () => resolve(data))
    req.on('error', reject)
  })
}
