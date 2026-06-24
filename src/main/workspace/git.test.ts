import { describe, it, expect } from 'vitest'
import { pushErrorMessage } from './git'

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
