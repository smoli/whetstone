import { describe, it, expect } from 'vitest'
import { en } from './en'
import { de } from './de'

/** Recursively collect dotted key paths of a nested message object. */
function keyPaths(obj: unknown, prefix = ''): string[] {
  if (typeof obj !== 'object' || obj === null) return [prefix]
  return Object.entries(obj as Record<string, unknown>).flatMap(([k, v]) =>
    keyPaths(v, prefix ? `${prefix}.${k}` : k),
  )
}

describe('i18n catalogs', () => {
  it('German mirrors English key-for-key (no missing or extra keys)', () => {
    const enKeys = keyPaths(en).sort()
    const deKeys = keyPaths(de).sort()
    expect(deKeys).toEqual(enKeys)
  })

  it('has no empty translations', () => {
    for (const [path, locale] of [
      ...keyPaths(en).map((p) => [p, 'en'] as const),
      ...keyPaths(de).map((p) => [p, 'de'] as const),
    ]) {
      const value = path.split('.').reduce<unknown>((o, k) => (o as Record<string, unknown>)[k], locale === 'en' ? en : de)
      expect(typeof value === 'string' && value.length > 0, `${locale}:${path}`).toBe(true)
    }
  })
})
