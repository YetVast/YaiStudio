import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '@/app/api/telemetry/save-github/route';
import * as sessionModule from '@/lib/auth/session';
import * as githubStorageAuth from '@/lib/auth/github-storage-auth';
import * as personalStorage from '@/lib/storage/personal-intelligence-storage';
import * as gh from '@/lib/github/api-client';

describe('API: /api/telemetry/save-github', () => {
  const mockSession = {
    yvUserId: 'user_123',
    email: 'user@example.com',
    githubLogin: 'octocat',
    role: 'user',
  };

  const sampleTestExecution = {
    testId: 'test_run_abc123',
    query: 'Explain how a local AI model processes a user request.',
    model: {
      provider: 'local-litert',
      name: 'ibm-granite-4.0-350m',
      version: '4.0',
      quantization: '4bit',
      backend: 'LiteRT WebGPU Engine',
    },
    execution: {
      startedAt: '2026-11-23T14:30:25.000Z',
      completedAt: '2026-11-23T14:30:26.500Z',
      durationMs: 1500,
      status: 'COMPLETED' as const,
    },
    tokens: {
      input: 42,
      output: 128,
      total: 170,
      tokensPerSecond: 85.3,
    },
    queryResources: {
      baselineApplicationMemoryBytes: 45000000,
      peakMemoryDuringBytes: 62000000,
      incrementalPeakMemoryBytes: 17000000,
      memoryRetainedAfterBytes: 2000000,
      usedComponentsCount: 15,
      notUsedComponentsCount: 40,
      measuredZeroComponentsCount: 10,
      unavailableMeasurementsCount: 8,
      notSupportedMeasurementsCount: 3,
      errorMeasurementsCount: 0,
    },
    measurementCoverage: {
      totalRegisteredComponents: 76,
      classifiedComponents: 76,
      coveragePercentage: 100,
      directlyMeasuredMetricsCount: 22,
      estimatedMetricsCount: 12,
      notSupportedMetricsCount: 3,
    },
    response: {
      content: 'A local AI model processes a request in multiple stages...',
    },
    systemResources: {
      initialMemory: { jsHeapUsedMb: 45 },
      finalMemory: { jsHeapUsedMb: 47 },
    },
    steps: [],
    components: [],
    errors: [],
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('rejects unauthenticated requests with 401', async () => {
    vi.spyOn(sessionModule, 'requireSession').mockRejectedValue(new Error('Unauthorized'));

    const req = new NextRequest('http://localhost:3000/api/telemetry/save-github', {
      method: 'POST',
      body: JSON.stringify({ testExecution: sampleTestExecution }),
    });

    const res = await POST(req);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe('Unauthorized');
  });

  it('rejects requests when GitHub token is not connected with 403', async () => {
    vi.spyOn(sessionModule, 'requireSession').mockResolvedValue(mockSession as any);
    vi.spyOn(githubStorageAuth, 'getStoredGitHubToken').mockResolvedValue(null);

    const req = new NextRequest('http://localhost:3000/api/telemetry/save-github', {
      method: 'POST',
      body: JSON.stringify({ testExecution: sampleTestExecution }),
    });

    const res = await POST(req);
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toContain('GitHub storage is not connected');
  });

  it('rejects invalid or missing testExecution payload with 400', async () => {
    vi.spyOn(sessionModule, 'requireSession').mockResolvedValue(mockSession as any);
    vi.spyOn(githubStorageAuth, 'getStoredGitHubToken').mockResolvedValue('gho_mock_token');

    const req = new NextRequest('http://localhost:3000/api/telemetry/save-github', {
      method: 'POST',
      body: JSON.stringify({}),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('Invalid payload');
  });

  it('rejects when personal intelligence repository is not found with 404', async () => {
    vi.spyOn(sessionModule, 'requireSession').mockResolvedValue(mockSession as any);
    vi.spyOn(githubStorageAuth, 'getStoredGitHubToken').mockResolvedValue('gho_mock_token');
    vi.spyOn(personalStorage, 'verifyRepository').mockResolvedValue({
      exists: false,
      isPrivate: false,
      ownerMatch: true,
    });

    const req = new NextRequest('http://localhost:3000/api/telemetry/save-github', {
      method: 'POST',
      body: JSON.stringify({ testExecution: sampleTestExecution }),
    });

    const res = await POST(req);
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toContain('Personal Intelligence repository');
  });

  it('prevents overwriting an existing test record with 409 Conflict', async () => {
    vi.spyOn(sessionModule, 'requireSession').mockResolvedValue(mockSession as any);
    vi.spyOn(githubStorageAuth, 'getStoredGitHubToken').mockResolvedValue('gho_mock_token');
    vi.spyOn(personalStorage, 'verifyRepository').mockResolvedValue({
      exists: true,
      isPrivate: true,
      ownerMatch: true,
    });

    // Mock existing file in GitHub
    vi.spyOn(gh, 'getFile').mockResolvedValue({
      path: 'telemetry-tests/runtime-telemetry-local-litert-ibm-granite-4-0-350m-20261123-143025.json',
      sha: 'existing_sha_123',
      content: '{}',
      size: 2,
    });

    const req = new NextRequest('http://localhost:3000/api/telemetry/save-github', {
      method: 'POST',
      body: JSON.stringify({ testExecution: sampleTestExecution }),
    });

    const res = await POST(req);
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toContain('already exists');
    expect(body.error).toContain('Overwrite is prevented');
  });

  it('saves complete test execution record to GitHub and returns success details', async () => {
    vi.spyOn(sessionModule, 'requireSession').mockResolvedValue(mockSession as any);
    vi.spyOn(githubStorageAuth, 'getStoredGitHubToken').mockResolvedValue('gho_mock_token');
    vi.spyOn(personalStorage, 'verifyRepository').mockResolvedValue({
      exists: true,
      isPrivate: true,
      ownerMatch: true,
    });

    // File does not exist yet
    vi.spyOn(gh, 'getFile').mockResolvedValue(null);

    let committedPath = '';
    let committedContent = '';
    let committedMessage = '';

    vi.spyOn(gh, 'createFile').mockImplementation(
      async (owner, repo, path, content, message, token) => {
        committedPath = path;
        committedContent = content;
        committedMessage = message;
        return {
          content: { name: 'test.json', path, sha: 'created_sha_999' },
          commit: { sha: 'commit_sha_999' },
        } as any;
      }
    );

    const req = new NextRequest('http://localhost:3000/api/telemetry/save-github', {
      method: 'POST',
      body: JSON.stringify({ testExecution: sampleTestExecution }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.success).toBe(true);
    expect(body.filename).toMatch(/^runtime-telemetry-local-litert-ibm-granite-4-0-350m-\d{8}-\d{6}\.json$/);
    expect(body.path).toContain('telemetry-tests/');
    expect(body.repository).toBe('octocat/YVSApps_Data_YaiStudio');
    expect(body.url).toContain('https://github.com/octocat/YVSApps_Data_YaiStudio/blob/main/telemetry-tests/');

    // Validate committed JSON content
    const parsed = JSON.parse(committedContent);
    expect(parsed.testExecutionId).toBe('test_run_abc123');
    expect(parsed.activeProvider).toBe('local-litert');
    expect(parsed.selectedModel).toBe('ibm-granite-4.0-350m');
    expect(parsed.modelVersion).toBe('4.0');
    expect(parsed.modelQuantization).toBe('4bit');
    expect(parsed.inferenceBackend).toBe('LiteRT WebGPU Engine');
    expect(parsed.diagnosticQueryPrompt).toBe(sampleTestExecution.query);
    expect(parsed.elapsedDurationMs).toBe(1500);
    expect(parsed.queryResources.peakMemoryDuringBytes).toBe(62000000);
    expect(parsed.measurementCoverage.coveragePercentage).toBe(100);
    expect(parsed.modelOutputResponse.content).toContain('A local AI model processes');
    expect(parsed.savedBy.userId).toBe('user_123');
    expect(parsed.savedBy.githubLogin).toBe('octocat');
    expect(committedMessage).toContain('test(telemetry): record baseline for ibm-granite-4.0-350m');
  });
});
