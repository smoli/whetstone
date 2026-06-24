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
    const copies: { src: string; dest: string }[] = []
    const assets: Record<string, string> = {
      '/app/assets/lesson.css': '/* css */',
      '/app/assets/quiz.js': '// quiz',
    }
    const deps: ScaffoldDeps = {
      async exec(file, args, cwd) {
        execs.push({ file, args, cwd })
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
      async copyDir(src, dest) {
        copies.push({ src, dest })
      },
    }
    return { deps, writes, mkdirs, execs, copies }
  }

  const opts = {
    skillSource: '/app/.claude/skills/teach',
    assetsSource: '/app/assets',
    targetDir: '/new/course',
    topic: 'chess endgames',
  }

  it('creates dirs, starter docs, copies assets, copies the bundled skill, and inits git', async () => {
    const { deps, writes, execs, copies } = fakeDeps()
    await scaffoldSession(opts, deps)

    expect(writes.get('/new/course/MISSION.md')).toContain('chess endgames')
    expect(writes.get('/new/course/assets/lesson.css')).toBe('/* css */')
    expect(writes.get('/new/course/assets/quiz.js')).toBe('// quiz')

    // skill copied from the bundled dir into the session, no git fetch/ls-tree
    expect(copies).toContainEqual({ src: '/app/.claude/skills/teach', dest: '/new/course/.claude/skills/teach' })
    expect(execs.some((e) => e.args[0] === 'fetch' || e.args[0] === 'ls-tree')).toBe(false)

    const cmds = execs.map((e) => `${e.args[0]}@${e.cwd}`)
    expect(cmds).toContain('init@/new/course')
    expect(execs.find((e) => e.args[0] === 'commit')!.args.join(' ')).toContain('chess endgames')
  })

  it('still creates the folder when git is unavailable (best-effort init)', async () => {
    const { deps, writes } = fakeDeps()
    deps.exec = async () => {
      throw new Error('git: command not found')
    }
    await scaffoldSession(opts, deps)
    expect(writes.get('/new/course/MISSION.md')).toBeTruthy()
  })

  it('still creates the folder when the bundled skill is missing (degrades to --add-dir)', async () => {
    const { deps, writes } = fakeDeps()
    deps.copyDir = async () => {
      throw new Error('ENOENT skill')
    }
    await scaffoldSession(opts, deps)
    expect(writes.get('/new/course/MISSION.md')).toBeTruthy()
  })
})
