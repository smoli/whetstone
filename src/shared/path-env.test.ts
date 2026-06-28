import { describe, it, expect } from 'vitest'
import { mergeMissingPaths, commonBinDirs } from './path-env'

describe('mergeMissingPaths', () => {
  it('appends missing dirs while preserving existing precedence', () => {
    const merged = mergeMissingPaths('/usr/bin:/bin', ['/opt/homebrew/bin', '/usr/local/bin'])
    expect(merged).toBe('/usr/bin:/bin:/opt/homebrew/bin:/usr/local/bin')
  })

  it('does not duplicate dirs already on PATH', () => {
    const merged = mergeMissingPaths('/usr/local/bin:/bin', ['/opt/homebrew/bin', '/usr/local/bin'])
    expect(merged.split(':').filter((p) => p === '/usr/local/bin')).toHaveLength(1)
    expect(merged).toBe('/usr/local/bin:/bin:/opt/homebrew/bin')
  })

  it('handles an empty starting PATH', () => {
    expect(mergeMissingPaths('', ['/opt/homebrew/bin'])).toBe('/opt/homebrew/bin')
  })

  it('ignores empty segments and empty dirs', () => {
    expect(mergeMissingPaths('/bin::', ['', '/opt/homebrew/bin'])).toBe('/bin:/opt/homebrew/bin')
  })
})

describe('commonBinDirs', () => {
  it('includes the standard claude install locations under the home dir', () => {
    const dirs = commonBinDirs('/Users/ada')
    expect(dirs).toContain('/opt/homebrew/bin')
    expect(dirs).toContain('/usr/local/bin')
    expect(dirs).toContain('/Users/ada/.local/bin')
    expect(dirs).toContain('/Users/ada/.claude/local')
  })
})
