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
    // vue-i18n feature flags: drop the esm-bundler runtime warning, disable the
    // Options-API install we don't use, and keep prod devtools off.
    define: {
      __VUE_I18N_FULL_INSTALL__: false,
      __VUE_I18N_LEGACY_API__: false,
      __INTLIFY_PROD_DEVTOOLS__: false,
    },
    build: { rollupOptions: { input: { index: 'src/renderer/index.html' } } },
  },
})
