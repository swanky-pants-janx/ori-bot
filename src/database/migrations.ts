import type { DatabaseSync } from 'node:sqlite'

/**
 * Append-only list of schema migrations. The index + 1 is the schema version
 * stored in `PRAGMA user_version`. Never edit a migration that has shipped.
 */
const MIGRATIONS: string[] = [
  `
  CREATE TABLE pets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    species TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    birthday INTEGER NOT NULL
  );

  CREATE TABLE pet_state (
    pet_id INTEGER PRIMARY KEY REFERENCES pets(id) ON DELETE CASCADE,
    hunger REAL NOT NULL,
    happiness REAL NOT NULL,
    energy REAL NOT NULL,
    health REAL NOT NULL,
    cleanliness REAL NOT NULL,
    affection REAL NOT NULL,
    age REAL NOT NULL,
    sleeping INTEGER NOT NULL DEFAULT 0,
    last_interaction INTEGER NOT NULL,
    last_updated INTEGER NOT NULL
  );

  CREATE TABLE personality (
    pet_id INTEGER PRIMARY KEY REFERENCES pets(id) ON DELETE CASCADE,
    friendliness REAL NOT NULL,
    playfulness REAL NOT NULL,
    curiosity REAL NOT NULL,
    stubbornness REAL NOT NULL,
    affection REAL NOT NULL,
    energy REAL NOT NULL,
    updated_at INTEGER NOT NULL
  );

  CREATE TABLE memories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pet_id INTEGER NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
    timestamp INTEGER NOT NULL,
    type TEXT NOT NULL,
    content TEXT NOT NULL,
    importance INTEGER NOT NULL CHECK (importance BETWEEN 0 AND 100)
  );
  CREATE INDEX idx_memories_pet ON memories(pet_id, importance DESC, timestamp DESC);

  CREATE TABLE conversations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pet_id INTEGER NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
    timestamp INTEGER NOT NULL,
    user_message TEXT NOT NULL,
    pet_response TEXT NOT NULL
  );
  CREATE INDEX idx_conversations_pet ON conversations(pet_id, timestamp DESC);

  CREATE TABLE events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pet_id INTEGER NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
    timestamp INTEGER NOT NULL,
    type TEXT NOT NULL,
    message TEXT NOT NULL,
    data TEXT
  );
  CREATE INDEX idx_events_pet ON events(pet_id, timestamp DESC);

  CREATE TABLE settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
  `
]

export function migrate(db: DatabaseSync): void {
  const row = db.prepare('PRAGMA user_version').get() as { user_version: number }
  let version = row.user_version
  while (version < MIGRATIONS.length) {
    db.exec('BEGIN')
    try {
      db.exec(MIGRATIONS[version])
      version += 1
      db.exec(`PRAGMA user_version = ${version}`)
      db.exec('COMMIT')
    } catch (err) {
      db.exec('ROLLBACK')
      throw err
    }
  }
}
