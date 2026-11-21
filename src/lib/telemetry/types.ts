/**
 * YAI Studio — Unified Process Telemetry Architecture Types
 *
 * Provides a standardized contract for tracking runtime operations,
 * background tasks, model loading, downloads, and inference across
 * LiteRT-LM, Ollama, and Cloud providers.
 */

export type RuntimeProcessStatus =
  | 'QUEUED'
  | 'INITIALIZING'
  | 'RUNNING'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLING'
  | 'CANCELLED';

export type RuntimeProcessType =
  | 'model-download'
  | 'model-load'
  | 'model-unload'
  | 'inference'
  | 'runtime-init'
  | 'health-check'
  | 'document-processing'
  | 'embedding'
  | 'memory-retrieval';

export type DiagnosticLogLevel = 'info' | 'warn' | 'error' | 'success';

export interface RuntimeProcessLog {
  timestamp: string;
  stage: string;
  message: string;
  level: DiagnosticLogLevel;
}

export interface RuntimeProcessResourceMetrics {
  jsHeapUsedMb?: number;
  jsHeapLimitMb?: number;
  modelMemoryMb?: number;
  vramMb?: number;
  tokensPerSec?: number;
  tokensGenerated?: number;
  durationMs?: number;
}

export interface RuntimeProcess {
  id: string;
  operationType: RuntimeProcessType;
  operationName: string;
  provider: string; // 'local-litert' | 'local-ollama' | 'openrouter' | 'google-ai' | 'system'
  runtime: 'litert-lm' | 'ollama' | 'cloud' | 'system';
  model?: string;
  status: RuntimeProcessStatus;
  startedAt: string;
  updatedAt: string;
  completedAt?: string;
  progress?: number; // 0 to 100, undefined if indeterminate
  currentStage: string;
  resourceMetrics?: RuntimeProcessResourceMetrics;
  logs: RuntimeProcessLog[];
  error?: string;
  canCancel?: boolean;
}

export interface TelemetrySummaryMetrics {
  currentRuntime: 'litert-lm' | 'ollama' | 'cloud' | 'none';
  activeModel: string | null;
  activeCount: number;
  queuedCount: number;
  completedCount: number;
  failedCount: number;
  isLoadingModel: boolean;
  isInferencing: boolean;
  runtimeHealth: 'healthy' | 'degraded' | 'offline' | 'checking';
}
