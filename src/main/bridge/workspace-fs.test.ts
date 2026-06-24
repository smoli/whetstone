import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { NodeWorkspaceFs } from './workspace-fs'

let root: string
let wfs: NodeWorkspaceFs

beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'teach-wfs-'))
  wfs = new NodeWorkspaceFs(root)
})

afterEach(async () => {
  await fs.rm(root, { recursive: true, force: true })
})

describe('NodeWorkspaceFs', () => {
  it('round-trips write/read, creating parent dirs', async () => {
    await wfs.write('learning-records/0001-x.md', '# hi')
    expect(await wfs.read('learning-records/0001-x.md')).toBe('# hi')
  })

  it('read returns null for a missing file', async () => {
    expect(await wfs.read('nope.md')).toBeNull()
  })

  it('list returns [] for a missing dir, names for a present one', async () => {
    expect(await wfs.list('learning-records')).toEqual([])
    await wfs.write('learning-records/0001-x.md', 'a')
    await wfs.write('learning-records/0002-y.md', 'b')
    expect((await wfs.list('learning-records')).sort()).toEqual(['0001-x.md', '0002-y.md'])
  })

  it('rejects paths that escape the workspace', async () => {
    await expect(wfs.read('../../etc/passwd')).rejects.toThrow(/escapes workspace/)
  })
})
