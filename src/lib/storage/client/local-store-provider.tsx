'use client';

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
} from 'react';
import { ClientStorageAdapter } from './storage-adapter';
import { getYaiDatabase } from './db';
import type { StorageQuotaInfo } from './types';

export interface LocalStoreContextValue {
  adapter: ClientStorageAdapter | null;
  isReady: boolean;
  pendingCount: number;
  storageQuota: StorageQuotaInfo | null;
  refreshPendingCount: () => Promise<number>;
  refreshStorageQuota: () => Promise<void>;
}

const LocalStoreContext = createContext<LocalStoreContextValue>({
  adapter: null,
  isReady: false,
  pendingCount: 0,
  storageQuota: null,
  refreshPendingCount: async () => 0,
  refreshStorageQuota: async () => {},
});

export function LocalStoreProvider({ children }: { children: React.ReactNode }) {
  const [adapter, setAdapter] = useState<ClientStorageAdapter | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [storageQuota, setStorageQuota] = useState<StorageQuotaInfo | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      const db = getYaiDatabase();
      const storageAdapter = new ClientStorageAdapter(db);
      setAdapter(storageAdapter);
      setIsReady(true);

      storageAdapter.countPendingMutations().then(setPendingCount).catch(console.warn);
      storageAdapter.getStorageQuota().then(setStorageQuota).catch(console.warn);
    } catch (err) {
      console.warn('[LocalStore] IndexedDB initialization deferred or unavailable:', err);
    }
  }, []);

  const refreshPendingCount = useCallback(async (): Promise<number> => {
    if (!adapter) return 0;
    try {
      const count = await adapter.countPendingMutations();
      setPendingCount(count);
      return count;
    } catch {
      return 0;
    }
  }, [adapter]);

  const refreshStorageQuota = useCallback(async (): Promise<void> => {
    if (!adapter) return;
    try {
      const quota = await adapter.getStorageQuota();
      setStorageQuota(quota);
    } catch {
      // Ignore quota fetch error
    }
  }, [adapter]);

  const value = useMemo<LocalStoreContextValue>(
    () => ({
      adapter,
      isReady,
      pendingCount,
      storageQuota,
      refreshPendingCount,
      refreshStorageQuota,
    }),
    [adapter, isReady, pendingCount, storageQuota, refreshPendingCount, refreshStorageQuota]
  );

  return <LocalStoreContext.Provider value={value}>{children}</LocalStoreContext.Provider>;
}

export function useLocalStore(): LocalStoreContextValue {
  return useContext(LocalStoreContext);
}
