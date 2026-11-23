/**
 * YAI Studio — Provider-Aware Runtime Health Service
 *
 * Implements centralized, provider-specific health checks and lifecycle management:
 * - LOCAL-LITERT: WebGPU/WASM compatibility, OPFS model storage, engine readiness.
 *   Strictly zero Ollama calls, zero network requests to 127.0.0.1:11434.
 * - OLLAMA: Real daemon connectivity, installed models (/api/tags), running VRAM (/api/ps).
 *   Only invoked when Ollama is explicitly selected.
 * - CLOUD: Vaulted API key verification for Google AI Studio / OpenRouter.
 *
 * Enforces terminal health states: CHECKING | READY | UNAVAILABLE | MODEL_NOT_FOUND |
 * MODEL_NOT_LOADED | INITIALIZATION_FAILED | ERROR.
 * Guarantees that changing selected provider aborts pending checks and prevents race conditions.
 */

import { LocalAIConfig } from './local-ai-config';
import { detectDeviceCapabilities } from './device-capabilities';
import { getLocalModelDescriptor } from './local-model-registry';
import { LocalModelManager } from './model-manager';
import { OllamaClient } from './runtimes/ollama-client';
import { processTelemetry } from '../telemetry/process-telemetry';
import type { DeviceCapabilityReport } from './types';

export type RuntimeHealthStatus =
  | 'CHECKING'
  | 'READY'
  | 'UNAVAILABLE'
  | 'MODEL_NOT_FOUND'
  | 'MODEL_NOT_LOADED'
  | 'INITIALIZATION_FAILED'
  | 'ERROR';

export type ResolvedProviderType = 'LOCAL-LITERT' | 'OLLAMA' | 'CLOUD';

export interface RuntimeHealthReport {
  providerType: ResolvedProviderType;
  providerId: string; // 'local-litert' | 'local-ollama' | 'google-ai' | 'openrouter'
  runtime: 'litert-lm' | 'ollama' | 'cloud';
  modelId: string | null;
  modelName: string | null;
  status: RuntimeHealthStatus;
  message: string;
  details?: {
    platform?: string;
    hasWebGPU?: boolean;
    hasWasm?: boolean;
    isModelInstalled?: boolean;
    isModelLoaded?: boolean;
    modelStorageBytes?: number;
    ollamaEndpoint?: string;
    ollamaVersion?: string;
    cloudConfigured?: boolean;
    failureReason?: string;
    latencyMs?: number;
    recommendedAction?: string;
  };
  checkedAt: string;
}

export interface ProviderResolution {
  providerType: ResolvedProviderType;
  providerId: string;
  runtime: 'litert-lm' | 'ollama' | 'cloud';
  modelId: string | null;
  cloudProvider: 'openrouter' | 'google-ai';
}

/**
 * Deterministically resolve the active provider, runtime, and model configuration.
 */
export function resolveCurrentProvider(): ProviderResolution {
  const mode = LocalAIConfig.getInferenceMode();
  const activeRuntime = LocalAIConfig.getRuntime();
  const cloudProvider = LocalAIConfig.getPreferredCloudProvider();

  if (mode === 'cloud') {
    const modelId =
      cloudProvider === 'google-ai' ? 'gemini-1.5-flash' : 'anthropic/claude-3.5-sonnet';
    return {
      providerType: 'CLOUD',
      providerId: cloudProvider,
      runtime: 'cloud',
      modelId,
      cloudProvider,
    };
  }

  if (activeRuntime === 'ollama') {
    const activeModelId = LocalAIConfig.getActiveModelId('ollama');
    return {
      providerType: 'OLLAMA',
      providerId: 'local-ollama',
      runtime: 'ollama',
      modelId: activeModelId,
      cloudProvider,
    };
  }

  // Default is LOCAL-LITERT
  const activeModelId = LocalAIConfig.getActiveModelId('litert-lm');
  return {
    providerType: 'LOCAL-LITERT',
    providerId: 'local-litert',
    runtime: 'litert-lm',
    modelId: activeModelId,
    cloudProvider,
  };
}

/**
 * Execute LiteRT-LM provider health evaluation.
 * Strictly local: no calls to 127.0.0.1:11434, no Ollama dependencies.
 */
async function checkLiteRTHealth(
  activeModelId: string | null,
  signal: AbortSignal
): Promise<RuntimeHealthReport> {
  const start = performance.now();
  const descriptor = activeModelId ? getLocalModelDescriptor(activeModelId) : null;
  const modelName = descriptor ? descriptor.name : (activeModelId || 'LiteRT-LM Model');

  // 1. Check device capabilities (WebGPU / WASM)
  let caps: DeviceCapabilityReport | null = null;
  try {
    caps = await detectDeviceCapabilities();
  } catch (err: any) {
    return {
      providerType: 'LOCAL-LITERT',
      providerId: 'local-litert',
      runtime: 'litert-lm',
      modelId: activeModelId,
      modelName,
      status: 'INITIALIZATION_FAILED',
      message: `Device capability detection failed: ${err.message}`,
      details: {
        failureReason: err.message,
      },
      checkedAt: new Date().toISOString(),
    };
  }

  if (signal.aborted) throw new DOMException('Aborted', 'AbortError');

  // Verify hardware platform compatibility
  if (!caps.hasWebGPU && !caps.hasWasm) {
    return {
      providerType: 'LOCAL-LITERT',
      providerId: 'local-litert',
      runtime: 'litert-lm',
      modelId: activeModelId,
      modelName,
      status: 'UNAVAILABLE',
      message: `Device does not support WebGPU or WebAssembly SIMD (${caps.unsupportedReasons.join(', ') || 'Incompatible hardware'}).`,
      details: {
        hasWebGPU: false,
        hasWasm: false,
        failureReason: caps.unsupportedReasons.join(', '),
      },
      checkedAt: new Date().toISOString(),
    };
  }

  // 2. Check model catalog registration
  if (!activeModelId) {
    return {
      providerType: 'LOCAL-LITERT',
      providerId: 'local-litert',
      runtime: 'litert-lm',
      modelId: null,
      modelName: null,
      status: 'MODEL_NOT_FOUND',
      message: 'No active local model selected. Please select a model in AI Providers or Device Intelligence.',
      details: {
        recommendedAction: 'Select a model in Settings > AI Providers.',
      },
      checkedAt: new Date().toISOString(),
    };
  }

  if (!descriptor) {
    return {
      providerType: 'LOCAL-LITERT',
      providerId: 'local-litert',
      runtime: 'litert-lm',
      modelId: activeModelId,
      modelName,
      status: 'MODEL_NOT_FOUND',
      message: `Model "${activeModelId}" is not in the approved local catalog.`,
      details: {
        failureReason: 'Model descriptor not found in local catalog',
      },
      checkedAt: new Date().toISOString(),
    };
  }

  // 3. Check model binary installation status in OPFS
  const record = LocalModelManager.getRecord(activeModelId);
  const isInstalled = record?.status === 'ready';

  if (!isInstalled) {
    if (record?.status === 'downloading' || record?.status === 'verifying') {
      return {
        providerType: 'LOCAL-LITERT',
        providerId: 'local-litert',
        runtime: 'litert-lm',
        modelId: activeModelId,
        modelName: descriptor.name,
        status: 'MODEL_NOT_LOADED',
        message: `Model "${descriptor.name}" is downloading (${record.progressPercent}%).`,
        details: {
          hasWebGPU: caps.hasWebGPU,
          hasWasm: caps.hasWasm,
          isModelInstalled: false,
          isModelLoaded: false,
        },
        checkedAt: new Date().toISOString(),
      };
    }

    return {
      providerType: 'LOCAL-LITERT',
      providerId: 'local-litert',
      runtime: 'litert-lm',
      modelId: activeModelId,
      modelName: descriptor.name,
      status: 'MODEL_NOT_LOADED',
      message: `Model "${descriptor.name}" is not installed in OPFS. Download the model to enable on-device inference.`,
      details: {
        hasWebGPU: caps.hasWebGPU,
        hasWasm: caps.hasWasm,
        isModelInstalled: false,
        isModelLoaded: false,
        recommendedAction: 'Navigate to AI Providers > Local Models to download.',
      },
      checkedAt: new Date().toISOString(),
    };
  }

  // 4. Model is verified in OPFS and device capability is active
  const latency = Math.round(performance.now() - start);
  const backendLabel = caps.hasWebGPU ? 'WebGPU accelerated' : 'WASM SIMD';

  return {
    providerType: 'LOCAL-LITERT',
    providerId: 'local-litert',
    runtime: 'litert-lm',
    modelId: activeModelId,
    modelName: descriptor.name,
    status: 'READY',
    message: `LiteRT-LM runtime ready. Model "${descriptor.name}" verified in OPFS (${backendLabel}).`,
    details: {
      hasWebGPU: caps.hasWebGPU,
      hasWasm: caps.hasWasm,
      isModelInstalled: true,
      isModelLoaded: true,
      modelStorageBytes: record.downloadedBytes,
      latencyMs: latency,
    },
    checkedAt: new Date().toISOString(),
  };
}

/**
 * Execute Ollama provider health evaluation.
 * ONLY executed when OLLAMA is the actively selected provider.
 */
async function checkOllamaHealth(
  activeModelId: string | null,
  signal: AbortSignal
): Promise<RuntimeHealthReport> {
  const start = performance.now();
  const endpoint = OllamaClient.getEndpoint();

  // 1. Probe connectivity to local Ollama daemon
  let isReachable = false;
  let version = '';

  try {
    const res = await fetch(`${endpoint}/api/version`, {
      signal,
      headers: { Accept: 'application/json' },
    });
    if (res.ok) {
      const data = await res.json();
      version = data.version || '0.34+';
      isReachable = true;
    }
  } catch {
    if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
    isReachable = false;
  }

  if (!isReachable) {
    return {
      providerType: 'OLLAMA',
      providerId: 'local-ollama',
      runtime: 'ollama',
      modelId: activeModelId,
      modelName: activeModelId || 'Ollama Model',
      status: 'UNAVAILABLE',
      message: `Ollama daemon is not reachable at ${endpoint}. Run "ollama serve" in terminal to start the service.`,
      details: {
        ollamaEndpoint: endpoint,
        failureReason: 'Connection refused or daemon stopped',
        recommendedAction: 'Open terminal and execute: ollama serve',
      },
      checkedAt: new Date().toISOString(),
    };
  }

  // 2. Query /api/tags for installed models
  let installedModels: any[] = [];
  try {
    const resTags = await fetch(`${endpoint}/api/tags`, { signal });
    if (resTags.ok) {
      const data = await resTags.json();
      installedModels = data.models || [];
    }
  } catch {}

  // 3. Query /api/ps for currently running models in VRAM
  let runningModels: any[] = [];
  try {
    const resPs = await fetch(`${endpoint}/api/ps`, { signal });
    if (resPs.ok) {
      const data = await resPs.json();
      runningModels = data.models || [];
    }
  } catch {}

  // 4. Verify model availability
  if (!activeModelId) {
    return {
      providerType: 'OLLAMA',
      providerId: 'local-ollama',
      runtime: 'ollama',
      modelId: null,
      modelName: null,
      status: 'MODEL_NOT_FOUND',
      message: 'Ollama is connected, but no model is selected.',
      details: { ollamaVersion: version, ollamaEndpoint: endpoint },
      checkedAt: new Date().toISOString(),
    };
  }

  const isInstalled = installedModels.some(
    (m) => m.name === activeModelId || m.model === activeModelId
  );

  if (!isInstalled && installedModels.length > 0) {
    return {
      providerType: 'OLLAMA',
      providerId: 'local-ollama',
      runtime: 'ollama',
      modelId: activeModelId,
      modelName: activeModelId,
      status: 'MODEL_NOT_FOUND',
      message: `Ollama v${version} running, but model "${activeModelId}" is not installed. Run "ollama pull ${activeModelId}".`,
      details: {
        ollamaVersion: version,
        ollamaEndpoint: endpoint,
        isModelInstalled: false,
        recommendedAction: `Execute in terminal: ollama pull ${activeModelId}`,
      },
      checkedAt: new Date().toISOString(),
    };
  }

  const isModelRunning = runningModels.some(
    (m) => m.name === activeModelId || m.model === activeModelId
  );

  const latency = Math.round(performance.now() - start);

  return {
    providerType: 'OLLAMA',
    providerId: 'local-ollama',
    runtime: 'ollama',
    modelId: activeModelId,
    modelName: activeModelId,
    status: 'READY',
    message: `Connected to Ollama v${version}. Model "${activeModelId}" is available (${isModelRunning ? 'in VRAM' : 'ready to load'}).`,
    details: {
      ollamaVersion: version,
      ollamaEndpoint: endpoint,
      isModelInstalled: true,
      isModelLoaded: isModelRunning,
      latencyMs: latency,
    },
    checkedAt: new Date().toISOString(),
  };
}

/**
 * Execute Cloud BYOK provider health evaluation.
 */
async function checkCloudHealth(
  cloudProvider: 'openrouter' | 'google-ai',
  signal: AbortSignal
): Promise<RuntimeHealthReport> {
  const modelId =
    cloudProvider === 'google-ai' ? 'gemini-1.5-flash' : 'anthropic/claude-3.5-sonnet';

  try {
    const res = await fetch('/api/providers', { signal });
    if (res.ok) {
      const data = await res.json();
      const prov = (data.providers || []).find((p: any) => p.id === cloudProvider);
      if (prov && prov.configured) {
        return {
          providerType: 'CLOUD',
          providerId: cloudProvider,
          runtime: 'cloud',
          modelId,
          modelName: prov.name,
          status: 'READY',
          message: `Vaulted API key configured for ${prov.name}. Ready for cloud inference.`,
          details: { cloudConfigured: true },
          checkedAt: new Date().toISOString(),
        };
      }
    }
  } catch {}

  return {
    providerType: 'CLOUD',
    providerId: cloudProvider,
    runtime: 'cloud',
    modelId,
    modelName: cloudProvider,
    status: 'UNAVAILABLE',
    message: `API key for ${cloudProvider} is not configured. Add your key in AI Providers.`,
    details: {
      cloudConfigured: false,
      recommendedAction: 'Navigate to Settings > AI Providers to add API key.',
    },
    checkedAt: new Date().toISOString(),
  };
}

/**
 * Singleton service coordinating provider health checks, race condition avoidance,
 * request cancellation, and telemetry synchronization.
 */
export class RuntimeHealthService {
  private static currentReport: RuntimeHealthReport | null = null;
  private static listeners: Set<(report: RuntimeHealthReport) => void> = new Set();
  private static activeCheckId = 0;
  private static activeAbortController: AbortController | null = null;
  private static inFlightPromise: Promise<RuntimeHealthReport> | null = null;
  private static isSubscribedToConfig = false;

  private static initConfigListener() {
    if (this.isSubscribedToConfig) return;
    this.isSubscribedToConfig = true;
    LocalAIConfig.subscribe(() => {
      this.checkCurrentRuntimeHealth(true).catch(() => {});
    });
  }

  /**
   * Resolve current provider configuration synchronously.
   */
  static resolveCurrentProvider(): ProviderResolution {
    return resolveCurrentProvider();
  }

  /**
   * Get the most recent health report, if any.
   */
  static getLastReport(): RuntimeHealthReport | null {
    return this.currentReport;
  }

  /**
   * Subscribe to runtime health state updates.
   */
  static subscribe(listener: (report: RuntimeHealthReport) => void): () => void {
    this.listeners.add(listener);
    if (this.currentReport) {
      try {
        listener(this.currentReport);
      } catch {}
    }
    return () => {
      this.listeners.delete(listener);
    };
  }

  private static notify(report: RuntimeHealthReport): void {
    for (const listener of this.listeners) {
      try {
        listener(report);
      } catch (err) {
        console.warn('[RuntimeHealthService] Listener error:', err);
      }
    }
  }

  /**
   * Abort any ongoing health checks.
   */
  static cancelPendingChecks(): void {
    if (this.activeAbortController) {
      this.activeAbortController.abort();
      this.activeAbortController = null;
    }
  }

  /**
   * Run provider-specific health check for the currently selected provider.
   * Cancels any obsolete checks and prevents duplicate concurrent executions.
   */
  static async checkCurrentRuntimeHealth(force = false): Promise<RuntimeHealthReport> {
    this.initConfigListener();

    const resolution = resolveCurrentProvider();
    const { providerType, providerId, runtime, modelId, cloudProvider } = resolution;

    // Deduplicate concurrent checks for the same provider/model unless forced
    if (
      !force &&
      this.inFlightPromise &&
      this.currentReport?.providerType === providerType &&
      this.currentReport?.modelId === modelId
    ) {
      return this.inFlightPromise;
    }

    // 1. Cancel previous pending check
    this.cancelPendingChecks();

    const checkId = ++this.activeCheckId;
    const controller = new AbortController();
    this.activeAbortController = controller;

    // 2. Set intermediate CHECKING state if provider or model changed
    if (
      !this.currentReport ||
      this.currentReport.providerType !== providerType ||
      this.currentReport.modelId !== modelId
    ) {
      const checkingReport: RuntimeHealthReport = {
        providerType,
        providerId,
        runtime,
        modelId,
        modelName: modelId,
        status: 'CHECKING',
        message: `Verifying health for ${providerType}...`,
        checkedAt: new Date().toISOString(),
      };
      this.currentReport = checkingReport;
      this.notify(checkingReport);
      processTelemetry.setCurrentRuntime(runtime);
      processTelemetry.setRuntimeHealth('checking');
    }

    // 3. Set a safety timeout
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, 4500);

    const execPromise = (async (): Promise<RuntimeHealthReport> => {
      try {
        let result: RuntimeHealthReport;

        if (providerType === 'LOCAL-LITERT') {
          result = await checkLiteRTHealth(modelId, controller.signal);
        } else if (providerType === 'OLLAMA') {
          result = await checkOllamaHealth(modelId, controller.signal);
        } else {
          result = await checkCloudHealth(cloudProvider, controller.signal);
        }

        clearTimeout(timeoutId);

        // Check if an obsolete asynchronous check finished after a newer one started
        if (checkId !== this.activeCheckId) {
          return this.currentReport!;
        }

        this.currentReport = result;
        this.notify(result);

        // Synchronize with ProcessTelemetryManager
        processTelemetry.setCurrentRuntime(result.runtime);
        if (result.modelId) {
          processTelemetry.setLoadedModel(result.modelId);
        }

        const mappedHealth =
          result.status === 'READY'
            ? 'healthy'
            : result.status === 'UNAVAILABLE' ||
              result.status === 'INITIALIZATION_FAILED' ||
              result.status === 'ERROR'
            ? 'offline'
            : 'degraded';
        processTelemetry.setRuntimeHealth(mappedHealth);

        return result;
      } catch (err: any) {
        clearTimeout(timeoutId);

        if (controller.signal.aborted && checkId !== this.activeCheckId) {
          return this.currentReport!;
        }

        const errorReport: RuntimeHealthReport = {
          providerType,
          providerId,
          runtime,
          modelId,
          modelName: modelId,
          status: 'ERROR',
          message: err instanceof Error ? err.message : 'Health check failed unexpectedly',
          details: {
            failureReason: String(err),
          },
          checkedAt: new Date().toISOString(),
        };

        if (checkId === this.activeCheckId) {
          this.currentReport = errorReport;
          this.notify(errorReport);
          processTelemetry.setRuntimeHealth('offline');
        }

        return errorReport;
      } finally {
        if (this.activeCheckId === checkId) {
          this.inFlightPromise = null;
        }
      }
    })();

    this.inFlightPromise = execPromise;
    return execPromise;
  }
}
