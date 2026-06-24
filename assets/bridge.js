/* ============================================================
   Teach Desktop — lesson bridge (progressive enhancement).

   Lights up an otherwise-static lesson so it can talk to the
   teaching agent:
     • injects a "Send to your teacher" button on exercises
     • reports quiz results when a quiz is completed
     • adds inline "explain" affordances ([data-explain])
     • renders agent feedback / patches arriving over WebSocket

   Backward compatible: opened in a plain browser with no bridge
   config, it no-ops the network and simply shows the affordances.
   ============================================================ */
(function () {
  function slug(s) {
    return String(s)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
  }

  function lessonIdFromLocation() {
    var file = (location.pathname.split('/').pop() || '').replace(/\.html?$/, '')
    var m = /^(\d+)/.exec(file)
    return m ? m[1] : file || 'unknown'
  }

  function uid() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
    return 'e-' + Math.floor(performance.now() * 1000).toString(36)
  }

  function nowIso() {
    return new Date().toISOString()
  }

  function create(state) {
    var bridge = {
      base: state.base || '',
      lessonId: state.lessonId || lessonIdFromLocation(),
      doc: state.doc || document,
      fetchImpl: state.fetchImpl || (typeof fetch !== 'undefined' ? fetch.bind(globalThis) : null),
    }

    bridge.post = function (event) {
      if (!bridge.base || !bridge.fetchImpl) return Promise.resolve(null)
      return bridge.fetchImpl(bridge.base + '/events', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(event),
      })
    }

    // ── exercises ────────────────────────────────────────────
    bridge.enhanceExercises = function () {
      var exercises = bridge.doc.querySelectorAll('.exercise')
      exercises.forEach(function (ex, i) {
        var textarea = ex.querySelector('textarea')
        if (!textarea || ex.querySelector('[data-teach-submit]')) return
        var h3 = ex.querySelector('h3')
        var promptId = ex.dataset.promptId || (h3 ? slug(h3.textContent) : 'exercise-' + (i + 1))
        ex.dataset.promptId = promptId

        var slot = bridge.doc.createElement('div')
        slot.className = 'teach-feedback'
        slot.id = 'teach-feedback-' + promptId

        var btn = bridge.doc.createElement('button')
        btn.type = 'button'
        btn.className = 'teach-submit'
        btn.setAttribute('data-teach-submit', '')
        btn.textContent = 'Send to your teacher'
        btn.addEventListener('click', function () {
          var text = textarea.value.trim()
          if (!text) return
          btn.disabled = true
          btn.textContent = 'Sent — your teacher is reading…'
          bridge.post({
            type: 'exercise_submission',
            eventId: uid(),
            lessonId: bridge.lessonId,
            promptId: promptId,
            text: text,
            ts: nowIso(),
          })
        })
        ex.appendChild(btn)
        ex.appendChild(slot)
      })
    }

    // ── quizzes ──────────────────────────────────────────────
    bridge.enhanceQuizzes = function () {
      bridge.doc.querySelectorAll('.quiz[data-quiz]').forEach(function (container) {
        var dataEl = container.nextElementSibling
        while (dataEl && !dataEl.classList.contains('quiz-data')) dataEl = dataEl.nextElementSibling
        if (!dataEl) return
        var questions
        try {
          questions = JSON.parse(dataEl.textContent)
        } catch (e) {
          return
        }
        var answers = {}
        container.addEventListener('click', function (evt) {
          var btn = evt.target.closest ? evt.target.closest('.quiz-opt') : null
          if (!btn || !container.contains(btn)) return
          var optsEl = btn.parentNode
          var groups = Array.prototype.slice.call(container.querySelectorAll('.quiz-opts'))
          var qi = groups.indexOf(optsEl)
          if (qi < 0) return
          var chosen = Array.prototype.slice.call(optsEl.querySelectorAll('.quiz-opt')).indexOf(btn)
          if (answers[qi] !== undefined) return
          answers[qi] = chosen
          if (Object.keys(answers).length === questions.length) bridge.reportQuiz(container, questions, answers)
        })
      })
    }

    bridge.reportQuiz = function (container, questions, answers) {
      var items = questions.map(function (q, qi) {
        var chosen = answers[qi]
        return {
          questionIndex: qi,
          questionText: q.q,
          chosenIndex: chosen,
          correctIndex: q.answer,
          isCorrect: chosen === q.answer,
        }
      })
      var correct = items.filter(function (it) {
        return it.isCorrect
      }).length
      bridge.post({
        type: 'quiz_result',
        eventId: uid(),
        lessonId: bridge.lessonId,
        items: items,
        score: { correct: correct, total: questions.length },
        ts: nowIso(),
      })
    }

    // ── inline explain ───────────────────────────────────────
    bridge.enhanceExplain = function () {
      bridge.doc.querySelectorAll('[data-explain]').forEach(function (el) {
        if (el.querySelector('.teach-explain')) return
        var btn = bridge.doc.createElement('button')
        btn.type = 'button'
        btn.className = 'teach-explain'
        btn.textContent = 'explain ▸'
        btn.addEventListener('click', function () {
          bridge.post({
            type: 'help_request',
            eventId: uid(),
            lessonId: bridge.lessonId,
            anchorId: el.id || undefined,
            anchorText: (el.dataset.explain || el.textContent || '').trim().slice(0, 400),
            ts: nowIso(),
          })
          btn.textContent = 'asked — see chat'
        })
        el.appendChild(btn)
      })
    }

    // ── incoming agent commands ──────────────────────────────
    bridge.handleCommand = function (cmd) {
      if (!cmd || typeof cmd.type !== 'string') return
      if (cmd.type === 'lesson_feedback') return bridge.renderFeedback(cmd)
      if (cmd.type === 'patch_lesson') return bridge.applyPatch(cmd)
    }

    bridge.renderFeedback = function (cmd) {
      var slot = cmd.anchorId ? bridge.doc.getElementById('teach-feedback-' + cmd.anchorId) : null
      if (!slot) {
        slot = bridge.doc.createElement('div')
        slot.className = 'teach-feedback'
        var article = bridge.doc.querySelector('article') || bridge.doc.body
        article.appendChild(slot)
      }
      slot.innerHTML = cmd.html
      slot.classList.add('show')
    }

    bridge.applyPatch = function (cmd) {
      var target = bridge.doc.querySelector(cmd.selector)
      if (!target) return
      if (cmd.mode === 'replace') target.outerHTML = cmd.html
      else if (cmd.mode === 'append') target.insertAdjacentHTML('beforeend', cmd.html)
      else if (cmd.mode === 'before') target.insertAdjacentHTML('beforebegin', cmd.html)
      else if (cmd.mode === 'after') target.insertAdjacentHTML('afterend', cmd.html)
    }

    bridge.connect = function () {
      if (!state.wsUrl || typeof WebSocket === 'undefined') return
      try {
        var ws = new WebSocket(state.wsUrl)
        ws.addEventListener('message', function (evt) {
          try {
            bridge.handleCommand(JSON.parse(evt.data))
          } catch (e) {
            /* ignore malformed */
          }
        })
        bridge.ws = ws
      } catch (e) {
        /* offline / plain browser — no live updates */
      }
    }

    bridge.injectStyles = function () {
      if (bridge.doc.getElementById('teach-bridge-styles')) return
      var style = bridge.doc.createElement('style')
      style.id = 'teach-bridge-styles'
      style.textContent =
        '.teach-submit{font:inherit;margin-top:.8rem;padding:.5rem .9rem;border:1px solid var(--accent,#2b6cb0);' +
        'background:var(--accent,#2b6cb0);color:#fff;border-radius:.35rem;cursor:pointer}' +
        '.teach-submit:disabled{opacity:.6;cursor:default}' +
        '.teach-feedback{margin-top:1rem;padding:0 1rem;border-left:3px solid var(--accent,#2b6cb0);' +
        'display:none}.teach-feedback.show{display:block}' +
        '.teach-explain{font:inherit;font-size:.7rem;margin-left:.4rem;padding:.05rem .4rem;border:1px solid var(--rule,#ccc);' +
        'background:transparent;color:var(--accent,#2b6cb0);border-radius:.3rem;cursor:pointer;vertical-align:middle}'
      var head = bridge.doc.head || bridge.doc.querySelector('head') || bridge.doc.body
      if (head) head.appendChild(style)
    }

    bridge.init = function () {
      bridge.injectStyles()
      bridge.enhanceExercises()
      bridge.enhanceQuizzes()
      bridge.enhanceExplain()
      bridge.connect()
      bridge.post({ type: 'lesson_opened', eventId: uid(), lessonId: bridge.lessonId, ts: nowIso() })
      return bridge
    }

    return bridge
  }

  var api = {
    slug: slug,
    lessonIdFromLocation: lessonIdFromLocation,
    create: create,
    init: function (state) {
      return create(state || window.__TEACH_BRIDGE__ || {}).init()
    },
  }

  if (typeof window !== 'undefined') {
    window.TeachBridge = api
    if (window.__TEACH_BRIDGE__) {
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function () {
          api.init(window.__TEACH_BRIDGE__)
        })
      } else {
        api.init(window.__TEACH_BRIDGE__)
      }
    }
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = api
})()
