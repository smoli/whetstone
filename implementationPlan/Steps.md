# Steps — ordered red → green → refactor

One commit per completed step. A step is done when its test(s) are green and lint
is clean. Reference the step in the commit message, e.g. `M1.3: quiz result →
recorded + synthesized prompt`.

## M0 — Scaffold & protocol

- **M0.1** Repo hygiene: `.gitignore`, `implementationPlan/`, rewritten
  `CLAUDE.md`. (docs only)
- **M0.2** Toolchain: `package.json`, `tsconfig*.json`, `electron.vite.config`,
  `vitest.config`, ESLint config. `npm install` succeeds.
- **M0.3** (red) Test: `LessonEvent` variants parse via zod; malformed rejects.
  (green) Write `src/shared/protocol.ts` with `LessonEventSchema`.
- **M0.4** (red) Test: `AgentCommand` variants parse. (green) Add
  `AgentCommandSchema`. Refactor: shared primitives (ids, timestamps).
- **M0.5** Helpers: `parseLessonEvent` / `parseAgentCommand` returning a typed
  Result; tests for the error path. Commit M0.

## M1 — Headless bridge

- **M1.1** (red) `BridgeCore.handleLessonEvent` for an `exercise_submission`
  returns `{ artifact: lesson-entries/NNNN, prompt }`. (green) implement with an
  injected FS + clock. Refactor.
- **M1.2** (red) idempotency: same event id twice → one artifact. (green) dedupe.
- **M1.3** (red) `quiz_result` → results recorded + prompt summarises score.
- **M1.4** (red) `help_request` (inline explain) → scoped prompt with anchor.
- **M1.5** (red) `applyAgentCommand` for `lesson_feedback` / `patch_lesson` /
  `schedule_review` → correct WS broadcast messages.
- **M1.6** `lessonServer`: serve workspace `lessons/` + `assets/`, accept
  `POST /events`, broadcast over WS. Wrap `BridgeCore`. (integration test on an
  ephemeral port)
- **M1.7** `mcpServer`: expose the four tools, each delegating to `BridgeCore`.
  Commit M1.

## M2 — Claude Code harness

- **M2.1** (red) `parseStreamJson` — assistant text, tool_use, partial-line
  buffering. (green) implement. Refactor.
- **M2.2** (red) `ClaudeHarness.send()` writes a user turn to stdin (fake spawn).
- **M2.3** (red) lesson event → `BridgeCore` prompt → `harness.send` path.
- **M2.4** (red) subprocess exit / error → typed `ClaudeError` state, never raw.
  Commit M2.

## M3 — Renderer shell

- **M3.1** Electron main: create window, start `lessonServer` + `mcpServer` +
  `ClaudeHarness`, load renderer.
- **M3.2** Preload: typed IPC surface (`window.teach`).
- **M3.3** Pinia stores + tests: `chat`, `lesson`, `workspace`.
- **M3.4** Two-pane Vue layout; lesson `<webview>` → local server.
- **M3.5** (red, jsdom) `bridge.js` enhancement: inject Submit on
  `.exercise textarea`, hook `.quiz`, build payload, POST. (green) implement.
  Commit M3.

## M4–M8

Follow `Milestones.md`; each win is: wire the already-tested event/command
through the live stack, then an end-to-end check (M4 against `ExampleLesson`),
then commit.
