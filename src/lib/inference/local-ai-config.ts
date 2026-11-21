/**
 * YAI Studio V1 — Local AI & Provider Configuration Service
 *
 * Manages user preferences across the application:
 * - Active inference mode: 'local' (Local Only) | 'cloud' (Cloud Only) | 'auto' (Automatic)
 * - Active local model selection
 * - Provider status calculation
 *
 * Persists preferences in localStorage without storing sensitive credentials.
 */

import type { DeviceCapabilityReport, InstalledModelRecord, InferenceMode, LocalProviderStatus } from './types';
import { LOCAL_MODEL_CATALOG } from './local-model-registry';

const MODE_KEY = 'yai_inference_mode_v1';
const ACTIVE_MODEL_KEY = 'yai_active_local_model_v1';
const ACTIVE_OLLAMA_MODEL_KEY = 'yai_active_ollama_model_v1';
const ACTIVE_RUNTIME_KEY = 'yai_active_local_runtime_v1';
const PREFERRED_CLOUD_KEY = 'yai_preferred_cloud_provider_v1';

export type LocalRuntimeSelection = 'litert-lm' | 'ollama';

export interface LocalAIPreferences {
  inferenceMode: InferenceMode;
  activeRuntime: LocalRuntimeSelection;
  activeModelId: string | null;
  preferredCloudProvider: 'openrouter' | 'google-ai';
}

export class LocalAIConfig {
  static getPreferences(): LocalAIPreferences {
    const activeRuntime = this.getRuntime();
    return {
      inferenceMode: this.getInferenceMode(),
      activeRuntime,
      activeModelId: this.getActiveModelId(activeRuntime),
      preferredCloudProvider: this.getPreferredCloudProvider(),
    };
  }

  static getRuntime(): LocalRuntimeSelection {
    if (typeof localStorage === 'undefined') return 'litert-lm';
    const val = localStorage.getItem(ACTIVE_RUNTIME_KEY);
    if (val === 'ollama' || val === 'litert-lm') {
      return val;
    }
    return 'litert-lm';
  }

  static setRuntime(runtime: LocalRuntimeSelection): void {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(ACTIVE_RUNTIME_KEY, runtime);
    this.dispatchChangeEvent();
  }

  static getInferenceMode(): InferenceMode {
    if (typeof localStorage === 'undefined') return 'auto';
    const val = localStorage.getItem(MODE_KEY);
    if (val === 'local' || val === 'cloud' || val === 'auto') {
      return val;
    }
    return 'auto';
  }

  static setInferenceMode(mode: InferenceMode): void {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(MODE_KEY, mode);
    this.dispatchChangeEvent();
  }

  static getActiveModelId(runtime?: LocalRuntimeSelection): string {
    const currentRuntime = runtime || this.getRuntime();
    if (typeof localStorage === 'undefined') {
      return currentRuntime === 'ollama' ? 'llama3.2:latest' : (LOCAL_MODEL_CATALOG[0]?.id || 'gemma-4-e2b-it-web');
    }

    if (currentRuntime === 'ollama') {
      const val = localStorage.getItem(ACTIVE_OLLAMA_MODEL_KEY);
      return val || 'llama3.2:latest';
    }

    const val = localStorage.getItem(ACTIVE_MODEL_KEY);
    if (val && LOCAL_MODEL_CATALOG.some((m) => m.id === val)) {
      return val;
    }
    return LOCAL_MODEL_CATALOG[0]?.id || 'gemma-4-e2b-it-web';
  }

  static setActiveModelId(modelId: string | null, runtime?: LocalRuntimeSelection): void {
    if (typeof localStorage === 'undefined') return;
    const currentRuntime = runtime || this.getRuntime();
    const storageKey = currentRuntime === 'ollama' ? ACTIVE_OLLAMA_MODEL_KEY : ACTIVE_MODEL_KEY;

    if (modelId === null) {
      localStorage.removeItem(storageKey);
    } else {
      localStorage.setItem(storageKey, modelId);
    }
    this.dispatchChangeEvent();
  }

  static getPreferredCloudProvider(): 'openrouter' | 'google-ai' {
    if (typeof localStorage === 'undefined') return 'openrouter';
    const val = localStorage.getItem(PREFERRED_CLOUD_KEY);
    if (val === 'openrouter' || val === 'google-ai') {
      return val;
    }
    return 'openrouter';
  }

  static setPreferredCloudProvider(provider: 'openrouter' | 'google-ai'): void {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(PREFERRED_CLOUD_KEY, provider);
    this.dispatchChangeEvent();
  }

  /**
   * Determine exact provider status based on device capabilities and model state.
   */
  static computeStatus(
    caps: DeviceCapabilityReport | null,
    modelRecords: InstalledModelRecord[] = [],
    activeModelId?: string | null
  ): LocalProviderStatus {
    if (!caps) {
      return 'not_set_up';
    }

    if (!caps.isSupported && caps.unsupportedReasons.length > 0) {
      return 'device_unsupported';
    }

    const hasDownloading = modelRecords.some(
      (r) => r.status === 'downloading' || r.status === 'verifying'
    );
    if (hasDownloading) {
      return 'model_downloading';
    }

    const currentActive = activeModelId || this.getActiveModelId();
    const activeRecord = modelRecords.find((r) => r.modelId === currentActive);
    if (activeRecord && activeRecord.status === 'ready') {
      return 'ready';
    }

    const anyReady = modelRecords.some((r) => r.status === 'ready');
    if (anyReady) {
      return 'ready';
    }

    if (caps.hasWebGPU && caps.hasWasm) {
      return 'model_required';
    }

    return 'device_compatible';
  }

  static getStatusLabel(status: LocalProviderStatus): string {
    switch (status) {
      case 'ready':
        return 'Ready';
      case 'model_downloading':
        return 'Model Downloading';
      case 'model_required':
        return 'Model Required';
      case 'device_compatible':
        return 'Device Compatible';
      case 'device_unsupported':
        return 'Device Unsupported';
      case 'error':
        return 'Error';
      case 'not_set_up':
      default:
        return 'Not Set Up';
    }
  }

  static getActionLabel(status: LocalProviderStatus): string {
    switch (status) {
      case 'ready':
        return 'Manage Local AI';
      case 'model_downloading':
        return 'Continue Setup';
      case 'model_required':
      case 'device_compatible':
        return 'Set Up Local AI';
      case 'device_unsupported':
        return 'Check Device Compatibility';
      case 'not_set_up':
      default:
        return 'Set Up Local AI';
    }
  }

  static subscribe(listener: () => void): () => void {
    if (typeof window === 'undefined') return () => {};
    window.addEventListener('yai_local_config_change', listener);
    return () => {
      window.removeEventListener('yai_local_config_change', listener);
    };
  }

  private static dispatchChangeEvent(): void {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('yai_local_config_change'));
    }
  }
}
