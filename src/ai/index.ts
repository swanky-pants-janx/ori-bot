import type { KeyedProviderId, Settings } from '../types/settings'
import { AnthropicProvider } from './providers/anthropic'
import { OllamaProvider } from './providers/ollama'
import type { AIProvider } from './types'

export { buildAIContext } from './context'
export { heuristicMemories, extractOwnerName, isTrivial, selectMemories, MIN_IMPORTANCE } from './memory'
export { parseReply } from './prompt'
export { AIError, type AIContext, type AIProvider, type PetReply } from './types'

/**
 * Build the configured brain, or null when AI is off / not set up.
 * Adding a provider = implement `AIProvider` and add a case here.
 */
export function createProvider(settings: Settings, apiKey: (p: KeyedProviderId) => string | null): AIProvider | null {
  switch (settings.aiProvider) {
    case 'anthropic': {
      const key = apiKey('anthropic')
      return key ? new AnthropicProvider(key, settings.anthropicModel) : null
    }
    case 'ollama':
      return new OllamaProvider(settings.ollamaUrl, settings.ollamaModel)
    case 'none':
      return null
  }
}
