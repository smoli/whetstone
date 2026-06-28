import { createI18n } from 'vue-i18n'
import { en } from './en'
import { de } from './de'

export type Locale = 'en' | 'de'
export const LOCALES: Locale[] = ['en', 'de']
const STORAGE_KEY = 'teach.locale'

/** Persisted choice, else the OS language if German, else English. */
export function initialLocale(): Locale {
  const saved = localStorage.getItem(STORAGE_KEY)
  if (saved === 'en' || saved === 'de') return saved
  return navigator.language?.toLowerCase().startsWith('de') ? 'de' : 'en'
}

export const i18n = createI18n({
  legacy: false,
  globalInjection: true,
  locale: initialLocale(),
  fallbackLocale: 'en',
  messages: { en, de },
})

/** Switch + persist the active locale and reflect it on <html lang>. */
export function setLocale(locale: Locale): void {
  i18n.global.locale.value = locale
  localStorage.setItem(STORAGE_KEY, locale)
  document.documentElement.lang = locale
}

export function currentLocale(): Locale {
  return i18n.global.locale.value as Locale
}
