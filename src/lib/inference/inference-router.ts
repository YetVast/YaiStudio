/**
 * YAI Studio V1 — Unified Inference Router
 *
 * Implements strict isolation between local and cloud execution modes:
 * - Local mode: strictly executes on-device via LiteRT-LM.
 *   HARD INVARIANT: NO SILENT CLOUD FALLBACK.
 * - Cloud mode: uses server-side vaulted BYOK credentials via /api/yai/generate.
 */

import { LiteRTEngine } from './litert-engine';
import { LocalModelManager } from './model-manager';
import { LocalAIConfig } from './local-ai-config';
import type {
  UnifiedInferenceRequest,
  UnifiedInferenceResult,
  InferenceMode,
} from './types';

let localEngineInstance: LiteRTEngine | null = null;

function getLocalEngine(): LiteRTEngine {
  if (!localEngineInstance) {
    localEngineInstance = new LiteRTEngine();
  }
  return localEngineInstance;
}

export class InferenceRouter {
  /**
   * Execute inference respecting strict mode boundaries:
   * - 'local': strictly executes on-device via LiteRT-LM (no cloud fallback).
   * - 'auto': prefers on-device when a ready model is available, otherwise uses cloud.
   * - 'cloud': uses server-side vaulted BYOK cloud provider.
   */
  static async route(request: UnifiedInferenceRequest): Promise<UnifiedInferenceResult> {
    // ─── 1. AUTOMATIC MODE ──────────────────────────────────────────
    if (request.mode === 'auto') {
      const activeModelId = LocalAIConfig.getActiveModelId();
      const record = LocalModelManager.getRecord(activeModelId);
      if (record && record.status === 'ready') {
        try {
          const engine = getLocalEngine();
          const { result } = await engine.generate({
            ...request,
            model: activeModelId,
            provider: 'local-litert',
            mode: 'local',
          });
          return result;
        } catch (localErr) {
          console.warn('[InferenceRouter] Auto mode local execution failed, falling back to cloud:', localErr);
          // Fall through to cloud execution
        }
      }
    }

    // ─── 2. STRICT LOCAL MODE ───────────────────────────────────────
    if (request.mode === 'local') {
      try {
        const engine = getLocalEngine();
        const { result } = await engine.generate(request);
        return result;
      } catch (err) {
        // HARD PRIVACY INVARIANT: Never fall back to cloud silently in Local mode!
        const errMsg = err instanceof Error ? err.message : String(err);
        throw new Error(
          `Local on-device inference failed: ${errMsg}. Local mode strictly prohibits cloud fallback to protect your privacy.`
        );
      }
    }

    // ─── 3. CLOUD BYOK MODE ─────────────────────────────────────────
    const startTime = performance.now();
    const lastUserMessage = request.messages[request.messages.length - 1]?.content || '';
    const cloudProvider = request.provider === 'local-litert' ? LocalAIConfig.getPreferredCloudProvider() : request.provider;

    const res = await fetch('/api/yai/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: lastUserMessage,
        message: lastUserMessage,
        model: request.model,
        provider: cloudProvider,
        systemPrompt: request.systemPrompt,
      }),
      signal: request.signal,
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || `Cloud generation failed with HTTP ${res.status}`);
    }

    const data = await res.json();
    const duration = Math.round(performance.now() - startTime);

    return {
      content: data.response || data.content || '',
      model: data.model || request.model,
      provider: cloudProvider,
      mode: 'cloud',
      executionEnvironment: 'server-vaulted',
      executionTimeMs: duration,
      inputTokens: data.inputTokens,
      outputTokens: data.outputTokens,
      finishReason: 'stop',
    };
  }
}
