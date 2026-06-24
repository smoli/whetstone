<script setup lang="ts">
import { ref, nextTick, watch } from 'vue'
import { useChatStore } from '../stores/chat'

const chat = useChatStore()
const draft = ref('')
const list = ref<HTMLElement | null>(null)

function submit(): void {
  if (!draft.value.trim()) return
  chat.send(draft.value)
  draft.value = ''
}

watch(
  () => chat.messages.length,
  async () => {
    await nextTick()
    if (list.value) list.value.scrollTop = list.value.scrollHeight
  },
)
</script>

<template>
  <section class="chat">
    <header class="chat-head">
      Your teacher
    </header>
    <div
      ref="list"
      class="chat-list"
    >
      <article
        v-for="m in chat.messages"
        :key="m.id"
        :class="['msg', `msg--${m.role}`, { pending: m.pending }]"
      >
        <span
          v-if="m.role === 'tool'"
          class="tool-label"
        >🛠 {{ m.text }}</span>
        <span v-else>{{ m.text }}</span>
      </article>
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
      <button type="submit">
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
  border-left: 1px solid var(--rule, #ddd);
}
.chat-head {
  padding: 0.6rem 1rem;
  font-weight: 600;
  border-bottom: 1px solid var(--rule, #ddd);
}
.chat-list {
  flex: 1;
  overflow-y: auto;
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}
.msg {
  padding: 0.5rem 0.75rem;
  border-radius: 0.5rem;
  max-width: 85%;
  white-space: pre-wrap;
  line-height: 1.4;
}
.msg--user {
  align-self: flex-end;
  background: #2b6cb0;
  color: #fff;
}
.msg--assistant {
  align-self: flex-start;
  background: #f0f0ef;
}
.msg--tool {
  align-self: center;
  font-size: 0.8rem;
  color: #777;
  background: transparent;
}
.msg--system {
  align-self: center;
  font-size: 0.85rem;
  color: #a33;
}
.msg.pending::after {
  content: '▍';
  opacity: 0.5;
}
.chat-input {
  display: flex;
  gap: 0.5rem;
  padding: 0.75rem;
  border-top: 1px solid var(--rule, #ddd);
}
.chat-input textarea {
  flex: 1;
  resize: none;
  font: inherit;
  padding: 0.5rem;
}
</style>
