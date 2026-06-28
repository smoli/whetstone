/**
 * PATH repair for GUI-launched packaged apps.
 *
 * A macOS/Linux app started from Finder/Dock (rather than a terminal) inherits a
 * minimal PATH (`/usr/bin:/bin:/usr/sbin:/sbin`) that omits Homebrew, nvm, and
 * `~/.local/bin` — so the spawned `claude` (and the tools it shells out to) can't
 * be found, and the agent silently hangs. Re-importing the login shell's PATH and
 * merging well-known bin dirs fixes that. Kept pure so the merge is unit-tested
 * without spawning a shell.
 */

/** Likely locations of the `claude` CLI and its toolchain, given a home dir. */
export function commonBinDirs(homedir: string, sep = '/'): string[] {
  const home = (rel: string): string => [homedir, ...rel.split('/')].join(sep)
  return [
    '/opt/homebrew/bin',
    '/usr/local/bin',
    home('.local/bin'),
    home('.claude/local'),
    home('.npm-global/bin'),
    home('.bun/bin'),
  ]
}

/**
 * Append `dirs` not already present in `current`, preserving the existing entries
 * and their precedence. Returns the merged PATH string.
 */
export function mergeMissingPaths(current: string, dirs: string[], sep = ':'): string {
  const parts = current ? current.split(sep).filter(Boolean) : []
  const seen = new Set(parts)
  for (const dir of dirs) {
    if (dir && !seen.has(dir)) {
      parts.push(dir)
      seen.add(dir)
    }
  }
  return parts.join(sep)
}
