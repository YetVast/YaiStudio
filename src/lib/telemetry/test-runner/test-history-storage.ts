/**
 * YAI Studio — Test Telemetry History Persistence
 *
 * Persists Test Once execution baselines in client-side IndexedDB (localSettings table)
 * with graceful fallback to localStorage.
 *
 * Ensures test history is private, local-only, and never sent to central servers.
 */

import { getYaiDatabase } from '@/lib/storage/client/db';
import type { TestOnceResult } from './types';

const STORAGE_KEY = 'telemetry_test_history';
const LOCAL_STORAGE_FALLBACK_KEY = 'yai_telemetry_test_history_v1';
const MAX_HISTORY_ITEMS = 25;

export class TestHistoryStorage {
  private static listeners: Set<() => void> = new Set();
  private static inMemoryFallback: TestOnceResult[] = [];

  /**
   * Save a completed test result into persistent storage.
   */
  static async saveTestResult(result: TestOnceResult): Promise<void> {
    const existing = await this.getTestResults();
    // Prepend newest test result, deduplicate by testId
    const updated = [result, ...existing.filter((r) => r.testId !== result.testId)].slice(
      0,
      MAX_HISTORY_ITEMS
    );
    this.inMemoryFallback = updated;

    // 1. Try IndexedDB localSettings
    let idbSucceeded = false;
    try {
      if (typeof window !== 'undefined' && globalThis.indexedDB) {
        const db = getYaiDatabase();
        await db.localSettings.put({
          key: STORAGE_KEY,
          value: updated,
          updatedAt: new Date().toISOString(),
        });
        idbSucceeded = true;
      }
    } catch (err) {
      console.warn('[TestHistoryStorage] IndexedDB write failed, using localStorage fallback:', err);
    }

    // 2. Always sync to localStorage as reliable fast cache / fallback
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(LOCAL_STORAGE_FALLBACK_KEY, JSON.stringify(updated));
      } catch (lsErr) {
        console.warn('[TestHistoryStorage] localStorage write failed:', lsErr);
      }
    }

    this.inMemoryFallback = [];
    this.notify();
  }

  /**
   * Retrieve all saved test results from storage.
   */
  static async getTestResults(): Promise<TestOnceResult[]> {
    // 1. Try IndexedDB localSettings
    try {
      if (typeof window !== 'undefined' && globalThis.indexedDB) {
        const db = getYaiDatabase();
        const record = await db.localSettings.get(STORAGE_KEY);
        if (record && Array.isArray(record.value)) {
          return record.value as TestOnceResult[];
        }
      }
    } catch (err) {
      console.warn('[TestHistoryStorage] IndexedDB read failed, falling back to localStorage:', err);
    }

    // 2. Fallback to localStorage
    if (typeof localStorage !== 'undefined') {
      try {
        const raw = localStorage.getItem(LOCAL_STORAGE_FALLBACK_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.length > 0) {
            return parsed as TestOnceResult[];
          }
        }
      } catch {
        // Fall through to in-memory
      }
    }

    // 3. Fallback to in-memory cache (e.g. Node test environment)
    return this.inMemoryFallback;
  }

  /**
   * Get single test result by ID.
   */
  static async getTestResultById(testId: string): Promise<TestOnceResult | undefined> {
    const all = await this.getTestResults();
    return all.find((t) => t.testId === testId);
  }

  /**
   * Clear all stored test history.
   */
  static async clearTestHistory(): Promise<void> {
    try {
      if (typeof window !== 'undefined' && globalThis.indexedDB) {
        const db = getYaiDatabase();
        await db.localSettings.delete(STORAGE_KEY);
      }
    } catch (err) {
      console.warn('[TestHistoryStorage] IndexedDB delete error:', err);
    }

    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.removeItem(LOCAL_STORAGE_FALLBACK_KEY);
      } catch {}
    }

    this.inMemoryFallback = [];
    this.notify();
  }

  static subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private static notify(): void {
    for (const listener of this.listeners) {
      try {
        listener();
      } catch (err) {
        console.error('[TestHistoryStorage] Listener error:', err);
      }
    }
  }
}
