// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest'
import '../../assets/quiz.js'

const TeachQuiz = (window as unknown as {
  TeachQuiz: {
    build(container: Element, questions: unknown[]): void
    shuffledIndices(n: number): number[]
  }
}).TeachQuiz

beforeEach(() => {
  document.body.innerHTML = ''
})

describe('shuffledIndices', () => {
  it('is a valid permutation of 0..n-1', () => {
    const order = TeachQuiz.shuffledIndices(4)
    expect([...order].sort()).toEqual([0, 1, 2, 3])
  })

  it('does not always keep the answer in the same position', () => {
    const positions = new Set<number>()
    for (let i = 0; i < 200; i++) {
      positions.add(TeachQuiz.shuffledIndices(3).indexOf(0))
    }
    // index 0 (a notional "correct" option) must land in more than one slot
    expect(positions.size).toBeGreaterThan(1)
  })
})

describe('build', () => {
  function makeQuiz() {
    const container = document.createElement('div')
    container.className = 'quiz'
    document.body.appendChild(container)
    TeachQuiz.build(container, [{ q: 'Q1', opts: ['right', 'wrong-a', 'wrong-b'], answer: 0, why: 'because' }])
    return container
  }

  it('renders each option with its original index in data-opt-index', () => {
    const container = makeQuiz()
    const btns = [...container.querySelectorAll('.quiz-opt')] as HTMLButtonElement[]
    expect(btns).toHaveLength(3)
    const indices = btns.map((b) => b.getAttribute('data-opt-index')).sort()
    expect(indices).toEqual(['0', '1', '2'])
    // the button carrying the correct text is the one with data-opt-index 0
    const correct = btns.find((b) => b.getAttribute('data-opt-index') === '0')!
    expect(correct.textContent).toBe('right')
  })

  it('marks the correct option regardless of its shuffled position', () => {
    const container = makeQuiz()
    const wrong = [...container.querySelectorAll('.quiz-opt')].find(
      (b) => b.getAttribute('data-opt-index') !== '0',
    ) as HTMLButtonElement
    wrong.click()
    const correct = container.querySelector('[data-opt-index="0"]')!
    expect(correct.classList.contains('correct')).toBe(true)
    expect(wrong.classList.contains('wrong')).toBe(true)
  })
})
