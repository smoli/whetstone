import { describe, it, expect } from 'vitest'
import { formatRelativeTime } from './time'

const NOW = Date.parse('2026-06-24T12:00:00.000Z')
const ago = (ms: number) => new Date(NOW - ms).toISOString()

describe('formatRelativeTime', () => {
  it('returns empty for missing/invalid input', () => {
    expect(formatRelativeTime(undefined, NOW)).toBe('')
    expect(formatRelativeTime('not a date', NOW)).toBe('')
  })

  it('formats recent spans', () => {
    expect(formatRelativeTime(ago(10_000), NOW)).toBe('just now')
    expect(formatRelativeTime(ago(5 * 60_000), NOW)).toBe('5m ago')
    expect(formatRelativeTime(ago(3 * 3_600_000), NOW)).toBe('3h ago')
    expect(formatRelativeTime(ago(2 * 86_400_000), NOW)).toBe('2d ago')
  })

  it('formats longer spans', () => {
    expect(formatRelativeTime(ago(14 * 86_400_000), NOW)).toBe('2w ago')
    expect(formatRelativeTime(ago(60 * 86_400_000), NOW)).toBe('2mo ago')
    expect(formatRelativeTime(ago(400 * 86_400_000), NOW)).toBe('1y ago')
  })
})
