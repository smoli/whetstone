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
  <header class="titlebar">
    <div
      class="brand"
      @dblclick="toggleMaximize"
    >
      <svg
        class="logo"
        viewBox="0 0 1024 1024"
        width="18"
        height="18"
        aria-hidden="true"
      >
        <defs>
          <linearGradient
            id="tb-bg"
            x1="0"
            y1="0"
            x2="0"
            y2="1"
          >
            <stop
              offset="0"
              stop-color="#3b322b"
            />
            <stop
              offset="1"
              stop-color="#1d1814"
            />
          </linearGradient>
          <linearGradient
            id="tb-spark"
            x1="0"
            y1="0"
            x2="0"
            y2="1"
          >
            <stop
              offset="0"
              stop-color="#ffe1b8"
            />
            <stop
              offset="0.45"
              stop-color="#f6a14a"
            />
            <stop
              offset="1"
              stop-color="#b5532a"
            />
          </linearGradient>
          <linearGradient
            id="tb-stone"
            x1="0"
            y1="0"
            x2="0"
            y2="1"
          >
            <stop
              offset="0"
              stop-color="#d7c9b3"
            />
            <stop
              offset="1"
              stop-color="#6f6353"
            />
          </linearGradient>
        </defs>
        <rect
          x="100"
          y="100"
          width="824"
          height="824"
          rx="184"
          fill="url(#tb-bg)"
        />
        <g transform="rotate(-7 512 772)">
          <rect
            x="214"
            y="726"
            width="596"
            height="96"
            rx="48"
            fill="url(#tb-stone)"
          />
        </g>
        <path
          d="M512 190 Q556 406 772 450 Q556 494 512 710 Q468 494 252 450 Q468 406 512 190 Z"
          fill="url(#tb-spark)"
        />
      </svg>
      <span class="name">Whetstone</span>
    </div>

    <div class="controls">
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
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 2rem;
  flex: 0 0 auto;
  background: var(--paper-card);
  border-bottom: 1px solid var(--rule);
  /* The whole bar drags the window; interactive bits opt out below. */
  -webkit-app-region: drag;
  user-select: none;
}
.brand {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  padding-left: 0.6rem;
}
.logo {
  display: block;
  border-radius: 4px;
}
.name {
  font-family: var(--serif);
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--ink);
  letter-spacing: 0.01em;
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
  color: var(--ink-soft);
  cursor: pointer;
}
.ctl:hover {
  background: #e7ddcb;
  color: var(--ink);
}
.ctl.close:hover {
  background: var(--bad);
  color: #fff;
}
</style>
