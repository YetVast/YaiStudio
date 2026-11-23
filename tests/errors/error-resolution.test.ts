/**
 * YAI Studio — Guided Troubleshooting & Error Resolution Tests
 *
 * Verifies intelligent generation of actionable troubleshooting guidance, probable causes
 * with confidence ratings and supporting evidence, sequential resolution steps,
 * and contextual recovery action buttons.
 */

import { describe, it, expect } from 'vitest';
import { normalizeError } from '@/lib/errors/error-normalizer';
import { generateErrorResolution } from '@/lib/errors/error-resolution';

describe('Guided Troubleshooting & Error Resolution', () => {
  describe('Reference Implementation: GitHub 401 Bad Credentials', () => {
    it('generates high-confidence troubleshooting guidance for GitHub 401 Bad Credentials', () => {
      const appError = normalizeError({
        error: new Error('Bad credentials'),
        category: 'AUTHENTICATION',
        source: {
          module: 'AI Runtime Monitor',
          component: 'GitHub Persistence',
          operation: 'Save Baseline Details',
        },
        details: {
          httpStatus: 401,
          upstreamStatus: 401,
          upstreamService: 'GitHub API',
          endpoint: '/api/telemetry/save-github',
          provider: 'litert',
          model: 'gemma-2-2b-it-int4',
          operationId: 'test_123',
        },
        retryHandler: async () => true,
      });

      const resolution = appError.resolution;
      expect(resolution).toBeDefined();
      if (!resolution) return;

      // Status indicator
      expect(resolution.status).toBe('ACTION_REQUIRED');
      expect(resolution.fixAvailable).toBe(true);
      expect(resolution.automaticFixAvailable).toBe(false);

      // Plain language summary explaining failure and isolating inference from persistence
      expect(resolution.summary).toContain('GitHub rejected the authentication credential');
      expect(resolution.summary).toContain('telemetry generation and inference operations completed successfully');
      expect(resolution.summary).toContain('Only GitHub persistence failed');

      // Probable causes with confidence and evidence
      expect(resolution.probableCauses).toHaveLength(4);
      const topCause = resolution.probableCauses[0];
      expect(topCause.confidence).toBe('HIGH');
      expect(topCause.description).toContain('server credential vault has expired');
      expect(topCause.evidence).toEqual(
        expect.arrayContaining([
          expect.stringContaining('HTTP 401 Unauthorized'),
        ])
      );

      // Sequential instructions
      expect(resolution.instructions.length).toBeGreaterThanOrEqual(4);
      expect(resolution.instructions[0].step).toBe(1);
      expect(resolution.instructions[0].title).toBe('Validate GitHub Authentication');
      expect(resolution.instructions[1].title).toBe('Re-authorize GitHub Storage');
      expect(resolution.instructions[1].description).toContain('/github-connect');
      expect(resolution.instructions[3].title).toBe('Retry Save Details');
      expect(resolution.instructions[3].description).toContain('without re-running any inference test');

      // Contextual action buttons
      expect(resolution.actions.length).toBe(4);

      const diagAction = resolution.actions.find((a) => a.id === 'validate_github');
      expect(diagAction).toBeDefined();
      expect(diagAction?.type).toBe('DIAGNOSTIC');
      expect(diagAction?.enabled).toBe(true);
      expect(diagAction?.target).toBe('/api/github/connection');

      const navAction = resolution.actions.find((a) => a.id === 'open_github_connect');
      expect(navAction).toBeDefined();
      expect(navAction?.type).toBe('NAVIGATE');
      expect(navAction?.enabled).toBe(true);
      expect(navAction?.target).toBe('/github-connect');

      const copyAction = resolution.actions.find((a) => a.id === 'copy_instructions');
      expect(copyAction).toBeDefined();
      expect(copyAction?.type).toBe('COPY');
      expect(copyAction?.enabled).toBe(true);

      const retryAction = resolution.actions.find((a) => a.id === 'retry_operation');
      expect(retryAction).toBeDefined();
      expect(retryAction?.type).toBe('RETRY');
      expect(retryAction?.enabled).toBe(true);
      expect(retryAction?.description).toContain('without re-running model inference');
    });

    it('omits retry action when operation does not provide a retry handler', () => {
      const appError = normalizeError({
        error: new Error('Bad credentials'),
        category: 'AUTHENTICATION',
        source: {
          module: 'AI Runtime Monitor',
          component: 'GitHub Persistence',
          operation: 'Save Baseline Details',
        },
        details: {
          httpStatus: 401,
          upstreamStatus: 401,
          endpoint: '/api/telemetry/save-github',
        },
        // no retryHandler
      });

      const resolution = appError.resolution;
      expect(resolution).toBeDefined();
      if (!resolution) return;

      const retryAction = resolution.actions.find((a) => a.type === 'RETRY');
      expect(retryAction).toBeUndefined();
    });
  });

  describe('GitHub 403 Forbidden / Authorization Errors', () => {
    it('generates guidance for missing repo write scope on GitHub 403', () => {
      const appError = normalizeError({
        error: new Error('Resource not accessible by integration'),
        category: 'AUTHORIZATION',
        source: {
          module: 'AI Runtime Monitor',
          component: 'GitHub Persistence',
          operation: 'Save Baseline Details',
        },
        details: {
          httpStatus: 403,
          upstreamStatus: 403,
          upstreamService: 'GitHub API',
          endpoint: '/api/telemetry/save-github',
        },
        retryHandler: async () => true,
      });

      const resolution = appError.resolution;
      expect(resolution).toBeDefined();
      if (!resolution) return;

      expect(resolution.summary).toContain('write access to repository');
      expect(resolution.probableCauses[0].confidence).toBe('HIGH');
      expect(resolution.probableCauses[0].description).toContain('repo');

      const navAction = resolution.actions.find((a) => a.id === 'open_github_connect');
      expect(navAction?.enabled).toBe(true);
      expect(navAction?.target).toBe('/github-connect');
    });
  });

  describe('AI Model Inference Failures (Category: MODEL)', () => {
    it('generates guidance pointing to provider catalog and device intelligence', () => {
      const appError = normalizeError({
        error: new Error('WebGPU device lost during tensor evaluation'),
        category: 'MODEL',
        source: {
          module: 'AI Runtime',
          component: 'LiteRT-LM Engine',
          operation: 'Inference Execution',
        },
        details: {
          model: 'gemma-2-2b-it-int4',
          provider: 'litert',
        },
        retryHandler: async () => true,
      });

      const resolution = appError.resolution;
      expect(resolution).toBeDefined();
      if (!resolution) return;

      expect(resolution.probableCauses[0].description).toContain('WebGPU');
      expect(resolution.probableCauses[2].description).toContain('Ollama');

      const providersAction = resolution.actions.find((a) => a.id === 'open_providers');
      expect(providersAction?.target).toBe('/providers');
      expect(providersAction?.enabled).toBe(true);

      const deviceAction = resolution.actions.find((a) => a.id === 'open_device_intel');
      expect(deviceAction?.target).toBe('/settings/yai-local');
      expect(deviceAction?.enabled).toBe(true);
    });
  });

  describe('Database and Storage Errors (Category: DATABASE)', () => {
    it('generates storage guidance pointing to /settings', () => {
      const appError = normalizeError({
        error: new Error('QuotaExceededError: The quota has been exceeded.'),
        category: 'DATABASE',
        source: {
          module: 'Storage',
          component: 'IndexedDB',
          operation: 'Put Record',
        },
        retryHandler: async () => true,
      });

      const resolution = appError.resolution;
      expect(resolution).toBeDefined();
      if (!resolution) return;

      expect(resolution.probableCauses[0].description).toContain('disk space quota');
      const settingsAction = resolution.actions.find((a) => a.id === 'open_settings');
      expect(settingsAction?.target).toBe('/settings');
      expect(settingsAction?.enabled).toBe(true);
    });
  });
});
