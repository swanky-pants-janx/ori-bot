import js from '@eslint/js'
import ts from 'typescript-eslint'
import svelte from 'eslint-plugin-svelte'
import globals from 'globals'
import { defineConfig } from 'eslint/config'
import svelteConfig from './svelte.config.mjs'

export default defineConfig(
  { ignores: ['out/', 'release/', 'dist/', 'node_modules/', 'build/'] },
  js.configs.recommended,
  ts.configs.recommended,
  svelte.configs.recommended,
  {
    languageOptions: { globals: { ...globals.node } }
  },
  {
    files: ['src/renderer/**/*'],
    languageOptions: { globals: { ...globals.browser } }
  },
  {
    files: ['**/*.svelte', '**/*.svelte.ts'],
    languageOptions: {
      parserOptions: { parser: ts.parser, extraFileExtensions: ['.svelte'], svelteConfig }
    }
  },
  {
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }]
    }
  }
)
