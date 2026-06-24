import { app, BrowserWindow, ipcMain } from 'electron'
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { BridgeCore } from './bridge/bridge-core'
import { Bridge } from './bridge/bridge'
import { NodeWorkspaceFs } from './bridge/workspace-fs'
import { LessonServer } from './bridge/lesson-server'
import { ClaudeHarness, wireBridgeToClaude, type ChildLike } from './claude/harness'
import { MODELS, buildExtraArgs, parseSessionFile, shouldFallbackToFresh, type SessionFile } from './claude/session'
import { startMcpHttp, type McpHttpHandle } from './mcp/mcp-http'
import { IPC, type AppConfig } from '@shared/ipc'
import type { ChatEvent, ChatMessage } from '@shared/chat'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const SESSION_FILE = '.teach-desktop.json'

/** The active teaching workspace. Defaults to the bundled ExampleLesson. */
function resolveWorkspace(): string {
  const fromEnv = process.env.TEACH_WORKSPACE
  if (fromEnv) return path.resolve(fromEnv)
  return path.resolve(__dirname, '../../ExampleLesson')
}

interface Services {
  lessonServer: LessonServer
  mcp: McpHttpHandle
  stop(): void
}

async function startServices(window: BrowserWindow): Promise<Services> {
  const workspaceRoot = resolveWorkspace()
  const appAssetsRoot = path.resolve(__dirname, '../../assets')
  const wfs = new NodeWorkspaceFs(workspaceRoot)

  const bridge = new Bridge(new BridgeCore(wfs))
  const lessonServer = new LessonServer({ bridge, workspaceRoot, appAssetsRoot, port: 0 })
  await lessonServer.listen()
  const mcp = await startMcpHttp(bridge)

  // Skill discovery: --add-dir loads .claude/skills/ from the app's skill home
  // regardless of the workspace cwd.
  const skillHome = path.resolve(__dirname, '../..')
  const hasSkill = existsSync(path.join(skillHome, '.claude', 'skills', 'teach', 'SKILL.md'))

  // Restore prior session (if any) so we can resume instead of re-running /teach.
  const persisted = parseSessionFile(await wfs.read(SESSION_FILE))
  const resumedAtLaunch = !!persisted?.sessionId
  const state: SessionFile = {
    sessionId: persisted?.sessionId ?? null,
    model: persisted?.model ?? 'default',
    messages: persisted?.messages ?? [],
    updatedAt: persisted?.updatedAt ?? '',
  }

  async function persist(): Promise<void> {
    state.updatedAt = new Date().toISOString()
    await wfs.write(SESSION_FILE, JSON.stringify(state, null, 2))
  }

  let harness: ClaudeHarness
  let fellBack = false
  let sessionStarted = resumedAtLaunch // resumed sessions need no /teach
  function makeHarness(): ClaudeHarness {
    const launchedWithResume = !!state.sessionId
    let gotInit = false
    const h = new ClaudeHarness({
      spawn: (command, args, options) => spawn(command, args, { cwd: options.cwd }) as unknown as ChildLike,
      workspaceRoot,
      extraArgs: buildExtraArgs({
        mcpConfigPath: mcp.configPath,
        model: state.model,
        resumeId: state.sessionId,
        skillHome: hasSkill ? skillHome : null,
      }),
    })
    // A stale/expired session id makes --resume fail before any init. Detect that
    // (no init seen) and self-heal: clear the id, restart fresh, re-run /teach.
    const fallbackIfNeeded = (): void => {
      if (!shouldFallbackToFresh({ launchedWithResume, gotInit, alreadyFellBack: fellBack })) return
      fellBack = true
      state.sessionId = null
      void persist()
      harness = makeHarness()
      sessionStarted = true
      harness.send('/teach')
    }
    h.onEvent((e: ChatEvent) => {
      if (e.kind === 'system' && e.subtype === 'init') gotInit = true
      if (e.kind === 'system' && e.sessionId && e.sessionId !== state.sessionId) {
        state.sessionId = e.sessionId
        void persist()
      }
      window.webContents.send(IPC.chatEvent, e)
    })
    h.onError((e) => {
      window.webContents.send(IPC.chatError, e)
      fallbackIfNeeded()
    })
    h.onClose(() => fallbackIfNeeded())
    h.start()
    return h
  }
  harness = makeHarness()
  // Wire bridge prompts to whichever harness is current (survives model switches).
  wireBridgeToClaude(bridge, { send: (p) => harness.send(p) })

  ipcMain.on(IPC.startSession, () => {
    if (sessionStarted) return
    sessionStarted = true
    harness.send('/teach')
  })
  ipcMain.on(IPC.sendChat, (_e, text: string) => harness.send(text))
  ipcMain.on(IPC.saveSession, (_e, messages: ChatMessage[]) => {
    state.messages = messages
    void persist()
  })
  ipcMain.on(IPC.setModel, (_e, model: string) => {
    if (model === state.model) return
    state.model = model
    void persist()
    // Restart the agent on the same (resumed) session so context is preserved.
    harness.stop()
    harness = makeHarness()
  })

  ipcMain.handle(IPC.listLessons, async () => {
    const names = await wfs.list('lessons')
    return names.filter((n) => n.endsWith('.html')).sort()
  })
  ipcMain.handle(
    IPC.getConfig,
    (): AppConfig => ({
      lessonBase: lessonServer.httpBase(),
      workspaceName: path.basename(workspaceRoot),
      model: state.model,
      models: MODELS,
      resumed: resumedAtLaunch,
      messages: state.messages,
    }),
  )

  return {
    lessonServer,
    mcp,
    stop: () => {
      harness.stop()
      void lessonServer.close()
      void mcp.close()
    },
  }
}

async function createWindow(): Promise<void> {
  const window = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.mjs'),
      contextIsolation: true,
      sandbox: false,
    },
  })

  const services = await startServices(window)
  app.on('before-quit', () => services.stop())

  if (process.env.ELECTRON_RENDERER_URL) {
    await window.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    await window.loadFile(path.join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(createWindow)

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) void createWindow()
})
