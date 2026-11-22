import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ErrorRegistry } from '@/lib/errors/error-registry';
import { RetryManager } from '@/lib/errors/retry-manager';
import { NotificationStore } from '@/lib/errors/notification-store';
import { normalizeError } from '@/lib/errors/error-normalizer';
import type { ApplicationError } from '@/lib/errors/types';

describe('Centralized Error Management — Error Registry & Retry Mechanism', () => {
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

  describe('1. Error Registry Persistence & Log Preservation', () => {
    it('persists ApplicationError records and retrieves them', async () => {
      const err = normalizeError({
        error: new Error('Failed to connect to provider endpoint'),
        title: 'Connection Error',
        category: 'NETWORK',
        source: {
          module: 'Model Providers',
          component: 'Ollama Client',
          operation: 'Check Health',
        },
        logs: [
          {
            timestamp: new Date().toISOString(),
            level: 'info',
            source: 'Ollama Client',
            message: 'Pinging http://localhost:11434...',
          },
        ],
      });

      await ErrorRegistry.saveError(err);
      const retrieved = await ErrorRegistry.getError(err.id);
      expect(retrieved).not.toBeNull();
      expect(retrieved?.id).toBe(err.id);
      expect(retrieved?.category).toBe('NETWORK');
      expect(retrieved?.logs).toHaveLength(1);
    });

    it('preserves underlying diagnostic error records even when notifications are cleared', async () => {
      const err = normalizeError({
        error: new Error('Inference timeout on local LiteRT model'),
        category: 'MODEL',
        source: {
          module: 'AI Runtime Monitor',
          component: 'Test Once Runner',
          operation: 'Run Test Once',
        },
      });

      await ErrorRegistry.saveError(err);
      await NotificationStore.addNotification({
        category: 'ERROR',
        title: err.title,
        description: err.message,
        source: err.source,
        relatedErrorId: err.id,
      });

      // User clears notifications in Notification Center
      await NotificationStore.clearAllNotifications();

      const notifs = await NotificationStore.getNotifications();
      expect(notifs).toHaveLength(0);

      // Diagnostic record in ErrorRegistry remains completely intact
      const preservedErr = await ErrorRegistry.getError(err.id);
      expect(preservedErr).not.toBeNull();
      expect(preservedErr?.id).toBe(err.id);
      expect(preservedErr?.category).toBe('MODEL');
    });
  });

  describe('2. Specific Retry Mechanism & Context Preservation', () => {
    it('retries only the specific failed functionality without rerunning preceding stages', async () => {
      let inferenceCalls = 0;
      let saveDetailsCalls = 0;

      // Simulated preceding successful inference
      const executeInference = () => {
        inferenceCalls++;
        return {
          testId: 'test_baseline_123',
          output: 'Pre-computed inference output',
        };
      };

      const inferenceResult = executeInference();
      expect(inferenceCalls).toBe(1);

      // Simulated failed Save Details operation using the pre-computed inference result
      const saveDetailsToGitHub = async (allowSuccess = false) => {
        saveDetailsCalls++;
        if (!allowSuccess) {
          throw new Error('HTTP 403: Forbidden - write access required');
        }
        return true;
      };

      let allowSaveSuccess = false;

      const error = normalizeError({
        error: new Error('GitHub Save Failed with HTTP 403'),
        title: 'Save Details Failed',
        category: 'AUTHORIZATION',
        source: {
          module: 'AI Runtime Monitor',
          component: 'GitHub Persistence',
          operation: 'Save Baseline Details',
        },
        retryHandler: async () => {
          return await saveDetailsToGitHub(allowSaveSuccess);
        },
      });

      await ErrorRegistry.saveError(error);
      RetryManager.registerRetry(error.id, async () => {
        return await saveDetailsToGitHub(allowSaveSuccess);
      });

      // First retry attempt fails
      const firstRetrySuccess = await RetryManager.executeRetry(error.id);
      expect(firstRetrySuccess).toBe(false);
      expect(inferenceCalls).toBe(1); // DID NOT RE-RUN INFERENCE!
      expect(saveDetailsCalls).toBe(1);

      let record = await ErrorRegistry.getError(error.id);
      expect(record?.retry.attempts).toBe(1);
      expect(record?.retry.status).toBe('FAILED');

      // Now user grants permission and retries
      allowSaveSuccess = true;
      const secondRetrySuccess = await RetryManager.executeRetry(error.id);
      expect(secondRetrySuccess).toBe(true);
      expect(inferenceCalls).toBe(1); // STILL DID NOT RE-RUN INFERENCE!
      expect(saveDetailsCalls).toBe(2);

      record = await ErrorRegistry.getError(error.id);
      expect(record?.retry.attempts).toBe(2);
      expect(record?.retry.status).toBe('SUCCEEDED');
      expect(record?.resolvedAt).toBeTruthy();
    });

    it('prevents concurrent duplicate retries while a retry is already in flight', async () => {
      let resolveRetry: () => void = () => {};
      const pendingPromise = new Promise<void>((resolve) => {
        resolveRetry = resolve;
      });

      const error = normalizeError({
        error: new Error('Transient network error'),
        category: 'NETWORK',
        source: { module: 'API', component: 'Sync', operation: 'Push' },
        retryHandler: async () => {
          await pendingPromise;
          return true;
        },
      });

      await ErrorRegistry.saveError(error);
      RetryManager.registerRetry(error.id, async () => {
        await pendingPromise;
        return true;
      });

      // Launch first retry
      const retryPromise1 = RetryManager.executeRetry(error.id);
      expect(RetryManager.isRetrying(error.id)).toBe(true);

      // Attempt duplicate retry while in progress
      const duplicateSuccess = await RetryManager.executeRetry(error.id);
      expect(duplicateSuccess).toBe(false); // Blocked concurrent retry

      resolveRetry();
      const firstSuccess = await retryPromise1;
      expect(firstSuccess).toBe(true);
      expect(RetryManager.isRetrying(error.id)).toBe(false);
    });
  });
});
