import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { WebSocket } from 'ws'
import { LessonServer } from './lesson-server'
import { Bridge } from './bridge'
import { BridgeCore } from './bridge-core'
import { NodeWorkspaceFs } from './workspace-fs'

const TS = '2026-06-24T10:00:00.000Z'

let root: string
let server: LessonServer
let bridge: Bridge
let base: string

let appAssets: string

beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'teach-srv-'))
  appAssets = await fs.mkdtemp(path.join(os.tmpdir(), 'teach-app-'))
  await fs.mkdir(path.join(root, 'lessons'), { recursive: true })
  await fs.writeFile(path.join(root, 'lessons', '0004.html'), '<html><body><h1>Lesson 4</h1></body></html>')
  await fs.writeFile(path.join(appAssets, 'bridge.js'), '/* bridge */')
  bridge = new Bridge(new BridgeCore(new NodeWorkspaceFs(root)))
  server = new LessonServer({ bridge, workspaceRoot: root, appAssetsRoot: appAssets, port: 0 })
  const port = await server.listen()
  base = `http://127.0.0.1:${port}`
})

afterEach(async () => {
  await server.close()
  await fs.rm(root, { recursive: true, force: true })
  await fs.rm(appAssets, { recursive: true, force: true })
})

describe('LessonServer', () => {
  it('serves health', async () => {
    const res = await fetch(`${base}/healthz`)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })
  })

  it('serves static lesson HTML', async () => {
    const res = await fetch(`${base}/lessons/0004.html`)
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('text/html')
    expect(await res.text()).toContain('Lesson 4')
  })

  it('injects the bridge config + bridge.js into served lesson HTML', async () => {
    const html = await (await fetch(`${base}/lessons/0004.html`)).text()
    expect(html).toContain('__TEACH_BRIDGE__')
    expect(html).toContain('"lessonId":"0004"')
    expect(html).toContain('/teach-assets/bridge.js')
    // injected before the closing body tag
    expect(html.indexOf('teach-assets/bridge.js')).toBeLessThan(html.indexOf('</body>'))
  })

  it('replays persisted patches by injecting them into the bridge config', async () => {
    await fs.writeFile(
      path.join(root, 'lessons', '0004.patches.json'),
      JSON.stringify([{ selector: '.aside', mode: 'replace', html: '<div class="aside">moved</div>' }]),
    )
    const html = await (await fetch(`${base}/lessons/0004.html`)).text()
    expect(html).toContain('"patches"')
    expect(html).toContain('moved')
  })

  it('injects an empty patches array when there is no sidecar', async () => {
    const html = await (await fetch(`${base}/lessons/0004.html`)).text()
    expect(html).toContain('"patches":[]')
  })

  it('shows a friendly HTML page (not raw JSON) for a missing content page', async () => {
    const res = await fetch(`${base}/lessons/9999-missing.html`)
    expect(res.status).toBe(404)
    expect(res.headers.get('content-type')).toContain('text/html')
    const body = await res.text()
    expect(body).toContain('Not found')
    expect(body).not.toContain('"ok":false')
  })

  it('renders a workspace markdown doc to HTML at /doc/', async () => {
    await fs.writeFile(path.join(root, 'MISSION.md'), '# Mission: Learn chess\n\nBecause **endgames**.')
    const res = await fetch(`${base}/doc/MISSION.md`)
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('text/html')
    const html = await res.text()
    expect(html).toContain('<h1>Mission: Learn chess</h1>')
    expect(html).toContain('<strong>endgames</strong>')
    expect(html).toContain('/teach-assets/bridge.js') // bridge injected for nav sync
  })

  it('refuses non-markdown doc paths', async () => {
    expect((await fetch(`${base}/doc/secret.txt`)).status).toBe(403)
  })

  it('serves the app bridge.js from /teach-assets/', async () => {
    const res = await fetch(`${base}/teach-assets/bridge.js`)
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('javascript')
    expect(await res.text()).toContain('bridge')
  })

  it('accepts a valid event, records it, and emits a prompt', async () => {
    const prompts: string[] = []
    bridge.onPrompt((p) => prompts.push(p))
    const res = await fetch(`${base}/events`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        type: 'exercise_submission',
        eventId: 'e1',
        lessonId: '0004',
        promptId: 'slice',
        text: 'my vertical slice',
        ts: TS,
      }),
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.ok).toBe(true)
    expect(prompts).toHaveLength(1)
    // artifact actually landed on disk
    expect(await fs.readFile(path.join(root, 'lesson-entries', '0004-slice.md'), 'utf8')).toContain('my vertical slice')
  })

  it('rejects a malformed event with 422', async () => {
    const res = await fetch(`${base}/events`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ type: 'bogus' }),
    })
    expect(res.status).toBe(422)
    expect((await res.json()).ok).toBe(false)
  })

  it('rejects non-JSON with 400', async () => {
    const res = await fetch(`${base}/events`, { method: 'POST', body: 'not json{' })
    expect(res.status).toBe(400)
  })

  it('delivers an agent command broadcast to a connected WS lesson client', async () => {
    const ws = new WebSocket(`${base.replace('http', 'ws')}/ws`)
    const received = new Promise<string>((resolve) => ws.on('message', (d) => resolve(d.toString())))
    await new Promise<void>((resolve) => ws.on('open', () => resolve()))

    await bridge.runCommand({
      type: 'lesson_feedback',
      commandId: 'c1',
      lessonId: '0004',
      anchorId: 'slice',
      html: '<p>great LAND beat</p>',
      ts: TS,
    })

    const msg = JSON.parse(await received)
    expect(msg).toMatchObject({ type: 'lesson_feedback', lessonId: '0004', anchorId: 'slice' })
    ws.close()
  })
})
