// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest'
import '../../assets/bridge.js'

interface Posted {
  url: string
  body: Record<string, unknown>
}

// window.TeachBridge is attached by the imported IIFE.
const TeachBridge = (window as unknown as { TeachBridge: {
  create(state: Record<string, unknown>): {
    init(): unknown
    handleCommand(cmd: unknown): void
  }
  slug(s: string): string
} }).TeachBridge

let posts: Posted[]
function fakeFetch(url: string, opts: { body: string }) {
  posts.push({ url, body: JSON.parse(opts.body) })
  return Promise.resolve({ ok: true, json: () => Promise.resolve({ ok: true }) })
}

function ofType(type: string) {
  return posts.filter((p) => p.body.type === type)
}

function setupDom() {
  document.body.innerHTML = `
    <article>
      <div class="exercise">
        <h3>Design one complete moment</h3>
        <textarea></textarea>
      </div>
      <div class="quiz" data-quiz></div>
      <script type="application/json" class="quiz-data">
        [{"q":"Q1","opts":["a","b"],"answer":0},{"q":"Q2","opts":["a","b"],"answer":1}]
      </script>
      <p id="earn" data-explain="Earn, don't tell">Earn, don't tell</p>
    </article>`
  // mirror quiz.js's built structure inside the .quiz container
  const quiz = document.querySelector('.quiz') as HTMLElement
  quiz.innerHTML = `
    <div class="quiz-opts"><button class="quiz-opt">a</button><button class="quiz-opt">b</button></div>
    <div class="quiz-opts"><button class="quiz-opt">a</button><button class="quiz-opt">b</button></div>`
}

function makeBridge() {
  return TeachBridge.create({
    base: 'http://127.0.0.1:9999',
    lessonId: '0004',
    wsUrl: null,
    fetchImpl: fakeFetch,
  })
}

beforeEach(() => {
  posts = []
  setupDom()
})

describe('bridge init', () => {
  it('posts a lesson_opened event', () => {
    makeBridge().init()
    expect(ofType('lesson_opened')).toHaveLength(1)
    expect(ofType('lesson_opened')[0].body.lessonId).toBe('0004')
  })

  it('injects a submit button on the exercise', () => {
    makeBridge().init()
    expect(document.querySelector('.exercise [data-teach-submit]')).not.toBeNull()
  })
})

describe('exercise submission', () => {
  it('posts an exercise_submission with the textarea text and a slugged promptId', () => {
    makeBridge().init()
    const ta = document.querySelector('textarea') as HTMLTextAreaElement
    ta.value = 'SETUP — the boring world…'
    ;(document.querySelector('[data-teach-submit]') as HTMLButtonElement).click()
    const subs = ofType('exercise_submission')
    expect(subs).toHaveLength(1)
    expect(subs[0].body.text).toContain('boring world')
    expect(subs[0].body.promptId).toBe('design-one-complete-moment')
  })

  it('does not post when the textarea is empty', () => {
    makeBridge().init()
    ;(document.querySelector('[data-teach-submit]') as HTMLButtonElement).click()
    expect(ofType('exercise_submission')).toHaveLength(0)
  })
})

describe('quiz reporting', () => {
  it('posts quiz_result once all questions are answered, with correct grading', () => {
    makeBridge().init()
    const groups = document.querySelectorAll('.quiz-opts')
    // Q1 → index 0 (correct), Q2 → index 0 (wrong; answer is 1)
    ;(groups[0].querySelectorAll('.quiz-opt')[0] as HTMLButtonElement).click()
    expect(ofType('quiz_result')).toHaveLength(0) // not all answered yet
    ;(groups[1].querySelectorAll('.quiz-opt')[0] as HTMLButtonElement).click()
    const results = ofType('quiz_result')
    expect(results).toHaveLength(1)
    const body = results[0].body as { score: { correct: number; total: number }; items: { isCorrect: boolean }[] }
    expect(body.score).toEqual({ correct: 1, total: 2 })
    expect(body.items[0].isCorrect).toBe(true)
    expect(body.items[1].isCorrect).toBe(false)
  })
})

describe('inline explain', () => {
  it('injects an explain button and posts a help_request with the anchor text', () => {
    makeBridge().init()
    const btn = document.querySelector('#earn .teach-explain') as HTMLButtonElement
    expect(btn).not.toBeNull()
    btn.click()
    const help = ofType('help_request')
    expect(help).toHaveLength(1)
    expect(help[0].body.anchorText).toContain('Earn')
    expect(help[0].body.anchorId).toBe('earn')
  })
})

describe('incoming agent commands', () => {
  it('renders lesson_feedback into the matching feedback slot', () => {
    const b = makeBridge()
    b.init()
    b.handleCommand({
      type: 'lesson_feedback',
      lessonId: '0004',
      anchorId: 'design-one-complete-moment',
      html: '<p>Your LAND beat needs work.</p>',
    })
    const slot = document.getElementById('teach-feedback-design-one-complete-moment')
    expect(slot?.innerHTML).toContain('LAND beat')
    expect(slot?.classList.contains('show')).toBe(true)
  })

  it('applies a patch_lesson replace', () => {
    const b = makeBridge()
    b.init()
    b.handleCommand({
      type: 'patch_lesson',
      lessonId: '0004',
      selector: '#earn',
      mode: 'replace',
      html: '<p id="earn">Patched copy</p>',
    })
    expect(document.getElementById('earn')?.textContent).toContain('Patched copy')
  })
})
