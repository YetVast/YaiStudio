import { describe, it, expect } from 'vitest';
import {
  sanitizeString,
  sanitizeObject,
  classifyErrorCategory,
  normalizeError,
  getFriendlySummary,
} from '@/lib/errors/error-normalizer';

describe('Centralized Error Management — Error Normalizer & Secret Sanitizer', () => {
  describe('1. Secret Sanitization', () => {
    it('scrubs GitHub OAuth tokens, personal access tokens, and bearer tokens', () => {
      const raw = 'Failed request with token gho_1234567890abcdef1234567890 and Bearer eyJhbGciOiJIUzI1NiJ9.test';
      const sanitized = sanitizeString(raw);
      expect(sanitized).not.toContain('gho_1234567890abcdef1234567890');
      expect(sanitized).toContain('gho_[REDACTED]');
      expect(sanitized).not.toContain('eyJhbGciOiJIUzI1NiJ9.test');
      expect(sanitized).toContain('Bearer [REDACTED]');
    });

    it('scrubs Google API tokens and OpenAI style sk- tokens', () => {
      const raw = 'Google token ya29.a0AfH6SMByz1234567890abcdef and secret sk-1234567890abcdefghij';
      const sanitized = sanitizeString(raw);
      expect(sanitized).not.toContain('ya29.a0AfH6SMByz1234567890abcdef');
      expect(sanitized).toContain('ya29.[REDACTED]');
      expect(sanitized).not.toContain('sk-1234567890abcdefghij');
      expect(sanitized).toContain('sk-[REDACTED]');
    });

    it('deeply sanitizes objects and redacts sensitive keys', () => {
      const sensitiveObj = {
        endpoint: '/api/telemetry/save-github',
        githubToken: 'gho_secrettoken12345678',
        headers: {
          Authorization: 'Bearer gho_secrettoken12345678',
          apiKey: 'key_12345678',
          contentType: 'application/json',
        },
        payload: {
          password: 'mySuperSecretPassword',
          safeField: 'hello-world',
        },
      };

      const cleaned = sanitizeObject(sensitiveObj);
      expect(cleaned.githubToken).toBe('[REDACTED]');
      expect(cleaned.headers.Authorization).toBe('[REDACTED]');
      expect(cleaned.headers.apiKey).toBe('[REDACTED]');
      expect(cleaned.headers.contentType).toBe('application/json');
      expect(cleaned.payload.password).toBe('[REDACTED]');
      expect(cleaned.payload.safeField).toBe('hello-world');
    });
  });

  describe('2. Error Classification & Normalization', () => {
    it('classifies HTTP 401 as AUTHENTICATION and HTTP 403 as AUTHORIZATION', () => {
      expect(classifyErrorCategory(new Error('Session expired'), undefined, 401)).toBe('AUTHENTICATION');
      expect(classifyErrorCategory(new Error('Forbidden resource'), undefined, 403)).toBe('AUTHORIZATION');
    });

    it('classifies network connection failures as NETWORK', () => {
      expect(classifyErrorCategory(new TypeError('Failed to fetch'))).toBe('NETWORK');
      expect(classifyErrorCategory(new Error('Network request timed out'))).toBe('NETWORK');
    });

    it('classifies model and WebGPU out-of-memory errors as MODEL', () => {
      expect(classifyErrorCategory(new Error('WebGPU out of memory during inference'))).toBe('MODEL');
      expect(classifyErrorCategory(new Error('LiteRT runtime model loading failed'))).toBe('MODEL');
    });

    it('produces human-friendly summaries for common errors', () => {
      const summary401 = getFriendlySummary('AUTHENTICATION', 401);
      expect(summary401.title).toBe('Authentication Required');

      const summary403 = getFriendlySummary('AUTHORIZATION', 403);
      expect(summary403.title).toBe('Action Not Authorized');
    });

    it('normalizes arbitrary errors into a complete ApplicationError structure', () => {
      const appErr = normalizeError({
        error: new Error('A network error occurred while reaching endpoint https://example.com?apiKey=secret_val'),
        source: {
          module: 'AI Runtime Monitor',
          component: 'GitHub Persistence',
          operation: 'Save Baseline Details',
        },
        details: {
          httpStatus: 500,
          endpoint: '/api/telemetry/save-github',
        },
        logs: [
          {
            timestamp: '2026-11-23T02:00:00Z',
            level: 'error',
            source: 'GitHub Persistence',
            message: 'Connection failed',
          },
        ],
      });

      expect(appErr.id).toBeTruthy();
      expect(appErr.category).toBe('API');
      expect(appErr.source.module).toBe('AI Runtime Monitor');
      expect(appErr.details.httpStatus).toBe(500);
      expect(appErr.details.originalMessage).not.toContain('secret_val');
      expect(appErr.details.originalMessage).toContain('[REDACTED]');
      expect(appErr.logs).toHaveLength(1);
      expect(appErr.retry.available).toBe(false);
    });
  });
});
