import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { AppConfig, ModelOption, RecentWorkspace, GitResult } from '@shared/ipc'
import type { ChatMessage } from '@shared/chat'

export type ContentSection = 'lessons' | 'reference'
export interface ContentRef {
  section: ContentSection
  file: string
}

export const useWorkspaceStore = defineStore('workspace', () => {
  const active = ref(false)
  const recent = ref<RecentWorkspace[]>([])
  const config = ref<AppConfig | null>(null)
  const lessons = ref<string[]>([])
  const references = ref<string[]>([])
  const current = ref<ContentRef | null>(null)
  const model = ref('default')
  const models = ref<ModelOption[]>([])
  const session = ref<{ messages: ChatMessage[]; resumed: boolean }>({ messages: [], resumed: false })

  const currentUrl = computed(() => {
    if (!config.value || !current.value) return null
    return `${config.value.lessonBase}/${current.value.section}/${current.value.file}`
  })

  async function refreshContents(): Promise<void> {
    lessons.value = await window.teach.listLessons()
    references.value = await window.teach.listReferences()
  }

  async function applyConfig(cfg: AppConfig): Promise<void> {
    config.value = cfg
    model.value = cfg.model
    models.value = cfg.models
    session.value = { messages: cfg.messages, resumed: cfg.resumed }
    await refreshContents()
    // Default the content view to the most recent lesson.
    current.value = lessons.value.length
      ? { section: 'lessons', file: lessons.value[lessons.value.length - 1] }
      : references.value.length
        ? { section: 'reference', file: references.value[0] }
        : null
    active.value = true
  }

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

  function openItem(section: ContentSection, file: string): void {
    current.value = { section, file }
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
    active, recent, config, lessons, references, current, currentUrl, model, models, session,
    loadLauncher, openFolder, openRecent, newSession, toLauncher, openItem, refreshContents, setModel, commit,
  }
})
