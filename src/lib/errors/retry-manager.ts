/**
 * YAI Studio — Centralized Retry Manager
 *
 * Manages registered operation-specific retry closures. Guarantees that retries
 * execute only the specific failed functionality without restarting preceding workflows.
 */

import { ErrorRegistry } from './error-registry';
import type { RetryHandler, RetryStatus } from './types';

interface RegisteredRetryEntry {
  errorId: string;
  handler: RetryHandler;
  maxAttempts: number;
}

export class RetryManager {
  private static handlers: Map<string, RegisteredRetryEntry> = new Map();
  private static inProgress: Set<string> = new Set();
  private static listeners: Set<() => void> = new Set();

  /**
   * Register a retry handler for a specific error instance.
   */
  static registerRetry(errorId: string, handler: RetryHandler, maxAttempts = 3): void {
    this.handlers.set(errorId, {
      errorId,
      handler,
      maxAttempts,
    });
    this.notify();
  }

  /**
   * Check if retry is registered and available for an error ID.
   */
  static isRetryAvailable(errorId: string): boolean {
    return this.handlers.has(errorId) && !this.inProgress.has(errorId);
  }

  /**
   * Check if a retry is currently in flight.
   */
  static isRetrying(errorId: string): boolean {
    return this.inProgress.has(errorId);
  }

  /**
   * Check if ANY retry is in progress.
   */
  static isAnyRetrying(): boolean {
    return this.inProgress.size > 0;
  }

  /**
   * Execute retry for an error.
   */
  static async executeRetry(errorId: string): Promise<boolean> {
    const entry = this.handlers.get(errorId);
    if (!entry) {
      console.warn(`[RetryManager] No retry handler registered for error: ${errorId}`);
      return false;
    }

    if (this.inProgress.has(errorId)) {
      console.warn(`[RetryManager] Retry already in progress for error: ${errorId}`);
      return false;
    }

    // Acquire lock synchronously before any async ticks
    this.inProgress.add(errorId);
    this.notify();

    const currentError = await ErrorRegistry.getError(errorId);
    if (!currentError) {
      this.inProgress.delete(errorId);
      this.notify();
      console.warn(`[RetryManager] Error record not found in registry: ${errorId}`);
      return false;
    }

    // Check max attempts
    if (currentError.retry.maxAttempts && currentError.retry.attempts >= currentError.retry.maxAttempts) {
      this.inProgress.delete(errorId);
      this.notify();
      console.warn(`[RetryManager] Max retry attempts exceeded for error: ${errorId}`);
      await ErrorRegistry.updateError(errorId, (err) => ({
        ...err,
        retry: {
          ...err.retry,
          status: 'FAILED',
          reasonUnavailable: `Maximum retry attempts (${err.retry.maxAttempts}) exceeded.`,
        },
      }));
      return false;
    }

    await ErrorRegistry.updateError(errorId, (err) => ({
      ...err,
      retry: {
        ...err.retry,
        status: 'IN_PROGRESS',
        lastAttemptAt: new Date().toISOString(),
      },
      logs: [
        ...err.logs,
        {
          timestamp: new Date().toISOString(),
          level: 'info',
          source: 'RetryManager',
          message: `Executing retry attempt ${err.retry.attempts + 1} of ${err.retry.maxAttempts || 'unlimited'}...`,
        },
      ],
    }));

    let succeeded = false;
    let failureError: unknown = null;

    try {
      const result = await entry.handler();
      // If handler returns false explicitly, treat as failure; otherwise truthy or void is success
      succeeded = result !== false;
    } catch (err) {
      failureError = err;
      succeeded = false;
    } finally {
      this.inProgress.delete(errorId);
      this.notify();
    }

    const now = new Date().toISOString();

    if (succeeded) {
      await ErrorRegistry.updateError(errorId, (err) => ({
        ...err,
        resolvedAt: now,
        retry: {
          ...err.retry,
          status: 'SUCCEEDED',
          attempts: err.retry.attempts + 1,
          lastAttemptAt: now,
        },
        logs: [
          ...err.logs,
          {
            timestamp: now,
            level: 'info',
            source: 'RetryManager',
            message: `Retry attempt ${err.retry.attempts + 1} succeeded. Operation recovered.`,
          },
        ],
      }));
      return true;
    } else {
      const failureMsg = failureError instanceof Error ? failureError.message : String(failureError || 'Retry returned failure');
      await ErrorRegistry.updateError(errorId, (err) => {
        const attempts = err.retry.attempts + 1;
        const reachedMax = err.retry.maxAttempts ? attempts >= err.retry.maxAttempts : false;
        return {
          ...err,
          retry: {
            ...err.retry,
            status: 'FAILED',
            attempts,
            lastAttemptAt: now,
            reasonUnavailable: reachedMax ? `Maximum retry attempts (${err.retry.maxAttempts}) reached.` : err.retry.reasonUnavailable,
          },
          logs: [
            ...err.logs,
            {
              timestamp: now,
              level: 'error',
              source: 'RetryManager',
              message: `Retry attempt ${attempts} failed: ${failureMsg}`,
            },
          ],
        };
      });
      return false;
    }
  }

  /**
   * Subscribe to retry state transitions.
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
        console.error('[RetryManager] Listener error:', e);
      }
    }
  }
}
