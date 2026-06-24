import { describe, it, expect } from 'vitest'
import { resolveChatLink, isExternalUrl, lessonNumber, contentLabel, type LinkContext } from './links'

const ctx: LinkContext = {
  lessonBase: 'http://127.0.0.1:5000',
  lessons: ['0004-the-vertical-slice.html', '0006-running-the-test.html'],
  references: ['glossary.html', 'slice-01-the-lava-commute.html'],
  docs: ['MISSION.md', 'RESOURCES.md', 'NOTES.md'],
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

  it('routes workspace docs (MISSION/RESOURCES/NOTES) to the doc section', () => {
    expect(resolveChatLink('../RESOURCES.md', ctx)).toEqual({ kind: 'doc', file: 'RESOURCES.md' })
    expect(resolveChatLink('MISSION.md', ctx)).toEqual({ kind: 'doc', file: 'MISSION.md' })
  })

  it('canonicalizes a mis-cased link to the real filename', () => {
    expect(resolveChatLink('MISSION.Md', ctx)).toEqual({ kind: 'doc', file: 'MISSION.md' })
    expect(resolveChatLink('0006-Running-The-Test.html', ctx)).toEqual({
      kind: 'lesson',
      file: '0006-running-the-test.html',
    })
  })

  it('returns anchor for hash links and unknown for other non-html', () => {
    expect(resolveChatLink('#section', ctx)).toEqual({ kind: 'anchor', hash: '#section' })
    expect(resolveChatLink('../GLOSSARY.txt', ctx)).toEqual({ kind: 'unknown' })
    expect(resolveChatLink('', ctx)).toEqual({ kind: 'unknown' })
  })
})

describe('isExternalUrl', () => {
  it('flags real websites and mail links', () => {
    expect(isExternalUrl('https://www.amazon.com/dp/123')).toBe(true)
    expect(isExternalUrl('http://someblog.dev/post')).toBe(true)
    expect(isExternalUrl('mailto:a@b.com')).toBe(true)
  })

  it('treats the loopback lesson server and relative links as internal', () => {
    expect(isExternalUrl('http://127.0.0.1:51234/lessons/0004-x.html')).toBe(false)
    expect(isExternalUrl('http://localhost:5173/')).toBe(false)
    expect(isExternalUrl('0004-the-vertical-slice.html')).toBe(false)
    expect(isExternalUrl('#anchor')).toBe(false)
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
