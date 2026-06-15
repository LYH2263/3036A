import type { OfflineQueueEvent, SearchHistoryDto } from '@lexigram/shared';

import { apiRequest } from './api';
import { readOfflineEvents, removeOfflineEvent } from './offline-queue';

export interface SyncResultItem {
  id: number;
  event: OfflineQueueEvent;
  success: boolean;
  error?: string;
}

export interface SyncDetailedResult {
  results: SyncResultItem[];
  synced: number;
  failed: number;
}

let syncInProgress = false;

export function isSyncInProgress(): boolean {
  return syncInProgress;
}

async function syncSingleEvent(
  row: { id: number; event: OfflineQueueEvent }
): Promise<SyncResultItem> {
  try {
    if (row.event.type === 'WORD_REVIEW') {
      const body: Record<string, unknown> = {
        known: row.event.payload.known,
        clientEventId: row.event.clientEventId
      };
      if (row.event.payload.rating) {
        body.rating = row.event.payload.rating;
      }
      await apiRequest(`/user-words/${row.event.payload.progressId}/review`, {
        method: 'POST',
        body: JSON.stringify(body)
      });
    }

    if (row.event.type === 'GRAMMAR_ATTEMPT') {
      await apiRequest(`/grammar/lessons/${row.event.payload.lessonId}/attempts`, {
        method: 'POST',
        body: JSON.stringify({
          answers: row.event.payload.answers,
          clientEventId: row.event.clientEventId,
          isTimedMode: row.event.payload.isTimedMode,
          timeLimitMode: row.event.payload.timeLimitMode,
          timeLimitSec: row.event.payload.timeLimitSec,
          timeTakenMs: row.event.payload.timeTakenMs
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

    if (row.event.type === 'WORD_NOTE_UPSERT') {
      await apiRequest(`/word-notes/progress/${row.event.payload.progressId}`, {
        method: 'PUT',
        body: JSON.stringify({
          content: row.event.payload.content,
          expectedVersion: row.event.payload.expectedVersion,
          clientEventId: row.event.clientEventId
        })
      });
    }

    if (row.event.type === 'WORD_NOTE_DELETE') {
      await apiRequest(`/word-notes/progress/${row.event.payload.progressId}`, {
        method: 'DELETE'
      });
    }

    if (row.event.type === 'SEARCH_HISTORY_ADD') {
      await apiRequest<SearchHistoryDto[]>('/search-history', {
        method: 'POST',
        body: JSON.stringify({
          query: row.event.payload.query
        })
      });
    }

    if (row.event.type === 'SEARCH_HISTORY_DELETE') {
      const encodedQuery = encodeURIComponent(row.event.payload.query);
      await apiRequest<SearchHistoryDto[]>(`/search-history?query=${encodedQuery}`, {
        method: 'DELETE'
      });
    }

    if (row.event.type === 'SEARCH_HISTORY_CLEAR') {
      await apiRequest<SearchHistoryDto[]>('/search-history', {
        method: 'DELETE'
      });
    }

    await removeOfflineEvent(row.id);
    return { id: row.id, event: row.event, success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '未知错误';
    return { id: row.id, event: row.event, success: false, error: errorMessage };
  }
}

export async function syncOfflineQueue(): Promise<{ synced: number; failed: number }> {
  const result = await syncOfflineQueueDetailed();
  return { synced: result.synced, failed: result.failed };
}

export async function syncOfflineQueueDetailed(
  eventIds?: number[]
): Promise<SyncDetailedResult> {
  if (syncInProgress) {
    return { results: [], synced: 0, failed: 0 };
  }

  syncInProgress = true;

  try {
    let events = await readOfflineEvents();

    if (eventIds && eventIds.length > 0) {
      events = events.filter((row) => eventIds.includes(row.id));
    }

    const results: SyncResultItem[] = [];
    let synced = 0;
    let failed = 0;

    for (const row of events) {
      const result = await syncSingleEvent(row);
      results.push(result);
      if (result.success) {
        synced += 1;
      } else {
        failed += 1;
      }
    }

    return { results, synced, failed };
  } finally {
    syncInProgress = false;
  }
}

export async function syncSingleOfflineEvent(id: number): Promise<SyncResultItem | null> {
  if (syncInProgress) {
    return null;
  }

  const events = await readOfflineEvents();
  const row = events.find((e) => e.id === id);

  if (!row) {
    return null;
  }

  syncInProgress = true;

  try {
    return await syncSingleEvent(row);
  } finally {
    syncInProgress = false;
  }
}
