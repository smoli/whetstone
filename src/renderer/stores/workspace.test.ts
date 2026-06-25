import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useWorkspaceStore } from './workspace'

beforeEach(() => setActivePinia(createPinia()))

describe('content navigation + history', () => {
  it('openItem builds a back/forward history', () => {
    const ws = useWorkspaceStore()
    ws.openItem('lessons', 'a.html')
    ws.openItem('lessons', 'b.html')
    expect(ws.current).toEqual({ section: 'lessons', file: 'b.html' })
    expect(ws.canBack).toBe(true)
    expect(ws.canForward).toBe(false)
  })

  it('back and forward traverse history', () => {
    const ws = useWorkspaceStore()
    ws.openItem('lessons', 'a.html')
    ws.openItem('reference', 'g.html')
    ws.back()
    expect(ws.current).toEqual({ section: 'lessons', file: 'a.html' })
    expect(ws.canForward).toBe(true)
    ws.forward()
    expect(ws.current).toEqual({ section: 'reference', file: 'g.html' })
  })

  it('navigating after going back truncates the forward history', () => {
    const ws = useWorkspaceStore()
    ws.openItem('lessons', 'a.html')
    ws.openItem('lessons', 'b.html')
    ws.back() // at a
    ws.openItem('lessons', 'c.html')
    expect(ws.current).toEqual({ section: 'lessons', file: 'c.html' })
    expect(ws.canForward).toBe(false)
    ws.back()
    expect(ws.current).toEqual({ section: 'lessons', file: 'a.html' })
  })

  it('refreshContents opens a newly created lesson in the content view', async () => {
    const ws = useWorkspaceStore()
    let lessonList = ['0001-intro.html']
    ;(globalThis as unknown as { window: { teach: unknown } }).window = {
      teach: {
        listLessons: async () => lessonList,
        listReferences: async () => [],
        listDocs: async () => [],
        gitInfo: async () => ({ isRepo: false, branch: null, hasRemote: false, remoteUrl: null, dirty: false }),
      },
    }
    ws.openItem('lessons', '0001-intro.html')
    lessonList = ['0001-intro.html', '0002-the-next-lesson.html'] // agent created lesson 2
    await ws.refreshContents()
    expect(ws.current).toEqual({ section: 'lessons', file: '0002-the-next-lesson.html' })
  })

  it('onNavigated canonicalizes a mis-cased file against the known list', () => {
    const ws = useWorkspaceStore()
    ws.docs.push('MISSION.md')
    ws.onNavigated('doc', 'MISSION.MD')
    expect(ws.current).toEqual({ section: 'doc', file: 'MISSION.md' })
  })

  it('onNavigated ignores the echo of the current page but records in-page jumps', () => {
    const ws = useWorkspaceStore()
    ws.openItem('lessons', 'a.html')
    ws.onNavigated('lessons', 'a.html') // echo from the iframe loading a.html
    expect(ws.canBack).toBe(false) // no duplicate entry
    ws.onNavigated('lessons', 'b.html') // an in-page link navigated the iframe
    expect(ws.current).toEqual({ section: 'lessons', file: 'b.html' })
    expect(ws.canBack).toBe(true)
  })
})
