import { contextBridge, ipcRenderer } from 'electron'
import { IPC, type TeachApi, type AppConfig, type LauncherState, type GitResult, type GitInfo } from '@shared/ipc'
import type { ChatEvent, ClaudeError, ChatMessage } from '@shared/chat'

const api: TeachApi = {
  sendChat: (text) => ipcRenderer.send(IPC.sendChat, text),
  startSession: () => ipcRenderer.send(IPC.startSession),
  saveSession: (messages: ChatMessage[]) => ipcRenderer.send(IPC.saveSession, messages),
  setModel: (model: string) => ipcRenderer.send(IPC.setModel, model),
  onChatEvent: (cb) => {
    const listener = (_e: unknown, payload: ChatEvent) => cb(payload)
    ipcRenderer.on(IPC.chatEvent, listener)
    return () => ipcRenderer.removeListener(IPC.chatEvent, listener)
  },
  onChatError: (cb) => {
    const listener = (_e: unknown, payload: ClaudeError) => cb(payload)
    ipcRenderer.on(IPC.chatError, listener)
    return () => ipcRenderer.removeListener(IPC.chatError, listener)
  },
  listLessons: () => ipcRenderer.invoke(IPC.listLessons) as Promise<string[]>,
  listReferences: () => ipcRenderer.invoke(IPC.listReferences) as Promise<string[]>,
  listDocs: () => ipcRenderer.invoke(IPC.listDocs) as Promise<string[]>,
  openExternal: (url: string) => ipcRenderer.send(IPC.openExternal, url),
  revealWorkspace: () => ipcRenderer.send(IPC.revealWorkspace),
  getConfig: () => ipcRenderer.invoke(IPC.getConfig) as Promise<AppConfig>,
  lessonUrl: (base, lessonId) => `${base}/lessons/${lessonId}.html`,
  getLauncher: () => ipcRenderer.invoke(IPC.getLauncher) as Promise<LauncherState>,
  openFolder: () => ipcRenderer.invoke(IPC.openFolder) as Promise<AppConfig | null>,
  openRecent: (path: string) => ipcRenderer.invoke(IPC.openRecent, path) as Promise<AppConfig | null>,
  newSession: (topic: string) => ipcRenderer.invoke(IPC.newSession, topic) as Promise<AppConfig | null>,
  gitCommit: (message: string) => ipcRenderer.invoke(IPC.gitCommit, message) as Promise<GitResult>,
  gitInfo: () => ipcRenderer.invoke(IPC.gitInfo) as Promise<GitInfo>,
  gitPush: (remoteUrl: string | null) => ipcRenderer.invoke(IPC.gitPush, remoteUrl) as Promise<GitResult>,
  minimizeWindow: () => ipcRenderer.send(IPC.winMinimize),
  toggleMaximizeWindow: () => ipcRenderer.send(IPC.winMaximizeToggle),
  closeWindow: () => ipcRenderer.send(IPC.winClose),
  onMaximizeChange: (cb) => {
    const listener = (_e: unknown, maximized: boolean) => cb(maximized)
    ipcRenderer.on(IPC.winMaximizedChanged, listener)
    return () => ipcRenderer.removeListener(IPC.winMaximizedChanged, listener)
  },
}

contextBridge.exposeInMainWorld('teach', api)
