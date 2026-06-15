import type { SearchHistoryDto } from '@lexigram/shared';
import { DBSchema, openDB } from 'idb';

import { apiRequest, ApiError } from './api';
import { enqueueOfflineEvent } from './offline-queue';

const MAX_HISTORY_ITEMS = 20;
const LS_FALLBACK_KEY = 'lexigram:search-history';
const LS_USER_KEY_PREFIX = 'lexigram:search-history:';

interface LocalHistoryItem {
  id: string;
  query: string;
  searchedAt: string;
  inLibrary: boolean;
}

interface LexigramSearchHistoryDB extends DBSchema {
  search_history: {
    key: string;
    value: LocalHistoryItem;
    indexes: { 'by-searchedAt': string };
  };
}

const DB_NAME = 'lexigram-search-history-db';

function generateId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function getUserIdKey(userId: string | null): string {
  return `${LS_USER_KEY_PREFIX}${userId ?? 'guest'}`;
}

function normalizeQuery(query: string): string {
  return query.trim().toLowerCase();
}

async function getIdb(): Promise<ReturnType<typeof openDB<LexigramSearchHistoryDB>> | null> {
  try {
    return await openDB<LexigramSearchHistoryDB>(DB_NAME, 1, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('search_history')) {
          const store = db.createObjectStore('search_history', { keyPath: 'id' });
          store.createIndex('by-searchedAt', 'searchedAt', { unique: false });
        }
      }
    });
  } catch {
    return null;
  }
}

async function readLocalHistory(userId: string | null): Promise<LocalHistoryItem[]> {
  const idb = await getIdb();

  if (idb) {
    try {
      const all = await idb.getAll('search_history');
      return all
        .sort((a, b) => (a.searchedAt < b.searchedAt ? 1 : -1))
        .slice(0, MAX_HISTORY_ITEMS);
    } catch {
      // fall through to localStorage
    }
  }

  try {
    const key = getUserIdKey(userId);
    const raw = localStorage.getItem(key) ?? localStorage.getItem(LS_FALLBACK_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as LocalHistoryItem[];
      return Array.isArray(parsed) ? parsed : [];
    }
  } catch {
    // ignore
  }

  return [];
}

async function writeLocalHistory(userId: string | null, items: LocalHistoryItem[]): Promise<void> {
  const idb = await getIdb();

  if (idb) {
    try {
      const tx = idb.transaction('search_history', 'readwrite');
      await tx.store.clear();
      for (const item of items) {
        await tx.store.put(item);
      }
      await tx.done;
      return;
    } catch {
      // fall through to localStorage
    }
  }

  try {
    const key = getUserIdKey(userId);
    localStorage.setItem(key, JSON.stringify(items));
  } catch {
    // ignore
  }
}

function isOnline(): boolean {
  return typeof navigator !== 'undefined' ? navigator.onLine : true;
}

function markLibraryStatus(items: LocalHistoryItem[], libraryWords: Set<string>): LocalHistoryItem[] {
  return items.map((item) => ({
    ...item,
    inLibrary: libraryWords.has(normalizeQuery(item.query))
  }));
}

export async function fetchSearchHistory(userId: string | null, libraryWords: Set<string>): Promise<SearchHistoryDto[]> {
  const online = isOnline();

  if (online) {
    try {
      const serverItems = await apiRequest<SearchHistoryDto[]>('/search-history', { timeoutMs: 4000 });
      if (Array.isArray(serverItems)) {
        const withLibrary = markLibraryStatus(serverItems as LocalHistoryItem[], libraryWords);
        await writeLocalHistory(userId, withLibrary);
        return withLibrary;
      }
    } catch (_error) {
      // fall back to local
    }
  }

  const local = await readLocalHistory(userId);
  return markLibraryStatus(local, libraryWords);
}

export async function addSearchHistory(
  userId: string | null,
  query: string,
  libraryWords: Set<string>
): Promise<SearchHistoryDto[]> {
  const normalized = normalizeQuery(query);

  if (!normalized) {
    return fetchSearchHistory(userId, libraryWords);
  }

  const current = await readLocalHistory(userId);
  const now = new Date().toISOString();
  const id = generateId();

  const filtered = current.filter((item) => normalizeQuery(item.query) !== normalized);
  const next: LocalHistoryItem[] = [
    { id, query: normalized, searchedAt: now, inLibrary: libraryWords.has(normalized) },
    ...filtered
  ].slice(0, MAX_HISTORY_ITEMS);

  await writeLocalHistory(userId, next);

  const online = isOnline();

  if (online) {
    try {
      const serverItems = await apiRequest<SearchHistoryDto[]>('/search-history', {
        method: 'POST',
        body: JSON.stringify({ query: normalized }),
        timeoutMs: 4000
      });
      if (Array.isArray(serverItems)) {
        const withLibrary = markLibraryStatus(serverItems as LocalHistoryItem[], libraryWords);
        await writeLocalHistory(userId, withLibrary);
        return withLibrary;
      }
    } catch (error) {
      if (error instanceof ApiError) {
        const clientEventId = generateId();
        await enqueueOfflineEvent({
          type: 'SEARCH_HISTORY_ADD',
          clientEventId,
          payload: { query: normalized },
          createdAt: now
        });
      }
    }
  } else {
    const clientEventId = generateId();
    await enqueueOfflineEvent({
      type: 'SEARCH_HISTORY_ADD',
      clientEventId,
      payload: { query: normalized },
      createdAt: now
    });
  }

  return next;
}

export async function deleteSearchHistoryItem(
  userId: string | null,
  query: string,
  libraryWords: Set<string>
): Promise<SearchHistoryDto[]> {
  const normalized = normalizeQuery(query);

  if (!normalized) {
    return fetchSearchHistory(userId, libraryWords);
  }

  const current = await readLocalHistory(userId);
  const next = current.filter((item) => normalizeQuery(item.query) !== normalized);
  await writeLocalHistory(userId, next);

  const online = isOnline();

  if (online) {
    try {
      const encoded = encodeURIComponent(normalized);
      const serverItems = await apiRequest<SearchHistoryDto[]>(`/search-history?query=${encoded}`, {
        method: 'DELETE',
        timeoutMs: 4000
      });
      if (Array.isArray(serverItems)) {
        const withLibrary = markLibraryStatus(serverItems as LocalHistoryItem[], libraryWords);
        await writeLocalHistory(userId, withLibrary);
        return withLibrary;
      }
    } catch (error) {
      if (error instanceof ApiError) {
        const clientEventId = generateId();
        await enqueueOfflineEvent({
          type: 'SEARCH_HISTORY_DELETE',
          clientEventId,
          payload: { query: normalized },
          createdAt: new Date().toISOString()
        });
      }
    }
  } else {
    const clientEventId = generateId();
    await enqueueOfflineEvent({
      type: 'SEARCH_HISTORY_DELETE',
      clientEventId,
      payload: { query: normalized },
      createdAt: new Date().toISOString()
    });
  }

  return next;
}

export async function clearSearchHistory(userId: string | null): Promise<SearchHistoryDto[]> {
  await writeLocalHistory(userId, []);

  const online = isOnline();

  if (online) {
    try {
      const serverItems = await apiRequest<SearchHistoryDto[]>('/search-history', {
        method: 'DELETE',
        timeoutMs: 4000
      });
      if (Array.isArray(serverItems)) {
        return serverItems;
      }
    } catch (error) {
      if (error instanceof ApiError) {
        const clientEventId = generateId();
        await enqueueOfflineEvent({
          type: 'SEARCH_HISTORY_CLEAR',
          clientEventId,
          payload: {},
          createdAt: new Date().toISOString()
        });
      }
    }
  } else {
    const clientEventId = generateId();
    await enqueueOfflineEvent({
      type: 'SEARCH_HISTORY_CLEAR',
      clientEventId,
      payload: {},
      createdAt: new Date().toISOString()
    });
  }

  return [];
}

export function debounce<T extends (...args: unknown[]) => unknown>(fn: T, delayMs: number): (...args: Parameters<T>) => void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  return function debounced(...args: Parameters<T>) {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      fn(...args);
    }, delayMs);
  };
}
