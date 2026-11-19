import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { LocalAIConfig } from '@/lib/inference/local-ai-config';
import { LocalModelManager } from '@/lib/inference/model-manager';
import { InferenceRouter } from '@/lib/inference/inference-router';
import type { DeviceCapabilityReport, InstalledModelRecord } from '@/lib/inference/types';

describe('LiteRT-LM First-Class AI Provider Integration', () => {
  const store: Record<string, string> = {};
  const listeners: Record<string, EventListener[]> = {};

  beforeEach(() => {
    for (const key in store) {
      delete store[key];
    }
    for (const key in listeners) {
      delete listeners[key];
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
        for (const key in store) {
          delete store[key];
        }
      },
    });

    vi.stubGlobal('window', {
      addEventListener: (type: string, listener: EventListener) => {
        if (!listeners[type]) listeners[type] = [];
        listeners[type].push(listener);
      },
      removeEventListener: (type: string, listener: EventListener) => {
        if (!listeners[type]) return;
        listeners[type] = listeners[type].filter((l) => l !== listener);
      },
      dispatchEvent: (event: Event) => {
        const list = listeners[event.type] || [];
        for (const l of list) {
          l(event);
        }
        return true;
      },
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('LocalAIConfig Preferences & Events', () => {
    it('initializes with default preferences', () => {
      const prefs = LocalAIConfig.getPreferences();
      expect(prefs.inferenceMode).toBe('auto');
      expect(prefs.activeModelId).toBe('gemma-2-2b-it-int4');
      expect(prefs.preferredCloudProvider).toBe('openrouter');
    });

    it('persists and retrieves updated inference modes', () => {
      let notified = false;
      const unsubscribe = LocalAIConfig.subscribe(() => {
        notified = true;
      });

      LocalAIConfig.setInferenceMode('local');
      expect(LocalAIConfig.getInferenceMode()).toBe('local');
      expect(notified).toBe(true);

      notified = false;
      LocalAIConfig.setInferenceMode('cloud');
      expect(LocalAIConfig.getInferenceMode()).toBe('cloud');
      expect(notified).toBe(true);

      unsubscribe();
      notified = false;
      LocalAIConfig.setInferenceMode('auto');
      expect(notified).toBe(false);
    });

    it('persists and removes active model IDs', () => {
      LocalAIConfig.setActiveModelId('gemma-2b-it-int4');
      expect(LocalAIConfig.getActiveModelId()).toBe('gemma-2b-it-int4');

      LocalAIConfig.setActiveModelId(null);
      // Fallback to default catalog item
      expect(LocalAIConfig.getActiveModelId()).toBe('gemma-2-2b-it-int4');
    });
  });

  describe('Provider Status Calculation', () => {
    const mockCapsSupported: DeviceCapabilityReport = {
      isSupported: true,
      hasWebGPU: true,
      hasWasm: true,
      hasOpfs: true,
      unsupportedReasons: [],
      storage: {
        quotaBytes: 100 * 1024 * 1024 * 1024,
        usageBytes: 10 * 1024 * 1024 * 1024,
        freeBytes: 90 * 1024 * 1024 * 1024,
        usagePercent: 10,
      },
    };

    const mockCapsUnsupported: DeviceCapabilityReport = {
      isSupported: false,
      hasWebGPU: false,
      hasWasm: true,
      hasOpfs: true,
      unsupportedReasons: ['WebGPU is not supported by your browser or graphics driver.'],
      storage: {
        quotaBytes: 0,
        usageBytes: 0,
        freeBytes: 0,
        usagePercent: 0,
      },
    };

    it('returns not_set_up when capabilities are null', () => {
      expect(LocalAIConfig.computeStatus(null)).toBe('not_set_up');
      expect(LocalAIConfig.getStatusLabel('not_set_up')).toBe('Not Set Up');
      expect(LocalAIConfig.getActionLabel('not_set_up')).toBe('Set Up Local AI');
    });

    it('returns device_unsupported when hardware lacks requirements', () => {
      const status = LocalAIConfig.computeStatus(mockCapsUnsupported);
      expect(status).toBe('device_unsupported');
      expect(LocalAIConfig.getStatusLabel(status)).toBe('Device Unsupported');
      expect(LocalAIConfig.getActionLabel(status)).toBe('Check Device Compatibility');
    });

    it('returns model_required when hardware is compatible but no model installed', () => {
      const status = LocalAIConfig.computeStatus(mockCapsSupported, []);
      expect(status).toBe('model_required');
      expect(LocalAIConfig.getStatusLabel(status)).toBe('Model Required');
      expect(LocalAIConfig.getActionLabel(status)).toBe('Set Up Local AI');
    });

    it('returns model_downloading when any model is in progress', () => {
      const records: InstalledModelRecord[] = [
        {
          modelId: 'gemma-2-2b-it-int4',
          status: 'downloading',
          progressPercent: 45,
          downloadedBytes: 500000,
          totalBytes: 1000000,
        },
      ];
      const status = LocalAIConfig.computeStatus(mockCapsSupported, records);
      expect(status).toBe('model_downloading');
      expect(LocalAIConfig.getStatusLabel(status)).toBe('Model Downloading');
      expect(LocalAIConfig.getActionLabel(status)).toBe('Continue Setup');
    });

    it('returns ready when the active model is installed', () => {
      const records: InstalledModelRecord[] = [
        {
          modelId: 'gemma-2-2b-it-int4',
          status: 'ready',
          progressPercent: 100,
          downloadedBytes: 1000000,
          totalBytes: 1000000,
        },
      ];
      const status = LocalAIConfig.computeStatus(mockCapsSupported, records, 'gemma-2-2b-it-int4');
      expect(status).toBe('ready');
      expect(LocalAIConfig.getStatusLabel(status)).toBe('Ready');
      expect(LocalAIConfig.getActionLabel(status)).toBe('Manage Local AI');
    });
  });

  describe('Download Cancellation', () => {
    it('cancels an in-progress download and cleans up record', async () => {
      const modelId = 'gemma-2-2b-it-int4';

      // Start install and give a brief delay before cancelling
      const installPromise = LocalModelManager.installModel(modelId);
      await new Promise((r) => setTimeout(r, 20));
      await LocalModelManager.cancelDownload(modelId);

      await expect(installPromise).rejects.toThrow();

      const record = LocalModelManager.getRecord(modelId);
      expect(record?.status).toBe('not_downloaded');
    });
  });

  describe('InferenceRouter Execution Modes', () => {
    it('strictly enforces no silent fallback to cloud in local mode', async () => {
      const mockFetch = vi.fn();
      vi.stubGlobal('fetch', mockFetch);

      // In local mode, route must not invoke cloud fetch
      const result = await InferenceRouter.route({
        messages: [{ role: 'user', content: 'Testing local mode' }],
        model: 'gemma-2-2b-it-int4',
        provider: 'local-litert',
        mode: 'local',
      });

      expect(result.mode).toBe('local');
      expect(result.provider).toBe('local-litert');
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('falls back to cloud in auto mode when local model is not downloaded', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          response: 'Auto cloud fallback response',
          model: 'openrouter/auto',
          provider: 'openrouter',
        }),
      });
      vi.stubGlobal('fetch', mockFetch);

      // Model is not ready in records
      LocalAIConfig.setActiveModelId('gemma-2-9b-it-int4');

      const result = await InferenceRouter.route({
        messages: [{ role: 'user', content: 'Testing auto mode fallback' }],
        model: 'gemma-2-9b-it-int4',
        provider: 'local-litert',
        mode: 'auto',
      });

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/yai/generate',
        expect.objectContaining({ method: 'POST' })
      );
      expect(result.content).toBe('Auto cloud fallback response');
    });
  });
});
