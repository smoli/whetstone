# Milestones — Teach Desktop

An Electron desktop app that wraps **Claude Code** (running the existing `teach`
skill) as the teaching brain, and adds a **bidirectional bridge** so lesson HTML
can send structured interactions to the agent and the agent can push live updates
back into the lesson.

Guiding decisions (locked):

- **Agent engine:** wrap Claude Code as a subprocess (stream-json), reuse the
  `teach` skill. We add hands (an MCP server + a synthesized-input channel), we
  do not reimplement the agent.
- **Scope:** personal-first. Single user, local files, the user's own Claude
  Code auth. No accounts / packaging / multi-user yet.
- **Backward compatible:** existing lessons light up untouched (progressive
  enhancement); a bare terminal run of the skill still works (tools simply
  absent).

The unit of state is the **teaching workspace on disk** (the same files the skill
already uses: `MISSION.md`, `lessons/`, `learning-records/`, `lesson-entries/`,
`assets/`, `RESOURCES.md`, `NOTES.md`). No database in v0 — files are the DB.
Spaced-repetition review dates live in `reviews.json` inside the workspace.

---

## M0 — Scaffold & interaction protocol

**Goal:** a green, lint-clean project skeleton and the typed contract that every
later milestone depends on.

- Deliverables: Electron + Vue 3 + Vite + Vitest + ESLint scaffold;
  `src/shared/protocol.ts` (zod schemas + inferred types) for the two event
  families — `LessonEvent` (lesson → agent) and `AgentCommand` (agent → lesson).
- Exit: `npm test` green, `npm run lint` clean, `npm run typecheck` clean. The
  protocol round-trips (parse/serialize) under test. No UI, no network yet.
- Key tests: every event/command variant parses; malformed payloads reject with
  a typed error; discriminated-union narrowing works.

## M1 — Headless bridge

**Goal:** the backbone that connects lessons and the agent, fully testable under
Node without Electron.

- Deliverables: `BridgeCore` (pure) — `handleLessonEvent()` records the artifact
  + returns a synthesized agent prompt; `applyAgentCommand()` returns WebSocket
  messages to broadcast. Thin `lessonServer` (HTTP serve + POST + WS) and
  `mcpServer` (MCP tools) wrap `BridgeCore`.
- Exit: a POST of each `LessonEvent` produces the right recorded artifact (e.g. a
  `lesson-entries/*.md`) and the right synthesized prompt; each `AgentCommand`
  produces the right WS broadcast. Tests drive `BridgeCore` directly.
- Key tests: slice submission → `lesson-entries/NNNN.md` written + prompt
  contains the text; quiz result → results recorded + prompt summarises score;
  `lesson_feedback` command → WS message targeting the right lesson/anchor;
  idempotent (re-POST same event id does not double-write).

## M2 — Claude Code harness

**Goal:** spawn and drive `claude` in stream-json mode and feed it synthesized
turns from lesson events.

- Deliverables: pure `parseStreamJson` line parser; `ClaudeHarness` with an
  injectable spawn so tests use a fake binary; mapping from `BridgeCore`
  synthesized prompts → stdin turns and from stdout → chat events.
- Exit: a fake `claude` emitting stream-json is parsed into typed chat events; a
  lesson event injected mid-session reaches the subprocess as a user turn.
- Key tests: parser handles assistant text deltas, tool-use blocks, and partial
  lines; harness forwards a synthesized prompt; harness surfaces a crash as a
  typed error state (never raw).

## M3 — Renderer shell

**Goal:** the two-pane app — chat transcript + lesson webview — wired to main.

- Deliverables: Vue 3 `<script setup>` two-pane layout; Pinia stores
  (`chat`, `lesson`, `workspace`); preload exposing a typed IPC surface; lesson
  webview pointed at the local lesson server; `assets/bridge.js`.
- Exit: app boots, shows a workspace's lessons, chat renders streamed agent
  output, lesson loads with `bridge.js` active (progressive enhancement injects a
  Submit button on `.exercise textarea` and hooks `.quiz`).
- Key tests: store reducers (component/unit); `bridge.js` enhancement logic
  (jsdom) — finds the textarea, builds the payload, posts on submit.

## M4 — Win 1: live exercise feedback (end-to-end)

**Goal:** the lesson-4 vertical-slice gap, closed, on the real `ExampleLesson`.

- Submit textarea → recorded to `lesson-entries/` → synthesized turn → agent
  calls `lesson_feedback` → WS → rendered inline by the textarea.
- Exit: demonstrated end-to-end against `ExampleLesson/lessons/0004-*`.

## M5 — Win 2: quiz → memory + spaced repetition

- Quiz completion → structured results → agent updates a learning record and
  calls `schedule_review` → review date persisted to `reviews.json`; due reviews
  surfaced on next launch.

## M6 — Win 3: inline "explain this"

- Per-paragraph "explain ▸" → scoped turn (anchor text attached) → reply in chat
  / popover.

## M7 — Win 4: self-rewriting lessons

- Agent calls `patch_lesson(lessonId, selector, html)` → WS DOM patch **and**
  main persists the patched HTML to disk.

## M8 — Ship the bridge to the skill

- `bridge.js` shipped as a workspace asset; a small addendum to the `teach`
  SKILL.md documenting the MCP tools (`lesson_feedback`, `patch_lesson`,
  `schedule_review`, `record_learning`) and when to call them. Verifies terminal
  use still degrades gracefully.

---

Work milestones in order. Do not start a milestone before its predecessor's exit
criteria (tests green, lint clean) are met.
