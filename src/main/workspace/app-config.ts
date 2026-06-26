import type { ThemeSource } from '@shared/ipc'

/** App-level config persisted in Electron userData (across workspaces). */
export interface AppState {
  /** Most-recent-first list of absolute workspace paths. */
  recent: string[]
  /** The workspace open when the app last closed, if any. */
  lastWorkspace: string | null
  /** Path → ISO timestamp it was last opened. */
  openedAt: Record<string, string>
  /** Color theme preference. */
  theme: ThemeSource
}

export const EMPTY_APP_STATE: AppState = { recent: [], lastWorkspace: null, openedAt: {}, theme: 'system' }

const THEMES: ThemeSource[] = ['system', 'light', 'dark']

const RECENT_CAP = 8

/** Add a workspace to the front of the recents list (deduped, capped). Pure. */
export function addRecent(recent: string[], workspacePath: string, cap = RECENT_CAP): string[] {
  const deduped = recent.filter((p) => p !== workspacePath)
  return [workspacePath, ...deduped].slice(0, cap)
}

/** Drop a workspace from recents (e.g. it no longer exists). Pure. */
export function removeRecent(recent: string[], workspacePath: string): string[] {
  return recent.filter((p) => p !== workspacePath)
}

/** Parse persisted app state, tolerating absence/corruption. */
export function parseAppState(raw: string | null): AppState {
  if (!raw) return { ...EMPTY_APP_STATE }
  try {
    const obj = JSON.parse(raw) as Partial<AppState>
    const openedAt: Record<string, string> = {}
    if (obj.openedAt && typeof obj.openedAt === 'object') {
      for (const [k, v] of Object.entries(obj.openedAt)) if (typeof v === 'string') openedAt[k] = v
    }
    return {
      recent: Array.isArray(obj.recent) ? obj.recent.filter((p): p is string => typeof p === 'string') : [],
      lastWorkspace: typeof obj.lastWorkspace === 'string' ? obj.lastWorkspace : null,
      openedAt,
      theme: THEMES.includes(obj.theme as ThemeSource) ? (obj.theme as ThemeSource) : 'system',
    }
  } catch {
    return { ...EMPTY_APP_STATE }
  }
}
