import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NotificationStore } from '@/lib/errors/notification-store';
import type { AppNotification } from '@/lib/errors/types';

describe('Centralized Error Management — Notification Store', () => {
  const store: Record<string, string> = {};

  beforeEach(async () => {
    for (const k in store) {
      delete store[k];
    }

    vi.stubGlobal('localStorage', {
      getItem: (key: string) => store[key] || null,
      setItem: (key: string, value: string) => {
        store[key] = value;
      },
      removeItem: (key: string) => {
        delete store[key];
      },
      clear: () => {
        for (const k in store) {
          delete store[k];
        }
      },
    });

    await NotificationStore.clearAllNotifications();
  });

  it('adds notifications and keeps them in chronological newest-first order', async () => {
    await NotificationStore.addNotification({
      category: 'INFO',
      title: 'Model Loaded',
      description: 'Gemma 2B initialized',
      source: { module: 'AI Runtime' },
      timestamp: '2026-11-23T01:00:00Z',
    });

    await NotificationStore.addNotification({
      category: 'ERROR',
      title: 'Persistence Failed',
      description: 'GitHub commit 403',
      source: { module: 'AI Runtime Monitor' },
      timestamp: '2026-11-23T01:05:00Z',
      retryAvailable: true,
      relatedErrorId: 'err_123',
    });

    const notifs = await NotificationStore.getNotifications();
    expect(notifs).toHaveLength(2);
    expect(notifs[0].title).toBe('Persistence Failed'); // newest first
    expect(notifs[0].read).toBe(false);
  });

  it('calculates unread counts and supports read/unread transitions', async () => {
    const n1 = await NotificationStore.addNotification({
      category: 'WARNING',
      title: 'Disk space low',
      description: 'Less than 2GB remaining',
      source: { module: 'Storage' },
    });

    const n2 = await NotificationStore.addNotification({
      category: 'SUCCESS',
      title: 'Backup Completed',
      description: 'All cogs saved',
      source: { module: 'Sync' },
    });

    expect(await NotificationStore.getUnreadCount()).toBe(2);

    await NotificationStore.markAsRead(n1.id);
    expect(await NotificationStore.getUnreadCount()).toBe(1);

    await NotificationStore.markAsUnread(n1.id);
    expect(await NotificationStore.getUnreadCount()).toBe(2);

    await NotificationStore.markAllAsRead();
    expect(await NotificationStore.getUnreadCount()).toBe(0);
  });

  it('clears individual and all notifications', async () => {
    const n1 = await NotificationStore.addNotification({
      category: 'INFO',
      title: 'Task 1',
      description: 'Completed',
      source: { module: 'Tasks' },
    });

    const n2 = await NotificationStore.addNotification({
      category: 'INFO',
      title: 'Task 2',
      description: 'Completed',
      source: { module: 'Tasks' },
    });

    expect(await NotificationStore.getNotifications()).toHaveLength(2);

    await NotificationStore.clearNotification(n1.id);
    const afterOne = await NotificationStore.getNotifications();
    expect(afterOne).toHaveLength(1);
    expect(afterOne[0].id).toBe(n2.id);

    await NotificationStore.clearAllNotifications();
    expect(await NotificationStore.getNotifications()).toHaveLength(0);
  });

  it('updates notification when related error is resolved', async () => {
    const n = await NotificationStore.addNotification({
      category: 'ERROR',
      title: 'Save Details Failed',
      description: '403 Forbidden',
      source: { module: 'AI Runtime Monitor' },
      relatedErrorId: 'err_save_999',
      retryAvailable: true,
    });

    await NotificationStore.updateByErrorId('err_save_999', (prev) => ({
      ...prev,
      title: `[Resolved] ${prev.title}`,
      retryAvailable: false,
      executionStatus: 'SUCCEEDED',
    }));

    const notifs = await NotificationStore.getNotifications();
    expect(notifs[0].title).toBe('[Resolved] Save Details Failed');
    expect(notifs[0].retryAvailable).toBe(false);
  });
});
