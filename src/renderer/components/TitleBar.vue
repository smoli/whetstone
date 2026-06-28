<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { ThemeSource } from '@shared/ipc'
import { setLocale, currentLocale, type Locale } from '../i18n'

const { t } = useI18n()

const maximized = ref(false)
const theme = ref<ThemeSource>('system')
const locale = ref<Locale>(currentLocale())
// On macOS the OS draws the window controls (traffic lights); we only render
// our own minimize/maximize/close on Windows/Linux.
const isMac = window.teach.platform === 'darwin'
let off: (() => void) | null = null

onMounted(async () => {
  off = window.teach.onMaximizeChange((m) => (maximized.value = m))
  theme.value = await window.teach.getTheme()
})
onUnmounted(() => {
  off?.()
  if (labelTimer !== null) clearTimeout(labelTimer)
})

const minimize = (): void => window.teach.minimizeWindow()
const toggleMaximize = (): void => window.teach.toggleMaximizeWindow()
const close = (): void => window.teach.closeWindow()

const themeName = computed(() => t(`theme.${theme.value}`))
const themeTitle = computed(() => t('titlebar.themeHint', { name: themeName.value }))
// The cycle includes "system", which can look identical to light/dark; a brief
// label confirms which state each click lands on, then fades out to stay clean.
const themeLabel = computed(() => themeName.value)
const labelVisible = ref(false)
const labelHovered = ref(false)
const labelShown = computed(() => labelVisible.value || labelHovered.value)
let labelTimer: ReturnType<typeof setTimeout> | null = null
function cycleTheme(): void {
  const next: ThemeSource = theme.value === 'system' ? 'light' : theme.value === 'light' ? 'dark' : 'system'
  theme.value = next
  void window.teach.setTheme(next)
  labelVisible.value = true
  if (labelTimer !== null) clearTimeout(labelTimer)
  labelTimer = setTimeout(() => (labelVisible.value = false), 1600)
}

const languageTitle = computed(() => t('titlebar.languageHint', { name: t(`language.${locale.value}`) }))
function toggleLanguage(): void {
  const next: Locale = locale.value === 'en' ? 'de' : 'en'
  locale.value = next
  setLocale(next)
}
</script>

<template>
  <header
    class="titlebar"
    :class="{ mac: isMac }"
    @dblclick="toggleMaximize"
  >
    <span class="name">Whetstone</span>

    <div
      class="controls"
      @dblclick.stop
    >
      <button
        class="ctl lang"
        :title="languageTitle"
        @click="toggleLanguage"
      >
        {{ locale.toUpperCase() }}
      </button>
      <span
        class="theme-label"
        :class="{ show: labelShown }"
        aria-hidden="true"
      >{{ themeLabel }}</span>
      <button
        class="ctl"
        :title="themeTitle"
        @click="cycleTheme"
        @mouseenter="labelHovered = true"
        @mouseleave="labelHovered = false"
      >
        <!-- system: monitor -->
        <svg
          v-if="theme === 'system'"
          viewBox="0 0 16 16"
          width="13"
          height="13"
        >
          <rect
            x="1.5"
            y="2.5"
            width="13"
            height="9"
            rx="1"
            fill="none"
            stroke="currentColor"
            stroke-width="1.2"
          />
          <path
            d="M6 14h4M8 11.5V14"
            stroke="currentColor"
            stroke-width="1.2"
          />
        </svg>
        <!-- light: sun -->
        <svg
          v-else-if="theme === 'light'"
          viewBox="0 0 16 16"
          width="13"
          height="13"
        >
          <circle
            cx="8"
            cy="8"
            r="3"
            fill="none"
            stroke="currentColor"
            stroke-width="1.2"
          />
          <path
            d="M8 1v2M8 13v2M1 8h2M13 8h2M3 3l1.4 1.4M11.6 11.6 13 13M13 3l-1.4 1.4M4.4 11.6 3 13"
            stroke="currentColor"
            stroke-width="1.2"
          />
        </svg>
        <!-- dark: moon -->
        <svg
          v-else
          viewBox="0 0 16 16"
          width="13"
          height="13"
        >
          <path
            d="M11 2.8a6 6 0 1 0 0 10.4 7.5 7.5 0 0 1 0-10.4z"
            fill="none"
            stroke="currentColor"
            stroke-width="1.2"
            stroke-linejoin="round"
          />
        </svg>
      </button>
      <button
        v-if="!isMac"
        class="ctl"
        :title="t('titlebar.minimize')"
        @click="minimize"
      >
        <svg
          viewBox="0 0 12 12"
          width="11"
          height="11"
        >
          <path
            d="M2 6h8"
            stroke="currentColor"
            stroke-width="1.2"
          />
        </svg>
      </button>
      <button
        v-if="!isMac"
        class="ctl"
        :title="maximized ? t('titlebar.restore') : t('titlebar.maximize')"
        @click="toggleMaximize"
      >
        <svg
          v-if="!maximized"
          viewBox="0 0 12 12"
          width="11"
          height="11"
        >
          <rect
            x="2.2"
            y="2.2"
            width="7.6"
            height="7.6"
            rx="1"
            fill="none"
            stroke="currentColor"
            stroke-width="1.2"
          />
        </svg>
        <svg
          v-else
          viewBox="0 0 12 12"
          width="11"
          height="11"
        >
          <rect
            x="2.2"
            y="3.4"
            width="6.4"
            height="6.4"
            rx="1"
            fill="none"
            stroke="currentColor"
            stroke-width="1.2"
          />
          <path
            d="M4.4 3.4V2.2h6.4v6.4H9.4"
            fill="none"
            stroke="currentColor"
            stroke-width="1.2"
          />
        </svg>
      </button>
      <button
        v-if="!isMac"
        class="ctl close"
        :title="t('titlebar.close')"
        @click="close"
      >
        <svg
          viewBox="0 0 12 12"
          width="11"
          height="11"
        >
          <path
            d="M3 3l6 6M9 3l-6 6"
            stroke="currentColor"
            stroke-width="1.2"
          />
        </svg>
      </button>
    </div>
  </header>
</template>

<style scoped>
.titlebar {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  height: 2.3rem;
  flex: 0 0 auto;
  background: var(--titlebar-bg);
  /* The whole bar drags the window; interactive bits opt out below. */
  -webkit-app-region: drag;
  user-select: none;
}
/* macOS draws the traffic lights at top-left; reserve room so the centered
   title and theme toggle never sit under them. */
.titlebar.mac {
  padding-left: 78px;
}
.name {
  position: absolute;
  left: 0;
  right: 0;
  text-align: center;
  font-family: var(--serif);
  font-size: 1.1rem;
  font-weight: 600;
  color: var(--titlebar-fg);
  letter-spacing: 0.02em;
  pointer-events: none;
}
.controls {
  display: flex;
  align-items: center;
  height: 100%;
  -webkit-app-region: no-drag;
}
/* Transient confirmation of the chosen theme; fades out to keep the bar clean. */
.theme-label {
  font-size: 0.78rem;
  font-weight: 500;
  color: var(--titlebar-fg);
  letter-spacing: 0.02em;
  margin-right: 0.1rem;
  opacity: 0;
  transform: translateX(4px);
  transition:
    opacity 0.45s ease,
    transform 0.45s ease;
  pointer-events: none;
  white-space: nowrap;
}
.theme-label.show {
  opacity: 0.85;
  transform: translateX(0);
  transition-duration: 0.12s;
}
.ctl {
  width: 2.8rem;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 0;
  background: transparent;
  color: var(--titlebar-fg);
  cursor: pointer;
}
.ctl:hover {
  color: #fff;
}
/* The language toggle shows its 2-letter code as text, not an icon. */
.ctl.lang {
  width: auto;
  padding: 0 0.6rem;
  font-family: var(--sans);
  font-size: 0.72rem;
  font-weight: 600;
  letter-spacing: 0.06em;
  opacity: 0.85;
}
.ctl.lang:hover {
  opacity: 1;
}
.ctl.close:hover {
  background: var(--bad);
  color: #fff;
}
</style>
