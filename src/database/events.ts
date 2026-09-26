import { PET_EVENT_TYPES, type PetEvent, type PetEventType } from '../types/events'
import type { Db } from './connection'

export class EventRepository {
  constructor(private readonly db: Db) {}

  add(petId: number, events: readonly PetEvent[]): void {
    const insert = this.db.prepare('INSERT INTO events (pet_id, timestamp, type, message, data) VALUES (?, ?, ?, ?, ?)')
    for (const e of events) {
      insert.run(petId, e.timestamp, e.type, e.message, e.data ? JSON.stringify(e.data) : null)
    }
  }

  /** The last `limit` events, oldest first. */
  recent(petId: number, limit: number, since = 0): PetEvent[] {
    return this.db
      .prepare(
        'SELECT * FROM events WHERE pet_id = ? AND timestamp >= ? ORDER BY timestamp DESC, id DESC LIMIT ?'
      )
      .all(petId, since, limit)
      .map((r) => {
        const type = String(r.type)
        const event: PetEvent = {
          type: (PET_EVENT_TYPES as readonly string[]).includes(type) ? (type as PetEventType) : 'USER_RETURNED',
          timestamp: Number(r.timestamp),
          message: String(r.message)
        }
        if (typeof r.data === 'string') event.data = JSON.parse(r.data) as NonNullable<PetEvent['data']>
        return event
      })
      .reverse()
  }

  prune(olderThan: number): void {
    this.db.prepare('DELETE FROM events WHERE timestamp < ?').run(olderThan)
  }
}
