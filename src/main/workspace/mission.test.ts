import { describe, it, expect } from 'vitest'
import { extractMissionTitle } from './mission'

describe('extractMissionTitle', () => {
  it('returns the first heading, stripping a Mission: prefix', () => {
    expect(extractMissionTitle('# Mission: Learn chess endgames\n\n## Why')).toBe('Learn chess endgames')
  })

  it('returns a plain heading as-is', () => {
    expect(extractMissionTitle('intro\n# Watercolour basics\nmore')).toBe('Watercolour basics')
  })

  it('returns null when there is no heading or no content', () => {
    expect(extractMissionTitle('no heading here')).toBeNull()
    expect(extractMissionTitle(null)).toBeNull()
    expect(extractMissionTitle('# Mission:   ')).toBeNull()
  })
})
