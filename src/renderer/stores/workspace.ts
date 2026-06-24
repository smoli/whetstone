import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { AppConfig } from '@shared/ipc'

/** A lesson file ("0004-the-vertical-slice.html") → its stem ("0004-the-vertical-slice"). */
function stem(file: string): string {
  return file.replace(/\.html?$/, '')
}

export const useWorkspaceStore = defineStore('workspace', () => {
  const config = ref<AppConfig | null>(null)
  const lessons = ref<string[]>([])
  const currentLesson = ref<string | null>(null)

  const currentUrl = computed(() => {
    if (!config.value || !currentLesson.value) return null
    return window.teach.lessonUrl(config.value.lessonBase, stem(currentLesson.value))
  })

  async function load(): Promise<void> {
    config.value = await window.teach.getConfig()
    lessons.value = await window.teach.listLessons()
    if (!currentLesson.value && lessons.value.length) currentLesson.value = lessons.value[0]
  }

  function open(file: string): void {
    currentLesson.value = file
  }

  return { config, lessons, currentLesson, currentUrl, load, open }
})
