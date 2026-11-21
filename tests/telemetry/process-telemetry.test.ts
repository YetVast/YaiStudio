import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ProcessTelemetryManager } from '@/lib/telemetry/process-telemetry';

describe('Unified Process Telemetry Architecture', () => {
  let manager: ProcessTelemetryManager;

  beforeEach(() => {
    manager = ProcessTelemetryManager.getInstance();
    manager.clearCompleted();
    for (const p of manager.getProcesses()) {
      manager.completeProcess(p.id);
    }
    manager.clearCompleted();
  });

  it('initializes and starts a process with accurate lifecycle and stage', () => {
    const proc = manager.startProcess({
      operationType: 'inference',
      operationName: 'Evaluate Test Prompt',
      provider: 'local-litert',
      runtime: 'litert-lm',
      model: 'gemma-4-e2b-it-web',
      canCancel: true,
      initialStage: 'Tokenizing Prompt',
    });

    expect(proc.id).toBeDefined();
    expect(proc.status).toBe('RUNNING');
    expect(proc.currentStage).toBe('Tokenizing Prompt');
    expect(proc.canCancel).toBe(true);
    expect(proc.logs.length).toBe(1);
    expect(proc.logs[0].stage).toBe('Tokenizing Prompt');

    const active = manager.getActiveProcesses();
    expect(active.some((p) => p.id === proc.id)).toBe(true);
  });

  it('updates progress, stages, and appends logs sequentially', () => {
    const proc = manager.startProcess({
      operationType: 'model-download',
      operationName: 'Download Gemma 4',
      provider: 'local-litert',
      runtime: 'litert-lm',
    });

    manager.updateProgress(proc.id, 45, 'Streaming chunk 4/10');
    let updated = manager.getProcess(proc.id);
    expect(updated?.progress).toBe(45);
    expect(updated?.currentStage).toBe('Streaming chunk 4/10');

    manager.appendLog(proc.id, 'Checksum', 'Computing SHA-256 hash', 'info');
    updated = manager.getProcess(proc.id);
    expect(updated?.logs.length).toBe(2);
    expect(updated?.logs[1].stage).toBe('Checksum');
    expect(updated?.logs[1].message).toBe('Computing SHA-256 hash');
  });

  it('completes a process with duration and telemetry metrics', () => {
    const proc = manager.startProcess({
      operationType: 'inference',
      operationName: 'Inference Run',
      provider: 'local-litert',
      runtime: 'litert-lm',
    });

    manager.completeProcess(
      proc.id,
      {
        tokensGenerated: 120,
        tokensPerSec: 24.5,
      },
      'Generated 120 tokens'
    );

    const completed = manager.getProcess(proc.id);
    expect(completed?.status).toBe('COMPLETED');
    expect(completed?.progress).toBe(100);
    expect(completed?.completedAt).toBeDefined();
    expect(completed?.resourceMetrics?.tokensGenerated).toBe(120);
    expect(completed?.resourceMetrics?.tokensPerSec).toBe(24.5);

    const active = manager.getActiveProcesses();
    expect(active.some((p) => p.id === proc.id)).toBe(false);
  });

  it('handles cancellation and invokes registered cancel handler', async () => {
    let cancelInvoked = false;
    const proc = manager.startProcess({
      operationType: 'model-download',
      operationName: 'Cancellable Download',
      provider: 'local-litert',
      runtime: 'litert-lm',
      canCancel: true,
    });

    manager.registerCancelHandler(proc.id, () => {
      cancelInvoked = true;
    });

    const cancelled = await manager.cancelProcess(proc.id);
    expect(cancelled).toBe(true);
    expect(cancelInvoked).toBe(true);

    const record = manager.getProcess(proc.id);
    expect(record?.status).toBe('CANCELLED');
    expect(record?.currentStage).toBe('Cancelled');
  });

  it('fails a process with error details and records in metrics', () => {
    const proc = manager.startProcess({
      operationType: 'inference',
      operationName: 'Faulty Task',
      provider: 'local-litert',
      runtime: 'litert-lm',
    });

    manager.failProcess(proc.id, 'WebGPU device lost');
    const failed = manager.getProcess(proc.id);
    expect(failed?.status).toBe('FAILED');
    expect(failed?.error).toBe('WebGPU device lost');

    const metrics = manager.getSummaryMetrics();
    expect(metrics.failedCount).toBeGreaterThanOrEqual(1);
  });

  it('clears completed processes while preserving active ones', () => {
    const active = manager.startProcess({
      operationType: 'inference',
      operationName: 'Active Task',
      provider: 'local-litert',
      runtime: 'litert-lm',
    });

    const finished = manager.startProcess({
      operationType: 'inference',
      operationName: 'Finished Task',
      provider: 'local-litert',
      runtime: 'litert-lm',
    });
    manager.completeProcess(finished.id);

    manager.clearCompleted();

    expect(manager.getProcess(active.id)).toBeDefined();
    expect(manager.getProcess(finished.id)).toBeUndefined();
  });
});
