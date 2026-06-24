import http from 'node:http'
import path from 'node:path'
import { promises as fs } from 'node:fs'
import { marked } from 'marked'
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
  /** Absolute path to the app's shipped assets (serves /teach-assets/, incl. bridge.js). */
  appAssetsRoot?: string
  /** Auto-inject the bridge config + bridge.js into served lesson HTML. Default true. */
  injectBridge?: boolean
  /** Port to bind; 0 picks a free ephemeral port (tests). */
  port?: number
  host?: string
}

/**
 * Thin HTTP + WebSocket server wrapping the Bridge:
 *   GET  /healthz          liveness
 *   POST /events           a LessonEvent → bridge.ingestEvent
 *   GET  /lessons/*        static lesson HTML (bridge auto-injected)
 *   GET  /assets/*         static shared assets from the workspace
 *   GET  /teach-assets/*   the app's shipped assets (bridge.js)
 *   WS   /ws               a lesson client; receives AgentCommand broadcasts
 */
export class LessonServer {
  private readonly server: http.Server
  private readonly wss: WebSocketServer
  private readonly opts: LessonServerOptions
  private host = '127.0.0.1'
  private port = 0

  constructor(opts: LessonServerOptions) {
    this.opts = opts
    this.host = opts.host ?? '127.0.0.1'
    this.server = http.createServer((req, res) => {
      this.handle(req, res).catch((err) => {
        res.statusCode = 500
        res.end(JSON.stringify({ ok: false, error: 'internal error' }))
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
      this.server.listen(this.opts.port ?? 0, this.host, () => {
        const addr = this.server.address()
        this.port = typeof addr === 'object' && addr ? addr.port : 0
        resolve(this.port)
      })
    })
  }

  close(): Promise<void> {
    return new Promise((resolve) => {
      this.wss.clients.forEach((c) => c.terminate())
      this.wss.close(() => this.server.close(() => resolve()))
    })
  }

  /** Base HTTP origin once listening, e.g. http://127.0.0.1:51234. */
  httpBase(): string {
    return `http://${this.host}:${this.port}`
  }

  wsUrl(): string {
    return `ws://${this.host}:${this.port}/ws`
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

    if (req.method === 'GET' && url.pathname.startsWith('/doc/')) {
      return this.serveDoc(url.pathname.slice('/doc/'.length), res)
    }

    if (req.method === 'GET' && url.pathname.startsWith('/teach-assets/')) {
      if (!this.opts.appAssetsRoot) return json(res, 404, { ok: false, error: 'not found' })
      const rel = url.pathname.slice('/teach-assets/'.length)
      return this.serveFrom(this.opts.appAssetsRoot, rel, res, false, '')
    }

    if (
      req.method === 'GET' &&
      (url.pathname.startsWith('/lessons/') ||
        url.pathname.startsWith('/reference/') ||
        url.pathname.startsWith('/assets/'))
    ) {
      const rel = decodeURIComponent(url.pathname.replace(/^\/+/, ''))
      const lessonId = lessonIdFromPath(url.pathname)
      return this.serveFrom(this.opts.workspaceRoot, rel, res, true, lessonId)
    }

    console.warn('[lesson-server] no route:', req.method, url.pathname)
    return json(res, 404, { ok: false, error: 'not found' })
  }

  private async serveFrom(
    root: string,
    rel: string,
    res: http.ServerResponse,
    allowInject: boolean,
    lessonId: string,
  ): Promise<void> {
    const abs = path.resolve(root, decodeURIComponent(rel))
    const rootWithSep = path.resolve(root) + path.sep
    if (!abs.startsWith(rootWithSep)) {
      return json(res, 403, { ok: false, error: 'forbidden' })
    }
    const ext = path.extname(abs)
    try {
      if (allowInject && ext === '.html' && this.opts.injectBridge !== false) {
        const html = await fs.readFile(abs, 'utf8')
        const injected = await this.injectBridge(html, lessonId)
        res.statusCode = 200
        res.setHeader('content-type', CONTENT_TYPES['.html'])
        res.end(injected)
        return
      }
      const data = await fs.readFile(abs)
      res.statusCode = 200
      res.setHeader('content-type', CONTENT_TYPES[ext] ?? 'application/octet-stream')
      res.end(data)
    } catch {
      // A missing content page is shown in the iframe, so render a friendly page
      // instead of raw JSON. Sub-resources (assets) keep the JSON 404.
      if (allowInject && ext === '.html') return this.serveNotFound(path.basename(rel), res)
      return json(res, 404, { ok: false, error: 'not found' })
    }
  }

  private serveNotFound(name: string, res: http.ServerResponse): void {
    res.statusCode = 404
    res.setHeader('content-type', CONTENT_TYPES['.html'])
    res.end(
      `<!doctype html><html lang="en"><head><meta charset="utf-8">` +
        `<meta name="viewport" content="width=device-width, initial-scale=1">` +
        `<link rel="stylesheet" href="/assets/lesson.css">` +
        `<style>body{display:grid;place-items:center;min-height:100vh;margin:0}` +
        `.nf{max-width:32rem;text-align:center;padding:2rem}` +
        `.nf h1{font-size:1.25rem}.nf p{color:var(--ink-soft,#5c544c)}</style></head>` +
        `<body><div class="nf"><h1>Not found</h1>` +
        `<p>“${escapeHtml(name)}” isn’t in this workspace yet. Ask your teacher to create it, ` +
        `or pick another item from the sidebar.</p></div></body></html>`,
    )
  }

  /** Render a workspace markdown doc (MISSION.md, etc.) to a styled HTML page. */
  private async serveDoc(name: string, res: http.ServerResponse): Promise<void> {
    const rel = decodeURIComponent(name)
    const abs = path.resolve(this.opts.workspaceRoot, rel)
    const rootWithSep = path.resolve(this.opts.workspaceRoot) + path.sep
    if (!abs.startsWith(rootWithSep) || !abs.endsWith('.md')) {
      return json(res, 403, { ok: false, error: 'forbidden' })
    }
    let md: string
    try {
      md = await fs.readFile(abs, 'utf8')
    } catch (err) {
      console.warn('[lesson-server] doc not found:', abs, (err as NodeJS.ErrnoException).code)
      return this.serveNotFound(rel, res)
    }
    const bodyHtml = marked.parse(md, { async: false, gfm: true })
    const page =
      `<!doctype html><html lang="en"><head><meta charset="utf-8">` +
      `<meta name="viewport" content="width=device-width, initial-scale=1">` +
      `<title>${rel}</title><link rel="stylesheet" href="/assets/lesson.css"></head>` +
      `<body><article class="lesson">${bodyHtml}</article></body></html>`
    const injected = await this.injectBridge(page, rel.replace(/\.md$/, ''))
    res.statusCode = 200
    res.setHeader('content-type', CONTENT_TYPES['.html'])
    res.end(injected)
  }

  /** Inject the bridge config global + bridge.js script just before </body>. */
  async injectBridge(html: string, lessonId: string): Promise<string> {
    const config = {
      base: this.httpBase(),
      lessonId,
      wsUrl: this.wsUrl(),
      patches: await this.readPatches(lessonId),
    }
    const snippet =
      `\n<script>window.__TEACH_BRIDGE__=${JSON.stringify(config)};</script>` +
      `\n<script src="/teach-assets/bridge.js"></script>\n`
    return html.includes('</body>') ? html.replace('</body>', snippet + '</body>') : html + snippet
  }

  /** Persisted patches for a lesson (from the BridgeCore sidecar), for replay on load. */
  private async readPatches(lessonId: string): Promise<unknown[]> {
    try {
      const raw = await fs.readFile(path.resolve(this.opts.workspaceRoot, 'lessons', `${lessonId}.patches.json`), 'utf8')
      const parsed = JSON.parse(raw)
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  }
}

function lessonIdFromPath(pathname: string): string {
  const file = (pathname.split('/').pop() ?? '').replace(/\.html?$/, '')
  const m = /^(\d+)/.exec(file)
  return m ? m[1] : file || 'unknown'
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] as string)
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
