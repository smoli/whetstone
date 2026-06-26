<script setup lang="ts">
import { ref, computed, nextTick, watch, onMounted, onUnmounted } from 'vue'
import { useChatStore } from '../stores/chat'
import { useWorkspaceStore } from '../stores/workspace'
import SparkSpinner from './SparkSpinner.vue'
import { renderMarkdown } from '../markdown'
import { resolveChatLink } from '@shared/links'

const chat = useChatStore()
const ws = useWorkspaceStore()

// Intercept link clicks in chat: open lessons/references in the content view and
// real URLs in the browser. preventDefault keeps the chat scroll exactly put.
function onListClick(e: MouseEvent): void {
  const anchor = (e.target as HTMLElement).closest('a')
  if (!anchor) return
  e.preventDefault()
  const href = anchor.getAttribute('href') ?? ''
  const link = resolveChatLink(href, {
    lessonBase: ws.config?.lessonBase ?? '',
    lessons: ws.lessons,
    references: ws.references,
    docs: ws.docs,
  })
  if (link.kind === 'lesson') ws.openItem('lessons', link.file)
  else if (link.kind === 'reference') ws.openItem('reference', link.file)
  else if (link.kind === 'doc') ws.openItem('doc', link.file)
  else if (link.kind === 'external') window.teach.openExternal(link.url)
}
const draft = ref('')
const list = ref<HTMLElement | null>(null)

// Thinking timer: tick once a second; elapsed derives from the store's startedAt.
const tick = ref(Date.now())
let timer: ReturnType<typeof setInterval> | null = null
onMounted(() => {
  timer = setInterval(() => (tick.value = Date.now()), 250)
})
onUnmounted(() => {
  if (timer) clearInterval(timer)
})

const elapsed = computed(() => {
  if (!chat.busy || !chat.startedAt) return 0
  return Math.max(0, Math.round((tick.value - chat.startedAt) / 1000))
})

function submit(): void {
  if (!draft.value.trim()) return
  chat.send(draft.value)
  draft.value = ''
}

function md(text: string): string {
  return renderMarkdown(text)
}

watch(
  () => [chat.messages.length, chat.busy] as const,
  async () => {
    await nextTick()
    if (list.value) list.value.scrollTop = list.value.scrollHeight
  },
)
</script>

<template>
  <section class="chat">
    <header class="chat-head">
      <span class="eyebrow">
        <SparkSpinner
          :spinning="chat.busy"
          :size="24"
          class="teacher-spark"
        />Your teacher<span
          v-if="ws.config?.skillVersion"
          class="skill-ver"
          title="Teaching skill version"
        >v{{ ws.config.skillVersion }}</span></span>
      <select
        class="model-select"
        :value="ws.model"
        title="Model"
        @change="ws.setModel(($event.target as HTMLSelectElement).value)"
      >
        <option
          v-for="m in ws.models"
          :key="m.id"
          :value="m.id"
        >
          {{ m.label }}
        </option>
      </select>
    </header>

    <div
      ref="list"
      class="chat-list"
      @click="onListClick"
    >
      <template
        v-for="m in chat.messages"
        :key="m.id"
      >
        <div
          v-if="m.role === 'tool'"
          class="tool-pill"
        >
          <span class="spark">✦</span>
          {{ m.text }}<span
            v-if="(m.count ?? 1) > 1"
            class="tool-count"
          > ×{{ m.count }}</span>
        </div>
        <article
          v-else
          :class="['msg', `msg--${m.role}`]"
        >
          <div
            v-if="m.role === 'assistant'"
            class="md"
            v-html="md(m.text)"
          />
          <span v-else>{{ m.text }}</span>
        </article>
      </template>

      <div
        v-if="chat.busy"
        class="thinking"
      >
        <SparkSpinner
          :spinning="true"
          :size="22"
        /> Thinking… <span class="secs">{{ elapsed }}s</span>
      </div>
    </div>

    <form
      class="chat-input"
      @submit.prevent="submit"
    >
      <textarea
        v-model="draft"
        placeholder="Ask your teacher anything, or paste your work…"
        rows="3"
        @keydown.enter.exact.prevent="submit"
      />
      <button
        type="submit"
        :disabled="!draft.trim()"
      >
        Send
      </button>
    </form>
  </section>
</template>

<style scoped>
.chat {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--paper);
  border-left: 1px solid var(--rule);
}
.chat-head {
  height: var(--head-h);
  padding: 0 1.1rem;
  border-bottom: 1px solid var(--rule);
  background: var(--paper-card);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.6rem;
  box-sizing: border-box;
}
.model-select {
  font-family: var(--sans);
  font-size: 0.78rem;
  color: var(--ink-soft);
  background: #fff;
  border: 1px solid var(--rule);
  border-radius: 0.4rem;
  padding: 0.2rem 0.4rem;
  cursor: pointer;
}
.eyebrow {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  font-family: var(--sans);
  font-size: 0.7rem;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--accent);
  font-weight: 600;
}
.skill-ver {
  color: var(--ink-soft);
  font-weight: 500;
  letter-spacing: 0.06em;
  text-transform: none;
}
.chat-list {
  flex: 1;
  overflow-y: auto;
  padding: 1.1rem;
  display: flex;
  flex-direction: column;
  gap: 0.7rem;
}
.msg {
  padding: 0.6rem 0.85rem;
  border-radius: 0.7rem;
  max-width: 88%;
  line-height: 1.5;
  font-size: 0.96rem;
}
.msg--user {
  align-self: flex-end;
  background: var(--accent);
  color: #fff;
  white-space: pre-wrap;
}
.msg--assistant {
  align-self: stretch;
  max-width: 100%;
  background: transparent;
  border: 0;
  padding: 0.1rem 0;
  color: var(--ink);
}
.msg--system {
  align-self: center;
  font-size: 0.85rem;
  color: var(--bad);
  font-family: var(--sans);
}
.tool-pill {
  align-self: center;
  font-family: var(--sans);
  font-size: 0.74rem;
  letter-spacing: 0.02em;
  color: var(--ink-soft);
  background: #f1ece2;
  border: 1px solid var(--rule);
  border-radius: 999px;
  padding: 0.2rem 0.7rem;
}
.tool-pill .spark {
  color: var(--accent);
  margin-right: 0.3rem;
}
.tool-count {
  color: var(--accent);
}
.thinking {
  align-self: flex-start;
  font-family: var(--sans);
  font-size: 0.82rem;
  color: var(--ink-soft);
  display: flex;
  align-items: center;
  gap: 0.4rem;
}
.thinking .secs {
  font-variant-numeric: tabular-nums;
  color: var(--accent);
}

/* rendered markdown */
.md :deep(p) { margin: 0 0 0.6rem; }
.md :deep(p:last-child) { margin-bottom: 0; }
.md :deep(ul), .md :deep(ol) { margin: 0 0 0.6rem; padding-left: 1.2rem; }
.md :deep(li) { margin: 0.15rem 0; }
.md :deep(code) {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 0.85em;
  background: #eee6d8;
  padding: 0.08rem 0.3rem;
  border-radius: 0.25rem;
}
.md :deep(pre) {
  background: #2b2622;
  color: #f6f0e6;
  padding: 0.7rem 0.9rem;
  border-radius: 0.5rem;
  overflow-x: auto;
}
.md :deep(pre code) { background: none; padding: 0; color: inherit; }
.md :deep(a) { color: var(--link); border-bottom: 1px solid var(--accent-soft); }
.md :deep(h1), .md :deep(h2), .md :deep(h3) { font-size: 1.05rem; margin: 0.6rem 0 0.4rem; }
.md :deep(blockquote) {
  border-left: 3px solid var(--accent-soft);
  margin: 0 0 0.6rem;
  padding-left: 0.8rem;
  color: var(--ink-soft);
}

.chat-input {
  display: flex;
  gap: 0.5rem;
  padding: 0.8rem;
  border-top: 1px solid var(--rule);
  background: var(--paper-card);
}
.chat-input textarea {
  flex: 1;
  resize: none;
  font: inherit;
  font-size: 0.95rem;
  padding: 0.55rem 0.7rem;
  border: 1px solid var(--rule);
  border-radius: 0.5rem;
  background: #fff;
  color: var(--ink);
}
.chat-input textarea:focus {
  outline: 2px solid var(--accent-soft);
  border-color: var(--accent);
}
.chat-input button {
  font-family: var(--sans);
  font-weight: 600;
  font-size: 0.85rem;
  padding: 0 1rem;
  border: 0;
  border-radius: 0.5rem;
  background: var(--accent);
  color: #fff;
  cursor: pointer;
}
.chat-input button:disabled {
  opacity: 0.45;
  cursor: default;
}
</style>
