import { describe, it, expect } from 'vitest'
import { resolveChatLink, lessonNumber, contentLabel, type LinkContext } from './links'

const ctx: LinkContext = {
  lessonBase: 'http://127.0.0.1:5000',
  lessons: ['0004-the-vertical-slice.html', '0006-running-the-test.html'],
  references: ['glossary.html', 'slice-01-the-lava-commute.html'],
}

describe('resolveChatLink', () => {
  it('matches a known lesson by basename (relative or pathed)', () => {
    expect(resolveChatLink('0006-running-the-test.html', ctx)).toEqual({ kind: 'lesson', file: '0006-running-the-test.html' })
    expect(resolveChatLink('lessons/0006-running-the-test.html', ctx)).toEqual({ kind: 'lesson', file: '0006-running-the-test.html' })
  })

  it('matches a known reference', () => {
    expect(resolveChatLink('../reference/glossary.html', ctx)).toEqual({ kind: 'reference', file: 'glossary.html' })
  })

  it('routes a brand-new lesson (not yet listed) by its leading number', () => {
    expect(resolveChatLink('0007-playtesting-two.html', ctx)).toEqual({ kind: 'lesson', file: '0007-playtesting-two.html' })
  })

  it('routes a new reference by path hint or shape', () => {
    expect(resolveChatLink('reference/playtest-sheet.html', ctx)).toEqual({ kind: 'reference', file: 'playtest-sheet.html' })
    expect(resolveChatLink('playtest-sheet.html', ctx)).toEqual({ kind: 'reference', file: 'playtest-sheet.html' })
  })

  it('treats real web URLs as external', () => {
    expect(resolveChatLink('https://example.com/x', ctx)).toEqual({ kind: 'external', url: 'https://example.com/x' })
    expect(resolveChatLink('mailto:a@b.com', ctx)).toEqual({ kind: 'external', url: 'mailto:a@b.com' })
  })

  it('classifies internal lessonBase URLs by their path', () => {
    expect(resolveChatLink('http://127.0.0.1:5000/lessons/0004-the-vertical-slice.html', ctx)).toEqual({
      kind: 'lesson',
      file: '0004-the-vertical-slice.html',
    })
  })

  it('returns anchor for hash links and unknown for non-html', () => {
    expect(resolveChatLink('#section', ctx)).toEqual({ kind: 'anchor', hash: '#section' })
    expect(resolveChatLink('../RESOURCES.md', ctx)).toEqual({ kind: 'unknown' })
    expect(resolveChatLink('', ctx)).toEqual({ kind: 'unknown' })
  })
})

describe('lessonNumber', () => {
  it('strips leading zeros', () => {
    expect(lessonNumber('0006-running.html')).toBe('6')
    expect(lessonNumber('0012-x.html')).toBe('12')
    expect(lessonNumber('glossary.html')).toBe('')
  })
})

describe('contentLabel', () => {
  it('drops the numeric prefix and extension and de-dashes', () => {
    expect(contentLabel('0006-running-the-test.html')).toBe('running the test')
    expect(contentLabel('glossary.html')).toBe('glossary')
  })
})
