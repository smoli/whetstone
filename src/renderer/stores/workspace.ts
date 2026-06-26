import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { AppConfig, ModelOption, RecentWorkspace, GitResult, GitInfo, SkillUpdateInfo } from '@shared/ipc'
import type { ChatMessage } from '@shared/chat'

export type ContentSection = 'lessons' | 'reference' | 'doc'
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
  const docs = ref<string[]>([])
  const current = ref<ContentRef | null>(null)
  const history = ref<ContentRef[]>([])
  const histIndex = ref(-1)
  const model = ref('default')
  const models = ref<ModelOption[]>([])
  const session = ref<{ messages: ChatMessage[]; resumed: boolean }>({ messages: [], resumed: false })
  const git = ref<GitInfo>({ isRepo: false, branch: null, hasRemote: false, remoteUrl: null, dirty: false })
  const version = ref('')
  const skillUpdate = ref<SkillUpdateInfo | null>(null)

  const currentUrl = computed(() => {
    if (!config.value || !current.value) return null
    return `${config.value.lessonBase}/${current.value.section}/${current.value.file}`
  })

  const canBack = computed(() => histIndex.value > 0)
  const canForward = computed(() => histIndex.value < history.value.length - 1)

  function sameRef(a: ContentRef | null, b: ContentRef | null): boolean {
    return !!a && !!b && a.section === b.section && a.file === b.file
  }

  /** Go to a content ref, pushing onto history (truncating any forward entries). */
  function navigate(ref: ContentRef): void {
    if (sameRef(current.value, ref)) return
    current.value = ref
    history.value = [...history.value.slice(0, histIndex.value + 1), ref]
    histIndex.value = history.value.length - 1
  }

  async function loadLists(): Promise<void> {
    lessons.value = await window.teach.listLessons()
    references.value = await window.teach.listReferences()
    docs.value = await window.teach.listDocs()
  }

  /**
   * Reload content lists; if the agent just created new lesson(s), open the
   * newest in the content view (so it shows in-app rather than the OS browser).
   */
  async function refreshContents(): Promise<void> {
    const prev = new Set(lessons.value)
    await loadLists()
    const added = lessons.value.filter((f) => !prev.has(f))
    if (added.length) navigate({ section: 'lessons', file: added[added.length - 1] })
    // The agent may have changed files this turn — keep the git dirty state live.
    git.value = await window.teach.gitInfo()
  }

  async function applyConfig(cfg: AppConfig): Promise<void> {
    config.value = cfg
    model.value = cfg.model
    models.value = cfg.models
    session.value = { messages: cfg.messages, resumed: cfg.resumed }
    await loadLists()
    // Default the content view to the most recent lesson.
    history.value = []
    histIndex.value = -1
    current.value = null
    const initial = lessons.value.length
      ? { section: 'lessons' as const, file: lessons.value[lessons.value.length - 1] }
      : references.value.length
        ? { section: 'reference' as const, file: references.value[0] }
        : null
    if (initial) navigate(initial)
    skillUpdate.value = cfg.skillUpdate
    git.value = await window.teach.gitInfo()
    active.value = true
  }

  async function loadLauncher(): Promise<void> {
    const l = await window.teach.getLauncher()
    recent.value = l.recent
    version.value = l.version
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
    navigate({ section, file })
  }

  /** A page loaded in the content iframe announced itself (incl. in-page links). */
  function onNavigated(section: ContentSection, file: string): void {
    // Canonicalize against the known list so a mis-cased path still highlights.
    const list = section === 'lessons' ? lessons.value : section === 'reference' ? references.value : docs.value
    const canonical = list.find((f) => f.toLowerCase() === file.toLowerCase()) ?? file
    navigate({ section, file: canonical })
  }

  function back(): void {
    if (!canBack.value) return
    histIndex.value -= 1
    current.value = history.value[histIndex.value]
  }

  function forward(): void {
    if (!canForward.value) return
    histIndex.value += 1
    current.value = history.value[histIndex.value]
  }

  function setModel(id: string): void {
    if (id === model.value) return
    model.value = id
    window.teach.setModel(id)
  }

  async function commit(message: string): Promise<GitResult> {
    const res = await window.teach.gitCommit(message)
    git.value = await window.teach.gitInfo()
    return res
  }

  async function push(remoteUrl: string | null): Promise<GitResult> {
    const res = await window.teach.gitPush(remoteUrl)
    git.value = await window.teach.gitInfo()
    return res
  }

  function revealWorkspace(): void {
    window.teach.revealWorkspace()
  }

  /** Open the currently displayed content in the OS default browser. */
  function openCurrentInBrowser(): void {
    if (currentUrl.value) window.teach.openExternal(currentUrl.value)
  }

  /** Overwrite the workspace's teach skill with the app's bundled copy. */
  async function updateSkill(): Promise<void> {
    skillUpdate.value = await window.teach.updateSkill()
  }

  /** Dismiss the update offer for this session without changing the skill. */
  function dismissSkillUpdate(): void {
    if (skillUpdate.value) skillUpdate.value = { ...skillUpdate.value, available: false }
  }

  return {
    active, recent, config, lessons, references, docs, current, currentUrl, canBack, canForward, model, models, session, git, version, skillUpdate,
    loadLauncher, openFolder, openRecent, newSession, toLauncher, openItem, onNavigated, back, forward,
    refreshContents, setModel, commit, push, revealWorkspace, openCurrentInBrowser, updateSkill, dismissSkillUpdate,
  }
})
