/**
 * Voice pipeline (Milestone 3):
 *
 *   microphone → SpeechToText → chat → TextToSpeech → speaker
 *
 * Text-to-speech works today using the system voices. Speech-to-text is an
 * interface only: plug in a local Whisper implementation (via the main
 * process) without touching the chat flow.
 */
export interface TextToSpeech {
  speak(text: string): void
  stop(): void
}

export interface SpeechToText {
  /** Start listening. Resolves once recording has started. */
  start(): Promise<void>
  /** Stop listening and return the transcript. */
  stop(): Promise<string>
}

/** Remove stage directions like *wiggles* – they shouldn't be read aloud. */
export function speakable(text: string): string {
  return text
    .replace(/\*[^*]+\*/g, ' ')
    .replace(/[♥♡✨]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** System text-to-speech with a small, high, creature-like voice. */
export class SystemVoice implements TextToSpeech {
  private voice: SpeechSynthesisVoice | null = null

  constructor() {
    const pickVoice = (): void => {
      const voices = speechSynthesis.getVoices().filter((v) => v.lang.startsWith('en'))
      this.voice = voices.find((v) => /samantha|karen|moira|zira|aria|jenny/i.test(v.name)) ?? voices[0] ?? null
    }
    pickVoice()
    speechSynthesis.addEventListener('voiceschanged', pickVoice)
  }

  speak(text: string): void {
    const clean = speakable(text)
    if (!clean) return
    speechSynthesis.cancel()
    const u = new SpeechSynthesisUtterance(clean)
    if (this.voice) u.voice = this.voice
    u.pitch = 1.8
    u.rate = 1.08
    u.volume = 0.9
    speechSynthesis.speak(u)
  }

  stop(): void {
    speechSynthesis.cancel()
  }
}
