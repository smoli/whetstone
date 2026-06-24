import { promises as fs } from 'node:fs'
import path from 'node:path'
import type { WorkspaceFs } from './bridge-core'

/**
 * Real filesystem implementation of WorkspaceFs, rooted at a teaching workspace.
 * All access is confined to the root — relative paths that escape it are rejected,
 * since lesson content is untrusted.
 */
export class NodeWorkspaceFs implements WorkspaceFs {
  constructor(private readonly root: string) {}

  /** Resolve a workspace-relative path, guarding against traversal outside root. */
  resolve(rel: string): string {
    const abs = path.resolve(this.root, rel)
    const rootWithSep = path.resolve(this.root) + path.sep
    if (abs !== path.resolve(this.root) && !abs.startsWith(rootWithSep)) {
      throw new Error(`path escapes workspace: ${rel}`)
    }
    return abs
  }

  async read(rel: string): Promise<string | null> {
    try {
      return await fs.readFile(this.resolve(rel), 'utf8')
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null
      throw err
    }
  }

  async write(rel: string, content: string): Promise<void> {
    const abs = this.resolve(rel)
    await fs.mkdir(path.dirname(abs), { recursive: true })
    await fs.writeFile(abs, content, 'utf8')
  }

  async list(relDir: string): Promise<string[]> {
    try {
      return await fs.readdir(this.resolve(relDir))
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') return []
      throw err
    }
  }
}
