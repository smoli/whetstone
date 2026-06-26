/**
 * Skill versioning — used to offer a workspace an update when the app bundles a
 * newer copy of the teach skill. The version lives in SKILL.md's YAML
 * frontmatter (under `metadata: version:`, the spec's place for custom fields;
 * a top-level `version:` is also accepted).
 */

/** Extract the skill version from a SKILL.md, scanning only the frontmatter. */
export function readSkillVersion(skillMd: string): string | null {
  const m = /^---\r?\n([\s\S]*?)\r?\n---/.exec(skillMd)
  if (!m) return null
  const fm = m[1]
  const line = /^\s*version:\s*(.+?)\s*$/m.exec(fm)
  if (!line) return null
  return line[1].replace(/^['"]|['"]$/g, '').trim() || null
}

/** Numeric semver-ish comparison. A missing/blank version sorts oldest. */
export function compareVersions(a: string | null, b: string | null): number {
  const pa = parts(a)
  const pb = parts(b)
  const len = Math.max(pa.length, pb.length)
  for (let i = 0; i < len; i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0)
    if (d !== 0) return d < 0 ? -1 : 1
  }
  return 0
}

/** True when the bundled skill is strictly newer than the workspace's copy. */
export function skillUpdateAvailable(bundled: string | null, current: string | null): boolean {
  if (!bundled) return false // unknown bundled version → nothing to offer
  return compareVersions(bundled, current) > 0
}

function parts(v: string | null): number[] {
  if (!v) return [0]
  return v.split('.').map((p) => {
    const n = parseInt(p, 10)
    return Number.isFinite(n) ? n : 0
  })
}
