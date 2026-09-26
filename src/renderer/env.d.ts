/// <reference types="svelte" />
/// <reference types="vite/client" />
import type { OriApi } from '../types/api'

declare global {
  interface Window {
    ori: OriApi
  }
}

export {}
