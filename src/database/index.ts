import { openDatabase, type Db } from './connection'
import { ConversationRepository } from './conversations'
import { EventRepository } from './events'
import { MemoryRepository } from './memories'
import { PetRepository } from './pets'
import { SettingsRepository } from './settings'

export interface Database {
  db: Db
  pets: PetRepository
  memories: MemoryRepository
  conversations: ConversationRepository
  events: EventRepository
  settings: SettingsRepository
  close(): void
}

export function createDatabase(path: string): Database {
  const db = openDatabase(path)
  return {
    db,
    pets: new PetRepository(db),
    memories: new MemoryRepository(db),
    conversations: new ConversationRepository(db),
    events: new EventRepository(db),
    settings: new SettingsRepository(db),
    close: () => db.close()
  }
}

export type { StoredPet } from './pets'
