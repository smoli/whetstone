import { app, BrowserWindow, ipcMain, dialog, shell, Menu, nativeTheme } from 'electron'
import { spawn, execFile, execFileSync } from 'node:child_process'
import { promisify } from 'node:util'
import { existsSync, promises as fsp } from 'node:fs'
import os from 'node:os'
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
import { pushErrorMessage, isDirty } from './workspace/git'
import { startMcpHttp } from './mcp/mcp-http'
import { isExternalUrl } from '@shared/links'
import {
  IPC,
  type AppConfig,
  type GitResult,
  type GitInfo,
  type LauncherState,
  type SkillUpdateInfo,
  type ThemeSource,
} from '@shared/ipc'
import { readSkillVersion, skillUpdateAvailable } from '@shared/skill-version'
import { mergeMissingPaths, commonBinDirs } from '@shared/path-env'
import type { ChatEvent, ChatMessage } from '@shared/chat'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const SESSION_FILE = '.teach-desktop.json'
// Bundled resources: in dev they live in the repo checkout; when packaged,
// electron-builder copies .claude/skills + assets into Resources/ (process.resourcesPath).
const resourceBase = app.isPackaged ? process.resourcesPath : path.resolve(__dirname, '../..')
const appAssetsRoot = path.join(resourceBase, 'assets')
// Bundled template sources for new sessions (no git/network — works packaged).
const templateAssets = appAssetsRoot
const skillSource = path.join(resourceBase, '.claude', 'skills', 'teach')
const pexec = promisify(execFile)

let mainWindow: BrowserWindow | null = null
let session: Session | null = null
let appState: AppState = { recent: [], lastWorkspace: null, openedAt: {}, theme: 'system' }
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
    appState = { recent: [], lastWorkspace: null, openedAt: {}, theme: 'system' }
  }
  // Drives prefers-color-scheme for the app chrome AND the lesson iframe.
  nativeTheme.themeSource = appState.theme
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
  listDocs(): Promise<string[]>
  gitCommit(message: string): Promise<GitResult>
  gitInfo(): Promise<GitInfo>
  gitPush(remoteUrl: string | null): Promise<GitResult>
  updateSkill(): Promise<SkillUpdateInfo>
  stop(): void
}

async function createSession(workspaceRoot: string): Promise<Session> {
  const wfs = new NodeWorkspaceFs(workspaceRoot)
  const bridge = new Bridge(new BridgeCore(wfs))
  const lessonServer = new LessonServer({ bridge, workspaceRoot, appAssetsRoot, port: 0 })
  await lessonServer.listen()
  const mcp = await startMcpHttp(bridge)

  // Use the workspace's own skill if present; otherwise lend the app's via --add-dir.
  const wsSkillFile = path.join(workspaceRoot, '.claude', 'skills', 'teach', 'SKILL.md')
  const ownsSkill = existsSync(wsSkillFile)
  const skillHome = existsSync(path.join(resourceBase, '.claude', 'skills', 'teach', 'SKILL.md'))
    ? resourceBase
    : null

  const readVersion = async (abs: string): Promise<string | null> => {
    try {
      return readSkillVersion(await fsp.readFile(abs, 'utf8'))
    } catch {
      return null
    }
  }
  // A workspace that owns a skill copy can fall behind the app's bundled skill.
  // (No copy → it borrows the app's latest via --add-dir, so there's nothing to update.)
  async function computeSkillUpdate(): Promise<SkillUpdateInfo | null> {
    if (!existsSync(wsSkillFile) || !skillHome) return null
    const bundledVersion = await readVersion(path.join(skillSource, 'SKILL.md'))
    const workspaceVersion = await readVersion(wsSkillFile)
    return { available: skillUpdateAvailable(bundledVersion, workspaceVersion), bundledVersion, workspaceVersion }
  }
  let skillUpdate = await computeSkillUpdate()
  // The version of the skill actually in use: the workspace's copy, else the app's bundled one.
  const skillVersion = ownsSkill
    ? await readVersion(wsSkillFile)
    : skillHome
      ? await readVersion(path.join(skillSource, 'SKILL.md'))
      : null

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
      // Windows: a bare kill() orphans claude's child tree (node, ripgrep, MCP).
      // taskkill /T reaps the whole tree; other platforms use the default kill().
      killTree:
        process.platform === 'win32'
          ? (pid) => void execFile('taskkill', ['/pid', String(pid), '/T', '/F'], () => {})
          : undefined,
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
      skillUpdate,
      skillVersion,
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
    listDocs: async () => {
      const present = await Promise.all(
        ['MISSION.md', 'RESOURCES.md', 'NOTES.md'].map(async (n) => ((await wfs.read(n)) !== null ? n : null)),
      )
      return present.filter((n): n is string => n !== null)
    },
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
    gitInfo: async (): Promise<GitInfo> => {
      try {
        const branch = (await runGit(['rev-parse', '--abbrev-ref', 'HEAD'], workspaceRoot)).trim()
        let remoteUrl: string | null = null
        try {
          remoteUrl = (await runGit(['remote', 'get-url', 'origin'], workspaceRoot)).trim()
        } catch {
          /* no origin */
        }
        const dirty = isDirty(await runGit(['status', '--porcelain'], workspaceRoot))
        return { isRepo: true, branch, hasRemote: !!remoteUrl, remoteUrl, dirty }
      } catch {
        return { isRepo: false, branch: null, hasRemote: false, remoteUrl: null, dirty: false }
      }
    },
    gitPush: async (remoteUrl): Promise<GitResult> => {
      try {
        const branch = (await runGit(['rev-parse', '--abbrev-ref', 'HEAD'], workspaceRoot)).trim()
        let hasRemote = true
        try {
          await runGit(['remote', 'get-url', 'origin'], workspaceRoot)
        } catch {
          hasRemote = false
        }
        if (!hasRemote) {
          if (!remoteUrl?.trim()) return { ok: false, message: 'No remote set.' }
          await runGit(['remote', 'add', 'origin', remoteUrl.trim()], workspaceRoot)
        } else if (remoteUrl?.trim()) {
          await runGit(['remote', 'set-url', 'origin', remoteUrl.trim()], workspaceRoot)
        }
        // GIT_TERMINAL_PROMPT=0 so a missing credential fails fast instead of hanging.
        await pexec('git', ['push', '-u', 'origin', branch], {
          cwd: workspaceRoot,
          env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
        })
        return { ok: true, message: `Pushed to origin/${branch}.` }
      } catch (err) {
        const e = err as { stdout?: string; stderr?: string }
        return { ok: false, message: pushErrorMessage((e.stderr ?? '') + (e.stdout ?? '')) }
      }
    },
    updateSkill: async (): Promise<SkillUpdateInfo> => {
      const dest = path.join(workspaceRoot, '.claude', 'skills', 'teach')
      if (skillHome) {
        // Replace the workspace copy wholesale so files removed upstream don't linger.
        await fsp.rm(dest, { recursive: true, force: true })
        await fsp.cp(skillSource, dest, { recursive: true })
      }
      skillUpdate = (await computeSkillUpdate()) ?? {
        available: false,
        bundledVersion: null,
        workspaceVersion: null,
      }
      return skillUpdate
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
    return { recent, hasWorkspace: !!session, version: app.getVersion() }
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
      copyDir: (src, dest) => fsp.cp(src, dest, { recursive: true }),
    }
    await scaffoldSession({ skillSource, assetsSource: templateAssets, targetDir, topic }, deps)
    return openWorkspace(targetDir)
  })

  ipcMain.handle(IPC.gitCommit, (_e, message: string): Promise<GitResult> => {
    if (!session) return Promise.resolve({ ok: false, message: 'No workspace open.' })
    return session.gitCommit(message)
  })
  ipcMain.handle(IPC.gitInfo, (): Promise<GitInfo> => {
    if (!session) return Promise.resolve({ isRepo: false, branch: null, hasRemote: false, remoteUrl: null, dirty: false })
    return session.gitInfo()
  })
  ipcMain.handle(IPC.gitPush, (_e, remoteUrl: string | null): Promise<GitResult> => {
    if (!session) return Promise.resolve({ ok: false, message: 'No workspace open.' })
    return session.gitPush(remoteUrl)
  })
  ipcMain.handle(IPC.updateSkill, (): Promise<SkillUpdateInfo> => {
    if (!session) return Promise.resolve({ available: false, bundledVersion: null, workspaceVersion: null })
    return session.updateSkill()
  })
  ipcMain.handle(IPC.reopenWorkspace, (): Promise<AppConfig | null> => {
    if (!session) return Promise.resolve(null)
    return openWorkspace(session.workspaceRoot)
  })
  ipcMain.handle(IPC.getTheme, (): ThemeSource => appState.theme)
  ipcMain.handle(IPC.setTheme, async (_e, source: ThemeSource): Promise<void> => {
    appState.theme = source
    nativeTheme.themeSource = source
    await saveAppState()
  })

  ipcMain.on(IPC.startSession, () => session?.startSession())
  ipcMain.on(IPC.sendChat, (_e, text: string) => session?.sendChat(text))
  ipcMain.on(IPC.saveSession, (_e, messages: ChatMessage[]) => session?.saveSession(messages))
  ipcMain.on(IPC.setModel, (_e, model: string) => session?.setModel(model))
  ipcMain.handle(IPC.listLessons, () => session?.listLessons() ?? Promise.resolve([]))
  ipcMain.handle(IPC.listReferences, () => session?.listReferences() ?? Promise.resolve([]))
  ipcMain.handle(IPC.listDocs, () => session?.listDocs() ?? Promise.resolve([]))
  ipcMain.on(IPC.openExternal, (_e, url: string) => {
    if (/^https?:\/\//i.test(url) || /^mailto:/i.test(url)) void shell.openExternal(url)
  })
  ipcMain.on(IPC.revealWorkspace, () => {
    if (session) void shell.openPath(session.workspaceRoot)
  })
  ipcMain.handle(IPC.getConfig, () => session?.getConfig() ?? null)

  // Custom titlebar window controls (the window is frameless).
  ipcMain.on(IPC.winMinimize, () => mainWindow?.minimize())
  ipcMain.on(IPC.winMaximizeToggle, () => {
    if (!mainWindow) return
    if (mainWindow.isMaximized()) mainWindow.unmaximize()
    else mainWindow.maximize()
  })
  ipcMain.on(IPC.winClose, () => mainWindow?.close())
}

async function createWindow(): Promise<void> {
  // No native application/menu bar — the app uses its own custom titlebar.
  Menu.setApplicationMenu(null)
  const isMac = process.platform === 'darwin'
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    title: 'Whetstone',
    icon: path.join(__dirname, '../../build/icon.png'),
    // macOS: keep the native traffic-light controls (hidden titlebar), nudged to
    // sit vertically centered in our 2.3rem titlebar. Other platforms are fully
    // frameless with the custom controls drawn in TitleBar.vue.
    ...(isMac
      ? { titleBarStyle: 'hidden' as const, trafficLightPosition: { x: 13, y: 11 } }
      : { frame: false }),
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#1a1714' : '#f6f0e6',
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.mjs'),
      contextIsolation: true,
      sandbox: false,
    },
  })
  // Tell the renderer when to swap the maximize/restore glyph.
  mainWindow.on('maximize', () => mainWindow?.webContents.send(IPC.winMaximizedChanged, true))
  mainWindow.on('unmaximize', () => mainWindow?.webContents.send(IPC.winMaximizedChanged, false))
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

/**
 * Repair PATH for the packaged GUI app. An app launched from Finder/Dock (not a
 * terminal) inherits a minimal PATH that omits Homebrew, nvm, and ~/.local/bin —
 * so the spawned `claude` and the tools it runs can't be found and the agent
 * silently hangs ("Thinking…" forever, no first Bash call). Import the login
 * shell's PATH and merge well-known bin dirs. No-op in dev and on Windows.
 */
function repairEnvPath(): void {
  if (process.platform === 'win32' || !app.isPackaged) return
  try {
    const shell = process.env.SHELL || '/bin/zsh'
    // -ilc: a login+interactive shell so it sources the profile files where users
    // actually set PATH (e.g. ~/.zshrc); `command printf` dodges aliases.
    const out = execFileSync(shell, ['-ilc', 'command printf %s "$PATH"'], {
      encoding: 'utf8',
      timeout: 5000,
    }).trim()
    if (out) process.env.PATH = out
  } catch {
    // Login shell unavailable/slow — fall through to the static merge below.
  }
  process.env.PATH = mergeMissingPaths(process.env.PATH ?? '', commonBinDirs(os.homedir()))
}

app.whenReady().then(async () => {
  repairEnvPath()
  await loadAppState()
  await createWindow()
})

app.on('before-quit', () => session?.stop())

// Quit when the window is closed on every platform, including macOS (the default
// there is to keep the app alive in the Dock; this app has no use for that).
app.on('window-all-closed', () => {
  app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) void createWindow()
})
