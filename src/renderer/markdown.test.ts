// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { renderMarkdown } from './markdown'

describe('renderMarkdown', () => {
  it('renders basic markdown to HTML', () => {
    const html = renderMarkdown('**bold** and *italic*')
    expect(html).toContain('<strong>bold</strong>')
    expect(html).toContain('<em>italic</em>')
  })

  it('renders lists and code', () => {
    const html = renderMarkdown('- one\n- two')
    expect(html).toContain('<li>one</li>')
    const code = renderMarkdown('`inline`')
    expect(code).toContain('<code>inline</code>')
  })

  it('strips dangerous markup', () => {
    const html = renderMarkdown('<script>alert(1)</script>hello')
    expect(html).not.toContain('<script>')
    expect(html).toContain('hello')
  })

  it('drops event-handler attributes', () => {
    const html = renderMarkdown('<img src=x onerror="alert(1)">')
    expect(html).not.toContain('onerror')
  })
})
