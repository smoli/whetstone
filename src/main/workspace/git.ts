/** True if `git status --porcelain` reports any uncommitted change. Pure. */
export function isDirty(porcelain: string): boolean {
  return (porcelain || '').split('\n').some((line) => line.trim().length > 0)
}

/** A single changed path with a normalized status, for the commit-time file list. */
export interface ChangedFile {
  path: string
  status: 'modified' | 'added' | 'deleted' | 'renamed' | 'untracked'
}

/**
 * Parse `git status --porcelain` into a list of changed files. Pure + testable.
 * Each line is `XY <path>`; renames are `XY old -> new` (we keep the new path).
 */
export function parseChangedFiles(porcelain: string): ChangedFile[] {
  return (porcelain || '')
    .split('\n')
    .filter((line) => line.trim().length > 0)
    .map((line) => {
      const code = line.slice(0, 2)
      let path = line.slice(3).trim()
      if (path.includes(' -> ')) path = path.slice(path.indexOf(' -> ') + 4).trim()
      return { path, status: classify(code) }
    })
}

function classify(code: string): ChangedFile['status'] {
  if (code === '??') return 'untracked'
  if (code.includes('R')) return 'renamed'
  if (code.includes('A')) return 'added'
  if (code.includes('D')) return 'deleted'
  return 'modified'
}

/** Map raw `git push` output to a short, user-safe message. Pure + testable. */
export function pushErrorMessage(out: string): string {
  const o = (out || '').toLowerCase()
  if (/authentication failed|could not read username|permission denied|terminal prompts disabled|invalid credentials/.test(o)) {
    return 'Push failed: authentication required — check your git credentials.'
  }
  if (/non-fast-forward|fetch first|rejected|tip of your current branch is behind/.test(o)) {
    return 'Push rejected: the remote has newer commits. Pull/merge first.'
  }
  if (/could not resolve host|unable to access|connection (refused|timed out)|timed out/.test(o)) {
    return 'Push failed: could not reach the remote.'
  }
  if (/no configured push destination|no such remote|does not appear to be a git repository|no upstream/.test(o)) {
    return 'Push failed: no remote configured.'
  }
  return 'Push failed.'
}
