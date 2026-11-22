/**
 * YAI Studio — Test Once Resource Telemetry Types
 *
 * Provides standardized contracts for single-query baseline execution,
 * comprehensive component resource accounting, step-level lifecycle tracing,
 * and structured telemetry capture across all AI runtimes (LiteRT-LM, Ollama, Cloud).
 */

export type ComponentResourceStatus =
  | 'USED'
  | 'NOT_USED'
  | 'MEASURED_ZERO'
  | 'UNAVAILABLE'
  | 'NOT_SUPPORTED'
  | 'ERROR';

export type MeasurementAccuracy = 'EXACT' | 'ESTIMATED' | 'SAMPLED' | 'UNAVAILABLE';

export interface ComponentMemoryTelemetry {
  allocatedBytes: number | null;
  residentBytes: number | null;
  peakBytes: number | null;
  incrementalBytes: number | null;
  retainedBytes: number | null;
  releasedBytes: number | null;
  sharedBytes: number | null;
}

export interface ComponentComputeTelemetry {
  cpuUtilizationPercent: number | null;
  cpuTimeMs: number | null;
  gpuUtilizationPercent: number | null;
  gpuTimeMs: number | null;
  gpuMemoryBytes: number | null;
}

export interface ComponentTimingTelemetry {
  startedAt: string | null;
  endedAt: string | null;
  durationMs: number | null;
}

export interface ComponentTokensTelemetry {
  input: number | null;
  output: number | null;
}

export interface ComponentMeasurementMeta {
  source: string | null;
  method: string | null;
  accuracy: MeasurementAccuracy;
}

export interface ComponentResourceTelemetry {
  componentId: string;
  componentName: string;
  category: string;
  status: ComponentResourceStatus;
  memory: ComponentMemoryTelemetry;
  compute: ComponentComputeTelemetry;
  timing: ComponentTimingTelemetry;
  tokens: ComponentTokensTelemetry;
  measurement: ComponentMeasurementMeta;
}

export type StepExecutionStatus = 'COMPLETED' | 'FAILED' | 'SKIPPED' | 'RUNNING';

export interface ExecutionStepTelemetry {
  stepId: string;
  stepName: string;
  stageNumber: number;
  status: StepExecutionStatus;
  startedAt: string;
  endedAt: string | null;
  durationMs: number | null;
  memoryBeforeBytes: number | null;
  memoryDuringBytes: number | null;
  peakMemoryBytes: number | null;
  memoryAfterBytes: number | null;
  cpuUtilizationPercent: number | null;
  cpuTimeMs: number | null;
  gpuUtilizationPercent: number | null;
  gpuMemoryBytes: number | null;
  inputTokens: number | null;
  outputTokens: number | null;
  participatingComponents: string[];
  measurementSource: string | null;
  measurementAccuracy: MeasurementAccuracy;
  error?: string;
}

export interface ModelInfoTelemetry {
  provider: string;
  name: string;
  version: string | null;
  quantization: string | null;
  backend: string;
  contextCapacityTokens?: number | null;
}

export interface ExecutionInfoTelemetry {
  status: 'COMPLETED' | 'FAILED' | 'CANCELLED';
  startedAt: string;
  endedAt: string;
  durationMs: number;
  cancelledAt?: string;
}

export interface QueryResourcesSummary {
  baselineSystemMemoryBytes: number | null;
  baselineApplicationMemoryBytes: number | null;
  baselineModelMemoryBytes: number | null;
  totalCurrentMemoryBytes: number | null;
  peakMemoryDuringBytes: number | null;
  incrementalPeakMemoryBytes: number | null;
  memoryRetainedAfterBytes: number | null;
  memoryReleasedAfterBytes: number | null;
  cpuUtilizationPercent: number | null;
  cpuExecutionTimeMs: number | null;
  gpuUtilizationPercent: number | null;
  gpuExecutionTimeMs: number | null;
  gpuMemoryAllocationBytes: number | null;
  totalNetworkTransferBytes: number | null;
  totalInputTokens: number;
  totalOutputTokens: number;
  tokensPerSecond: number | null;
  totalElapsedTimeMs: number;
  modelLoadingDurationMs: number | null;
  inferenceDurationMs: number | null;
  timeToFirstTokenMs: number | null;
  usedComponentsCount: number;
  notUsedComponentsCount: number;
  measuredZeroComponentsCount: number;
  unavailableMeasurementsCount: number;
  notSupportedMeasurementsCount: number;
  errorMeasurementsCount: number;
}

export interface SystemResourcesSnapshot {
  deviceRamGb: number | null;
  jsHeapUsedMb: number | null;
  jsHeapLimitMb: number | null;
  jsHeapTotalMb: number | null;
  gpuMemoryLimitMb: number | null;
  gpuVendor: string | null;
  gpuArchitecture: string | null;
  storageFreeGb: number | null;
  isWebGPUSupported: boolean;
  isWasmSupported: boolean;
  platform: string;
}

export interface MeasurementCoverageTelemetry {
  totalRegisteredComponents: number;
  participatedComponents: number;
  nonParticipatedComponents: number;
  exactMeasurements: number;
  estimatedMeasurements: number;
  sampledMeasurements: number;
  unavailableMeasurements: number;
  unsupportedMeasurements: number;
  coveragePercentage: number;
}

export interface TelemetryErrorRecord {
  stepId?: string;
  componentId?: string;
  message: string;
  code?: string;
  timestamp: string;
}

export interface TestOnceResult {
  testId: string;
  query: string;
  model: ModelInfoTelemetry;
  execution: ExecutionInfoTelemetry;
  queryResources: QueryResourcesSummary;
  steps: ExecutionStepTelemetry[];
  components: ComponentResourceTelemetry[];
  systemResources: SystemResourcesSnapshot;
  tokens: {
    input: number;
    output: number;
    tokensPerSecond: number | null;
  };
  measurementCoverage: MeasurementCoverageTelemetry;
  response: {
    content: string;
    finishReason?: string;
  };
  errors: TelemetryErrorRecord[];
}

export interface TestOnceRunOptions {
  query: string;
  signal?: AbortSignal;
  onStepProgress?: (step: ExecutionStepTelemetry) => void;
}
