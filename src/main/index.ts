import { app, BrowserWindow, ipcMain } from 'electron'
import { spawn } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { BridgeCore } from './bridge/bridge-core'
import { Bridge } from './bridge/bridge'
import { NodeWorkspaceFs } from './bridge/workspace-fs'
import { LessonServer } from './bridge/lesson-server'
import { ClaudeHarness, wireBridgeToClaude, type ChildLike } from './claude/harness'
import { startMcpHttp, type McpHttpHandle } from './mcp/mcp-http'
import { IPC, type AppConfig } from '@shared/ipc'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/** The active teaching workspace. Defaults to the bundled ExampleLesson. */
function resolveWorkspace(): string {
  const fromEnv = process.env.TEACH_WORKSPACE
  if (fromEnv) return path.resolve(fromEnv)
  return path.resolve(__dirname, '../../ExampleLesson')
}

interface Services {
  lessonServer: LessonServer
  mcp: McpHttpHandle
  harness: ClaudeHarness
  workspaceRoot: string
}

async function startServices(window: BrowserWindow): Promise<Services> {
  const workspaceRoot = resolveWorkspace()
  const appAssetsRoot = path.resolve(__dirname, '../../assets')

  const bridge = new Bridge(new BridgeCore(new NodeWorkspaceFs(workspaceRoot)))
  const lessonServer = new LessonServer({ bridge, workspaceRoot, appAssetsRoot, port: 0 })
  await lessonServer.listen()

  const mcp = await startMcpHttp(bridge)

  const harness = new ClaudeHarness({
    spawn: (command, args, options) => spawn(command, args, { cwd: options.cwd }) as unknown as ChildLike,
    workspaceRoot,
    // bypassPermissions: the spawned agent drives a trusted local workspace and
    // headless mode can't answer permission prompts — it needs file ops + the
    // teach-bridge MCP tools (mcp__teach-bridge__*) without prompting.
    extraArgs: ['--mcp-config', mcp.configPath, '--permission-mode', 'bypassPermissions'],
  })
  harness.onEvent((e) => window.webContents.send(IPC.chatEvent, e))
  harness.onError((e) => window.webContents.send(IPC.chatError, e))
  harness.start()
  wireBridgeToClaude(bridge, harness)

  // The teach skill has disable-model-invocation: true, so it must be invoked
  // explicitly. Bootstrap the session once with /teach; the skill then reads the
  // workspace (MISSION.md, lessons/, learning-records/) and its guidance stays in
  // context for every later turn and lesson event.
  let sessionStarted = false
  ipcMain.on(IPC.startSession, () => {
    if (sessionStarted) return
    sessionStarted = true
    harness.send('/teach')
  })

  ipcMain.on(IPC.sendChat, (_e, text: string) => harness.send(text))
  ipcMain.handle(IPC.listLessons, async () => {
    const names = await new NodeWorkspaceFs(workspaceRoot).list('lessons')
    return names.filter((n) => n.endsWith('.html')).sort()
  })
  ipcMain.handle(IPC.getConfig, (): AppConfig => ({
    lessonBase: lessonServer.httpBase(),
    workspaceName: path.basename(workspaceRoot),
  }))

  return { lessonServer, mcp, harness, workspaceRoot }
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
  app.on('before-quit', () => {
    services.harness.stop()
    void services.lessonServer.close()
    void services.mcp.close()
  })

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
