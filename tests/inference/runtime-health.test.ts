import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  RuntimeHealthService,
  resolveCurrentProvider,
  type RuntimeHealthReport,
} from '@/lib/inference/runtime-health';
import { LocalAIConfig } from '@/lib/inference/local-ai-config';
import { LocalModelManager } from '@/lib/inference/model-manager';
import * as deviceCaps from '@/lib/inference/device-capabilities';
import { processTelemetry } from '@/lib/telemetry/process-telemetry';
import type { DeviceCapabilityReport } from '@/lib/inference/types';

function createMockCaps(overrides: Partial<DeviceCapabilityReport> = {}): DeviceCapabilityReport {
  return {
    hasWebGPU: true,
    hasWasm: true,
    hasOpfs: true,
    isSupported: true,
    unsupportedReasons: [],
    storage: {
      usageBytes: 1000000,
      quotaBytes: 100000000000,
      freeBytes: 99999000000,
      usagePercent: 1,
    },
    memoryInfo: {
      deviceMemoryGb: 16,
      deviceMemoryQuantized: true,
      memoryNotes: [],
    },
    assessment: {
      overallClassification: 'High capability',
      cpuCapability: 'High',
      gpuCapability: 'High',
      memorySuitability: 'Sufficient',
      localInferenceSuitability: 'Highly Suitable',
      runtimeCompatibility: {
        litertWebGpu: true,
        litertWasm: true,
        ollamaNative: false,
      },
      assessmentReasons: ['Optimal hardware detected'],
      assessmentLimitations: [],
    },
    ...overrides,
  };
}

describe('RuntimeHealthService — Provider-Aware Health Checks', () => {
  const store: Record<string, string> = {};

  beforeEach(() => {
    for (const k in store) {
      delete store[k];
    }

    vi.stubGlobal('localStorage', {
      getItem: (key: string) => store[key] || null,
      setItem: (key: string, value: string) => {
        store[key] = value;
      },
      removeItem: (key: string) => {
        delete store[key];
      },
      clear: () => {
        for (const k in store) {
          delete store[k];
        }
      },
    });

    processTelemetry.clearCompleted();
    RuntimeHealthService.cancelPendingChecks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('1. Provider Resolution', () => {
    it('resolves LOCAL-LITERT when mode is local/auto and runtime is litert-lm', () => {
      LocalAIConfig.setInferenceMode('local');
      LocalAIConfig.setRuntime('litert-lm');
      LocalAIConfig.setActiveModelId('granite-4.0-350m-web', 'litert-lm');

      const res = resolveCurrentProvider();
      expect(res.providerType).toBe('LOCAL-LITERT');
      expect(res.runtime).toBe('litert-lm');
      expect(res.modelId).toBe('granite-4.0-350m-web');
    });

    it('resolves OLLAMA when runtime is set to ollama', () => {
      LocalAIConfig.setInferenceMode('local');
      LocalAIConfig.setRuntime('ollama');
      LocalAIConfig.setActiveModelId('llama3.2:latest', 'ollama');

      const res = resolveCurrentProvider();
      expect(res.providerType).toBe('OLLAMA');
      expect(res.runtime).toBe('ollama');
      expect(res.modelId).toBe('llama3.2:latest');
    });

    it('resolves CLOUD when inference mode is cloud', () => {
      LocalAIConfig.setInferenceMode('cloud');
      LocalAIConfig.setPreferredCloudProvider('google-ai');

      const res = resolveCurrentProvider();
      expect(res.providerType).toBe('CLOUD');
      expect(res.runtime).toBe('cloud');
      expect(res.modelId).toBe('gemini-1.5-flash');
    });
  });

  describe('2. LOCAL-LITERT Health Checks (Zero Ollama / 11434 Network Calls)', () => {
    it('returns READY when WebGPU is supported and model is installed in OPFS, without touching network', async () => {
      const fetchSpy = vi.fn();
      vi.stubGlobal('fetch', fetchSpy);

      LocalAIConfig.setInferenceMode('local');
      LocalAIConfig.setRuntime('litert-lm');
      LocalAIConfig.setActiveModelId('granite-4.0-350m-web', 'litert-lm');

      // Mock device capabilities: WebGPU ready
      vi.spyOn(deviceCaps, 'detectDeviceCapabilities').mockResolvedValue(
        createMockCaps({
          hasWebGPU: true,
          hasWasm: true,
        })
      );

      // Mock LocalModelManager: Model is ready in OPFS
      vi.spyOn(LocalModelManager, 'getRecord').mockReturnValue({
        modelId: 'granite-4.0-350m-web',
        status: 'ready',
        progressPercent: 100,
        downloadedBytes: 468209584,
        totalBytes: 468209584,
        installedAt: new Date().toISOString(),
      });

      const report = await RuntimeHealthService.checkCurrentRuntimeHealth(true);

      expect(report.providerType).toBe('LOCAL-LITERT');
      expect(report.status).toBe('READY');
      expect(report.modelName).toBe('IBM Granite 4.0 350M (LiteRT-LM)');
      expect(report.details?.hasWebGPU).toBe(true);
      expect(report.details?.isModelInstalled).toBe(true);
      expect(report.details?.isModelLoaded).toBe(true);
      expect(report.details?.modelStorageBytes).toBe(468209584);

      // STRICT ISOLATION ASSERTION: No fetch requests attempted to port 11434 or localhost
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('returns MODEL_NOT_LOADED terminal state when model is not downloaded, without touching network', async () => {
      const fetchSpy = vi.fn();
      vi.stubGlobal('fetch', fetchSpy);

      LocalAIConfig.setInferenceMode('local');
      LocalAIConfig.setRuntime('litert-lm');
      LocalAIConfig.setActiveModelId('granite-4.0-350m-web', 'litert-lm');

      vi.spyOn(deviceCaps, 'detectDeviceCapabilities').mockResolvedValue(
        createMockCaps({
          hasWebGPU: true,
          hasWasm: true,
        })
      );

      // Model record is not_downloaded
      vi.spyOn(LocalModelManager, 'getRecord').mockReturnValue({
        modelId: 'granite-4.0-350m-web',
        status: 'not_downloaded',
        progressPercent: 0,
        downloadedBytes: 0,
        totalBytes: 468209584,
      });

      const report = await RuntimeHealthService.checkCurrentRuntimeHealth(true);

      expect(report.providerType).toBe('LOCAL-LITERT');
      expect(report.status).toBe('MODEL_NOT_LOADED');
      expect(report.message).toContain('not installed in OPFS');
      expect(report.details?.isModelInstalled).toBe(false);

      // Verify no network calls
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('returns UNAVAILABLE when device lacks both WebGPU and WASM capabilities', async () => {
      const fetchSpy = vi.fn();
      vi.stubGlobal('fetch', fetchSpy);

      LocalAIConfig.setInferenceMode('local');
      LocalAIConfig.setRuntime('litert-lm');
      LocalAIConfig.setActiveModelId('granite-4.0-350m-web', 'litert-lm');

      vi.spyOn(deviceCaps, 'detectDeviceCapabilities').mockResolvedValue(
        createMockCaps({
          hasWebGPU: false,
          hasWasm: false,
          isSupported: false,
          unsupportedReasons: ['WebGPU not supported in this browser', 'WASM SIMD not available'],
        })
      );

      const report = await RuntimeHealthService.checkCurrentRuntimeHealth(true);

      expect(report.providerType).toBe('LOCAL-LITERT');
      expect(report.status).toBe('UNAVAILABLE');
      expect(report.message).toContain('WebGPU');
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('returns MODEL_NOT_FOUND when model descriptor is not in catalog', async () => {
      const fetchSpy = vi.fn();
      vi.stubGlobal('fetch', fetchSpy);

      LocalAIConfig.setInferenceMode('local');
      LocalAIConfig.setRuntime('litert-lm');
      vi.spyOn(LocalAIConfig, 'getActiveModelId').mockReturnValue('unknown-experimental-model-99');

      vi.spyOn(deviceCaps, 'detectDeviceCapabilities').mockResolvedValue(createMockCaps());

      const report = await RuntimeHealthService.checkCurrentRuntimeHealth(true);

      expect(report.providerType).toBe('LOCAL-LITERT');
      expect(report.status).toBe('MODEL_NOT_FOUND');
      expect(report.message).toContain('not in the approved local catalog');
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('returns MODEL_NOT_FOUND when no active local model is configured', async () => {
      const fetchSpy = vi.fn();
      vi.stubGlobal('fetch', fetchSpy);

      LocalAIConfig.setInferenceMode('local');
      LocalAIConfig.setRuntime('litert-lm');
      vi.spyOn(LocalAIConfig, 'getActiveModelId').mockReturnValue(null as any);

      vi.spyOn(deviceCaps, 'detectDeviceCapabilities').mockResolvedValue(createMockCaps());

      const report = await RuntimeHealthService.checkCurrentRuntimeHealth(true);

      expect(report.providerType).toBe('LOCAL-LITERT');
      expect(report.status).toBe('MODEL_NOT_FOUND');
      expect(report.message).toContain('No active local model selected');
      expect(fetchSpy).not.toHaveBeenCalled();
    });
  });

  describe('3. OLLAMA Health Checks (Only when OLLAMA is actively selected)', () => {
    it('returns READY when Ollama daemon is reachable and model is available', async () => {
      LocalAIConfig.setInferenceMode('local');
      LocalAIConfig.setRuntime('ollama');
      LocalAIConfig.setActiveModelId('llama3.2:latest', 'ollama');

      const mockFetch = vi.fn().mockImplementation((url: string) => {
        if (url.includes('/api/version')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ version: '0.5.4' }),
          });
        }
        if (url.includes('/api/tags')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              models: [{ name: 'llama3.2:latest', size: 2000000000 }],
            }),
          });
        }
        if (url.includes('/api/ps')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              models: [{ name: 'llama3.2:latest', size_vram: 2000000000 }],
            }),
          });
        }
        return Promise.reject(new Error('Unknown URL'));
      });
      vi.stubGlobal('fetch', mockFetch);

      const report = await RuntimeHealthService.checkCurrentRuntimeHealth(true);

      expect(report.providerType).toBe('OLLAMA');
      expect(report.status).toBe('READY');
      expect(report.details?.ollamaVersion).toBe('0.5.4');
      expect(report.details?.isModelInstalled).toBe(true);
      expect(report.details?.isModelLoaded).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining('/api/version'), expect.anything());
    });

    it('returns UNAVAILABLE with troubleshooting guidance when daemon is stopped (ECONNREFUSED)', async () => {
      LocalAIConfig.setInferenceMode('local');
      LocalAIConfig.setRuntime('ollama');
      LocalAIConfig.setActiveModelId('llama3.2:latest', 'ollama');

      const mockFetch = vi.fn().mockRejectedValue(new TypeError('Failed to fetch (ERR_CONNECTION_REFUSED)'));
      vi.stubGlobal('fetch', mockFetch);

      const report = await RuntimeHealthService.checkCurrentRuntimeHealth(true);

      expect(report.providerType).toBe('OLLAMA');
      expect(report.status).toBe('UNAVAILABLE');
      expect(report.message).toContain('ollama serve');
      expect(report.details?.failureReason).toBe('Connection refused or daemon stopped');
    });

    it('returns MODEL_NOT_FOUND with pull guidance when model is missing from tags', async () => {
      LocalAIConfig.setInferenceMode('local');
      LocalAIConfig.setRuntime('ollama');
      LocalAIConfig.setActiveModelId('missing-model:7b', 'ollama');

      const mockFetch = vi.fn().mockImplementation((url: string) => {
        if (url.includes('/api/version')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ version: '0.5.4' }),
          });
        }
        if (url.includes('/api/tags')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              models: [{ name: 'other-model:latest' }],
            }),
          });
        }
        if (url.includes('/api/ps')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ models: [] }),
          });
        }
        return Promise.reject(new Error('Unknown URL'));
      });
      vi.stubGlobal('fetch', mockFetch);

      const report = await RuntimeHealthService.checkCurrentRuntimeHealth(true);

      expect(report.providerType).toBe('OLLAMA');
      expect(report.status).toBe('MODEL_NOT_FOUND');
      expect(report.message).toContain('ollama pull missing-model:7b');
    });
  });

  describe('4. CLOUD Health Checks', () => {
    it('returns READY when API key is configured for active cloud provider', async () => {
      LocalAIConfig.setInferenceMode('cloud');
      LocalAIConfig.setPreferredCloudProvider('openrouter');

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          providers: [{ id: 'openrouter', name: 'OpenRouter', configured: true }],
        }),
      });
      vi.stubGlobal('fetch', mockFetch);

      const report = await RuntimeHealthService.checkCurrentRuntimeHealth(true);

      expect(report.providerType).toBe('CLOUD');
      expect(report.status).toBe('READY');
      expect(report.details?.cloudConfigured).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith('/api/providers', expect.anything());
    });

    it('returns UNAVAILABLE when API key is not configured', async () => {
      LocalAIConfig.setInferenceMode('cloud');
      LocalAIConfig.setPreferredCloudProvider('google-ai');

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          providers: [{ id: 'google-ai', name: 'Google AI Studio', configured: false }],
        }),
      });
      vi.stubGlobal('fetch', mockFetch);

      const report = await RuntimeHealthService.checkCurrentRuntimeHealth(true);

      expect(report.providerType).toBe('CLOUD');
      expect(report.status).toBe('UNAVAILABLE');
      expect(report.message).toContain('API key for google-ai is not configured');
    });
  });

  describe('5. Provider Switching & Subscriptions', () => {
    it('notifies subscribers when health status updates', async () => {
      LocalAIConfig.setInferenceMode('local');
      LocalAIConfig.setRuntime('litert-lm');
      LocalAIConfig.setActiveModelId('granite-4.0-350m-web', 'litert-lm');

      vi.spyOn(deviceCaps, 'detectDeviceCapabilities').mockResolvedValue(createMockCaps());

      vi.spyOn(LocalModelManager, 'getRecord').mockReturnValue({
        modelId: 'granite-4.0-350m-web',
        status: 'ready',
        progressPercent: 100,
        downloadedBytes: 468209584,
        totalBytes: 468209584,
      });

      const reports: RuntimeHealthReport[] = [];
      const unsub = RuntimeHealthService.subscribe((r) => reports.push(r));

      await RuntimeHealthService.checkCurrentRuntimeHealth(true);

      unsub();
      expect(reports.length).toBeGreaterThan(0);
      expect(reports[reports.length - 1].status).toBe('READY');
      expect(reports[reports.length - 1].providerType).toBe('LOCAL-LITERT');
    });
  });
});
