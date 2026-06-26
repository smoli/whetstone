import { parse } from 'node-html-parser'
import type { PatchMode } from '@shared/protocol'

export interface HtmlPatch {
  selector: string
  mode: PatchMode
  html: string
}

/**
 * Apply a patch_lesson edit directly to a lesson's HTML source, so the change is
 * a permanent part of the file (not just a replayed overlay). `[data-explain]`
 * elements are given stable `teach-ex-N` ids first — mirroring bridge.js — so an
 * explanation anchored at `#teach-ex-N` resolves against the file.
 *
 * Returns the new HTML and whether the selector matched (false → unchanged).
 */
export function applyHtmlPatch(html: string, patch: HtmlPatch): { html: string; applied: boolean } {
  // node-html-parser drops the doctype on serialize — preserve it verbatim.
  const m = /^\s*<!doctype[^>]*>\s*/i.exec(html)
  const doctype = m ? m[0] : ''
  const body = m ? html.slice(m[0].length) : html

  const root = parse(body, { comment: true })
  root.querySelectorAll('[data-explain]').forEach((el, i) => {
    if (!el.getAttribute('id')) el.setAttribute('id', `teach-ex-${i}`)
  })

  const target = root.querySelector(patch.selector)
  if (!target) return { html: doctype + root.toString(), applied: false }

  switch (patch.mode) {
    case 'append':
      target.insertAdjacentHTML('beforeend', patch.html)
      break
    case 'before':
      target.insertAdjacentHTML('beforebegin', patch.html)
      break
    case 'after':
      target.insertAdjacentHTML('afterend', patch.html)
      break
    case 'replace':
      target.insertAdjacentHTML('afterend', patch.html)
      target.remove()
      break
  }
  return { html: doctype + root.toString(), applied: true }
}
