/**
 * Tiny synthesised sound effects (Web Audio) – no audio files to ship.
 */
export type SoundName = 'pet' | 'feed' | 'play' | 'clean' | 'sleep' | 'wake' | 'refuse' | 'blip' | 'grow' | 'pop' | 'dizzy'

let ctx: AudioContext | null = null
let enabled = true

export function setSoundEnabled(on: boolean): void {
  enabled = on
}

function audio(): AudioContext | null {
  if (!enabled) return null
  ctx ??= new AudioContext()
  if (ctx.state === 'suspended') void ctx.resume()
  return ctx
}

function tone(freq: number, start: number, dur: number, opts: { type?: OscillatorType; to?: number; gain?: number } = {}): void {
  const a = audio()
  if (!a) return
  const t0 = a.currentTime + start
  const osc = a.createOscillator()
  const gain = a.createGain()
  osc.type = opts.type ?? 'sine'
  osc.frequency.setValueAtTime(freq, t0)
  if (opts.to) osc.frequency.exponentialRampToValueAtTime(opts.to, t0 + dur)
  gain.gain.setValueAtTime(0.0001, t0)
  gain.gain.exponentialRampToValueAtTime(opts.gain ?? 0.12, t0 + 0.012)
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
  osc.connect(gain).connect(a.destination)
  osc.start(t0)
  osc.stop(t0 + dur + 0.02)
}

export function play(name: SoundName): void {
  if (!enabled) return
  switch (name) {
    case 'pet':
      tone(660, 0, 0.12, { to: 990, gain: 0.08 })
      tone(990, 0.1, 0.14, { to: 1320, gain: 0.06 })
      break
    case 'feed':
      for (let i = 0; i < 4; i++) tone(220 + i * 30, i * 0.16, 0.07, { type: 'square', gain: 0.035 })
      break
    case 'play':
      ;[523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.07, 0.12, { type: 'triangle', gain: 0.08 }))
      break
    case 'clean':
      for (let i = 0; i < 6; i++) tone(700 + Math.random() * 900, i * 0.06, 0.07, { to: 1800, gain: 0.04 })
      break
    case 'sleep':
      ;[523, 440, 349].forEach((f, i) => tone(f, i * 0.18, 0.3, { gain: 0.06 }))
      break
    case 'wake':
      ;[349, 440, 523].forEach((f, i) => tone(f, i * 0.12, 0.2, { type: 'triangle', gain: 0.07 }))
      break
    case 'refuse':
      tone(300, 0, 0.12, { type: 'square', gain: 0.04 })
      tone(220, 0.13, 0.16, { type: 'square', gain: 0.04 })
      break
    case 'grow':
      ;[392, 523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.09, 0.2, { type: 'triangle', gain: 0.07 }))
      break
    case 'pop':
      tone(500, 0, 0.06, { to: 900, gain: 0.05 })
      break
    case 'dizzy':
      // A woozy wobble down and back up.
      tone(740, 0, 0.18, { type: 'triangle', to: 420, gain: 0.07 })
      tone(420, 0.17, 0.18, { type: 'triangle', to: 620, gain: 0.06 })
      tone(620, 0.34, 0.24, { type: 'triangle', to: 330, gain: 0.05 })
      break
    case 'blip':
      tone(880 + Math.random() * 260, 0, 0.035, { type: 'square', gain: 0.018 })
      break
  }
}
