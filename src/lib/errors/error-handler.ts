/**
 * YAI Studio — Centralized Error Handler
 *
 * Coordinates error normalization, deduplication, diagnostic persistence,
 * retry registration, and notification generation across all application modules.
 */

import { normalizeError } from './error-normalizer';
import { ErrorRegistry } from './error-registry';
import { NotificationStore } from './notification-store';
import { RetryManager } from './retry-manager';
import type { ApplicationError, CaptureErrorOptions } from './types';

interface ModalListener {
  (error: ApplicationError | null): void;
}

export class ErrorHandler {
  private static instance: ErrorHandler | null = null;
  private modalListeners: Set<ModalListener> = new Set();
  private currentModalError: ApplicationError | null = null;
  private recentFingerprints: Map<string, { id: string; timestamp: number }> = new Map();

  static getInstance(): ErrorHandler {
    if (!ErrorHandler.instance) {
      ErrorHandler.instance = new ErrorHandler();
    }
    return ErrorHandler.instance;
  }

  /**
   * Main entry point to capture, normalize, record, and notify on an application error.
   */
  async captureError(options: CaptureErrorOptions): Promise<ApplicationError> {
    const rawMsg = options.error instanceof Error ? options.error.message : String(options.error || '');
    const code = options.details?.errorCode || '';
    const fingerprint = `${options.source.module}:${options.source.operation}:${code || rawMsg}`;
    const now = Date.now();

    // Deduplication: prevent repeated spamming if the exact same error propagates
    const recent = this.recentFingerprints.get(fingerprint);
    if (recent && now - recent.timestamp < 2000) {
      const existing = await ErrorRegistry.getError(recent.id);
      if (existing) {
        if (options.retryHandler) {
          RetryManager.registerRetry(existing.id, options.retryHandler, options.maxRetries);
        }
        if (options.showModal !== false && !options.silent) {
          this.openErrorModal(existing);
        }
        return existing;
      }
    }

    // 1. Normalize error
    const appError = normalizeError(options);
    this.recentFingerprints.set(fingerprint, { id: appError.id, timestamp: now });

    // Clean up old fingerprints
    for (const [fp, data] of this.recentFingerprints.entries()) {
      if (now - data.timestamp > 10000) {
        this.recentFingerprints.delete(fp);
      }
    }

    // 2. Persist in Error Registry
    await ErrorRegistry.saveError(appError);

    // 3. Register retry handler if provided
    if (options.retryHandler) {
      RetryManager.registerRetry(appError.id, options.retryHandler, options.maxRetries);
    }

    // 4. Create notification
    await NotificationStore.addNotification({
      category: 'ERROR',
      title: appError.title,
      description: appError.message,
      detailedMessage: appError.details.originalMessage || undefined,
      source: appError.source,
      operationId: appError.details.operationId || undefined,
      retryAvailable: appError.retry.available,
      relatedErrorId: appError.id,
    });

    // 5. Open Error Modal if appropriate
    if (options.showModal !== false && !options.silent) {
      this.openErrorModal(appError);
    }

    return appError;
  }

  /**
   * Open the Error Modal with a specific ApplicationError or error ID.
   */
  async openErrorModal(errorOrId: ApplicationError | string): Promise<void> {
    let error: ApplicationError | null = null;
    if (typeof errorOrId === 'string') {
      error = await ErrorRegistry.getError(errorOrId);
    } else {
      error = errorOrId;
    }

    if (error) {
      this.currentModalError = error;
      this.notifyModalListeners(error);
    }
  }

  /**
   * Close the currently open Error Modal.
   */
  closeErrorModal(): void {
    this.currentModalError = null;
    this.notifyModalListeners(null);
  }

  /**
   * Get the current error in the modal, if any.
   */
  getCurrentModalError(): ApplicationError | null {
    return this.currentModalError;
  }

  /**
   * Subscribe to Error Modal open/close events.
   */
  subscribeToModal(listener: ModalListener): () => void {
    this.modalListeners.add(listener);
    return () => {
      this.modalListeners.delete(listener);
    };
  }

  private notifyModalListeners(error: ApplicationError | null) {
    for (const listener of this.modalListeners) {
      try {
        listener(error);
      } catch (e) {
        console.error('[ErrorHandler] Modal listener error:', e);
      }
    }
  }
}

export const errorHandler = ErrorHandler.getInstance();
