import Anthropic from '@anthropic-ai/sdk'
import type { ChatMessage } from '../../types/chat'
import { normaliseTurns } from '../context'
import { contextPrompt, PET_INSTRUCTIONS, REPLY_SCHEMA } from '../prompt'
import { AIError, type AIContext, type AIProvider } from '../types'

/** Models that support server-side refusal fallbacks (`fallbacks: "default"`). */
const FALLBACK_MODELS = /^claude-(opus-5|fable-5|mythos-5)/
/** Older/smaller models reject `output_config.effort`. */
const NO_EFFORT_MODELS = /haiku|sonnet-4-5|opus-4-1|opus-4-0|sonnet-4-0|claude-3/

/** Claude via the official Anthropic SDK. */
export class AnthropicProvider implements AIProvider {
  readonly id = 'anthropic' as const
  readonly label = 'Claude'
  private readonly client: Anthropic

  constructor(
    apiKey: string,
    private readonly model: string,
    /** Only overridden in tests. */
    baseURL?: string
  ) {
    this.client = new Anthropic({ apiKey, maxRetries: 2, timeout: 60_000, ...(baseURL ? { baseURL } : {}) })
  }

  async chat(messages: ChatMessage[], context: AIContext, signal?: AbortSignal): Promise<string> {
    const turns: Anthropic.Beta.BetaMessageParam[] = normaliseTurns(messages).map((m) => ({
      role: m.role === 'user' ? 'user' : 'assistant',
      content: m.content
    }))
    if (turns.length === 0) throw new AIError('There is nothing to reply to.', 'config')

    const withFallbacks = FALLBACK_MODELS.test(this.model)
    try {
      const response = await this.client.beta.messages.create(
        {
          model: this.model,
          // Replies are deliberately short; this leaves ample room for low-effort thinking.
          max_tokens: 8192,
          ...(withFallbacks ? { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' as const } : {}),
          system: [
            // Stable instructions first so they can be served from the prompt cache.
            { type: 'text', text: PET_INSTRUCTIONS, cache_control: { type: 'ephemeral' } },
            { type: 'text', text: contextPrompt(context, Date.now()) }
          ],
          output_config: {
            ...(NO_EFFORT_MODELS.test(this.model) ? {} : { effort: 'low' as const }),
            format: { type: 'json_schema', schema: REPLY_SCHEMA }
          },
          messages: turns
        },
        { signal }
      )

      if (response.stop_reason === 'refusal') {
        throw new AIError("The brain didn't want to answer that one.", 'refused')
      }
      if (response.stop_reason === 'max_tokens') {
        throw new AIError('The reply was cut off.', 'bad_response')
      }
      const text = response.content
        .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === 'text')
        .map((b) => b.text)
        .join('')
      if (!text.trim()) throw new AIError('The brain returned an empty reply.', 'bad_response')
      return text
    } catch (err) {
      throw toAIError(err)
    }
  }
}

function toAIError(err: unknown): AIError {
  if (err instanceof AIError) return err
  if (err instanceof Anthropic.AuthenticationError) return new AIError('The Claude API key was rejected.', 'auth')
  if (err instanceof Anthropic.PermissionDeniedError) {
    return new AIError("This API key can't use that model.", 'auth')
  }
  if (err instanceof Anthropic.NotFoundError) return new AIError('That Claude model was not found.', 'config')
  if (err instanceof Anthropic.RateLimitError) return new AIError('Too many requests – slow down a little.', 'rate_limit')
  if (err instanceof Anthropic.BadRequestError) return new AIError(`Claude rejected the request: ${err.message}`, 'config')
  if (err instanceof Anthropic.APIUserAbortError) return new AIError('The request was cancelled.', 'network')
  if (err instanceof Anthropic.APIConnectionError) return new AIError("Couldn't reach Claude. Are you online?", 'network')
  if (err instanceof Anthropic.APIError) return new AIError(`Claude API error (${err.status ?? '?'}).`, 'unknown')
  return new AIError(err instanceof Error ? err.message : String(err), 'unknown')
}
