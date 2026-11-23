/**
 * YAI Studio — Centralized Error Management and Notification System Types
 *
 * Standardized contracts for error categorization, diagnostic logging,
 * structured troubleshooting & resolution, retry management, and notification lifecycle.
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

// ─── Troubleshooting & Resolution Types ─────────────────────────

export type ResolutionStatus =
  | 'ACTION_REQUIRED'
  | 'AUTOMATIC_FIX_AVAILABLE'
  | 'MANUAL_FIX_REQUIRED'
  | 'WAITING_FOR_USER'
  | 'READY_TO_RETRY'
  | 'RESOLVED'
  | 'UNRESOLVED';

export interface ProbableCause {
  description: string;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  evidence: string[];
}

export interface ResolutionStep {
  step: number;
  title: string;
  description: string;
  completed?: boolean;
}

export type ResolutionActionType =
  | 'RETRY'
  | 'NAVIGATE'
  | 'EXTERNAL_LINK'
  | 'DIAGNOSTIC'
  | 'AUTOMATIC_FIX'
  | 'COPY';

export interface ResolutionAction {
  id: string;
  label: string;
  type: ResolutionActionType;
  enabled: boolean;
  target: string | null;
  description: string;
  requiresConfirmation?: boolean;
}

export interface ErrorResolution {
  summary: string;
  probableCauses: ProbableCause[];
  instructions: ResolutionStep[];
  status: ResolutionStatus;
  actions: ResolutionAction[];
  fixAvailable: boolean;
  automaticFixAvailable: boolean;
  resolutionEvidence: string[];
}

// ─── Application Error Data Structure ───────────────────────────

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
    upstreamStatus?: number | null;
    upstreamService?: string | null;
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
  resolution?: ErrorResolution;
  occurredAt: string;
  resolvedAt?: string | null;
}

// ─── Notification Data Structure ────────────────────────────────

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
  resolutionStatus?: ResolutionStatus;
  primaryActionRoute?: string | null;
}

// ─── Capture Options ────────────────────────────────────────────

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
    upstreamStatus?: number | null;
    upstreamService?: string | null;
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
  customResolution?: Partial<ErrorResolution>;
  showModal?: boolean;
  silent?: boolean;
}
