import path from 'node:path'

export interface ScaffoldFile {
  path: string
  content: string
}

export interface ScaffoldPlan {
  dirs: string[]
  files: ScaffoldFile[]
}

/** Standard subdirectories of a teaching workspace. */
const WORKSPACE_DIRS = ['lessons', 'reference', 'learning-records', 'lesson-entries', 'assets']

/** Asset files copied from the bundled templates into a new session. */
export const TEMPLATE_ASSETS = ['lesson.css', 'quiz.js']

/** Skill subtree on the canonical branch, copied into each self-contained session. */
export const SKILL_SUBTREE = '.claude/skills/teach'

/**
 * The static scaffold for a new teaching workspace: directories to create and
 * starter docs to write. Pure so the shape is testable. The skill (from
 * origin/main) and assets (from bundled templates) are layered on by the executor.
 */
export function buildScaffoldPlan(topic?: string): ScaffoldPlan {
  const subject = topic?.trim() ? topic.trim() : '<your topic>'
  return {
    dirs: [...WORKSPACE_DIRS],
    files: [
      {
        path: 'MISSION.md',
        content:
          `# Mission: Learn ${subject}\n\n` +
          `## Why\n\n` +
          `<!-- Why do you want to learn this? What real-world goal grounds it? -->\n\n` +
          `## Success looks like\n\n- \n\n` +
          `## Constraints\n\n- \n\n` +
          `## Out of scope\n\n- \n`,
      },
      {
        path: 'RESOURCES.md',
        content:
          `# Resources\n\n` +
          `<!-- High-quality, high-trust sources the teaching is grounded in. -->\n`,
      },
      {
        path: 'NOTES.md',
        content: `# Notes\n\n<!-- Teaching preferences and working notes. -->\n`,
      },
      {
        path: '.gitignore',
        content: ['.teach-desktop.json', 'reviews.json', '.DS_Store', ''].join('\n'),
      },
    ],
  }
}

/**
 * Whether a target directory's contents warrant an overwrite confirmation.
 * Ignores OS noise so an effectively-empty folder doesn't trigger a prompt.
 */
export function needsOverwriteConfirm(entries: string[]): boolean {
  return entries.some((e) => e !== '.DS_Store')
}

export interface ScaffoldDeps {
  /** Run a command, resolving its stdout. */
  exec(file: string, args: string[], cwd: string): Promise<string>
  readFile(absPath: string): Promise<string>
  writeFile(absPath: string, content: string): Promise<void>
  mkdir(absPath: string): Promise<void>
  /** Recursively copy a directory (e.g. the bundled skill). */
  copyDir(src: string, dest: string): Promise<void>
}

export interface ScaffoldOptions {
  /** Absolute path to the bundled skill dir (…/.claude/skills/teach) to copy in. */
  skillSource: string
  /** Directory containing the bundled template assets (lesson.css, quiz.js). */
  assetsSource: string
  /** Where to create the new session. */
  targetDir: string
  topic?: string
}

/**
 * Create a self-contained teaching session: starter docs + bundled assets + a
 * copy of the app's teach skill, then `git init` and an initial commit.
 *
 * Everything is sourced from the app's own bundled files (no git / network), so
 * this works offline and when the app is packaged and handed to someone else.
 * Skill copy and git init are best-effort — a missing skill degrades to the
 * app's --add-dir lending, and a missing git just leaves an un-versioned folder.
 */
export async function scaffoldSession(opts: ScaffoldOptions, deps: ScaffoldDeps): Promise<void> {
  const { targetDir, assetsSource, skillSource, topic } = opts
  const plan = buildScaffoldPlan(topic)

  await deps.mkdir(targetDir)
  for (const dir of plan.dirs) await deps.mkdir(path.join(targetDir, dir))
  for (const file of plan.files) await deps.writeFile(path.join(targetDir, file.path), file.content)

  // Bundled assets (best-effort — a missing template asset shouldn't abort).
  for (const name of TEMPLATE_ASSETS) {
    try {
      const content = await deps.readFile(path.join(assetsSource, name))
      await deps.writeFile(path.join(targetDir, 'assets', name), content)
    } catch {
      /* skip missing asset */
    }
  }

  // Copy the skill so the session is self-contained (best-effort).
  try {
    await deps.copyDir(skillSource, path.join(targetDir, SKILL_SUBTREE))
  } catch {
    /* no bundled skill — the app lends its own via --add-dir at open time */
  }

  await gitInitAndCommit(targetDir, topic, deps)
}

async function gitInitAndCommit(targetDir: string, topic: string | undefined, deps: ScaffoldDeps): Promise<void> {
  try {
    await deps.exec('git', ['init'], targetDir)
    await deps.exec('git', ['add', '-A'], targetDir)
    const msg = topic?.trim() ? `Start teaching session: ${topic.trim()}` : 'Start teaching session'
    await deps.exec('git', ['commit', '-m', msg], targetDir)
  } catch {
    /* git missing / unconfigured — folder is still usable, just not a repo */
  }
}
