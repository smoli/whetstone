import { marked } from 'marked'
import DOMPurify from 'dompurify'

marked.setOptions({ gfm: true, breaks: true })

/**
 * Render agent markdown to sanitized HTML for display in the chat pane.
 * Sanitization is defensive: the agent's output is trusted-ish, but it can echo
 * arbitrary lesson/user content, so we never inject it raw.
 */
export function renderMarkdown(text: string): string {
  const html = marked.parse(text, { async: false })
  return DOMPurify.sanitize(html, { USE_PROFILES: { html: true } })
}
