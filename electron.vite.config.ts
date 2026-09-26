import { resolve } from 'node:path'
import { defineConfig } from 'electron-vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'

export default defineConfig({
  main: {
    build: {
      lib: { entry: resolve(__dirname, 'src/electron/main.ts') }
    }
  },
  preload: {
    build: {
      lib: { entry: resolve(__dirname, 'src/electron/preload.ts') }
    }
  },
  renderer: {
    root: resolve(__dirname, 'src/renderer'),
    build: {
      rollupOptions: { input: resolve(__dirname, 'src/renderer/index.html') }
    },
    plugins: [svelte({ configFile: resolve(__dirname, 'svelte.config.mjs') })]
  }
})
