import { describe, it, expect } from 'vitest'
import { applyHtmlPatch } from './html-patch'

const doc = (body: string) => `<!DOCTYPE html>\n<html><body>${body}</body></html>`

describe('applyHtmlPatch', () => {
  it('inserts after an explain anchor by normalizing data-explain ids', () => {
    const html = doc('<p data-explain="Earn">Earn, don\'t tell</p>')
    const r = applyHtmlPatch(html, {
      selector: '#teach-ex-0',
      mode: 'after',
      html: '<details class="teach-explanation"><summary>Explanation</summary><p>Because…</p></details>',
    })
    expect(r.applied).toBe(true)
    // the anchor gets a stable id baked in, and the explanation follows it
    expect(r.html).toContain('id="teach-ex-0"')
    expect(r.html).toMatch(/Earn, don't tell<\/p>\s*<details/)
    expect(r.html).toContain('teach-explanation')
  })

  it('preserves a leading doctype', () => {
    const html = doc('<p data-explain="x">x</p>')
    const r = applyHtmlPatch(html, { selector: '#teach-ex-0', mode: 'after', html: '<i>e</i>' })
    expect(r.html.startsWith('<!DOCTYPE html>')).toBe(true)
  })

  it('supports before, append, and replace modes against any selector', () => {
    const html = doc('<div class="aside">old</div>')
    expect(applyHtmlPatch(html, { selector: '.aside', mode: 'before', html: '<b>B</b>' }).html).toMatch(
      /<b>B<\/b><div class="aside">/,
    )
    expect(applyHtmlPatch(html, { selector: '.aside', mode: 'append', html: '<b>B</b>' }).html).toMatch(
      /<div class="aside">old<b>B<\/b><\/div>/,
    )
    const replaced = applyHtmlPatch(html, { selector: '.aside', mode: 'replace', html: '<div class="aside">new</div>' })
    expect(replaced.html).toContain('new')
    expect(replaced.html).not.toContain('old')
  })

  it('leaves the html unchanged and reports applied:false when the selector misses', () => {
    const html = doc('<p>nothing here</p>')
    const r = applyHtmlPatch(html, { selector: '#nope', mode: 'after', html: '<i>e</i>' })
    expect(r.applied).toBe(false)
    expect(r.html).not.toContain('<i>e</i>')
  })
})
