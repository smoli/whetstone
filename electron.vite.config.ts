import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath } from 'node:url'

const alias = {
  '@shared': fileURLToPath(new URL('./src/shared', import.meta.url)),
}

export default defineConfig({
  main: {
    resolve: { alias },
    // Bundle node-html-parser (don't externalize): its `entities` dep is ESM-only,
    // so a runtime require() of it from a CJS chunk throws ERR_REQUIRE_ESM.
    plugins: [externalizeDepsPlugin({ exclude: ['node-html-parser'] })],
    build: { rollupOptions: { input: { index: 'src/main/index.ts' } } },
  },
  preload: {
    resolve: { alias },
    plugins: [externalizeDepsPlugin()],
    build: { rollupOptions: { input: { index: 'src/preload/index.ts' } } },
  },
  renderer: {
    root: 'src/renderer',
    resolve: { alias },
    plugins: [vue()],
    build: { rollupOptions: { input: { index: 'src/renderer/index.html' } } },
  },
})
