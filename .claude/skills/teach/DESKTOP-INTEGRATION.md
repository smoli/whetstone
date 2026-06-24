# Teach Desktop integration

When this skill runs **inside the Teach Desktop app**, the lesson the learner is
viewing can talk back to you, and you can act on the live lesson. This is
optional: in a bare terminal the tools below are simply absent and you behave
exactly as before (the learner pastes work into chat by hand).

## How it works

The app spawns you (Claude Code) with the **`teach-bridge` MCP server** connected.
When the learner does something in a lesson, the app injects a synthesized user
turn describing it — e.g. _"The learner submitted their response to exercise
'design-one-complete-moment' in lesson 0004… Here is what they wrote: …"_. Treat
those turns as real learner activity and respond with the matching tool.

## The four bridge tools

- **`lesson_feedback`** — render feedback **inline in the lesson** the learner is
  reading. `{ lessonId, anchorId?, html }`. Use after an `exercise_submission`.
  Set `anchorId` to the exercise's `promptId` (the app gave it to you in the
  synthesized turn) so the feedback lands right beside their work. `html` is a
  small fragment — a few sentences, maybe a list. Keep it Tufte-clean.

- **`patch_lesson`** — change the live lesson. `{ lessonId, selector, mode, html }`
  with `mode` ∈ `replace | append | before | after`. Use to adapt a lesson to the
  learner (e.g. move a beat, add a harder question). The patch is persisted and
  replayed when the lesson reloads.

- **`schedule_review`** — space a future review. `{ lessonId, dueDate (YYYY-MM-DD),
  reason? }`. Use after a `quiz_result`, sooner if they struggled, later if they
  aced it. (Storage strength over fluency — see the Philosophy section.)

- **`record_learning`** — write a learning record. `{ title, body }`. Use when a
  submission or quiz shows genuine, non-trivial understanding. Same bar as
  [LEARNING-RECORD-FORMAT.md](./LEARNING-RECORD-FORMAT.md) — evidence, not
  coverage.

## Authoring lessons so the bridge can light them up

`bridge.js` is **auto-injected** by the app — never add it to a lesson yourself.
It progressively enhances standard markup:

- **Exercises:** wrap in `<div class="exercise">` containing a `<textarea>`. The
  app injects a "Send to your teacher" button and a feedback slot. The exercise's
  `promptId` is the slug of its `<h3>` (or set `data-prompt-id="…"` explicitly).
- **Quizzes:** keep using the `.quiz[data-quiz]` + `<script class="quiz-data">`
  convention (see `assets/quiz.js`). Completing all questions reports a
  `quiz_result` automatically.
- **Inline "explain this":** add `data-explain` to any element (its text, or the
  `data-explain` value, becomes the question). The app injects an "explain ▸"
  button that sends a `help_request` scoped to that passage.

All of this is backward compatible: the same lesson opened in a plain browser
just shows the affordances and does nothing over the network.
