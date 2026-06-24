import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron'
import { spawn, execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { existsSync, promises as fsp } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { BridgeCore } from './bridge/bridge-core'
import { Bridge } from './bridge/bridge'
import { NodeWorkspaceFs } from './bridge/workspace-fs'
import { LessonServer } from './bridge/lesson-server'
import { ClaudeHarness, wireBridgeToClaude, type ChildLike } from './claude/harness'
import { MODELS, buildExtraArgs, parseSessionFile, shouldFallbackToFresh, type SessionFile } from './claude/session'
import { scaffoldSession, needsOverwriteConfirm, type ScaffoldDeps } from './workspace/scaffold'
import { addRecent, removeRecent, parseAppState, type AppState } from './workspace/app-config'
import { extractMissionTitle } from './workspace/mission'
import { startMcpHttp } from './mcp/mcp-http'
import { isExternalUrl } from '@shared/links'
import { IPC, type AppConfig, type GitResult, type LauncherState } from '@shared/ipc'
import type { ChatEvent, ChatMessage } from '@shared/chat'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const SESSION_FILE = '.teach-desktop.json'
const repoRoot = path.resolve(__dirname, '../..')
const appAssetsRoot = path.join(repoRoot, 'assets')
const templateAssets = path.join(repoRoot, 'ExampleLesson', 'assets')
const pexec = promisify(execFile)

let mainWindow: BrowserWindow | null = null
let session: Session | null = null
let appState: AppState = { recent: [], lastWorkspace: null, openedAt: {} }
let ipcReady = false

async function runGit(args: string[], cwd: string): Promise<string> {
  const { stdout } = await pexec('git', args, { cwd })
  return stdout
}

// ── app-level persisted state (recents) ─────────────────────────────────────

function appStatePath(): string {
  return path.join(app.getPath('userData'), 'teach-desktop.json')
}
async function loadAppState(): Promise<void> {
  try {
    appState = parseAppState(await fsp.readFile(appStatePath(), 'utf8'))
  } catch {
    appState = { recent: [], lastWorkspace: null, openedAt: {} }
  }
}
async function saveAppState(): Promise<void> {
  await fsp.writeFile(appStatePath(), JSON.stringify(appState, null, 2), 'utf8')
}

// ── per-workspace session ───────────────────────────────────────────────────

interface Session {
  workspaceRoot: string
  getConfig(): AppConfig
  sendChat(text: string): void
  startSession(): void
  saveSession(messages: ChatMessage[]): void
  setModel(model: string): void
  listLessons(): Promise<string[]>
  listReferences(): Promise<string[]>
  gitCommit(message: string): Promise<GitResult>
  stop(): void
}

async function createSession(workspaceRoot: string): Promise<Session> {
  const wfs = new NodeWorkspaceFs(workspaceRoot)
  const bridge = new Bridge(new BridgeCore(wfs))
  const lessonServer = new LessonServer({ bridge, workspaceRoot, appAssetsRoot, port: 0 })
  await lessonServer.listen()
  const mcp = await startMcpHttp(bridge)

  // Use the workspace's own skill if present; otherwise lend the app's via --add-dir.
  const ownsSkill = existsSync(path.join(workspaceRoot, '.claude', 'skills', 'teach', 'SKILL.md'))
  const skillHome = existsSync(path.join(repoRoot, '.claude', 'skills', 'teach', 'SKILL.md')) ? repoRoot : null

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
  let stopping = false
  let sessionStarted = resumedAtLaunch
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
        skillHome: ownsSkill ? null : skillHome,
      }),
    })
    const fallbackIfNeeded = (): void => {
      // Only a genuinely unexpected exit of the *current* harness warrants a
      // fallback — never one we stopped on purpose (reopen) or replaced (model
      // switch). Otherwise an idle resumed session (no init yet) would spuriously
      // re-run /teach when torn down.
      if (stopping || h !== harness) return
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
      mainWindow?.webContents.send(IPC.chatEvent, e)
    })
    h.onError((e) => {
      mainWindow?.webContents.send(IPC.chatError, e)
      fallbackIfNeeded()
    })
    h.onClose(() => fallbackIfNeeded())
    h.start()
    return h
  }
  harness = makeHarness()
  wireBridgeToClaude(bridge, { send: (p) => harness.send(p) })

  return {
    workspaceRoot,
    getConfig: () => ({
      lessonBase: lessonServer.httpBase(),
      workspaceName: path.basename(workspaceRoot),
      model: state.model,
      models: MODELS,
      resumed: resumedAtLaunch,
      messages: state.messages,
    }),
    sendChat: (text) => harness.send(text),
    startSession: () => {
      if (sessionStarted) return
      sessionStarted = true
      harness.send('/teach')
    },
    saveSession: (messages) => {
      state.messages = messages
      void persist()
    },
    setModel: (model) => {
      if (model === state.model) return
      state.model = model
      void persist()
      harness.stop()
      harness = makeHarness()
    },
    listLessons: async () => (await wfs.list('lessons')).filter((n) => n.endsWith('.html')).sort(),
    listReferences: async () => (await wfs.list('reference')).filter((n) => n.endsWith('.html')).sort(),
    gitCommit: async (message) => {
      try {
        await runGit(['add', '-A'], workspaceRoot)
        await runGit(['commit', '-m', message.trim() || 'Update teaching session'], workspaceRoot)
        return { ok: true, message: 'Committed.' }
      } catch (err) {
        const out = (err as { stdout?: string; stderr?: string }).stdout ?? ''
        if (/nothing to commit/i.test(out)) return { ok: false, message: 'Nothing to commit.' }
        return { ok: false, message: 'Commit failed (is git configured?).' }
      }
    },
    stop: () => {
      stopping = true
      harness.stop()
      void lessonServer.close()
      void mcp.close()
    },
  }
}

async function openWorkspace(workspaceRoot: string): Promise<AppConfig> {
  session?.stop()
  session = await createSession(workspaceRoot)
  appState.recent = addRecent(appState.recent, workspaceRoot)
  appState.lastWorkspace = workspaceRoot
  appState.openedAt = { ...appState.openedAt, [workspaceRoot]: new Date().toISOString() }
  await saveAppState()
  return session.getConfig()
}

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'teaching-session'
}

// ── IPC (registered once) ───────────────────────────────────────────────────

function registerIpc(): void {
  if (ipcReady) return
  ipcReady = true

  ipcMain.handle(IPC.getLauncher, async (): Promise<LauncherState> => {
    const recent = await Promise.all(
      appState.recent
        .filter((p) => existsSync(p))
        .map(async (p) => {
          const md = await fsp.readFile(path.join(p, 'MISSION.md'), 'utf8').catch(() => null)
          const subtitle = extractMissionTitle(md) ?? undefined
          return { path: p, name: path.basename(p), subtitle, openedAt: appState.openedAt[p] }
        }),
    )
    return { recent, hasWorkspace: !!session }
  })

  ipcMain.handle(IPC.openFolder, async (): Promise<AppConfig | null> => {
    if (!mainWindow) return null
    const res = await dialog.showOpenDialog(mainWindow, { properties: ['openDirectory'] })
    if (res.canceled || !res.filePaths[0]) return null
    return openWorkspace(res.filePaths[0])
  })

  ipcMain.handle(IPC.openRecent, async (_e, p: string): Promise<AppConfig | null> => {
    if (!existsSync(p)) {
      appState.recent = removeRecent(appState.recent, p)
      await saveAppState()
      return null
    }
    return openWorkspace(p)
  })

  ipcMain.handle(IPC.newSession, async (_e, topic: string): Promise<AppConfig | null> => {
    if (!mainWindow) return null
    const res = await dialog.showSaveDialog(mainWindow, {
      title: 'Create teaching session',
      defaultPath: path.join(app.getPath('documents'), slug(topic)),
      buttonLabel: 'Create',
    })
    if (res.canceled || !res.filePath) return null
    const targetDir = res.filePath

    // Guard against clobbering an existing session/folder.
    if (existsSync(targetDir)) {
      const entries = await fsp.readdir(targetDir).catch(() => [] as string[])
      if (needsOverwriteConfirm(entries)) {
        const choice = await dialog.showMessageBox(mainWindow, {
          type: 'warning',
          buttons: ['Cancel', 'Create here anyway'],
          defaultId: 0,
          cancelId: 0,
          message: 'This folder already exists and isn’t empty.',
          detail:
            `${targetDir}\n\nCreating a session here may overwrite MISSION.md, ` +
            `assets, and the skill, and re-initialise git. Continue?`,
        })
        if (choice.response !== 1) return null
      }
    }

    const deps: ScaffoldDeps = {
      exec: (file, args, cwd) => pexec(file, args, { cwd }).then((r) => r.stdout),
      readFile: (p) => fsp.readFile(p, 'utf8'),
      writeFile: async (p, content) => {
        await fsp.mkdir(path.dirname(p), { recursive: true })
        await fsp.writeFile(p, content, 'utf8')
      },
      mkdir: (p) => fsp.mkdir(p, { recursive: true }).then(() => undefined),
    }
    await scaffoldSession({ repoRoot, assetsSource: templateAssets, targetDir, topic }, deps)
    return openWorkspace(targetDir)
  })

  ipcMain.handle(IPC.gitCommit, (_e, message: string): Promise<GitResult> => {
    if (!session) return Promise.resolve({ ok: false, message: 'No workspace open.' })
    return session.gitCommit(message)
  })

  ipcMain.on(IPC.startSession, () => session?.startSession())
  ipcMain.on(IPC.sendChat, (_e, text: string) => session?.sendChat(text))
  ipcMain.on(IPC.saveSession, (_e, messages: ChatMessage[]) => session?.saveSession(messages))
  ipcMain.on(IPC.setModel, (_e, model: string) => session?.setModel(model))
  ipcMain.handle(IPC.listLessons, () => session?.listLessons() ?? Promise.resolve([]))
  ipcMain.handle(IPC.listReferences, () => session?.listReferences() ?? Promise.resolve([]))
  ipcMain.on(IPC.openExternal, (_e, url: string) => {
    if (/^https?:\/\//i.test(url) || /^mailto:/i.test(url)) void shell.openExternal(url)
  })
  ipcMain.handle(IPC.getConfig, () => session?.getConfig() ?? null)
}

async function createWindow(): Promise<void> {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    title: 'Whetstone',
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.mjs'),
      contextIsolation: true,
      sandbox: false,
    },
  })
  registerIpc()

  // External links in lesson/reference pages (rendered in an iframe) open in the
  // OS browser; loopback navigation (other lessons/references) stays in-app.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (isExternalUrl(url)) void shell.openExternal(url)
    return { action: 'deny' }
  })
  mainWindow.webContents.on('will-frame-navigate', (event) => {
    if (isExternalUrl(event.url)) {
      event.preventDefault()
      void shell.openExternal(event.url)
    }
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    await mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    await mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(async () => {
  await loadAppState()
  await createWindow()
})

app.on('before-quit', () => session?.stop())

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) void createWindow()
})
