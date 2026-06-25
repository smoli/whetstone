import { describe, it, expect } from 'vitest'
import { chatWidthFromPointer, CHAT_WIDTH_MIN, CHAT_WIDTH_MAX } from './layout'

describe('chatWidthFromPointer', () => {
  it('measures from the window right edge (innerWidth minus cursor x)', () => {
    expect(chatWidthFromPointer(1200, 800)).toBe(400)
  })

  it('clamps to the minimum when dragged too narrow', () => {
    expect(chatWidthFromPointer(1200, 1000)).toBe(CHAT_WIDTH_MIN)
  })

  it('clamps to the maximum when dragged too wide', () => {
    expect(chatWidthFromPointer(1200, 100)).toBe(CHAT_WIDTH_MAX)
  })
})
