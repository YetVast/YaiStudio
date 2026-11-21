'use client';

import React, { createContext, useContext, useEffect, useState, useMemo, useCallback } from 'react';
import { processTelemetry, ProcessTelemetryManager } from './process-telemetry';
import type { RuntimeProcess, TelemetrySummaryMetrics } from './types';

interface TelemetryContextValue {
  processes: RuntimeProcess[];
  activeProcesses: RuntimeProcess[];
  activeCount: number;
  hasErrors: boolean;
  metrics: TelemetrySummaryMetrics;
  cancelProcess: (id: string) => Promise<boolean>;
  retryProcess: (id: string) => Promise<boolean>;
  clearCompleted: () => void;
  refresh: () => void;
}

const TelemetryContext = createContext<TelemetryContextValue | null>(null);

export function TelemetryProvider({ children }: { children: React.ReactNode }) {
  const [processes, setProcesses] = useState<RuntimeProcess[]>(() => processTelemetry.getProcesses());
  const [metrics, setMetrics] = useState<TelemetrySummaryMetrics>(() => processTelemetry.getSummaryMetrics());

  const refresh = useCallback(() => {
    setProcesses(processTelemetry.getProcesses());
    setMetrics(processTelemetry.getSummaryMetrics());
  }, []);

  useEffect(() => {
    refresh();
    const unsubscribe = processTelemetry.subscribe(refresh);
    return unsubscribe;
  }, [refresh]);

  const activeProcesses = useMemo(() => {
    return processes.filter(
      (p) => p.status === 'RUNNING' || p.status === 'INITIALIZING' || p.status === 'QUEUED' || p.status === 'CANCELLING'
    );
  }, [processes]);

  const hasErrors = useMemo(() => {
    return processes.some((p) => p.status === 'FAILED');
  }, [processes]);

  const cancelProcess = useCallback(async (id: string) => {
    return processTelemetry.cancelProcess(id);
  }, []);

  const retryProcess = useCallback(async (id: string) => {
    return processTelemetry.retryProcess(id);
  }, []);

  const clearCompleted = useCallback(() => {
    processTelemetry.clearCompleted();
  }, []);

  const value = useMemo(
    () => ({
      processes,
      activeProcesses,
      activeCount: activeProcesses.length,
      hasErrors,
      metrics,
      cancelProcess,
      retryProcess,
      clearCompleted,
      refresh,
    }),
    [processes, activeProcesses, hasErrors, metrics, cancelProcess, retryProcess, clearCompleted, refresh]
  );

  return <TelemetryContext.Provider value={value}>{children}</TelemetryContext.Provider>;
}

export function useTelemetry(): TelemetryContextValue {
  const context = useContext(TelemetryContext);
  if (!context) {
    // Provide safe fallback if accessed outside provider
    const procs = processTelemetry.getProcesses();
    const active = processTelemetry.getActiveProcesses();
    return {
      processes: procs,
      activeProcesses: active,
      activeCount: active.length,
      hasErrors: procs.some((p) => p.status === 'FAILED'),
      metrics: processTelemetry.getSummaryMetrics(),
      cancelProcess: (id) => processTelemetry.cancelProcess(id),
      retryProcess: (id) => processTelemetry.retryProcess(id),
      clearCompleted: () => processTelemetry.clearCompleted(),
      refresh: () => {},
    };
  }
  return context;
}
