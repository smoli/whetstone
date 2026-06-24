import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { AppConfig, ModelOption, RecentWorkspace, GitResult } from '@shared/ipc'
import type { ChatMessage } from '@shared/chat'

/** A lesson file ("0004-the-vertical-slice.html") → its stem ("0004-the-vertical-slice"). */
function stem(file: string): string {
  return file.replace(/\.html?$/, '')
}

export const useWorkspaceStore = defineStore('workspace', () => {
  const active = ref(false)
  const recent = ref<RecentWorkspace[]>([])
  const config = ref<AppConfig | null>(null)
  const lessons = ref<string[]>([])
  const currentLesson = ref<string | null>(null)
  const model = ref('default')
  const models = ref<ModelOption[]>([])
  const session = ref<{ messages: ChatMessage[]; resumed: boolean }>({ messages: [], resumed: false })

  const currentUrl = computed(() => {
    if (!config.value || !currentLesson.value) return null
    return window.teach.lessonUrl(config.value.lessonBase, stem(currentLesson.value))
  })

  async function applyConfig(cfg: AppConfig): Promise<void> {
    config.value = cfg
    model.value = cfg.model
    models.value = cfg.models
    session.value = { messages: cfg.messages, resumed: cfg.resumed }
    lessons.value = await window.teach.listLessons()
    currentLesson.value = lessons.value[0] ?? null
    active.value = true
  }

  /** Load launcher state; if a workspace is already open, hydrate it. */
  async function loadLauncher(): Promise<void> {
    const l = await window.teach.getLauncher()
    recent.value = l.recent
    if (l.hasWorkspace) {
      const cfg = await window.teach.getConfig()
      if (cfg) await applyConfig(cfg)
    }
  }

  async function openFolder(): Promise<boolean> {
    const cfg = await window.teach.openFolder()
    if (cfg) await applyConfig(cfg)
    return !!cfg
  }

  async function openRecent(path: string): Promise<boolean> {
    const cfg = await window.teach.openRecent(path)
    if (cfg) await applyConfig(cfg)
    return !!cfg
  }

  async function newSession(topic: string): Promise<boolean> {
    const cfg = await window.teach.newSession(topic)
    if (cfg) await applyConfig(cfg)
    return !!cfg
  }

  function toLauncher(): void {
    active.value = false
  }

  function open(file: string): void {
    currentLesson.value = file
  }

  function setModel(id: string): void {
    if (id === model.value) return
    model.value = id
    window.teach.setModel(id)
  }

  function commit(message: string): Promise<GitResult> {
    return window.teach.gitCommit(message)
  }

  return {
    active, recent, config, lessons, currentLesson, currentUrl, model, models, session,
    loadLauncher, openFolder, openRecent, newSession, toLauncher, open, setModel, commit,
  }
})
