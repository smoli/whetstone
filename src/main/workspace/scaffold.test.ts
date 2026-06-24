import { describe, it, expect } from 'vitest'
import { buildScaffoldPlan, scaffoldSession, needsOverwriteConfirm, type ScaffoldDeps } from './scaffold'

describe('needsOverwriteConfirm', () => {
  it('is false for an empty or OS-noise-only directory', () => {
    expect(needsOverwriteConfirm([])).toBe(false)
    expect(needsOverwriteConfirm(['.DS_Store'])).toBe(false)
  })

  it('is true when real content is present', () => {
    expect(needsOverwriteConfirm(['MISSION.md'])).toBe(true)
    expect(needsOverwriteConfirm(['.DS_Store', 'lessons'])).toBe(true)
  })
})

describe('buildScaffoldPlan', () => {
  it('creates the standard workspace directories', () => {
    const plan = buildScaffoldPlan()
    expect(plan.dirs).toEqual(['lessons', 'reference', 'learning-records', 'lesson-entries', 'assets'])
  })

  it('writes starter docs including a .gitignore that excludes runtime state', () => {
    const plan = buildScaffoldPlan()
    const names = plan.files.map((f) => f.path)
    expect(names).toContain('MISSION.md')
    expect(names).toContain('RESOURCES.md')
    expect(names).toContain('NOTES.md')
    const gitignore = plan.files.find((f) => f.path === '.gitignore')!
    expect(gitignore.content).toContain('.teach-desktop.json')
    expect(gitignore.content).toContain('reviews.json')
  })

  it('embeds the topic in MISSION.md when given', () => {
    const mission = buildScaffoldPlan('watercolor painting').files.find((f) => f.path === 'MISSION.md')!
    expect(mission.content).toContain('Learn watercolor painting')
  })

  it('uses a placeholder when no topic is given', () => {
    const mission = buildScaffoldPlan().files.find((f) => f.path === 'MISSION.md')!
    expect(mission.content).toContain('<your topic>')
  })
})

describe('scaffoldSession', () => {
  function fakeDeps() {
    const writes = new Map<string, string>()
    const mkdirs: string[] = []
    const execs: { file: string; args: string[]; cwd: string }[] = []
    const assets: Record<string, string> = {
      '/repo/ExampleLesson/assets/lesson.css': '/* css */',
      '/repo/ExampleLesson/assets/quiz.js': '// quiz',
    }
    const deps: ScaffoldDeps = {
      async exec(file, args, cwd) {
        execs.push({ file, args, cwd })
        if (args[0] === 'ls-tree') {
          return '.claude/skills/teach/SKILL.md\n.claude/skills/teach/MISSION-FORMAT.md\n'
        }
        if (args[0] === 'show') return `content of ${args[1]}`
        return ''
      },
      async readFile(p) {
        if (p in assets) return assets[p]
        throw new Error('ENOENT ' + p)
      },
      async writeFile(p, content) {
        writes.set(p, content)
      },
      async mkdir(p) {
        mkdirs.push(p)
      },
    }
    return { deps, writes, mkdirs, execs }
  }

  const opts = {
    repoRoot: '/repo',
    assetsSource: '/repo/ExampleLesson/assets',
    targetDir: '/new/course',
    topic: 'chess endgames',
  }

  it('creates dirs, starter docs, copies assets, extracts the skill, and inits git', async () => {
    const { deps, writes, execs } = fakeDeps()
    await scaffoldSession(opts, deps)

    // starter docs + assets + skill files written
    expect(writes.get('/new/course/MISSION.md')).toContain('chess endgames')
    expect(writes.get('/new/course/assets/lesson.css')).toBe('/* css */')
    expect(writes.get('/new/course/assets/quiz.js')).toBe('// quiz')
    expect(writes.get('/new/course/.claude/skills/teach/SKILL.md')).toBe('content of origin/main:.claude/skills/teach/SKILL.md')

    // git operations: ls-tree + show against origin/main in repoRoot, init/add/commit in targetDir
    const cmds = execs.map((e) => `${e.args[0]}@${e.cwd}`)
    expect(cmds).toContain('ls-tree@/repo')
    expect(cmds).toContain('init@/new/course')
    expect(cmds).toContain('add@/new/course')
    const commit = execs.find((e) => e.args[0] === 'commit')!
    expect(commit.args.join(' ')).toContain('chess endgames')
  })

  it('survives a failed git fetch (offline) and still extracts from the cached ref', async () => {
    const { deps, writes } = fakeDeps()
    const realExec = deps.exec
    deps.exec = async (file, args, cwd) => {
      if (args[0] === 'fetch') throw new Error('could not read Username')
      return realExec(file, args, cwd)
    }
    await scaffoldSession(opts, deps)
    expect(writes.get('/new/course/.claude/skills/teach/SKILL.md')).toBeTruthy()
  })
})
