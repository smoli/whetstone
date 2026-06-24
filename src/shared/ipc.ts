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
  getConfig: 'teach:getConfig',
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
  getConfig(): Promise<AppConfig>
  /** Build the URL to load a lesson by file stem, served by the lesson server. */
  lessonUrl(base: string, lessonId: string): string
}

declare global {
  interface Window {
    teach: TeachApi
  }
}
