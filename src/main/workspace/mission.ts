/**
 * Pull a short subtitle from a MISSION.md — the first heading, with a leading
 * "Mission:" stripped. Used to label recent workspaces. Pure; null if none.
 */
export function extractMissionTitle(md: string | null): string | null {
  if (!md) return null
  for (const line of md.split('\n')) {
    const m = /^#\s+(.+?)\s*$/.exec(line)
    if (m) return m[1].replace(/^mission:\s*/i, '').trim() || null
  }
  return null
}
