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

export type ModelCompatibilityStatus = 'supported' | 'unsupported';

export interface LocalModelDescriptor {
  id: string;
  name: string;
  description: string;
  provider: 'local-litert';
  format: 'litertlm' | 'task' | 'bin';
  parameters: string;
  quantization: string;
  downloadSizeBytes: number;
  installedSizeBytes: number;
  downloadUrl: string;
  sha256: string;
  contextLength: number;
  license: string;
  recommendedGpuMemoryGb: number;
  compatibility: ModelCompatibilityStatus;
  unsupportedReason?: string;
  huggingFaceRepo?: string;
  artifactFile?: string;
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
  downloadSpeedBytesPerSec?: number;
  installedAt?: string;
  lastUsedAt?: string;
  error?: string;
  verifiedChecksum?: boolean;
}

export interface DeviceCapabilityReport {
  hasWebGPU: boolean;
  hasWasm: boolean;
  hasOpfs: boolean;
  hasPersistentStorage?: boolean;
  isSecureContext?: boolean;
  gpuAdapterInfo?: {
    vendor?: string;
    architecture?: string;
    description?: string;
    device?: string;
  };
  gpuLimits?: {
    maxBufferSize?: number;
    maxStorageBufferBindingSize?: number;
    maxComputeWorkgroupStorageSize?: number;
  };
  storage: {
    usageBytes: number;
    quotaBytes: number;
    freeBytes: number;
    usagePercent: number;
    modelStorageBytes?: number;
  };
  isSupported: boolean;
  unsupportedReasons: string[];
}

export type RuntimeState =
  | 'UNINITIALIZED'
  | 'CHECKING_COMPATIBILITY'
  | 'INITIALIZING_RUNTIME'
  | 'READY'
  | 'LOADING_MODEL'
  | 'MODEL_READY'
  | 'GENERATING'
  | 'ERROR'
  | 'DISPOSING';

export type DiagnosticLogLevel = 'info' | 'warn' | 'error' | 'success';

export interface DiagnosticLogEntry {
  id: string;
  timestamp: string;
  level: DiagnosticLogLevel;
  event: string;
  modelId?: string;
  durationMs?: number;
  details?: Record<string, unknown>;
  error?: string;
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
  onToken?: (token: string) => void;
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
  generationDurationMs?: number;
  totalDurationMs: number;
  tokensGenerated: number;
  tokensPerSecond: number;
  memoryUsageMb?: number;
  isExactTokenCount?: boolean;
}

export interface NetworkVerificationReport {
  isZeroCloudVerified: boolean;
  modelDownloadRequests: number;
  runtimeAssetRequests: number;
  applicationRequests: number;
  inferenceOutboundRequests: number;
  interceptedEndpoints: string[];
}
