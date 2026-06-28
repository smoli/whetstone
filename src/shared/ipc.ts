import type { ChatEvent, ClaudeError, ChatMessage } from './chat'

/** IPC channel names — single source of truth for main + preload. */
export const IPC = {
  sendChat: 'teach:sendChat',
  startSession: 'teach:startSession',
  saveSession: 'teach:saveSession',
  setModel: 'teach:setModel',
  chatEvent: 'teach:chatEvent',
  chatError: 'teach:chatError',
  listLessons: 'teach:listLessons',
  listReferences: 'teach:listReferences',
  listDocs: 'teach:listDocs',
  openExternal: 'teach:openExternal',
  revealWorkspace: 'teach:revealWorkspace',
  getConfig: 'teach:getConfig',
  getLauncher: 'teach:getLauncher',
  openFolder: 'teach:openFolder',
  openRecent: 'teach:openRecent',
  newSession: 'teach:newSession',
  gitCommit: 'teach:gitCommit',
  gitInfo: 'teach:gitInfo',
  gitPush: 'teach:gitPush',
  updateSkill: 'teach:updateSkill',
  reopenWorkspace: 'teach:reopenWorkspace',
  getTheme: 'teach:getTheme',
  setTheme: 'teach:setTheme',
  winMinimize: 'teach:winMinimize',
  winMaximizeToggle: 'teach:winMaximizeToggle',
  winClose: 'teach:winClose',
  winMaximizedChanged: 'teach:winMaximizedChanged',
} as const

/** Color theme. 'system' follows the OS; the others force light/dark. */
export type ThemeSource = 'system' | 'light' | 'dark'

export interface ModelOption {
  /** Value passed to claude --model; 'default' means omit the flag. */
  id: string
  label: string
}

export interface AppConfig {
  /** HTTP origin of the lesson server, e.g. http://127.0.0.1:51234. */
  lessonBase: string
  /** Name of the active workspace (directory basename). */
  workspaceName: string
  /** Currently selected model id ('default' if unset). */
  model: string
  /** Selectable models. */
  models: ModelOption[]
  /** True when a prior session was resumed (so the renderer skips /teach). */
  resumed: boolean
  /** Transcript restored from the prior session, if any. */
  messages: ChatMessage[]
  /** Skill-update offer when the bundled teach skill is newer than the workspace's copy. */
  skillUpdate: SkillUpdateInfo | null
  /** Version of the teach skill currently in use (workspace copy, else bundled), if any. */
  skillVersion: string | null
}

/** State of the workspace's teach-skill copy vs the app's bundled version. */
export interface SkillUpdateInfo {
  /** True when the bundled skill is newer and the workspace owns a copy to update. */
  available: boolean
  /** Version bundled in the app (null if unversioned). */
  bundledVersion: string | null
  /** Version in the workspace's copy (null if unversioned / absent). */
  workspaceVersion: string | null
}

export interface RecentWorkspace {
  path: string
  name: string
  /** Mission title, if the workspace has a MISSION.md. */
  subtitle?: string
  /** ISO timestamp it was last opened. */
  openedAt?: string
}

export interface LauncherState {
  recent: RecentWorkspace[]
  /** True if a workspace is already open (e.g. restored on launch). */
  hasWorkspace: boolean
  /** App version (from package.json), e.g. "0.2.0". */
  version: string
}

export interface GitResult {
  ok: boolean
  /** User-readable outcome or error. */
  message: string
}

/** A changed path with a normalized status, shown in the commit-time file list. */
export interface GitChange {
  path: string
  status: 'modified' | 'added' | 'deleted' | 'renamed' | 'untracked'
}

export interface GitInfo {
  isRepo: boolean
  branch: string | null
  hasRemote: boolean
  remoteUrl: string | null
  /** True if the working tree has uncommitted changes (something to commit). */
  dirty: boolean
  /** The uncommitted changes (empty when clean), for the expandable file list. */
  changed: GitChange[]
}

/** The typed surface the preload exposes to the renderer as `window.teach`. */
export interface TeachApi {
  sendChat(text: string): void
  /** Bootstrap the teaching session by invoking the teach skill (idempotent). */
  startSession(): void
  /** Persist the current transcript so the next launch can resume it. */
  saveSession(messages: ChatMessage[]): void
  /** Switch the model; restarts the agent on the same (resumed) session. */
  setModel(model: string): void
  onChatEvent(cb: (e: ChatEvent) => void): () => void
  onChatError(cb: (e: ClaudeError) => void): () => void
  listLessons(): Promise<string[]>
  listReferences(): Promise<string[]>
  /** Workspace docs that exist (MISSION.md, RESOURCES.md, NOTES.md). */
  listDocs(): Promise<string[]>
  /** Open a URL in the system browser. */
  openExternal(url: string): void
  /** Reveal the active workspace folder in the OS file manager. */
  revealWorkspace(): void
  getConfig(): Promise<AppConfig>
  /** Build the URL to load a lesson by file stem, served by the lesson server. */
  lessonUrl(base: string, lessonId: string): string
  // ── workspace lifecycle ──
  /** Launcher state for the welcome screen. */
  getLauncher(): Promise<LauncherState>
  /** Pick a folder and open it as the active workspace. Null if cancelled. */
  openFolder(): Promise<AppConfig | null>
  /** Open a known workspace by path. Null if it no longer exists. */
  openRecent(path: string): Promise<AppConfig | null>
  /** Scaffold a new self-contained session (prompts for location), then open it. */
  newSession(topic: string): Promise<AppConfig | null>
  /** Stage all and commit the active workspace. */
  gitCommit(message: string): Promise<GitResult>
  /** Repo/remote status of the active workspace. */
  gitInfo(): Promise<GitInfo>
  /** Push the active workspace; sets 'origin' to remoteUrl first if given. */
  gitPush(remoteUrl: string | null): Promise<GitResult>
  /** Overwrite the workspace's teach skill with the app's bundled copy; returns the new state. */
  updateSkill(): Promise<SkillUpdateInfo>
  /** Recreate the current workspace's session (e.g. after a skill update); null if none open. */
  reopenWorkspace(): Promise<AppConfig | null>
  /** The persisted color-theme preference. */
  getTheme(): Promise<ThemeSource>
  /** Set and persist the color theme (drives nativeTheme → prefers-color-scheme). */
  setTheme(source: ThemeSource): Promise<void>
  // ── custom (frameless) window controls ──
  /** Host OS platform (process.platform), e.g. 'darwin' | 'win32' | 'linux'. */
  readonly platform: string
  minimizeWindow(): void
  /** Toggle maximize/restore of the main window. */
  toggleMaximizeWindow(): void
  closeWindow(): void
  /** Subscribe to maximize/restore changes (to swap the maximize/restore icon). */
  onMaximizeChange(cb: (maximized: boolean) => void): () => void
}

declare global {
  interface Window {
    teach: TeachApi
  }
}
