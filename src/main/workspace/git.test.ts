import { describe, it, expect } from 'vitest'
import { pushErrorMessage, isDirty } from './git'

describe('isDirty', () => {
  it('is false for a clean working tree', () => {
    expect(isDirty('')).toBe(false)
    expect(isDirty('\n')).toBe(false)
    expect(isDirty('   \n  ')).toBe(false)
  })

  it('is true when there are staged, unstaged, or untracked changes', () => {
    expect(isDirty(' M lessons/0001.html\n')).toBe(true)
    expect(isDirty('?? notes.txt')).toBe(true)
    expect(isDirty('A  new.md\n M old.md\n')).toBe(true)
  })
})

describe('pushErrorMessage', () => {
  it('maps auth failures', () => {
    expect(pushErrorMessage('fatal: Authentication failed for https://...')).toMatch(/authentication/i)
    expect(pushErrorMessage('could not read Username for https://github.com')).toMatch(/authentication/i)
  })

  it('maps non-fast-forward rejections', () => {
    expect(pushErrorMessage('! [rejected] main -> main (non-fast-forward)')).toMatch(/rejected/i)
    expect(pushErrorMessage('Updates were rejected; fetch first')).toMatch(/rejected/i)
  })

  it('maps unreachable remotes', () => {
    expect(pushErrorMessage('fatal: unable to access ... Could not resolve host: github.com')).toMatch(/reach/i)
  })

  it('maps missing remote config', () => {
    expect(pushErrorMessage('fatal: No configured push destination.')).toMatch(/no remote/i)
  })

  it('falls back to a generic message', () => {
    expect(pushErrorMessage('some unexpected git error')).toBe('Push failed.')
  })
})
