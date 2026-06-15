import type { OfflineQueueEvent } from '@lexigram/shared';
import { DBSchema, openDB } from 'idb';

interface QueueRecord {
  id?: number;
  event: OfflineQueueEvent;
}

interface LexigramDB extends DBSchema {
  offline_queue: {
    key: number;
    value: QueueRecord;
  };
}

const DB_NAME = 'lexigram-offline-db';

async function getDb() {
  return openDB<LexigramDB>(DB_NAME, 1, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('offline_queue')) {
        db.createObjectStore('offline_queue', { keyPath: 'id', autoIncrement: true });
      }
    }
  });
}

export async function enqueueOfflineEvent(event: OfflineQueueEvent): Promise<void> {
  const db = await getDb();
  await db.add('offline_queue', { event });
}

export async function readOfflineEvents(): Promise<Array<{ id: number; event: OfflineQueueEvent }>> {
  const db = await getDb();
  const rows = await db.getAll('offline_queue');
  return rows
    .filter((row): row is { id: number; event: OfflineQueueEvent } => typeof row.id === 'number')
    .sort((a, b) => a.id - b.id);
}

export async function removeOfflineEvent(id: number): Promise<void> {
  const db = await getDb();
  await db.delete('offline_queue', id);
}
