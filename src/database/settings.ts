import type { Db } from './connection'

/** A tiny JSON key/value store. */
export class SettingsRepository {
  constructor(private readonly db: Db) {}

  get<T>(key: string): T | undefined {
    const row = this.db.prepare('SELECT value FROM settings WHERE key = ?').get(key)
    if (!row) return undefined
    try {
      return JSON.parse(String(row.value)) as T
    } catch {
      return undefined
    }
  }

  set(key: string, value: unknown): void {
    if (value === undefined) {
      this.delete(key)
      return
    }
    this.db
      .prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
      .run(key, JSON.stringify(value))
  }

  delete(key: string): void {
    this.db.prepare('DELETE FROM settings WHERE key = ?').run(key)
  }
}
