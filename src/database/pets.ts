import type { SQLOutputValue } from 'node:sqlite'
import type { PetInfo, PetState, Personality } from '../types/pet'
import { transaction, type Db } from './connection'

type Row = Record<string, SQLOutputValue>

export interface StoredPet {
  info: PetInfo
  state: PetState
  personality: Personality
}

const n = (v: SQLOutputValue | undefined): number => Number(v ?? 0)

function toInfo(r: Row): PetInfo {
  return {
    id: n(r.id),
    name: String(r.name),
    species: String(r.species),
    createdAt: n(r.created_at),
    birthday: n(r.birthday)
  }
}

function toState(r: Row): PetState {
  return {
    hunger: n(r.hunger),
    happiness: n(r.happiness),
    energy: n(r.energy),
    health: n(r.health),
    cleanliness: n(r.cleanliness),
    affection: n(r.affection),
    age: n(r.age),
    sleeping: n(r.sleeping) === 1,
    lastInteraction: n(r.last_interaction),
    lastUpdated: n(r.last_updated)
  }
}

function toPersonality(r: Row): Personality {
  return {
    friendliness: n(r.friendliness),
    playfulness: n(r.playfulness),
    curiosity: n(r.curiosity),
    stubbornness: n(r.stubbornness),
    affection: n(r.affection),
    energy: n(r.energy)
  }
}

export class PetRepository {
  constructor(private readonly db: Db) {}

  /** The current pet (the most recently adopted one), if any. */
  load(): StoredPet | null {
    const pet = this.db.prepare('SELECT * FROM pets ORDER BY id DESC LIMIT 1').get()
    if (!pet) return null
    const id = n(pet.id)
    const state = this.db.prepare('SELECT * FROM pet_state WHERE pet_id = ?').get(id)
    const personality = this.db.prepare('SELECT * FROM personality WHERE pet_id = ?').get(id)
    if (!state || !personality) return null
    return { info: toInfo(pet), state: toState(state), personality: toPersonality(personality) }
  }

  create(info: Omit<PetInfo, 'id'>, state: PetState, personality: Personality): StoredPet {
    return transaction(this.db, () => {
      const result = this.db
        .prepare('INSERT INTO pets (name, species, created_at, birthday) VALUES (?, ?, ?, ?)')
        .run(info.name, info.species, info.createdAt, info.birthday)
      const id = Number(result.lastInsertRowid)
      this.db
        .prepare(
          `INSERT INTO pet_state (pet_id, hunger, happiness, energy, health, cleanliness, affection, age,
             sleeping, last_interaction, last_updated) VALUES (?, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0)`
        )
        .run(id)
      this.db
        .prepare(
          `INSERT INTO personality (pet_id, friendliness, playfulness, curiosity, stubbornness, affection,
             energy, updated_at) VALUES (?, 0, 0, 0, 0, 0, 0, 0)`
        )
        .run(id)
      this.saveState(id, state)
      this.savePersonality(id, personality, info.createdAt)
      return { info: { ...info, id }, state, personality }
    })
  }

  saveState(petId: number, s: PetState): void {
    this.db
      .prepare(
        `UPDATE pet_state SET hunger = ?, happiness = ?, energy = ?, health = ?, cleanliness = ?,
           affection = ?, age = ?, sleeping = ?, last_interaction = ?, last_updated = ?
         WHERE pet_id = ?`
      )
      .run(
        s.hunger,
        s.happiness,
        s.energy,
        s.health,
        s.cleanliness,
        s.affection,
        s.age,
        s.sleeping ? 1 : 0,
        s.lastInteraction,
        s.lastUpdated,
        petId
      )
  }

  savePersonality(petId: number, p: Personality, now: number): void {
    this.db
      .prepare(
        `UPDATE personality SET friendliness = ?, playfulness = ?, curiosity = ?, stubbornness = ?,
           affection = ?, energy = ?, updated_at = ?
         WHERE pet_id = ?`
      )
      .run(p.friendliness, p.playfulness, p.curiosity, p.stubbornness, p.affection, p.energy, now, petId)
  }

  rename(petId: number, name: string): void {
    this.db.prepare('UPDATE pets SET name = ? WHERE id = ?').run(name, petId)
  }

  delete(petId: number): void {
    this.db.prepare('DELETE FROM pets WHERE id = ?').run(petId)
  }
}
