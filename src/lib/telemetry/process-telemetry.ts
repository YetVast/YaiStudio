/**
 * YAI Studio — Unified Process Telemetry Manager
 *
 * Central source of truth for runtime operations, ongoing tasks, and resource monitoring.
 * Used by the top navigation indicator and Runtime Monitor screen.
 */

import type {
  RuntimeProcess,
  RuntimeProcessStatus,
  RuntimeProcessType,
  RuntimeProcessLog,
  RuntimeProcessResourceMetrics,
  TelemetrySummaryMetrics,
} from './types';

export interface StartProcessParams {
  id?: string;
  operationType: RuntimeProcessType;
  operationName: string;
  provider: string;
  runtime: 'litert-lm' | 'ollama' | 'cloud' | 'system';
  model?: string;
  canCancel?: boolean;
  initialStage?: string;
  initialMessage?: string;
}

export class ProcessTelemetryManager {
  private static instance: ProcessTelemetryManager | null = null;
  private processes: Map<string, RuntimeProcess> = new Map();
  private cancelHandlers: Map<string, () => Promise<void> | void> = new Map();
  private retryHandlers: Map<string, () => Promise<void> | void> = new Map();
  private listeners: Set<() => void> = new Set();
  private currentRuntime: 'litert-lm' | 'ollama' | 'cloud' | 'none' = 'none';
  private runtimeHealth: 'healthy' | 'degraded' | 'offline' | 'checking' = 'checking';
  private loadedModel: string | null = null;

  private constructor() {
    // Restore or initialize
  }

  static getInstance(): ProcessTelemetryManager {
    if (!ProcessTelemetryManager.instance) {
      ProcessTelemetryManager.instance = new ProcessTelemetryManager();
    }
    return ProcessTelemetryManager.instance;
  }

  /** Read current JavaScript heap metric if browser exposes performance.memory */
  static sampleJsHeap(): { usedMb?: number; limitMb?: number } {
    if (typeof window !== 'undefined' && (performance as unknown as { memory?: { usedJSHeapSize: number; jsHeapSizeLimit: number } }).memory) {
      const mem = (performance as unknown as { memory: { usedJSHeapSize: number; jsHeapSizeLimit: number } }).memory;
      return {
        usedMb: Math.round((mem.usedJSHeapSize / (1024 * 1024)) * 10) / 10,
        limitMb: Math.round((mem.jsHeapSizeLimit / (1024 * 1024)) * 10) / 10,
      };
    }
    return {};
  }

  startProcess(params: StartProcessParams): RuntimeProcess {
    const id = params.id || `proc_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date().toISOString();
    const stage = params.initialStage || 'Initializing';
    const message = params.initialMessage || `Started ${params.operationName}`;

    const heap = ProcessTelemetryManager.sampleJsHeap();

    const process: RuntimeProcess = {
      id,
      operationType: params.operationType,
      operationName: params.operationName,
      provider: params.provider,
      runtime: params.runtime,
      model: params.model,
      status: 'RUNNING',
      startedAt: now,
      updatedAt: now,
      currentStage: stage,
      canCancel: params.canCancel ?? false,
      resourceMetrics: {
        jsHeapUsedMb: heap.usedMb,
        jsHeapLimitMb: heap.limitMb,
      },
      logs: [
        {
          timestamp: now,
          stage,
          message,
          level: 'info',
        },
      ],
    };

    this.processes.set(id, process);
    this.notify();
    return process;
  }

  updateProcess(id: string, updates: Partial<Omit<RuntimeProcess, 'id' | 'logs'>>): void {
    const existing = this.processes.get(id);
    if (!existing) return;

    const now = new Date().toISOString();
    const updated: RuntimeProcess = {
      ...existing,
      ...updates,
      updatedAt: now,
      resourceMetrics: {
        ...existing.resourceMetrics,
        ...updates.resourceMetrics,
      },
    };

    this.processes.set(id, updated);
    this.notify();
  }

  appendLog(
    id: string,
    stage: string,
    message: string,
    level: 'info' | 'warn' | 'error' | 'success' = 'info'
  ): void {
    const existing = this.processes.get(id);
    if (!existing) return;

    const now = new Date().toISOString();
    const logEntry: RuntimeProcessLog = {
      timestamp: now,
      stage,
      message,
      level,
    };

    const heap = ProcessTelemetryManager.sampleJsHeap();

    existing.logs.push(logEntry);
    existing.currentStage = stage;
    existing.updatedAt = now;
    if (heap.usedMb) {
      existing.resourceMetrics = {
        ...existing.resourceMetrics,
        jsHeapUsedMb: heap.usedMb,
      };
    }

    this.notify();
  }

  updateProgress(id: string, progress: number, stage?: string): void {
    const existing = this.processes.get(id);
    if (!existing) return;

    const now = new Date().toISOString();
    existing.progress = Math.min(100, Math.max(0, Math.round(progress)));
    existing.updatedAt = now;
    if (stage) {
      existing.currentStage = stage;
    }
    this.notify();
  }

  completeProcess(
    id: string,
    metrics?: Partial<RuntimeProcessResourceMetrics>,
    completionMessage?: string
  ): void {
    const existing = this.processes.get(id);
    if (!existing) return;

    const now = new Date().toISOString();
    const durationMs = Math.round(new Date(now).getTime() - new Date(existing.startedAt).getTime());
    const heap = ProcessTelemetryManager.sampleJsHeap();

    existing.status = 'COMPLETED';
    existing.completedAt = now;
    existing.updatedAt = now;
    existing.progress = 100;
    existing.currentStage = 'Completed';
    existing.resourceMetrics = {
      ...existing.resourceMetrics,
      ...metrics,
      durationMs,
      jsHeapUsedMb: heap.usedMb ?? existing.resourceMetrics?.jsHeapUsedMb,
    };

    existing.logs.push({
      timestamp: now,
      stage: 'Completed',
      message: completionMessage || `Successfully completed in ${durationMs}ms`,
      level: 'success',
    });

    this.cancelHandlers.delete(id);
    this.notify();
  }

  failProcess(id: string, error: string): void {
    const existing = this.processes.get(id);
    if (!existing) return;

    const now = new Date().toISOString();
    const durationMs = Math.round(new Date(now).getTime() - new Date(existing.startedAt).getTime());

    existing.status = 'FAILED';
    existing.completedAt = now;
    existing.updatedAt = now;
    existing.currentStage = 'Failed';
    existing.error = error;
    existing.resourceMetrics = {
      ...existing.resourceMetrics,
      durationMs,
    };

    existing.logs.push({
      timestamp: now,
      stage: 'Failed',
      message: error,
      level: 'error',
    });

    this.cancelHandlers.delete(id);
    this.notify();
  }

  async cancelProcess(id: string): Promise<boolean> {
    const existing = this.processes.get(id);
    if (!existing) return false;
    if (existing.status !== 'RUNNING' && existing.status !== 'INITIALIZING' && existing.status !== 'QUEUED') {
      return false;
    }

    const now = new Date().toISOString();
    existing.status = 'CANCELLING';
    existing.updatedAt = now;
    existing.currentStage = 'Cancelling';
    existing.logs.push({
      timestamp: now,
      stage: 'Cancelling',
      message: 'Cancellation requested by user',
      level: 'warn',
    });
    this.notify();

    const handler = this.cancelHandlers.get(id);
    if (handler) {
      try {
        await handler();
      } catch (err) {
        console.warn(`[Telemetry] Cancel handler error for process ${id}:`, err);
      }
      this.cancelHandlers.delete(id);
    }

    const finalTime = new Date().toISOString();
    existing.status = 'CANCELLED';
    existing.completedAt = finalTime;
    existing.updatedAt = finalTime;
    existing.currentStage = 'Cancelled';
    existing.logs.push({
      timestamp: finalTime,
      stage: 'Cancelled',
      message: 'Operation terminated',
      level: 'warn',
    });
    this.notify();
    return true;
  }

  registerCancelHandler(id: string, handler: () => Promise<void> | void): void {
    this.cancelHandlers.set(id, handler);
  }

  registerRetryHandler(id: string, handler: () => Promise<void> | void): void {
    this.retryHandlers.set(id, handler);
  }

  async retryProcess(id: string): Promise<boolean> {
    const handler = this.retryHandlers.get(id);
    if (!handler) return false;

    const existing = this.processes.get(id);
    if (existing) {
      existing.status = 'QUEUED';
      existing.error = undefined;
      existing.currentStage = 'Queued for retry';
      existing.updatedAt = new Date().toISOString();
      existing.logs.push({
        timestamp: new Date().toISOString(),
        stage: 'Retry',
        message: 'Restarting operation via retry handler',
        level: 'info',
      });
      this.notify();
    }

    try {
      await handler();
      return true;
    } catch (err) {
      this.failProcess(id, err instanceof Error ? err.message : String(err));
      return false;
    }
  }

  getProcesses(): RuntimeProcess[] {
    return Array.from(this.processes.values()).sort(
      (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
    );
  }

  getActiveProcesses(): RuntimeProcess[] {
    return this.getProcesses().filter(
      (p) => p.status === 'RUNNING' || p.status === 'INITIALIZING' || p.status === 'QUEUED' || p.status === 'CANCELLING'
    );
  }

  getProcess(id: string): RuntimeProcess | undefined {
    return this.processes.get(id);
  }

  clearCompleted(): void {
    const toDelete: string[] = [];
    for (const [id, p] of this.processes.entries()) {
      if (p.status === 'COMPLETED' || p.status === 'CANCELLED') {
        toDelete.push(id);
      }
    }
    for (const id of toDelete) {
      this.processes.delete(id);
      this.cancelHandlers.delete(id);
      this.retryHandlers.delete(id);
    }
    this.notify();
  }

  setCurrentRuntime(runtime: 'litert-lm' | 'ollama' | 'cloud' | 'none'): void {
    this.currentRuntime = runtime;
    this.notify();
  }

  setRuntimeHealth(health: 'healthy' | 'degraded' | 'offline' | 'checking'): void {
    this.runtimeHealth = health;
    this.notify();
  }

  setLoadedModel(model: string | null): void {
    this.loadedModel = model;
    this.notify();
  }

  getSummaryMetrics(): TelemetrySummaryMetrics {
    const all = this.getProcesses();
    const active = all.filter(
      (p) => p.status === 'RUNNING' || p.status === 'INITIALIZING' || p.status === 'CANCELLING'
    );
    const queued = all.filter((p) => p.status === 'QUEUED');
    const completed = all.filter((p) => p.status === 'COMPLETED');
    const failed = all.filter((p) => p.status === 'FAILED');

    const isLoadingModel = active.some(
      (p) => p.operationType === 'model-load' || p.operationType === 'model-download'
    );
    const isInferencing = active.some((p) => p.operationType === 'inference');

    return {
      currentRuntime: this.currentRuntime,
      activeModel: this.loadedModel,
      activeCount: active.length,
      queuedCount: queued.length,
      completedCount: completed.length,
      failedCount: failed.length,
      isLoadingModel,
      isInferencing,
      runtimeHealth: this.runtimeHealth,
    };
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    for (const listener of this.listeners) {
      try {
        listener();
      } catch (err) {
        console.error('[Telemetry] Listener error:', err);
      }
    }
  }
}

export const processTelemetry = ProcessTelemetryManager.getInstance();
