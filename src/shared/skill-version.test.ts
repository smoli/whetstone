import { describe, it, expect } from 'vitest'
import { readSkillVersion, compareVersions, skillUpdateAvailable } from './skill-version'

const skill = (fm: string) => `---\nname: teach\n${fm}\n---\n\nbody text\n`

describe('readSkillVersion', () => {
  it('reads a version nested under metadata (the standard-compliant place)', () => {
    expect(readSkillVersion(skill('metadata:\n  version: 0.3.0'))).toBe('0.3.0')
  })

  it('also reads a top-level version key', () => {
    expect(readSkillVersion(skill('version: 1.2.3'))).toBe('1.2.3')
  })

  it('strips surrounding quotes', () => {
    expect(readSkillVersion(skill('metadata:\n  version: "2.0.0"'))).toBe('2.0.0')
  })

  it('returns null when there is no version and only scans the frontmatter', () => {
    expect(readSkillVersion(skill('description: x'))).toBeNull()
    // a "version:" in the body must not count
    expect(readSkillVersion('---\nname: teach\n---\n\nversion: 9.9.9 in prose\n')).toBeNull()
  })
})

describe('compareVersions', () => {
  it('orders semver-ish versions numerically', () => {
    expect(compareVersions('0.3.0', '0.2.0')).toBe(1)
    expect(compareVersions('0.2.0', '0.10.0')).toBe(-1) // numeric, not lexical
    expect(compareVersions('1.0.0', '1.0.0')).toBe(0)
  })

  it('treats a missing version as the oldest', () => {
    expect(compareVersions('0.1.0', null)).toBe(1)
    expect(compareVersions(null, null)).toBe(0)
  })
})

describe('skillUpdateAvailable', () => {
  it('is true only when the bundled version is strictly newer', () => {
    expect(skillUpdateAvailable('0.3.0', '0.2.0')).toBe(true)
    expect(skillUpdateAvailable('0.3.0', null)).toBe(true) // old copy with no version
    expect(skillUpdateAvailable('0.3.0', '0.3.0')).toBe(false)
    expect(skillUpdateAvailable('0.2.0', '0.3.0')).toBe(false)
    expect(skillUpdateAvailable(null, '0.3.0')).toBe(false) // unknown bundled → don't offer
  })
})
