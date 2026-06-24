import { describe, it, expect } from 'vitest'
import { addRecent, removeRecent, parseAppState } from './app-config'

describe('addRecent', () => {
  it('puts the newest first and dedupes', () => {
    expect(addRecent(['/a', '/b'], '/b')).toEqual(['/b', '/a'])
    expect(addRecent(['/a'], '/c')).toEqual(['/c', '/a'])
  })

  it('caps the list', () => {
    const many = Array.from({ length: 10 }, (_, i) => `/w${i}`)
    expect(addRecent(many, '/new', 8)).toHaveLength(8)
    expect(addRecent(many, '/new', 8)[0]).toBe('/new')
  })
})

describe('removeRecent', () => {
  it('drops a path', () => {
    expect(removeRecent(['/a', '/b'], '/a')).toEqual(['/b'])
  })
})

describe('parseAppState', () => {
  it('returns empty state for null/corrupt input', () => {
    expect(parseAppState(null).recent).toEqual([])
    expect(parseAppState('{bad').lastWorkspace).toBeNull()
  })

  it('parses valid state and filters non-string recents', () => {
    const s = parseAppState(JSON.stringify({ recent: ['/a', 5, '/b'], lastWorkspace: '/a' }))
    expect(s.recent).toEqual(['/a', '/b'])
    expect(s.lastWorkspace).toBe('/a')
  })

  it('parses openedAt timestamps, ignoring non-strings', () => {
    const s = parseAppState(JSON.stringify({ recent: [], openedAt: { '/a': '2026-06-24T00:00:00Z', '/b': 5 } }))
    expect(s.openedAt).toEqual({ '/a': '2026-06-24T00:00:00Z' })
  })

  it('defaults openedAt to an empty object', () => {
    expect(parseAppState(null).openedAt).toEqual({})
  })
})
