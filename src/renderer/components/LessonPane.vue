<script setup lang="ts">
import { useWorkspaceStore } from '../stores/workspace'

const ws = useWorkspaceStore()

function label(file: string): string {
  return file
    .replace(/\.html?$/, '')
    .replace(/^\d+-/, '')
    .replace(/-/g, ' ')
}
</script>

<template>
  <section class="lesson">
    <header class="lesson-head">
      <strong>{{ ws.config?.workspaceName ?? 'Workspace' }}</strong>
      <nav class="lesson-nav">
        <button
          v-for="file in ws.lessons"
          :key="file"
          :class="{ active: file === ws.currentLesson }"
          @click="ws.open(file)"
        >
          {{ label(file) }}
        </button>
      </nav>
    </header>
    <iframe
      v-if="ws.currentUrl"
      :src="ws.currentUrl"
      class="lesson-frame"
      title="lesson"
    />
    <div
      v-else
      class="lesson-empty"
    >
      No lesson selected.
    </div>
  </section>
</template>

<style scoped>
.lesson {
  display: flex;
  flex-direction: column;
  height: 100%;
}
.lesson-head {
  padding: 0.6rem 1rem;
  border-bottom: 1px solid var(--rule, #ddd);
}
.lesson-nav {
  display: flex;
  gap: 0.4rem;
  flex-wrap: wrap;
  margin-top: 0.4rem;
}
.lesson-nav button {
  font: inherit;
  font-size: 0.8rem;
  padding: 0.2rem 0.5rem;
  border: 1px solid var(--rule, #ddd);
  background: #fff;
  border-radius: 0.3rem;
  cursor: pointer;
}
.lesson-nav button.active {
  background: #2b6cb0;
  color: #fff;
  border-color: #2b6cb0;
}
.lesson-frame {
  flex: 1;
  border: 0;
  width: 100%;
}
.lesson-empty {
  flex: 1;
  display: grid;
  place-items: center;
  color: #999;
}
</style>
