import { defineConfig } from 'electron-vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath } from 'node:url'

const alias = {
  '@shared': fileURLToPath(new URL('./src/shared', import.meta.url)),
}

export default defineConfig({
  main: {
    resolve: { alias },
    build: { rollupOptions: { input: { index: 'src/main/index.ts' } } },
  },
  preload: {
    resolve: { alias },
    build: { rollupOptions: { input: { index: 'src/preload/index.ts' } } },
  },
  renderer: {
    root: 'src/renderer',
    resolve: { alias },
    plugins: [vue()],
    build: { rollupOptions: { input: { index: 'src/renderer/index.html' } } },
  },
})
