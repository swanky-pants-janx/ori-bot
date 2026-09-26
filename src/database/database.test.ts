import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { newPetState } from '../game'
import type { Personality } from '../types/pet'
import { createDatabase } from './index'

const T0 = Date.UTC(2026, 0, 1)
const traits: Personality = {
  friendliness: 60,
  playfulness: 70,
  curiosity: 40,
  stubbornness: 30,
  affection: 55,
  energy: 45
}

let dir: string
let file: string

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'ori-db-'))
  file = join(dir, 'test.db')
})
afterEach(() => rmSync(dir, { recursive: true, force: true }))

describe('database', () => {
  it('persists a pet across close and reopen', () => {
    const db = createDatabase(file)
    expect(db.pets.load()).toBeNull()
    const created = db.pets.create(
      { name: 'Ori', species: 'blob', createdAt: T0, birthday: T0 },
      newPetState(T0),
      traits
    )
    db.pets.saveState(created.info.id, { ...created.state, hunger: 42.5, sleeping: true, lastUpdated: T0 + 5000 })
    db.close()

    const reopened = createDatabase(file)
    const loaded = reopened.pets.load()
    expect(loaded?.info.name).toBe('Ori')
    expect(loaded?.state.hunger).toBe(42.5)
    expect(loaded?.state.sleeping).toBe(true)
    expect(loaded?.state.lastUpdated).toBe(T0 + 5000)
    expect(loaded?.personality).toEqual(traits)
    reopened.close()
  })

  it('stores memories, conversations, events and settings', () => {
    const db = createDatabase(file)
    const { info } = db.pets.create(
      { name: 'Ori', species: 'blob', createdAt: T0, birthday: T0 },
      newPetState(T0),
      traits
    )

    db.memories.add(info.id, { timestamp: T0, type: 'user_fact', content: "The user's name is Janx", importance: 95 })
    expect(db.memories.findByContent(info.id, "the user's name is janx")?.importance).toBe(95)
    expect(db.memories.count(info.id)).toBe(1)

    db.conversations.add(info.id, { timestamp: T0, userMessage: 'hi', petResponse: 'hello!' })
    db.conversations.add(info.id, { timestamp: T0 + 1, userMessage: 'bye', petResponse: 'noo' })
    expect(db.conversations.recent(info.id, 10).map((c) => c.userMessage)).toEqual(['hi', 'bye'])

    db.events.add(info.id, [{ type: 'PET_FED', timestamp: T0, message: 'fed', data: { n: 1 } }])
    expect(db.events.recent(info.id, 5)).toEqual([{ type: 'PET_FED', timestamp: T0, message: 'fed', data: { n: 1 } }])

    db.settings.set('ui', { alwaysOnTop: true })
    expect(db.settings.get('ui')).toEqual({ alwaysOnTop: true })

    db.pets.delete(info.id)
    expect(db.memories.count(info.id)).toBe(0)
    db.close()
  })
})
