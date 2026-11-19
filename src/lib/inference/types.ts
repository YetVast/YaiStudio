/**
 * YAI Studio V1 — Unified Inference & Provider Types
 *
 * Supports local on-device inference (LiteRT-LM) and server-side BYOK cloud providers.
 */

export type InferenceProviderType = 'local-litert' | 'openrouter' | 'google-ai';

export type InferenceMode = 'local' | 'cloud' | 'auto';

export type LocalProviderStatus =
  | 'not_set_up'
  | 'device_compatible'
  | 'model_required'
  | 'model_downloading'
  | 'ready'
  | 'device_unsupported'
  | 'error';

export type InferenceEnvironment = 'browser-device' | 'server-vaulted';

export interface InferenceCapabilities {
  streaming: boolean;
  cancellation: boolean;
  tokenEstimation: boolean;
  multimodal: boolean;
  localOnDevice: boolean;
}

export interface InferenceDeviceRequirements {
  requiresWebGPU: boolean;
  minRamGb: number;
  minStorageMb: number;
}

export interface LocalModelDescriptor {
  id: string;
  name: string;
  description: string;
  provider: 'local-litert';
  format: 'litertlm' | 'task' | 'bin';
  parameters: string; // e.g. "2B"
  quantization: string; // e.g. "INT4"
  downloadSizeBytes: number;
  installedSizeBytes: number;
  downloadUrl: string;
  sha256: string;
  contextLength: number;
  license: string;
  recommendedGpuMemoryGb: number;
}

export type ModelInstallationStatus =
  | 'not_downloaded'
  | 'downloading'
  | 'verifying'
  | 'ready'
  | 'error';

export interface InstalledModelRecord {
  modelId: string;
  status: ModelInstallationStatus;
  progressPercent: number;
  downloadedBytes: number;
  totalBytes: number;
  installedAt?: string;
  lastUsedAt?: string;
  error?: string;
}

export interface DeviceCapabilityReport {
  hasWebGPU: boolean;
  hasWasm: boolean;
  hasOpfs: boolean;
  gpuAdapterInfo?: {
    vendor?: string;
    architecture?: string;
    description?: string;
  };
  storage: {
    usageBytes: number;
    quotaBytes: number;
    freeBytes: number;
    usagePercent: number;
  };
  isSupported: boolean;
  unsupportedReasons: string[];
}

export interface UnifiedInferenceMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface UnifiedInferenceRequest {
  messages: UnifiedInferenceMessage[];
  model: string;
  provider: InferenceProviderType;
  mode: InferenceMode;
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
  signal?: AbortSignal;
}

export interface UnifiedInferenceResult {
  content: string;
  model: string;
  provider: InferenceProviderType;
  mode: InferenceMode;
  executionEnvironment: InferenceEnvironment;
  executionTimeMs: number;
  inputTokens?: number;
  outputTokens?: number;
  tokensPerSecond?: number;
  finishReason?: 'stop' | 'length' | 'cancelled' | 'error';
}

export interface LocalInferenceMeasurement {
  initDurationMs: number;
  modelLoadDurationMs: number;
  timeToFirstTokenMs: number;
  totalDurationMs: number;
  tokensGenerated: number;
  tokensPerSecond: number;
  memoryUsageMb?: number;
}
