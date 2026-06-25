<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'

const maximized = ref(false)
let off: (() => void) | null = null

onMounted(() => {
  off = window.teach.onMaximizeChange((m) => (maximized.value = m))
})
onUnmounted(() => off?.())

const minimize = (): void => window.teach.minimizeWindow()
const toggleMaximize = (): void => window.teach.toggleMaximizeWindow()
const close = (): void => window.teach.closeWindow()
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
  background: var(--ink);
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
  color: var(--paper);
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
  color: var(--paper);
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
