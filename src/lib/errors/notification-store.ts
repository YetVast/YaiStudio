/**
 * YAI Studio — Notification Store
 *
 * Persists application notifications into client-side IndexedDB with
 * localStorage fallback. Tracks read/unread state and provides reactive subscriptions.
 */

import { getYaiDatabase } from '@/lib/storage/client/db';
import type { AppNotification } from './types';

const STORAGE_KEY = 'yai_notifications_v1';
const LOCAL_STORAGE_FALLBACK_KEY = 'yai_notifications_ls_v1';
const MAX_NOTIFICATIONS = 50;

export class NotificationStore {
  private static listeners: Set<() => void> = new Set();
  private static inMemoryCache: AppNotification[] | null = null;

  /**
   * Add a new notification.
   */
  static async addNotification(
    data: Omit<AppNotification, 'id' | 'timestamp' | 'read'> & {
      id?: string;
      timestamp?: string;
      read?: boolean;
    }
  ): Promise<AppNotification> {
    const existing = await this.getNotifications();
    const newNotif: AppNotification = {
      id: data.id || `notif_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      category: data.category,
      title: data.title,
      description: data.description,
      detailedMessage: data.detailedMessage,
      source: data.source,
      operationId: data.operationId,
      timestamp: data.timestamp || new Date().toISOString(),
      read: data.read ?? false,
      executionStatus: data.executionStatus,
      retryAvailable: data.retryAvailable ?? false,
      relatedErrorId: data.relatedErrorId,
      resolutionStatus: data.resolutionStatus,
      primaryActionRoute: data.primaryActionRoute,
    };

    const updated = [newNotif, ...existing.filter((n) => n.id !== newNotif.id)].slice(
      0,
      MAX_NOTIFICATIONS
    );
    await this.persist(updated);
    return newNotif;
  }

  /**
   * Retrieve all notifications, ordered newest first.
   */
  static async getNotifications(): Promise<AppNotification[]> {
    if (this.inMemoryCache && this.inMemoryCache.length > 0) {
      return [...this.inMemoryCache];
    }

    // 1. Try IndexedDB
    try {
      if (typeof window !== 'undefined' && globalThis.indexedDB) {
        const db = getYaiDatabase();
        const record = await db.localSettings.get(STORAGE_KEY);
        if (record && Array.isArray(record.value)) {
          this.inMemoryCache = record.value as AppNotification[];
          return [...this.inMemoryCache];
        }
      }
    } catch (err) {
      console.warn('[NotificationStore] IndexedDB read failed, trying localStorage fallback:', err);
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
        console.warn('[NotificationStore] localStorage read failed:', lsErr);
      }
    }

    return [];
  }

  /**
   * Get unread notification count.
   */
  static async getUnreadCount(): Promise<number> {
    const all = await this.getNotifications();
    return all.filter((n) => !n.read).length;
  }

  /**
   * Mark a notification as read.
   */
  static async markAsRead(id: string): Promise<void> {
    const all = await this.getNotifications();
    const updated = all.map((n) => (n.id === id ? { ...n, read: true } : n));
    await this.persist(updated);
  }

  /**
   * Mark a notification as unread.
   */
  static async markAsUnread(id: string): Promise<void> {
    const all = await this.getNotifications();
    const updated = all.map((n) => (n.id === id ? { ...n, read: false } : n));
    await this.persist(updated);
  }

  /**
   * Mark all notifications as read.
   */
  static async markAllAsRead(): Promise<void> {
    const all = await this.getNotifications();
    const updated = all.map((n) => ({ ...n, read: true }));
    await this.persist(updated);
  }

  /**
   * Clear an individual notification.
   */
  static async clearNotification(id: string): Promise<void> {
    const all = await this.getNotifications();
    const updated = all.filter((n) => n.id !== id);
    await this.persist(updated);
  }

  /**
   * Clear all notifications.
   * Note: Underlying diagnostic error records in ErrorRegistry remain intact!
   */
  static async clearAllNotifications(): Promise<void> {
    await this.persist([]);
  }

  /**
   * Update notification by related error ID (e.g. after retry success).
   */
  static async updateByErrorId(
    errorId: string,
    updater: (prev: AppNotification) => AppNotification
  ): Promise<void> {
    const all = await this.getNotifications();
    const updated = all.map((n) => (n.relatedErrorId === errorId ? updater(n) : n));
    await this.persist(updated);
  }

  private static async persist(notifications: AppNotification[]): Promise<void> {
    this.inMemoryCache = notifications;

    try {
      if (typeof window !== 'undefined' && globalThis.indexedDB) {
        const db = getYaiDatabase();
        await db.localSettings.put({
          key: STORAGE_KEY,
          value: notifications,
          updatedAt: new Date().toISOString(),
        });
      }
    } catch (err) {
      console.warn('[NotificationStore] IndexedDB write failed:', err);
    }

    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(LOCAL_STORAGE_FALLBACK_KEY, JSON.stringify(notifications));
      } catch (lsErr) {
        console.warn('[NotificationStore] localStorage write failed:', lsErr);
      }
    }

    this.notify();
  }

  /**
   * Subscribe to store updates.
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
        console.error('[NotificationStore] Listener error:', e);
      }
    }
  }
}
