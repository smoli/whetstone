import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { AppConfig, ModelOption } from '@shared/ipc'
import type { ChatMessage } from '@shared/chat'

/** A lesson file ("0004-the-vertical-slice.html") → its stem ("0004-the-vertical-slice"). */
function stem(file: string): string {
  return file.replace(/\.html?$/, '')
}

export const useWorkspaceStore = defineStore('workspace', () => {
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

  async function load(): Promise<void> {
    const cfg = await window.teach.getConfig()
    config.value = cfg
    model.value = cfg.model
    models.value = cfg.models
    session.value = { messages: cfg.messages, resumed: cfg.resumed }
    lessons.value = await window.teach.listLessons()
    if (!currentLesson.value && lessons.value.length) currentLesson.value = lessons.value[0]
  }

  function open(file: string): void {
    currentLesson.value = file
  }

  function setModel(id: string): void {
    if (id === model.value) return
    model.value = id
    window.teach.setModel(id)
  }

  return { config, lessons, currentLesson, currentUrl, model, models, session, load, open, setModel }
})
