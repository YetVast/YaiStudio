/**
 * YAI Studio — Diagnostic Error Registry
 *
 * Persists ApplicationError diagnostic records into client-side IndexedDB
 * (localSettings table) with graceful fallback to localStorage.
 *
 * Invariant: Clearing notifications in the Notification Center NEVER deletes
 * underlying diagnostic error records from this registry.
 */

import { getYaiDatabase } from '@/lib/storage/client/db';
import type { ApplicationError } from './types';

const STORAGE_KEY = 'yai_diagnostic_errors_v1';
const LOCAL_STORAGE_FALLBACK_KEY = 'yai_diagnostic_errors_ls_v1';
const MAX_ERROR_RECORDS = 50;

export class ErrorRegistry {
  private static listeners: Set<() => void> = new Set();
  private static inMemoryCache: ApplicationError[] | null = null;

  /**
   * Save or update an ApplicationError record.
   */
  static async saveError(error: ApplicationError): Promise<void> {
    const existing = await this.getAllErrors();
    const filtered = existing.filter((e) => e.id !== error.id);
    const updated = [error, ...filtered].slice(0, MAX_ERROR_RECORDS);

    this.inMemoryCache = updated;

    // 1. Try IndexedDB localSettings
    try {
      if (typeof window !== 'undefined' && globalThis.indexedDB) {
        const db = getYaiDatabase();
        await db.localSettings.put({
          key: STORAGE_KEY,
          value: updated,
          updatedAt: new Date().toISOString(),
        });
      }
    } catch (err) {
      console.warn('[ErrorRegistry] IndexedDB write failed, relying on localStorage cache:', err);
    }

    // 2. Always sync to localStorage as reliable fast cache / fallback
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(LOCAL_STORAGE_FALLBACK_KEY, JSON.stringify(updated));
      } catch (lsErr) {
        console.warn('[ErrorRegistry] localStorage write failed:', lsErr);
      }
    }

    this.notify();
  }

  /**
   * Retrieve all saved diagnostic error records.
   */
  static async getAllErrors(): Promise<ApplicationError[]> {
    if (this.inMemoryCache && this.inMemoryCache.length > 0) {
      return [...this.inMemoryCache];
    }

    // 1. Try IndexedDB
    try {
      if (typeof window !== 'undefined' && globalThis.indexedDB) {
        const db = getYaiDatabase();
        const record = await db.localSettings.get(STORAGE_KEY);
        if (record && Array.isArray(record.value)) {
          this.inMemoryCache = record.value as ApplicationError[];
          return [...this.inMemoryCache];
        }
      }
    } catch (err) {
      console.warn('[ErrorRegistry] IndexedDB read failed, trying localStorage fallback:', err);
    }

    // 2. Fallback to localStorage
    if (typeof localStorage !== 'undefined') {
      try {
        const raw = localStorage.getItem(LOCAL_STORAGE_FALLBACK_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            this.inMemoryCache = parsed;
            return [...parsed];
          }
        }
      } catch (lsErr) {
        console.warn('[ErrorRegistry] localStorage read failed:', lsErr);
      }
    }

    return [];
  }

  /**
   * Find a specific error by ID.
   */
  static async getError(id: string): Promise<ApplicationError | null> {
    const all = await this.getAllErrors();
    return all.find((e) => e.id === id) || null;
  }

  /**
   * Update an existing error record (e.g. after a retry attempt or resolution).
   */
  static async updateError(
    id: string,
    updater: (prev: ApplicationError) => ApplicationError
  ): Promise<ApplicationError | null> {
    const existing = await this.getError(id);
    if (!existing) return null;

    const updated = updater({ ...existing });
    await this.saveError(updated);
    return updated;
  }

  /**
   * Clear error registry records (only used by explicit diagnostic purge or tests).
   */
  static async clearErrors(): Promise<void> {
    this.inMemoryCache = [];

    try {
      if (typeof window !== 'undefined' && globalThis.indexedDB) {
        const db = getYaiDatabase();
        await db.localSettings.delete(STORAGE_KEY);
      }
    } catch (err) {
      console.warn('[ErrorRegistry] IndexedDB delete failed:', err);
    }

    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.removeItem(LOCAL_STORAGE_FALLBACK_KEY);
      } catch (lsErr) {
        console.warn('[ErrorRegistry] localStorage delete failed:', lsErr);
      }
    }

    this.notify();
  }

  /**
   * Subscribe to registry changes.
   */
  static subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private static notify() {
    for (const listener of this.listeners) {
      try {
        listener();
      } catch (e) {
        console.error('[ErrorRegistry] Listener error:', e);
      }
    }
  }
}
