import { expect, type BrowserContext, type Page } from '@playwright/test';

interface OfflineEventSeed {
  type: 'WORD_REVIEW' | 'GRAMMAR_ATTEMPT';
  clientEventId: string;
  payload: Record<string, unknown>;
  createdAt: string;
}

async function overrideNavigatorOnline(page: Page, online: boolean): Promise<void> {
  await page.evaluate((value) => {
    const applyOverride = (target: object) => {
      Object.defineProperty(target, 'onLine', {
        configurable: true,
        get: () => value
      });
    };

    try {
      applyOverride(window.navigator);
    } catch (_error) {
      try {
        applyOverride(Object.getPrototypeOf(window.navigator) as object);
      } catch (_nestedError) {
        // Ignore when runtime does not allow overriding navigator.onLine.
      }
    }

    window.dispatchEvent(new Event(value ? 'online' : 'offline'));
  }, online);
}

export async function setOffline(context: BrowserContext, page?: Page): Promise<void> {
  void context;
  if (page) {
    await overrideNavigatorOnline(page, false);
  }
}

export async function setOnline(context: BrowserContext, page?: Page): Promise<void> {
  void context;
  if (page) {
    await overrideNavigatorOnline(page, true);
  }
}

export async function getOfflineQueueSize(page: Page): Promise<number> {
  return page.evaluate(async () => {
    const dbName = 'lexigram-offline-db';

    return new Promise<number>((resolve) => {
      const request = indexedDB.open(dbName);

      request.onerror = () => resolve(0);
      request.onupgradeneeded = () => resolve(0);
      request.onsuccess = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains('offline_queue')) {
          db.close();
          resolve(0);
          return;
        }

        const tx = db.transaction('offline_queue', 'readonly');
        const store = tx.objectStore('offline_queue');
        const countRequest = store.count();

        countRequest.onerror = () => {
          db.close();
          resolve(0);
        };

        countRequest.onsuccess = () => {
          const count = typeof countRequest.result === 'number' ? countRequest.result : 0;
          db.close();
          resolve(count);
        };
      };
    });
  });
}

export async function expectOfflineQueueSize(page: Page, expected: number): Promise<void> {
  await expect
    .poll(async () => getOfflineQueueSize(page), {
      timeout: 10_000
    })
    .toBe(expected);
}

export async function clearOfflineQueue(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const dbName = 'lexigram-offline-db';

    await new Promise<void>((resolve) => {
      const request = indexedDB.open(dbName);

      request.onerror = () => resolve();
      request.onupgradeneeded = () => resolve();
      request.onsuccess = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains('offline_queue')) {
          db.close();
          resolve();
          return;
        }

        const tx = db.transaction('offline_queue', 'readwrite');
        tx.objectStore('offline_queue').clear();
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
        tx.onerror = () => {
          db.close();
          resolve();
        };
      };
    });
  });
}

export async function seedOfflineEvents(page: Page, events: OfflineEventSeed[]): Promise<void> {
  await page.evaluate(async (payload) => {
    const dbName = 'lexigram-offline-db';

    await new Promise<void>((resolve) => {
      const request = indexedDB.open(dbName, 1);

      request.onerror = () => resolve();
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains('offline_queue')) {
          db.createObjectStore('offline_queue', { keyPath: 'id', autoIncrement: true });
        }
      };
      request.onsuccess = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains('offline_queue')) {
          db.close();
          resolve();
          return;
        }

        const tx = db.transaction('offline_queue', 'readwrite');
        const store = tx.objectStore('offline_queue');

        for (const event of payload) {
          store.add({ event });
        }

        tx.oncomplete = () => {
          db.close();
          resolve();
        };
        tx.onerror = () => {
          db.close();
          resolve();
        };
      };
    });
  }, events);
}
