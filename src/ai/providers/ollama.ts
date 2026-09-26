import type { ChatMessage } from '../../types/chat'
import { normaliseTurns } from '../context'
import { contextPrompt, PET_INSTRUCTIONS, REPLY_SCHEMA } from '../prompt'
import { AIError, type AIContext, type AIProvider } from '../types'

interface OllamaChatResponse {
  message?: { content?: string }
  error?: string
}

/** A local model served by Ollama (https://ollama.com). Works fully offline. */
export class OllamaProvider implements AIProvider {
  readonly id = 'ollama' as const
  readonly label = 'Ollama (local)'

  constructor(
    private readonly baseUrl: string,
    private readonly model: string
  ) {}

  async chat(messages: ChatMessage[], context: AIContext, signal?: AbortSignal): Promise<string> {
    const turns = normaliseTurns(messages)
    if (turns.length === 0) throw new AIError('There is nothing to reply to.', 'config')

    const body = {
      model: this.model,
      stream: false,
      format: REPLY_SCHEMA,
      options: { temperature: 0.8 },
      messages: [
        { role: 'system', content: `${PET_INSTRUCTIONS}\n\n${contextPrompt(context, Date.now())}` },
        ...turns.map((m) => ({ role: m.role === 'user' ? 'user' : 'assistant', content: m.content }))
      ]
    }

    const timeout = AbortSignal.timeout(120_000)
    let res: Response
    try {
      res = await fetch(new URL('/api/chat', this.baseUrl), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
        signal: signal ? AbortSignal.any([signal, timeout]) : timeout
      })
    } catch {
      throw new AIError(`Couldn't reach Ollama at ${this.baseUrl}. Is it running?`, 'network')
    }

    const data = (await res.json().catch(() => ({}))) as OllamaChatResponse
    if (!res.ok) {
      if (res.status === 404) {
        throw new AIError(`Ollama doesn't have "${this.model}". Try: ollama pull ${this.model}`, 'config')
      }
      throw new AIError(data.error ?? `Ollama error (${res.status}).`, 'unknown')
    }
    const text = data.message?.content ?? ''
    if (!text.trim()) throw new AIError('The local model returned an empty reply.', 'bad_response')
    return text
  }
}
