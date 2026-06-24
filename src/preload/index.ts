import { contextBridge, ipcRenderer } from 'electron'
import { IPC, type TeachApi, type AppConfig } from '@shared/ipc'
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
  getConfig: () => ipcRenderer.invoke(IPC.getConfig) as Promise<AppConfig>,
  lessonUrl: (base, lessonId) => `${base}/lessons/${lessonId}.html`,
}

contextBridge.exposeInMainWorld('teach', api)
