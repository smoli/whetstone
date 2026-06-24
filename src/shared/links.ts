/**
 * Resolve a link clicked in the chat to an action. Pure so it's testable.
 *
 * The agent writes markdown links to lessons ("0006-x.html", "lessons/0006-x.html"),
 * reference docs ("../reference/sheet.html"), and external sources (https://…).
 * We never let these navigate the renderer — we route them into the content view
 * or the system browser.
 */

export interface LinkContext {
  /** HTTP origin of the lesson server (internal links resolve against it). */
  lessonBase: string
  /** Known lesson filenames, e.g. "0006-running-the-test.html". */
  lessons: string[]
  /** Known reference filenames, e.g. "glossary.html". */
  references: string[]
  /** Known workspace doc filenames, e.g. "MISSION.md". */
  docs: string[]
}

export type ResolvedLink =
  | { kind: 'lesson'; file: string }
  | { kind: 'reference'; file: string }
  | { kind: 'doc'; file: string }
  | { kind: 'external'; url: string }
  | { kind: 'anchor'; hash: string }
  | { kind: 'unknown' }

export function resolveChatLink(href: string, ctx: LinkContext): ResolvedLink {
  const trimmed = (href ?? '').trim()
  if (!trimmed) return { kind: 'unknown' }
  if (trimmed.startsWith('#')) return { kind: 'anchor', hash: trimmed }

  if (/^https?:\/\//i.test(trimmed)) {
    if (ctx.lessonBase && trimmed.startsWith(ctx.lessonBase)) {
      return classifyPath(trimmed.slice(ctx.lessonBase.length), ctx)
    }
    return { kind: 'external', url: trimmed }
  }
  if (/^file:/i.test(trimmed)) return classifyPath(trimmed.replace(/^file:\/\//i, ''), ctx)
  // other schemes (mailto:, etc.) — let the OS handle them
  if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed)) return { kind: 'external', url: trimmed }

  return classifyPath(trimmed, ctx)
}

function classifyPath(p: string, ctx: LinkContext): ResolvedLink {
  const pathPart = p.split('#')[0].split('?')[0]
  const segs = pathPart.split('/').filter(Boolean)
  const basename = segs[segs.length - 1] ?? ''
  if (!basename) return { kind: 'unknown' }

  // Match known files case-insensitively, returning the canonical filename so a
  // mis-cased link (e.g. "MISSION.Md") resolves to the real file.
  const ci = (list: string[]): string | undefined =>
    list.find((f) => f.toLowerCase() === basename.toLowerCase())
  const lesson = ci(ctx.lessons)
  if (lesson) return { kind: 'lesson', file: lesson }
  const reference = ci(ctx.references)
  if (reference) return { kind: 'reference', file: reference }
  const doc = ci(ctx.docs)
  if (doc) return { kind: 'doc', file: doc }
  if (/^(MISSION|RESOURCES|NOTES)\.md$/i.test(basename)) return { kind: 'doc', file: basename }

  if (!/\.html?$/i.test(basename)) return { kind: 'unknown' }

  // Not in the known lists yet (e.g. a just-created lesson). Best-effort routing.
  const lower = pathPart.toLowerCase()
  if (lower.includes('reference')) return { kind: 'reference', file: basename }
  if (lower.includes('lesson')) return { kind: 'lesson', file: basename }
  if (/^\d/.test(basename)) return { kind: 'lesson', file: basename }
  return { kind: 'reference', file: basename }
}

const LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost', '::1', ''])

/**
 * Whether a URL points outside the app — a real website or mail link that should
 * open in the OS browser rather than navigate a lesson iframe. Loopback URLs (the
 * lesson server) and relative/unparseable links are internal.
 */
export function isExternalUrl(url: string): boolean {
  let u: URL
  try {
    u = new URL(url)
  } catch {
    return false
  }
  if (u.protocol === 'mailto:') return true
  if (u.protocol === 'http:' || u.protocol === 'https:') return !LOOPBACK_HOSTS.has(u.hostname)
  return false
}

/** Lesson number without leading zeros, e.g. "0006-x.html" → "6". '' if none. */
export function lessonNumber(file: string): string {
  const m = /^(\d+)/.exec(file)
  return m ? String(parseInt(m[1], 10)) : ''
}

/** Human label for a lesson/reference file: drop the numeric prefix + extension, de-dash. */
export function contentLabel(file: string): string {
  return file
    .replace(/\.html?$/i, '')
    .replace(/^\d+[-_]?/, '')
    .replace(/[-_]/g, ' ')
    .trim()
}
