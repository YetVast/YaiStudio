import { describe, it, expect, beforeEach, vi } from 'vitest';
import { errorHandler } from '@/lib/errors/error-handler';
import { ErrorRegistry } from '@/lib/errors/error-registry';
import { NotificationStore } from '@/lib/errors/notification-store';
import { RetryManager } from '@/lib/errors/retry-manager';
import type { ApplicationError } from '@/lib/errors/types';

describe('Centralized Error Management — ErrorHandler Orchestration', () => {
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

    await ErrorRegistry.clearErrors();
    await NotificationStore.clearAllNotifications();
  });

  it('captures an error, persists to registry, creates notification, and notifies modal subscribers', async () => {
    let modalTriggered: ApplicationError | null = null;
    const unsub = errorHandler.subscribeToModal((err) => {
      modalTriggered = err;
    });

    let retryCalled = false;
    const appError = await errorHandler.captureError({
      error: new Error('HTTP 401: GitHub session expired'),
      title: 'GitHub Auth Expired',
      category: 'AUTHENTICATION',
      source: {
        module: 'AI Runtime Monitor',
        component: 'GitHub Persistence',
        operation: 'Save Details',
      },
      details: {
        httpStatus: 401,
        endpoint: '/api/telemetry/save-github',
      },
      retryHandler: async () => {
        retryCalled = true;
        return true;
      },
    });

    expect(appError).toBeTruthy();
    expect(appError.category).toBe('AUTHENTICATION');
    expect(appError.details.httpStatus).toBe(401);

    // Persisted in registry
    const inRegistry = await ErrorRegistry.getError(appError.id);
    expect(inRegistry).not.toBeNull();
    expect(inRegistry?.title).toBe('GitHub Auth Expired');

    // Notification created
    const notifs = await NotificationStore.getNotifications();
    expect(notifs).toHaveLength(1);
    expect(notifs[0].relatedErrorId).toBe(appError.id);
    expect(notifs[0].category).toBe('ERROR');

    // Modal triggered
    expect(modalTriggered).not.toBeNull();
    expect(modalTriggered?.id).toBe(appError.id);

    // Retry registered
    expect(RetryManager.isRetryAvailable(appError.id)).toBe(true);
    await RetryManager.executeRetry(appError.id);
    expect(retryCalled).toBe(true);

    unsub();
  });

  it('deduplicates identical errors propagating within a 2-second window', async () => {
    const errorInstance = new Error('Database connection failed');

    const err1 = await errorHandler.captureError({
      error: errorInstance,
      title: 'DB Error',
      source: { module: 'Storage', component: 'IndexedDB', operation: 'Init' },
      details: { errorCode: 'ERR_DB_INIT' },
    });

    const err2 = await errorHandler.captureError({
      error: errorInstance,
      title: 'DB Error',
      source: { module: 'Storage', component: 'IndexedDB', operation: 'Init' },
      details: { errorCode: 'ERR_DB_INIT' },
    });

    // Should deduplicate and return the existing registered error
    expect(err1.id).toBe(err2.id);

    const allNotifs = await NotificationStore.getNotifications();
    expect(allNotifs).toHaveLength(1); // No spam duplicate notification
  });
});
