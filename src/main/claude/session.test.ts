import { describe, it, expect } from 'vitest'
import { buildExtraArgs, parseSessionFile, shouldFallbackToFresh } from './session'

describe('buildExtraArgs', () => {
  it('always includes mcp-config and bypassPermissions', () => {
    const args = buildExtraArgs({ mcpConfigPath: '/tmp/mcp.json' })
    expect(args).toEqual(['--mcp-config', '/tmp/mcp.json', '--permission-mode', 'bypassPermissions'])
  })

  it('adds --add-dir when a skill home is given', () => {
    const args = buildExtraArgs({ mcpConfigPath: '/m', skillHome: '/repo' })
    expect(args).toContain('--add-dir')
    expect(args[args.indexOf('--add-dir') + 1]).toBe('/repo')
  })

  it('omits --model for default but includes it otherwise', () => {
    expect(buildExtraArgs({ mcpConfigPath: '/m', model: 'default' })).not.toContain('--model')
    const args = buildExtraArgs({ mcpConfigPath: '/m', model: 'opus' })
    expect(args[args.indexOf('--model') + 1]).toBe('opus')
  })

  it('adds --resume when a session id is given', () => {
    const args = buildExtraArgs({ mcpConfigPath: '/m', resumeId: 'sess-1' })
    expect(args[args.indexOf('--resume') + 1]).toBe('sess-1')
    expect(buildExtraArgs({ mcpConfigPath: '/m', resumeId: null })).not.toContain('--resume')
  })
})

describe('shouldFallbackToFresh', () => {
  it('falls back when a resume launch produced no init', () => {
    expect(shouldFallbackToFresh({ launchedWithResume: true, gotInit: false, alreadyFellBack: false })).toBe(true)
  })

  it('does not fall back when resume succeeded (got init)', () => {
    expect(shouldFallbackToFresh({ launchedWithResume: true, gotInit: true, alreadyFellBack: false })).toBe(false)
  })

  it('does not fall back for a fresh (non-resume) launch', () => {
    expect(shouldFallbackToFresh({ launchedWithResume: false, gotInit: false, alreadyFellBack: false })).toBe(false)
  })

  it('only falls back once', () => {
    expect(shouldFallbackToFresh({ launchedWithResume: true, gotInit: false, alreadyFellBack: true })).toBe(false)
  })
})

describe('parseSessionFile', () => {
  it('returns null for missing or corrupt input', () => {
    expect(parseSessionFile(null)).toBeNull()
    expect(parseSessionFile('{not json')).toBeNull()
  })

  it('parses a valid file with defaults for missing fields', () => {
    const s = parseSessionFile(JSON.stringify({ sessionId: 'x', model: 'opus', messages: [{ id: 'm1', role: 'user', text: 'hi' }] }))
    expect(s?.sessionId).toBe('x')
    expect(s?.model).toBe('opus')
    expect(s?.messages).toHaveLength(1)
  })

  it('coerces bad shapes to safe defaults', () => {
    const s = parseSessionFile(JSON.stringify({ sessionId: 42, messages: 'nope' }))
    expect(s?.sessionId).toBeNull()
    expect(s?.model).toBe('default')
    expect(s?.messages).toEqual([])
  })
})
