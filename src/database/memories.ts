import type { SQLOutputValue } from 'node:sqlite'
import { MEMORY_TYPES, type Memory, type MemoryType, type NewMemory } from '../types/memory'
import type { Db } from './connection'

function toMemory(r: Record<string, SQLOutputValue>): Memory {
  const type = String(r.type)
  return {
    id: Number(r.id),
    timestamp: Number(r.timestamp),
    type: (MEMORY_TYPES as readonly string[]).includes(type) ? (type as MemoryType) : 'topic',
    content: String(r.content),
    importance: Number(r.importance)
  }
}

export class MemoryRepository {
  constructor(private readonly db: Db) {}

  add(petId: number, m: NewMemory): Memory {
    const importance = Math.round(Math.min(100, Math.max(0, m.importance)))
    const result = this.db
      .prepare('INSERT INTO memories (pet_id, timestamp, type, content, importance) VALUES (?, ?, ?, ?, ?)')
      .run(petId, m.timestamp, m.type, m.content, importance)
    return { ...m, importance, id: Number(result.lastInsertRowid) }
  }

  /** Most recent first. */
  list(petId: number, limit = 200): Memory[] {
    return this.db
      .prepare('SELECT * FROM memories WHERE pet_id = ? ORDER BY timestamp DESC, id DESC LIMIT ?')
      .all(petId, limit)
      .map(toMemory)
  }

  findByContent(petId: number, content: string): Memory | undefined {
    const row = this.db
      .prepare('SELECT * FROM memories WHERE pet_id = ? AND lower(content) = lower(?) LIMIT 1')
      .get(petId, content.trim())
    return row ? toMemory(row) : undefined
  }

  update(id: number, patch: Pick<Memory, 'content' | 'importance' | 'timestamp'>): void {
    this.db
      .prepare('UPDATE memories SET content = ?, importance = ?, timestamp = ? WHERE id = ?')
      .run(patch.content, Math.round(patch.importance), patch.timestamp, id)
  }

  delete(petId: number, id: number): void {
    this.db.prepare('DELETE FROM memories WHERE pet_id = ? AND id = ?').run(petId, id)
  }

  count(petId: number): number {
    const row = this.db.prepare('SELECT COUNT(*) AS c FROM memories WHERE pet_id = ?').get(petId)
    return Number(row?.c ?? 0)
  }
}
