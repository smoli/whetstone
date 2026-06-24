# CLAUDE.md — Teach Desktop

An Electron desktop app that gives the existing `teach` skill an integrated home:
a two-pane experience (agentic **chat** + a live **lesson** view) where lesson
HTML can send structured interactions to the agent and the agent can push live
updates back into the lesson.

The teaching brain is **Claude Code itself**, wrapped as a subprocess running the
`teach` skill in `.claude/skills/teach/`. We do not reimplement the agent — we
add a bridge (an MCP server + a synthesized-input channel) so the lesson and the
agent can talk both ways.

## Plan

- [implementationPlan/Milestones.md](implementationPlan/Milestones.md) — goals,
  deliverables, exit criteria per milestone.
- [implementationPlan/Steps.md](implementationPlan/Steps.md) — ordered
  red→green→refactor steps.

Work milestones in order. Don't start one before its predecessor is green +
lint-clean.

## Architecture

```
RENDERER (Vue 3 + Pinia)            MAIN PROCESS
  chat | lesson webview  <— IPC —>    Workspace FS (the teach workspace dir)
                                      Lesson server (HTTP serve + POST + WS)
                                      Bridge MCP server  <— tool calls — claude
                                      claude subprocess (teach skill, stream-json)
```

The app both **spawns** `claude` and is an **MCP server** `claude` connects to —
that closes the loop. Lesson interactions become synthesized user turns; the
agent's `lesson_feedback` / `patch_lesson` / `schedule_review` / `record_learning`
tool calls flow back to the lesson over WebSocket.

The unit of state is the **teaching workspace on disk** — the same files the skill
already uses (`MISSION.md`, `lessons/`, `learning-records/`, `lesson-entries/`,
`assets/`, `RESOURCES.md`, `NOTES.md`). No database in v0; files are the DB.
`reviews.json` (in the workspace) holds spaced-repetition due dates.
`ExampleLesson/` is a real workspace used as a test fixture and demo target.

## TDD is mandatory

Every behavior change is written **test-first**, red → green → refactor:

1. Write a failing Vitest test that specifies the behavior.
2. Run it; confirm it fails for the right reason.
3. Write the minimum code to pass.
4. Refactor with the test green.

Rules:

- **No production logic lands without a test that drove it.** Don't write the
  implementation first and backfill a mirror test.
- New bug fix → first a failing test that reproduces it.
- Keep domain logic in `src/shared/` as **pure functions** so it tests without
  Electron, the network, or a live `claude`. The interaction protocol, the
  `BridgeCore`, and the stream-json parser all live here or in pure modules.
- **Never spawn a real `claude` in tests.** Inject the spawn; use a fake binary
  emitting stream-json.
- **Never bind real ports in unit tests.** Drive `BridgeCore` directly; reserve
  ephemeral-port integration tests for the thin server wrappers.

Must-have tests (non-exhaustive): every protocol variant round-trips and rejects
malformed input; each `LessonEvent` → correct recorded artifact + synthesized
prompt; idempotent event handling (no double-write on re-POST); each
`AgentCommand` → correct WS broadcast; stream-json parser handles partial lines
and tool-use blocks; a subprocess crash surfaces as a typed error, never raw.

## Git workflow

- **Commit after each successful step** (test green + lint clean). One commit per
  step in [implementationPlan/Steps.md](implementationPlan/Steps.md). Message
  references the step, e.g. `M1.3: quiz result → recorded + synthesized prompt`.
- The working tree must be green at commit time. Never commit failing tests or
  lint errors.
- **Never commit secrets or user data.** No keys, no `.env`, no teaching
  `workspaces/`. `.gitignore` covers build output, `node_modules`, workspaces,
  and editor/OS cruft.

## Coding conventions

- TypeScript strict; no `any` without a written reason. Explicit types on the IPC
  and MCP boundaries.
- Vue 3 `<script setup>` + Composition API; state in Pinia stores, not
  components. Components are thin; logic lives in stores or `src/shared/`.
- Keep side effects (network, fs, child_process, Electron APIs) out of
  `src/shared/`. Pure core takes injected fs/clock/spawn.
- Errors from `claude` or providers are surfaced to the UI as typed, user-readable
  states — never raw, and never containing user content verbatim in logs.
- Backward compatibility is a feature: existing lessons must keep working
  untouched (progressive enhancement), and a bare-terminal skill run must degrade
  gracefully (MCP tools simply absent).

## Layout

```
src/
  shared/      pure domain — protocol, BridgeCore, stream-json parser (+ tests)
  main/        Electron main, lesson server, MCP server, claude harness
  preload/     typed IPC surface
  renderer/    Vue app (panes, stores, components)
assets/        bridge.js + shared lesson assets shipped to workspaces
.claude/skills/teach/   the teach skill (the brain)
ExampleLesson/          sample workspace / fixture
```

## Gotchas

- The `teach` skill expects a workspace as the working directory. The app sets
  the spawned `claude`'s cwd to the active workspace so the skill's relative paths
  (`lessons/`, `learning-records/`) resolve.
- `claude` stream-json is newline-delimited JSON; lines can arrive partial —
  always buffer until newline before parsing.
- The lesson webview runs **AI-generated HTML/JS**. Treat it as untrusted: it
  reaches the app only through the bridge's POST/WS protocol, never via direct
  node integration. (Hardening is a later, productization concern; keep the
  boundary clean now so it's cheap then.)
