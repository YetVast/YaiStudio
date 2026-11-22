/**
 * YAI Studio — Error Normalizer & Secret Sanitizer
 *
 * Normalizes diverse runtime, API, network, and model exceptions into a standard
 * ApplicationError structure while rigorously sanitizing secrets, tokens, and credentials.
 */

import type { ApplicationError, ErrorCategory, CaptureErrorOptions } from './types';

// Sensitive patterns to scrub from errors, messages, and stack traces
const SENSITIVE_PATTERNS: Array<{ pattern: RegExp; replacement: string }> = [
  // GitHub & Bearer tokens
  { pattern: /(gho_|ghp_|ghu_|ghs_|ghr_)[a-zA-Z0-9_]{16,}/g, replacement: '$1[REDACTED]' },
  { pattern: /ya29\.[a-zA-Z0-9_\\.-]{20,}/g, replacement: 'ya29.[REDACTED]' },
  { pattern: /sk-[a-zA-Z0-9]{20,}/g, replacement: 'sk-[REDACTED]' },
  { pattern: /Bearer\s+[a-zA-Z0-9_\-\.]{15,}/gi, replacement: 'Bearer [REDACTED]' },
  // Basic Auth or user credentials
  { pattern: /(https?:\/\/[^:]+):([^@]+)@/g, replacement: '$1:[REDACTED]@' },
  // API keys and secret query parameters
  { pattern: /([?&](?:apiKey|api_key|token|access_token|key|secret)=)[^&]+/gi, replacement: '$1[REDACTED]' },
];

/**
 * Sanitize a string by scrubbing known secret/token patterns.
 */
export function sanitizeString(val: string | null | undefined): string {
  if (!val) return '';
  let cleaned = val;
  for (const { pattern, replacement } of SENSITIVE_PATTERNS) {
    cleaned = cleaned.replace(pattern, replacement);
  }
  return cleaned;
}

/**
 * Deeply sanitize an object or array to ensure no tokens or passwords leak.
 */
export function sanitizeObject<T>(val: T): T {
  if (val === null || val === undefined) return val;
  if (typeof val === 'string') return sanitizeString(val) as unknown as T;
  if (typeof val !== 'object') return val;

  if (Array.isArray(val)) {
    return val.map((item) => sanitizeObject(item)) as unknown as T;
  }

  const result: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(val as Record<string, unknown>)) {
    const lowerKey = k.toLowerCase();
    if (
      lowerKey.includes('token') ||
      lowerKey.includes('secret') ||
      lowerKey.includes('password') ||
      lowerKey.includes('authorization') ||
      lowerKey.includes('cookie') ||
      lowerKey.includes('apikey') ||
      lowerKey.includes('key')
    ) {
      result[k] = '[REDACTED]';
    } else {
      result[k] = sanitizeObject(v);
    }
  }
  return result as T;
}

/**
 * Classify the error category from status code, error type, or message content.
 */
export function classifyErrorCategory(
  error: unknown,
  explicitCategory?: ErrorCategory,
  httpStatus?: number | null
): ErrorCategory {
  if (explicitCategory) return explicitCategory;

  if (httpStatus === 401) return 'AUTHENTICATION';
  if (httpStatus === 403) return 'AUTHORIZATION';
  if (httpStatus === 400 || httpStatus === 422) return 'VALIDATION';
  if (httpStatus && httpStatus >= 500) return 'API';

  const errStr = error instanceof Error ? `${error.name} ${error.message}`.toLowerCase() : String(error).toLowerCase();

  if (errStr.includes('unauthorized') || errStr.includes('401') || errStr.includes('session expired')) {
    return 'AUTHENTICATION';
  }
  if (errStr.includes('forbidden') || errStr.includes('403') || errStr.includes('permission') || errStr.includes('access denied')) {
    return 'AUTHORIZATION';
  }
  if (
    errStr.includes('failed to fetch') ||
    errStr.includes('network') ||
    errStr.includes('timeout') ||
    errStr.includes('connection refused') ||
    errStr.includes('err_connection')
  ) {
    return 'NETWORK';
  }
  if (
    errStr.includes('model') ||
    errStr.includes('inference') ||
    errStr.includes('litert') ||
    errStr.includes('ollama') ||
    errStr.includes('webgpu') ||
    errStr.includes('out of memory')
  ) {
    return 'MODEL';
  }
  if (
    errStr.includes('indexeddb') ||
    errStr.includes('database') ||
    errStr.includes('dexie') ||
    errStr.includes('quota')
  ) {
    return 'DATABASE';
  }

  return 'UNKNOWN';
}

/**
 * Formulate human-friendly error titles and summaries for known scenarios.
 */
export function getFriendlySummary(
  category: ErrorCategory,
  httpStatus?: number | null,
  rawMessage?: string
): { title: string; message: string } {
  if (httpStatus === 401 || category === 'AUTHENTICATION') {
    return {
      title: 'Authentication Required',
      message:
        'Your session or credential has expired or is invalid. Please sign in or re-authenticate to continue.',
    };
  }
  if (httpStatus === 403 || category === 'AUTHORIZATION') {
    return {
      title: 'Action Not Authorized',
      message:
        'You do not have sufficient permissions to access or write to this resource. Check your GitHub repository connection or role permissions.',
    };
  }
  if (category === 'NETWORK') {
    return {
      title: 'Network Communication Failure',
      message:
        'Unable to reach the remote endpoint. Please check your internet connectivity or network restrictions.',
    };
  }
  if (category === 'MODEL') {
    return {
      title: 'AI Model Inference Failure',
      message:
        'The configured AI model runtime encountered an error while processing the request. This may be caused by memory limits or unsupported model weights.',
    };
  }
  if (category === 'DATABASE') {
    return {
      title: 'Local Storage Error',
      message:
        'Client-side storage encountered an error accessing IndexedDB. Check browser storage permissions or disk quota.',
    };
  }

  return {
    title: 'Operation Failed',
    message: rawMessage || 'An unexpected failure occurred while executing the operation.',
  };
}

/**
 * Normalize any caught error into a standardized ApplicationError.
 */
export function normalizeError(options: CaptureErrorOptions, generatedId?: string): ApplicationError {
  const { error, title, message, category, source, details, logs, retryHandler, maxRetries, reasonUnavailable } = options;

  let originalMessage = '';
  let stackTrace: string | null = null;
  let detectedStatus = details?.httpStatus ?? null;
  let detectedCode = details?.errorCode ?? null;

  if (error instanceof Error) {
    originalMessage = error.message;
    stackTrace = error.stack || null;
    if ('status' in error && typeof (error as any).status === 'number') {
      detectedStatus = (error as any).status;
    }
    if ('code' in error && typeof (error as any).code === 'string') {
      detectedCode = (error as any).code;
    }
  } else if (typeof error === 'string') {
    originalMessage = error;
  } else if (error && typeof error === 'object') {
    originalMessage = JSON.stringify(error);
  } else {
    originalMessage = String(error);
  }

  const finalCategory = classifyErrorCategory(error, category, detectedStatus);
  const friendly = getFriendlySummary(finalCategory, detectedStatus, originalMessage);

  const errorId = generatedId || `err_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  const hasRetry = Boolean(retryHandler);

  return {
    id: errorId,
    title: sanitizeString(title || friendly.title),
    message: sanitizeString(message || friendly.message),
    category: finalCategory,
    source: {
      module: sanitizeString(source.module),
      component: sanitizeString(source.component),
      operation: sanitizeString(source.operation),
    },
    details: {
      errorCode: detectedCode ? sanitizeString(detectedCode) : null,
      httpStatus: detectedStatus,
      endpoint: details?.endpoint ? sanitizeString(details.endpoint) : null,
      requestId: details?.requestId ? sanitizeString(details.requestId) : null,
      operationId: details?.operationId ? sanitizeString(details.operationId) : null,
      originalMessage: sanitizeString(originalMessage),
      stackTrace: stackTrace ? sanitizeString(stackTrace) : null,
      provider: details?.provider ? sanitizeString(details.provider) : null,
      model: details?.model ? sanitizeString(details.model) : null,
      additionalContext: details?.additionalContext ? sanitizeObject(details.additionalContext) : null,
    },
    logs: (logs || []).map((l) => ({
      timestamp: l.timestamp || new Date().toISOString(),
      level: l.level || 'info',
      source: sanitizeString(l.source),
      message: sanitizeString(l.message),
    })),
    retry: {
      available: hasRetry,
      attempts: 0,
      maxAttempts: maxRetries !== undefined ? maxRetries : 3,
      lastAttemptAt: null,
      status: hasRetry ? 'READY' : 'NOT_AVAILABLE',
      reasonUnavailable: !hasRetry ? reasonUnavailable || 'This operation does not provide an automated retry handler.' : null,
    },
    occurredAt: new Date().toISOString(),
    resolvedAt: null,
  };
}
