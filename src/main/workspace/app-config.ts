/** App-level config persisted in Electron userData (across workspaces). */
export interface AppState {
  /** Most-recent-first list of absolute workspace paths. */
  recent: string[]
  /** The workspace open when the app last closed, if any. */
  lastWorkspace: string | null
}

export const EMPTY_APP_STATE: AppState = { recent: [], lastWorkspace: null }

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
    return {
      recent: Array.isArray(obj.recent) ? obj.recent.filter((p): p is string => typeof p === 'string') : [],
      lastWorkspace: typeof obj.lastWorkspace === 'string' ? obj.lastWorkspace : null,
    }
  } catch {
    return { ...EMPTY_APP_STATE }
  }
}
