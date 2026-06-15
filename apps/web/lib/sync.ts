import { apiRequest } from './api';
import { readOfflineEvents, removeOfflineEvent } from './offline-queue';

export async function syncOfflineQueue(): Promise<{ synced: number; failed: number }> {
  const events = await readOfflineEvents();

  let synced = 0;
  let failed = 0;

  for (const row of events) {
    try {
      if (row.event.type === 'WORD_REVIEW') {
        await apiRequest(`/user-words/${row.event.payload.progressId}/review`, {
          method: 'POST',
          body: JSON.stringify({
            known: row.event.payload.known,
            clientEventId: row.event.clientEventId
          })
        });
      }

      if (row.event.type === 'GRAMMAR_ATTEMPT') {
        await apiRequest(`/grammar/lessons/${row.event.payload.lessonId}/attempts`, {
          method: 'POST',
          body: JSON.stringify({
            answers: row.event.payload.answers,
            clientEventId: row.event.clientEventId
          })
        });
      }

      if (row.event.type === 'GRAMMAR_MISTAKE_RETRY') {
        await apiRequest('/grammar/mistakes/retry', {
          method: 'POST',
          body: JSON.stringify({
            answers: row.event.payload.answers,
            clientEventId: row.event.clientEventId
          })
        });
      }

      await removeOfflineEvent(row.id);
      synced += 1;
    } catch (_error) {
      failed += 1;
    }
  }

  return { synced, failed };
}
