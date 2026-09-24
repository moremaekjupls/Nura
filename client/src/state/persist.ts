/**
 * Offline: the query cache is persisted to localStorage, so the app opens with
 * the last loaded days, history and profile even without a connection.
 * Changes still need the network (they fail with a clear message offline).
 */
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';

const KEY = 'nura_cache_v1';

export const persister = createSyncStoragePersister({
  storage: typeof window !== 'undefined' ? safeStorage() : undefined,
  key: KEY,
  throttleTime: 2000,
});

function safeStorage(): Storage | undefined {
  try {
    localStorage.setItem('__nura', '1');
    localStorage.removeItem('__nura');
    return localStorage;
  } catch {
    return undefined;
  }
}

export function clearPersistedCache() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
