/**
 * YAI Studio V1 — Milestone 6: LiteRT-LM Proof of Concept
 *
 * Technical verification harness demonstrating:
 * 1. Runtime initialization & capability detection
 * 2. Model descriptor loading
 * 3. Local prompt execution
 * 4. Response generation
 * 5. Complete isolation: Zero outbound cloud inference requests
 * 6. Latency, tokens/second, and resource measurements
 */

import { LiteRTEngine } from './litert-engine';
import type { LocalInferenceMeasurement, UnifiedInferenceResult } from './types';

export interface PocExecutionReport {
  success: boolean;
  modelId: string;
  response: string;
  outboundRequestsCount: number;
  privacyVerified: boolean;
  measurements: LocalInferenceMeasurement;
  deviceSupported: boolean;
  unsupportedReasons: string[];
}

export async function runLiteRTPoc(options: {
  modelId?: string;
  prompt?: string;
} = {}): Promise<PocExecutionReport> {
  const modelId = options.modelId || 'gemma-2-2b-it-int4';
  const prompt = options.prompt || 'Hello! What is YAI Studio and how do you protect my privacy?';

  let outboundRequestsCount = 0;
  const originalFetch = globalThis.fetch;

  // Track any outbound requests during local execution to enforce privacy assertion
  const monitoredFetch = (...args: Parameters<typeof fetch>) => {
    outboundRequestsCount++;
    return originalFetch(...args);
  };

  try {
    globalThis.fetch = monitoredFetch as typeof fetch;

    const engine = new LiteRTEngine();

    // 1. Runtime initialization
    const caps = await engine.initialize();

    // 2. Model loading
    await engine.loadModel(modelId);

    // 3 & 4. Local prompt execution and generation
    const { result, measurement } = await engine.generate({
      messages: [{ role: 'user', content: prompt }],
      model: modelId,
      provider: 'local-litert',
      mode: 'local',
      systemPrompt: 'You are YAI Studio Local Intelligence running on-device.',
    });

    // 5. Invariant check: zero cloud requests made
    const privacyVerified = outboundRequestsCount === 0;

    return {
      success: true,
      modelId,
      response: result.content,
      outboundRequestsCount,
      privacyVerified,
      measurements: measurement,
      deviceSupported: caps.isSupported,
      unsupportedReasons: caps.unsupportedReasons,
    };
  } finally {
    globalThis.fetch = originalFetch;
  }
}
