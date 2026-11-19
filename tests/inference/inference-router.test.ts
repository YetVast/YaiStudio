import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { InferenceRouter } from '@/lib/inference/inference-router';
import { runLiteRTPoc } from '@/lib/inference/litert-poc';

describe('Milestone 5 & 6 & 8 — Inference Abstraction, LiteRT-LM POC and Privacy Modes', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('runs isolated LiteRT-LM Proof of Concept with zero outbound requests', async () => {
    const report = await runLiteRTPoc({
      modelId: 'gemma-2-2b-it-int4',
      prompt: 'Summarize my local intelligence state',
    });

    expect(report.success).toBe(true);
    expect(report.modelId).toBe('gemma-2-2b-it-int4');
    expect(report.response).toBeDefined();
    expect(report.response.length).toBeGreaterThan(10);

    // Hard Privacy Guarantee: zero outbound requests during local inference
    expect(report.outboundRequestsCount).toBe(0);
    expect(report.privacyVerified).toBe(true);

    // Measurement benchmarks
    expect(report.measurements.totalDurationMs).toBeGreaterThan(0);
    expect(report.measurements.tokensGenerated).toBeGreaterThan(0);
    expect(report.measurements.tokensPerSecond).toBeGreaterThan(0);
  });

  it('enforces strict local mode without silent cloud fallback on error', async () => {
    const mockFetch = vi.fn();
    vi.stubGlobal('fetch', mockFetch);

    const result = await InferenceRouter.route({
      messages: [{ role: 'user', content: 'What is local intelligence?' }],
      model: 'gemma-2-2b-it-int4',
      provider: 'local-litert',
      mode: 'local',
    });

    expect(result.mode).toBe('local');
    expect(result.provider).toBe('local-litert');
    expect(result.executionEnvironment).toBe('browser-device');

    // Strict invariant: fetch was never called
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('routes cloud requests to server-side vaulted /api/yai/generate route', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        response: 'Cloud assistant response',
        model: 'anthropic/claude-3.5-sonnet',
        provider: 'openrouter',
        inputTokens: 15,
        outputTokens: 25,
      }),
    });
    vi.stubGlobal('fetch', mockFetch);

    const result = await InferenceRouter.route({
      messages: [{ role: 'user', content: 'Hello cloud' }],
      model: 'anthropic/claude-3.5-sonnet',
      provider: 'openrouter',
      mode: 'cloud',
    });

    expect(result.mode).toBe('cloud');
    expect(result.executionEnvironment).toBe('server-vaulted');
    expect(result.content).toBe('Cloud assistant response');

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/yai/generate',
      expect.objectContaining({
        method: 'POST',
      })
    );
  });
});
