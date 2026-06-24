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
  getConfig: 'teach:getConfig',
  getLauncher: 'teach:getLauncher',
  openFolder: 'teach:openFolder',
  openRecent: 'teach:openRecent',
  newSession: 'teach:newSession',
  gitCommit: 'teach:gitCommit',
} as const

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
}

export interface GitResult {
  ok: boolean
  /** User-readable outcome or error. */
  message: string
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
}

declare global {
  interface Window {
    teach: TeachApi
  }
}
