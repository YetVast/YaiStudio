import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { OllamaClient } from '@/lib/inference/runtimes/ollama-client';
import { processTelemetry } from '@/lib/telemetry/process-telemetry';

describe('Ollama Local Runtime Client Integration', () => {
  beforeEach(() => {
    processTelemetry.clearCompleted();
    for (const p of processTelemetry.getProcesses()) {
      processTelemetry.completeProcess(p.id);
    }
    processTelemetry.clearCompleted();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('checks health when Ollama daemon is active', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        available: true,
        runtime: 'ollama',
        version: '0.5.1',
      }),
    });
    vi.stubGlobal('fetch', mockFetch);

    const report = await OllamaClient.checkHealth();
    expect(report.available).toBe(true);
    expect(report.version).toBe('0.5.1');

    const metrics = processTelemetry.getSummaryMetrics();
    expect(metrics.currentRuntime).toBe('ollama');
    expect(metrics.runtimeHealth).toBe('healthy');
  });

  it('handles offline Ollama daemon gracefully without throwing', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        available: false,
        error: 'Ollama daemon is not reachable',
      }),
    });
    vi.stubGlobal('fetch', mockFetch);

    const report = await OllamaClient.checkHealth();
    expect(report.available).toBe(false);

    const metrics = processTelemetry.getSummaryMetrics();
    expect(metrics.runtimeHealth).toBe('offline');
  });

  it('unloads model and updates telemetry state', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, model: 'gemma4:2b' }),
    });
    vi.stubGlobal('fetch', mockFetch);

    const success = await OllamaClient.unloadModel('gemma4:2b');
    expect(success).toBe(true);

    const metrics = processTelemetry.getSummaryMetrics();
    expect(metrics.activeModel).toBeNull();
  });

  it('executes generate and returns real token metrics', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        content: 'Local Ollama response',
        model: 'gemma4:2b',
        durationMs: 420,
        evalCount: 28,
        evalDurationNs: 1200000000,
        tokensPerSecond: 23.3,
      }),
    });
    vi.stubGlobal('fetch', mockFetch);

    const res = await OllamaClient.generate({
      model: 'gemma4:2b',
      prompt: 'Hello local AI',
    });

    expect(res.content).toBe('Local Ollama response');
    expect(res.tokensPerSecond).toBe(23.3);
    expect(res.durationMs).toBe(420);
  });
});
