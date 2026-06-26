<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue'
import type { ThemeSource } from '@shared/ipc'

const maximized = ref(false)
const theme = ref<ThemeSource>('system')
let off: (() => void) | null = null

onMounted(async () => {
  off = window.teach.onMaximizeChange((m) => (maximized.value = m))
  theme.value = await window.teach.getTheme()
})
onUnmounted(() => off?.())

const minimize = (): void => window.teach.minimizeWindow()
const toggleMaximize = (): void => window.teach.toggleMaximizeWindow()
const close = (): void => window.teach.closeWindow()

const themeTitle = computed(() => `Theme: ${theme.value} (click to change)`)
function cycleTheme(): void {
  const next: ThemeSource = theme.value === 'system' ? 'light' : theme.value === 'light' ? 'dark' : 'system'
  theme.value = next
  void window.teach.setTheme(next)
}
</script>

<template>
  <header
    class="titlebar"
    @dblclick="toggleMaximize"
  >
    <span class="name">Whetstone</span>

    <div
      class="controls"
      @dblclick.stop
    >
      <button
        class="ctl"
        :title="themeTitle"
        @click="cycleTheme"
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
            d="M13 9.5A5.5 5.5 0 0 1 6.5 3a5.5 5.5 0 1 0 6.5 6.5z"
            fill="none"
            stroke="currentColor"
            stroke-width="1.2"
          />
        </svg>
      </button>
      <button
        class="ctl"
        title="Minimize"
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
        class="ctl"
        :title="maximized ? 'Restore' : 'Maximize'"
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
        class="ctl close"
        title="Close"
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
  height: 100%;
  -webkit-app-region: no-drag;
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
  background: rgba(255, 255, 255, 0.12);
  color: #fff;
}
.ctl.close:hover {
  background: var(--bad);
  color: #fff;
}
</style>
