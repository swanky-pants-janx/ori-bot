import { describe, expect, it } from 'vitest'
import { chatterLine, helloLine, moodLine, type Speaker } from './dialogue'

const ori: Speaker = { owner: 'Janx', name: 'Ori', species: 'bunny moth' }

describe("Ori's voice", () => {
  it('fills in names and species', () => {
    expect(helloLine(ori)).toContain('Ek is Ori!')
    const said = new Set<string>()
    let i = 0
    const rng = () => ((i++ * 0.37) % 1)
    for (let n = 0; n < 60; n++) said.add(chatterLine('excited', ori, rng) ?? '')
    for (let n = 0; n < 60; n++) said.add(chatterLine('sleeping', ori, rng) ?? '')
    expect(said).toContain('Zzz... bunny moth... zzz')
    for (const line of said) expect(line).not.toMatch(/\{(owner|name|species)\}/)
  })

  it("keeps Ori's favourite phrases in his excited vocabulary", () => {
    const said = new Set<string>()
    for (let n = 0; n < 400; n++) said.add(chatterLine('excited', ori) ?? '')
    for (const phrase of ['Whooo!!', 'Ek is Ori!', 'Wow, dit is so cool', 'Ek hou van party']) {
      expect(said).toContain(phrase)
    }
  })

  it('avoids repeating what was just said', () => {
    const recent = ['Whooo!!']
    let n = 0
    const rng = () => (n++ === 0 ? 0 : 0.5) // first pick would be "Whooo!!"
    expect(chatterLine('excited', ori, rng, recent)).not.toBe('Whooo!!')
  })

  it('falls back to "vriend" when the owner has no name yet', () => {
    expect(moodLine('hungry', { ...ori, owner: '' }, () => 0.7)).toBe('Ek is honger, vriend...')
  })
})

describe('offline brain', () => {
  it('answers the question rather than just the greeting', async () => {
    const { offlineReply } = await import('../ai/offline')
    const snapshot = { state: { sleeping: false, hunger: 80 }, mood: 'happy', info: { name: 'Ori' } } as never
    expect(offlineReply('hello Ori! who are you?', snapshot, ori, () => 0).message).toBe('Ek is Ori!')
    expect(offlineReply('do you like parties?', snapshot, ori).message).toBe('Ek hou van party!')
    expect(offlineReply('hoe gaan dit?', snapshot, ori, () => 0).message).toBe('La la la~')
  })
})
