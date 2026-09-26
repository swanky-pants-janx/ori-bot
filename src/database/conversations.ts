import type { Conversation } from '../types/chat'
import type { Db } from './connection'

export class ConversationRepository {
  constructor(private readonly db: Db) {}

  add(petId: number, c: Omit<Conversation, 'id'>): Conversation {
    const result = this.db
      .prepare('INSERT INTO conversations (pet_id, timestamp, user_message, pet_response) VALUES (?, ?, ?, ?)')
      .run(petId, c.timestamp, c.userMessage, c.petResponse)
    return { ...c, id: Number(result.lastInsertRowid) }
  }

  /** The last `limit` exchanges, oldest first. */
  recent(petId: number, limit: number): Conversation[] {
    return this.db
      .prepare('SELECT * FROM conversations WHERE pet_id = ? ORDER BY timestamp DESC, id DESC LIMIT ?')
      .all(petId, limit)
      .map((r) => ({
        id: Number(r.id),
        timestamp: Number(r.timestamp),
        userMessage: String(r.user_message),
        petResponse: String(r.pet_response)
      }))
      .reverse()
  }

  clear(petId: number): void {
    this.db.prepare('DELETE FROM conversations WHERE pet_id = ?').run(petId)
  }
}
