/**
 * YAI Studio — Centralized Error Management and Notification System Types
 *
 * Provides standardized contracts for error categorization, diagnostic logging,
 * retry management, and notification lifecycle.
 */

export type ErrorCategory =
  | 'AUTHENTICATION'
  | 'AUTHORIZATION'
  | 'NETWORK'
  | 'API'
  | 'MODEL'
  | 'DATABASE'
  | 'VALIDATION'
  | 'RUNTIME'
  | 'UNKNOWN';

export type RetryStatus =
  | 'NOT_AVAILABLE'
  | 'READY'
  | 'IN_PROGRESS'
  | 'SUCCEEDED'
  | 'FAILED';

export interface DiagnosticLog {
  timestamp: string;
  level: string; // 'info' | 'warn' | 'error' | 'debug'
  source: string;
  message: string;
}

export interface ApplicationError {
  id: string;
  title: string;
  message: string;
  category: ErrorCategory;
  source: {
    module: string;
    component: string;
    operation: string;
  };
  details: {
    errorCode: string | null;
    httpStatus: number | null;
    endpoint: string | null;
    requestId: string | null;
    operationId: string | null;
    originalMessage: string | null;
    stackTrace: string | null;
    provider?: string | null;
    model?: string | null;
    additionalContext?: Record<string, unknown> | null;
  };
  logs: DiagnosticLog[];
  retry: {
    available: boolean;
    attempts: number;
    maxAttempts: number | null;
    lastAttemptAt: string | null;
    status: RetryStatus;
    reasonUnavailable?: string | null;
  };
  occurredAt: string;
  resolvedAt?: string | null;
}

export type NotificationCategory = 'ERROR' | 'WARNING' | 'SUCCESS' | 'INFO';

export interface AppNotification {
  id: string;
  category: NotificationCategory;
  title: string;
  description: string;
  detailedMessage?: string;
  source: {
    module: string;
    component?: string;
    operation?: string;
  };
  operationId?: string;
  timestamp: string;
  read: boolean;
  executionStatus?: string;
  retryAvailable: boolean;
  relatedErrorId?: string;
}

export type RetryHandler = () => Promise<boolean | void>;

export interface CaptureErrorOptions {
  error: unknown;
  title?: string;
  message?: string;
  category?: ErrorCategory;
  source: {
    module: string;
    component: string;
    operation: string;
  };
  details?: {
    errorCode?: string | null;
    httpStatus?: number | null;
    endpoint?: string | null;
    requestId?: string | null;
    operationId?: string | null;
    provider?: string | null;
    model?: string | null;
    additionalContext?: Record<string, unknown> | null;
  };
  logs?: DiagnosticLog[];
  retryHandler?: RetryHandler;
  maxRetries?: number;
  reasonUnavailable?: string;
  showModal?: boolean;
  silent?: boolean;
}
