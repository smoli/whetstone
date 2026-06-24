import { describe, it, expect } from 'vitest'
import { StreamParser, parseLine, encodeUserTurn } from './stream-parser'

function assistantLine(blocks: unknown[]): string {
  return JSON.stringify({ type: 'assistant', message: { role: 'assistant', content: blocks } })
}

describe('parseLine', () => {
  it('maps assistant text blocks to assistant_text events', () => {
    const evs = parseLine(assistantLine([{ type: 'text', text: 'Hello there' }]))
    expect(evs).toEqual([{ kind: 'assistant_text', text: 'Hello there' }])
  })

  it('maps tool_use blocks with name + input', () => {
    const evs = parseLine(
      assistantLine([{ type: 'tool_use', name: 'lesson_feedback', input: { lessonId: '0004' } }]),
    )
    expect(evs).toEqual([{ kind: 'tool_use', name: 'lesson_feedback', input: { lessonId: '0004' } }])
  })

  it('handles a message with multiple blocks', () => {
    const evs = parseLine(
      assistantLine([
        { type: 'text', text: 'Let me update the lesson.' },
        { type: 'tool_use', name: 'patch_lesson', input: {} },
      ]),
    )
    expect(evs).toHaveLength(2)
    expect(evs[0].kind).toBe('assistant_text')
    expect(evs[1].kind).toBe('tool_use')
  })

  it('maps a successful result', () => {
    const evs = parseLine(JSON.stringify({ type: 'result', subtype: 'success', result: 'done', is_error: false }))
    expect(evs).toEqual([{ kind: 'result', text: 'done', isError: false }])
  })

  it('flags an error result', () => {
    const evs = parseLine(JSON.stringify({ type: 'result', subtype: 'error_max_turns', is_error: true }))
    expect(evs[0]).toMatchObject({ kind: 'result', isError: true })
  })

  it('maps system init', () => {
    const evs = parseLine(JSON.stringify({ type: 'system', subtype: 'init' }))
    expect(evs).toEqual([{ kind: 'system', subtype: 'init' }])
  })

  it('ignores blank lines and invalid JSON without throwing', () => {
    expect(parseLine('')).toEqual([])
    expect(parseLine('   ')).toEqual([])
    expect(() => parseLine('{not json')).not.toThrow()
    expect(parseLine('{not json')).toEqual([])
    expect(parseLine(JSON.stringify({ noType: true }))).toEqual([])
  })
})

describe('StreamParser buffering', () => {
  it('emits an event only once a line is completed by a newline', () => {
    const p = new StreamParser()
    const line = assistantLine([{ type: 'text', text: 'partial' }])
    const head = line.slice(0, 12)
    const tail = line.slice(12)
    expect(p.push(head)).toEqual([])
    expect(p.push(tail)).toEqual([]) // still no newline
    expect(p.push('\n')).toEqual([{ kind: 'assistant_text', text: 'partial' }])
  })

  it('handles several newline-delimited lines in one chunk', () => {
    const p = new StreamParser()
    const chunk =
      assistantLine([{ type: 'text', text: 'one' }]) +
      '\n' +
      JSON.stringify({ type: 'result', subtype: 'success', result: 'fin', is_error: false }) +
      '\n'
    const evs = p.push(chunk)
    expect(evs).toHaveLength(2)
    expect(evs[0]).toEqual({ kind: 'assistant_text', text: 'one' })
    expect(evs[1]).toEqual({ kind: 'result', text: 'fin', isError: false })
  })

  it('flush() drains a trailing line without a newline', () => {
    const p = new StreamParser()
    p.push(assistantLine([{ type: 'text', text: 'no newline' }]))
    expect(p.flush()).toEqual([{ kind: 'assistant_text', text: 'no newline' }])
  })
})

describe('encodeUserTurn', () => {
  it('produces a stream-json user message line', () => {
    const parsed = JSON.parse(encodeUserTurn('teach me'))
    expect(parsed).toEqual({
      type: 'user',
      message: { role: 'user', content: [{ type: 'text', text: 'teach me' }] },
    })
  })
})
