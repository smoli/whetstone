import type { ChatEvent, ClaudeError } from './chat'

/** IPC channel names — single source of truth for main + preload. */
export const IPC = {
  sendChat: 'teach:sendChat',
  chatEvent: 'teach:chatEvent',
  chatError: 'teach:chatError',
  listLessons: 'teach:listLessons',
  getConfig: 'teach:getConfig',
} as const

export interface AppConfig {
  /** HTTP origin of the lesson server, e.g. http://127.0.0.1:51234. */
  lessonBase: string
  /** Name of the active workspace (directory basename). */
  workspaceName: string
}

/** The typed surface the preload exposes to the renderer as `window.teach`. */
export interface TeachApi {
  sendChat(text: string): void
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
