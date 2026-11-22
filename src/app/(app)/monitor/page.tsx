'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Activity,
  Cpu,
  HardDrive,
  RefreshCw,
  Trash2,
  XCircle,
  Play,
  CheckCircle2,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Clock,
  Layers,
  Zap,
  Shield,
  ArrowLeft,
  Square,
  Sparkles,
  FileText,
  Copy,
  Check,
  Code,
  X,
} from 'lucide-react';
import Button from '@/components/ui/Button';
import { useTelemetry } from '@/lib/telemetry/telemetry-context';
import { detectDeviceCapabilities } from '@/lib/inference/device-capabilities';
import { OllamaClient } from '@/lib/inference/runtimes/ollama-client';
import { LocalAIConfig } from '@/lib/inference/local-ai-config';
import {
  TestOnceRunner,
  DEFAULT_TEST_QUERY,
  TestHistoryStorage,
  type TestOnceResult,
  type ModelInfoTelemetry,
} from '@/lib/telemetry/test-runner';
import type { DeviceCapabilityReport } from '@/lib/inference/types';
import type { RuntimeProcess } from '@/lib/telemetry/types';
import styles from './Monitor.module.css';

export default function RuntimeMonitorPage() {
  const {
    processes,
    activeProcesses,
    activeCount,
    hasErrors,
    metrics,
    cancelProcess,
    retryProcess,
    clearCompleted,
    refresh: refreshTelemetry,
  } = useTelemetry();

  const [caps, setCaps] = useState<DeviceCapabilityReport | null>(null);
  const [expandedProcessId, setExpandedProcessId] = useState<string | null>(null);
  const [runningOllamaModels, setRunningOllamaModels] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  // Test Once State
  const [showTestDropdown, setShowTestDropdown] = useState(false);
  const [showTestModal, setShowTestModal] = useState(false);
  const [testQuery, setTestQuery] = useState(DEFAULT_TEST_QUERY);
  const [selectedModelInfo, setSelectedModelInfo] = useState<ModelInfoTelemetry | null>(null);
  const [isTestRunning, setIsTestRunning] = useState(false);
  const [currentTestResult, setCurrentTestResult] = useState<TestOnceResult | null>(null);
  const [testHistory, setTestHistory] = useState<TestOnceResult[]>([]);
  const [selectedHistoryId, setSelectedHistoryId] = useState<string | null>(null);
  const [jsonCopied, setJsonCopied] = useState(false);
  const [responseExpanded, setResponseExpanded] = useState(true);
  const [telemetryRawExpanded, setTelemetryRawExpanded] = useState(true);
  const [testErrorMessage, setTestErrorMessage] = useState<string | null>(null);

  const activeModelId = LocalAIConfig.getActiveModelId();

  const loadData = useCallback(async () => {
    setRefreshing(true);
    try {
      const [detectedCaps, runningModels, modelInfo, history] = await Promise.all([
        detectDeviceCapabilities().catch(() => null),
        OllamaClient.listRunningModels().catch(() => []),
        TestOnceRunner.getCurrentlySelectedModelInfo().catch(() => null),
        TestHistoryStorage.getTestResults().catch(() => []),
      ]);
      setCaps(detectedCaps);
      setRunningOllamaModels(runningModels);
      setSelectedModelInfo(modelInfo);
      setTestHistory(history);
      if (history.length > 0 && !currentTestResult) {
        setCurrentTestResult(history[0]);
      }
      refreshTelemetry();
    } finally {
      setRefreshing(false);
    }
  }, [currentTestResult, refreshTelemetry]);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 5000);
    return () => clearInterval(interval);
  }, [loadData]);

  // Click outside to close dropdown
  useEffect(() => {
    if (!showTestDropdown) return;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest(`.${styles.dropdownContainer}`)) {
        setShowTestDropdown(false);
      }
    };
    window.addEventListener('click', handleClickOutside);
    return () => window.removeEventListener('click', handleClickOutside);
  }, [showTestDropdown]);

  const toggleExpand = (id: string) => {
    setExpandedProcessId((prev) => (prev === id ? null : id));
  };

  const handleUnloadModel = async () => {
    if (metrics.currentRuntime === 'ollama' && metrics.activeModel) {
      await OllamaClient.unloadModel(metrics.activeModel);
      loadData();
    }
  };

  // ── Test Once Execution Handlers ───────────────────────────────
  const handleOpenTestDialog = async (openWithDefaultQuery = false) => {
    setShowTestDropdown(false);
    if (openWithDefaultQuery && !testQuery) {
      setTestQuery(DEFAULT_TEST_QUERY);
    }
    const modelInfo = await TestOnceRunner.getCurrentlySelectedModelInfo().catch(() => null);
    setSelectedModelInfo(modelInfo);
    setShowTestModal(true);
  };

  const handleRunTest = async () => {
    if (isTestRunning || !testQuery.trim()) return;
    setIsTestRunning(true);
    setTestErrorMessage(null);

    try {
      const result = await TestOnceRunner.runTestOnce({
        query: testQuery,
      });
      setCurrentTestResult(result);
      setSelectedHistoryId(result.testId);
      const updatedHistory = await TestHistoryStorage.getTestResults();
      setTestHistory(updatedHistory);
      refreshTelemetry();
    } catch (err: any) {
      setTestErrorMessage(err instanceof Error ? err.message : String(err));
      const updatedHistory = await TestHistoryStorage.getTestResults();
      setTestHistory(updatedHistory);
      if (updatedHistory.length > 0) {
        setCurrentTestResult(updatedHistory[0]);
      }
    } finally {
      setIsTestRunning(false);
    }
  };

  const handleCancelTest = () => {
    TestOnceRunner.cancelActiveTest();
  };

  const handleResetQuery = () => {
    setTestQuery(DEFAULT_TEST_QUERY);
  };

  const handleCopyJson = async () => {
    if (!activeDisplayResult) return;
    try {
      await navigator.clipboard.writeText(JSON.stringify(activeDisplayResult, null, 2));
      setJsonCopied(true);
      setTimeout(() => setJsonCopied(false), 2000);
    } catch (err) {
      console.warn('Failed to copy JSON:', err);
    }
  };

  const handleClearHistory = async () => {
    if (confirm('Clear all recorded Test Once telemetry history?')) {
      await TestHistoryStorage.clearTestHistory();
      setTestHistory([]);
      setCurrentTestResult(null);
      setSelectedHistoryId(null);
    }
  };

  const handleSelectHistory = (id: string) => {
    setSelectedHistoryId(id);
    const found = testHistory.find((t) => t.testId === id);
    if (found) {
      setCurrentTestResult(found);
    }
  };

  const activeDisplayResult = selectedHistoryId
    ? testHistory.find((t) => t.testId === selectedHistoryId) || currentTestResult
    : currentTestResult;

  // Memory Calculations
  const jsHeapUsed = caps?.memoryInfo?.jsHeapUsedMb;
  const jsHeapLimit = caps?.memoryInfo?.jsHeapLimitMb;
  const heapUsagePercent = jsHeapUsed && jsHeapLimit ? Math.round((jsHeapUsed / jsHeapLimit) * 100) : undefined;
  const deviceRamGb = caps?.memoryInfo?.deviceMemoryGb;

  return (
    <div className={styles.container}>
      {/* ── Top Header ────────────────────────────────────────── */}
      <div className={styles.header}>
        <div>
          <div className={styles.titleRow}>
            <Activity size={24} style={{ color: 'var(--color-primary)' }} />
            <h1 className={styles.title}>AI Runtime Monitor</h1>
          </div>
          <p className={styles.subtitle}>
            Real-time telemetry and resource oversight for local neural operations, background inference,
            and memory footprint across LiteRT-LM and Ollama runtimes.
          </p>
        </div>

        <div className={styles.actions}>
          {/* Test Once Dropdown Action */}
          <div className={styles.dropdownContainer}>
            <Button
              variant="primary"
              size="sm"
              onClick={() => setShowTestDropdown((prev) => !prev)}
              disabled={isTestRunning}
            >
              <Play size={14} />
              <span>Test Once</span>
              <ChevronDown size={13} />
            </Button>
            {showTestDropdown && (
              <div className={styles.dropdownMenu}>
                <button
                  type="button"
                  className={styles.dropdownItem}
                  onClick={() => handleOpenTestDialog(false)}
                >
                  <Play size={14} style={{ color: 'var(--color-primary)', marginTop: 2, flexShrink: 0 }} />
                  <div>
                    <strong>Test Once</strong>
                    <span>Execute baseline inference test on selected model</span>
                  </div>
                </button>
                <button
                  type="button"
                  className={styles.dropdownItem}
                  onClick={() => handleOpenTestDialog(true)}
                >
                  <FileText size={14} style={{ color: 'var(--color-primary)', marginTop: 2, flexShrink: 0 }} />
                  <div>
                    <strong>Default Test Query</strong>
                    <span>Inspect and edit the diagnostic test query</span>
                  </div>
                </button>
              </div>
            )}
          </div>

          <Button variant="outline" size="sm" onClick={loadData} disabled={refreshing}>
            <RefreshCw size={14} className={refreshing ? 'spin' : ''} />
            <span>Refresh</span>
          </Button>
          <Button variant="outline" size="sm" onClick={clearCompleted} disabled={processes.length === 0}>
            <Trash2 size={14} />
            <span>Clear Completed</span>
          </Button>
          <Button href="/settings/yai-local" variant="outline" size="sm">
            <Cpu size={14} />
            <span>Device Intelligence & Setup</span>
          </Button>
        </div>
      </div>

      {/* ── Overview Summary Tiles ─────────────────────────────── */}
      <div className={styles.overviewGrid}>
        <div className={styles.metricCard}>
          <div className={styles.metricHeader}>
            <span className={styles.metricLabel}>Active Runtime</span>
            <Cpu size={16} style={{ color: 'var(--color-muted-foreground)' }} />
          </div>
          <div className={styles.metricValue}>
            {metrics.currentRuntime === 'litert-lm'
              ? 'LiteRT-LM (WebGPU)'
              : metrics.currentRuntime === 'ollama'
              ? 'Ollama Local Daemon'
              : metrics.currentRuntime === 'cloud'
              ? 'Cloud BYOK'
              : 'Standby / Ready'}
          </div>
          <div className={styles.metricSubtext}>
            Health:{' '}
            <strong
              style={{
                color:
                  metrics.runtimeHealth === 'healthy'
                    ? 'var(--color-success)'
                    : metrics.runtimeHealth === 'offline'
                    ? 'var(--color-destructive)'
                    : 'var(--color-warning)',
              }}
            >
              {metrics.runtimeHealth.toUpperCase()}
            </strong>
          </div>
        </div>

        <div className={styles.metricCard}>
          <div className={styles.metricHeader}>
            <span className={styles.metricLabel}>Configured Model</span>
            <Layers size={16} style={{ color: 'var(--color-muted-foreground)' }} />
          </div>
          <div className={styles.metricValue} style={{ fontSize: '1rem', wordBreak: 'break-all' }}>
            {activeModelId || 'No active model'}
          </div>
          <div className={styles.metricSubtext}>
            {metrics.isLoadingModel ? 'Loading model weights into memory...' : 'Ready for prompt evaluation'}
          </div>
        </div>

        <div className={styles.metricCard}>
          <div className={styles.metricHeader}>
            <span className={styles.metricLabel}>Active Operations</span>
            <Activity size={16} style={{ color: 'var(--color-primary)' }} />
          </div>
          <div className={styles.metricValue}>
            {activeCount}
            {activeCount > 0 && <span style={{ fontSize: '0.875rem', fontWeight: 500 }}>in flight</span>}
          </div>
          <div className={styles.metricSubtext}>
            {metrics.isInferencing ? 'Generating tokens on hardware' : 'Zero tasks currently executing'}
          </div>
        </div>

        <div className={styles.metricCard}>
          <div className={styles.metricHeader}>
            <span className={styles.metricLabel}>Session Completed</span>
            <CheckCircle2 size={16} style={{ color: 'var(--color-success)' }} />
          </div>
          <div className={styles.metricValue}>
            {metrics.completedCount}
            {metrics.failedCount > 0 && (
              <span style={{ fontSize: '0.8125rem', color: 'var(--color-destructive)', fontWeight: 500 }}>
                ({metrics.failedCount} failed)
              </span>
            )}
          </div>
          <div className={styles.metricSubtext}>
            {metrics.queuedCount > 0 ? `${metrics.queuedCount} operation(s) queued` : 'Queue empty'}
          </div>
        </div>
      </div>

      {/* ── Section: Memory Monitoring ─────────────────────────── */}
      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <div className={styles.sectionTitleGroup}>
            <HardDrive size={18} style={{ color: 'var(--color-primary)' }} />
            <h2 className={styles.sectionTitle}>Memory & Resource Telemetry</h2>
          </div>
        </div>

        <div className={styles.memoryGrid}>
          {/* Device Memory */}
          <div className={styles.memoryBox}>
            <div className={styles.memoryBoxHeader}>
              <span className={styles.memoryBoxTitle}>Device Memory</span>
              <span className={`${styles.dataPill} ${styles.dataPillEstimated}`}>Estimated</span>
            </div>
            <div className={styles.memoryRow}>
              <span className={styles.memoryRowLabel}>Approximate Total RAM:</span>
              <span className={styles.memoryRowValue}>
                {deviceRamGb ? `${deviceRamGb} GiB` : 'Restricted by browser'}
              </span>
            </div>
            <div className={styles.memoryRow}>
              <span className={styles.memoryRowLabel}>Memory Suitability:</span>
              <span className={styles.memoryRowValue}>
                {caps?.assessment?.memorySuitability || 'Evaluating...'}
              </span>
            </div>
            <div className={styles.memoryRow}>
              <span className={styles.memoryRowLabel}>Platform Privacy:</span>
              <span className={styles.memoryRowValue}>Clamped to protect identity</span>
            </div>
          </div>

          {/* Application Memory (JS Heap) */}
          <div className={styles.memoryBox}>
            <div className={styles.memoryBoxHeader}>
              <span className={styles.memoryBoxTitle}>Application Memory (JS Heap)</span>
              <span className={`${styles.dataPill} ${styles.dataPillMeasured}`}>Measured</span>
            </div>
            <div className={styles.memoryRow}>
              <span className={styles.memoryRowLabel}>JavaScript Heap Used:</span>
              <span className={styles.memoryRowValue}>
                {jsHeapUsed !== undefined ? `${jsHeapUsed} MB` : 'Unavailable in this browser'}
              </span>
            </div>
            <div className={styles.memoryRow}>
              <span className={styles.memoryRowLabel}>JavaScript Heap Limit:</span>
              <span className={styles.memoryRowValue}>
                {jsHeapLimit !== undefined ? `${jsHeapLimit} MB` : 'Unavailable'}
              </span>
            </div>
            <div className={styles.memoryRow}>
              <span className={styles.memoryRowLabel}>Heap Utilization:</span>
              <span className={styles.memoryRowValue}>
                {heapUsagePercent !== undefined ? `${heapUsagePercent}%` : 'Unavailable'}
              </span>
            </div>
          </div>

          {/* Model & Runtime Memory */}
          <div className={styles.memoryBox}>
            <div className={styles.memoryBoxHeader}>
              <span className={styles.memoryBoxTitle}>Model & Runtime VRAM</span>
              <span className={`${styles.dataPill} ${runningOllamaModels.length > 0 ? styles.dataPillMeasured : styles.dataPillEstimated}`}>
                {runningOllamaModels.length > 0 ? 'Measured' : 'Estimated'}
              </span>
            </div>
            <div className={styles.memoryRow}>
              <span className={styles.memoryRowLabel}>Active Model:</span>
              <span className={styles.memoryRowValue}>{metrics.activeModel || 'None in VRAM'}</span>
            </div>
            <div className={styles.memoryRow}>
              <span className={styles.memoryRowLabel}>Ollama VRAM Consumed:</span>
              <span className={styles.memoryRowValue}>
                {runningOllamaModels.length > 0 && runningOllamaModels[0].size_vram
                  ? `${(runningOllamaModels[0].size_vram / (1024 * 1024)).toFixed(0)} MB`
                  : '0 MB / Standby'}
              </span>
            </div>
            <div className={styles.memoryRow}>
              <span className={styles.memoryRowLabel}>Storage Free for Models:</span>
              <span className={styles.memoryRowValue}>
                {caps ? `${(caps.storage.freeBytes / (1024 * 1024 * 1024)).toFixed(2)} GB` : 'Calculating...'}
              </span>
            </div>
          </div>
        </div>

        <div className={styles.privacyCallout}>
          <Shield size={16} style={{ flexShrink: 0, marginTop: 2, color: 'var(--color-primary)' }} />
          <div>
            <strong>Strict Telemetry Invariant:</strong>
            Browser JavaScript cannot inspect complete host operating system memory. We clearly distinguish
            quantized device RAM from real-time JavaScript heap allocation and measured VRAM. JavaScript heap metrics
            are never presented as total device system RAM.
          </div>
        </div>
      </section>

      {/* ── Section: Latest Test Once Baseline (if available) ──── */}
      {activeDisplayResult && (
        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <div className={styles.sectionTitleGroup}>
              <Play size={18} style={{ color: 'var(--color-primary)' }} />
              <h2 className={styles.sectionTitle}>
                Latest Baseline Telemetry — {activeDisplayResult.model.name}
              </h2>
            </div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <span
                className={`${styles.opStatusPill} ${
                  activeDisplayResult.execution.status === 'COMPLETED'
                    ? styles.statusCompleted
                    : activeDisplayResult.execution.status === 'FAILED'
                    ? styles.statusFailed
                    : styles.statusCancelled
                }`}
              >
                {activeDisplayResult.execution.status}
              </span>
              <Button variant="outline" size="sm" onClick={() => setShowTestModal(true)}>
                <span>View Full Telemetry & Diagnostics</span>
              </Button>
            </div>
          </div>

          <div className={styles.summaryGrid}>
            <div className={styles.summaryTile}>
              <span className={styles.summaryTileLabel}>Execution Duration</span>
              <span className={styles.summaryTileValue}>{activeDisplayResult.execution.durationMs} ms</span>
            </div>
            <div className={styles.summaryTile}>
              <span className={styles.summaryTileLabel}>Peak Heap Memory</span>
              <span className={styles.summaryTileValue}>
                {activeDisplayResult.queryResources.peakMemoryDuringBytes
                  ? `${(activeDisplayResult.queryResources.peakMemoryDuringBytes / (1024 * 1024)).toFixed(1)} MB`
                  : 'Unavailable'}
              </span>
            </div>
            <div className={styles.summaryTile}>
              <span className={styles.summaryTileLabel}>Incremental Peak</span>
              <span className={styles.summaryTileValue}>
                {activeDisplayResult.queryResources.incrementalPeakMemoryBytes
                  ? `${(activeDisplayResult.queryResources.incrementalPeakMemoryBytes / (1024 * 1024)).toFixed(1)} MB`
                  : '0 MB'}
              </span>
            </div>
            <div className={styles.summaryTile}>
              <span className={styles.summaryTileLabel}>Tokens (In / Out)</span>
              <span className={styles.summaryTileValue}>
                {activeDisplayResult.tokens.input} in / {activeDisplayResult.tokens.output} out
              </span>
            </div>
            <div className={styles.summaryTile}>
              <span className={styles.summaryTileLabel}>Components Accounted</span>
              <span className={styles.summaryTileValue}>
                {activeDisplayResult.measurementCoverage.totalRegisteredComponents} registered ({activeDisplayResult.queryResources.usedComponentsCount} used)
              </span>
            </div>
            <div className={styles.summaryTile}>
              <span className={styles.summaryTileLabel}>Measurement Coverage</span>
              <span className={styles.summaryTileValue}>
                {activeDisplayResult.measurementCoverage.coveragePercentage}%
              </span>
            </div>
          </div>
        </section>
      )}

      {/* ── Section: Active & Recent Operations ────────────────── */}
      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <div className={styles.sectionTitleGroup}>
            <Activity size={18} style={{ color: 'var(--color-primary)' }} />
            <h2 className={styles.sectionTitle}>Ongoing & Recent Operations</h2>
          </div>
          <span style={{ fontSize: '0.8125rem', color: 'var(--color-muted-foreground)' }}>
            {processes.length} recorded operation{processes.length === 1 ? '' : 's'}
          </span>
        </div>

        {processes.length === 0 ? (
          <div className={styles.emptyState}>
            <Activity size={32} className={styles.emptyStateIcon} />
            <p style={{ margin: 0, fontWeight: 500 }}>No operations recorded in this session</p>
            <p style={{ fontSize: '0.8125rem', margin: '4px 0 0' }}>
              Operations like model downloads, benchmark runs, Test Once baseline runs, and local token generation will appear here in real time.
            </p>
          </div>
        ) : (
          <div className={styles.opsList}>
            {processes.map((proc) => {
              const isExpanded = expandedProcessId === proc.id;
              const isRunning =
                proc.status === 'RUNNING' ||
                proc.status === 'INITIALIZING' ||
                proc.status === 'QUEUED' ||
                proc.status === 'CANCELLING';
              const isFailed = proc.status === 'FAILED';
              const isCompleted = proc.status === 'COMPLETED';

              return (
                <div
                  key={proc.id}
                  className={`${styles.opCard} ${isRunning ? styles.opCardRunning : isFailed ? styles.opCardFailed : ''}`}
                >
                  <div className={styles.opHeader} onClick={() => toggleExpand(proc.id)}>
                    <div className={styles.opHeaderLeft}>
                      <span
                        className={`${styles.opStatusPill} ${
                          isRunning
                            ? styles.statusRunning
                            : isCompleted
                            ? styles.statusCompleted
                            : isFailed
                            ? styles.statusFailed
                            : styles.statusCancelled
                        }`}
                      >
                        {proc.status}
                      </span>
                      <span className={styles.opName}>{proc.operationName}</span>
                      <div className={styles.opMeta}>
                        <span>{proc.provider}</span>
                        <span>•</span>
                        <span>Stage: {proc.currentStage}</span>
                        {proc.resourceMetrics?.durationMs && (
                          <>
                            <span>•</span>
                            <span>{proc.resourceMetrics.durationMs}ms</span>
                          </>
                        )}
                      </div>
                    </div>

                    <div className={styles.opHeaderRight}>
                      {proc.canCancel && isRunning && (
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            cancelProcess(proc.id);
                          }}
                        >
                          <XCircle size={13} />
                          <span>Cancel</span>
                        </Button>
                      )}
                      {isFailed && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            retryProcess(proc.id);
                          }}
                        >
                          <RefreshCw size={13} />
                          <span>Retry</span>
                        </Button>
                      )}
                      {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </div>
                  </div>

                  {/* Progress Bar (if percentage exists) */}
                  {proc.progress !== undefined && isRunning && (
                    <div className={styles.progressContainer}>
                      <div className={styles.progressHeader}>
                        <span>{proc.currentStage}</span>
                        <span>{proc.progress}%</span>
                      </div>
                      <div className={styles.progressBar}>
                        <div className={styles.progressFill} style={{ width: `${proc.progress}%` }} />
                      </div>
                    </div>
                  )}

                  {/* Expandable Lifecycle Details & Logs */}
                  {isExpanded && (
                    <div className={styles.opDetails}>
                      <div className={styles.detailsGrid}>
                        <div className={styles.detailTile}>
                          <div className={styles.detailLabel}>Process ID</div>
                          <div className={styles.detailValue}>{proc.id}</div>
                        </div>
                        <div className={styles.detailTile}>
                          <div className={styles.detailLabel}>Started At</div>
                          <div className={styles.detailValue}>
                            {new Date(proc.startedAt).toLocaleTimeString()}
                          </div>
                        </div>
                        <div className={styles.detailTile}>
                          <div className={styles.detailLabel}>Execution Duration</div>
                          <div className={styles.detailValue}>
                            {proc.resourceMetrics?.durationMs
                              ? `${proc.resourceMetrics.durationMs} ms`
                              : 'In progress'}
                          </div>
                        </div>
                        {proc.resourceMetrics?.tokensPerSec !== undefined && (
                          <div className={styles.detailTile}>
                            <div className={styles.detailLabel}>Generation Speed</div>
                            <div className={styles.detailValue}>
                              {proc.resourceMetrics.tokensPerSec} tok/s
                            </div>
                          </div>
                        )}
                        {proc.resourceMetrics?.loadDurationMs !== undefined && proc.resourceMetrics.loadDurationMs > 0 && (
                          <div className={styles.detailTile}>
                            <div className={styles.detailLabel}>Model Load Time</div>
                            <div className={styles.detailValue}>
                              {proc.resourceMetrics.loadDurationMs} ms
                            </div>
                          </div>
                        )}
                        {proc.resourceMetrics?.promptEvalDurationMs !== undefined && proc.resourceMetrics.promptEvalDurationMs > 0 && (
                          <div className={styles.detailTile}>
                            <div className={styles.detailLabel}>Prompt Evaluation</div>
                            <div className={styles.detailValue}>
                              {proc.resourceMetrics.promptEvalDurationMs} ms
                            </div>
                          </div>
                        )}
                        {proc.resourceMetrics?.evalDurationMs !== undefined && proc.resourceMetrics.evalDurationMs > 0 && (
                          <div className={styles.detailTile}>
                            <div className={styles.detailLabel}>Token Evaluation</div>
                            <div className={styles.detailValue}>
                              {proc.resourceMetrics.evalDurationMs} ms
                            </div>
                          </div>
                        )}
                        {proc.resourceMetrics?.tokensGenerated !== undefined && (
                          <div className={styles.detailTile}>
                            <div className={styles.detailLabel}>Tokens (Prompt / Eval)</div>
                            <div className={styles.detailValue}>
                              {proc.resourceMetrics.promptTokens ?? 0} in / {proc.resourceMetrics.tokensGenerated} out
                            </div>
                          </div>
                        )}
                        {proc.resourceMetrics?.telemetryReliability && (
                          <div className={styles.detailTile}>
                            <div className={styles.detailLabel}>Telemetry Quality</div>
                            <div className={styles.detailValue}>
                              <span className={`${styles.dataPill} ${proc.resourceMetrics.telemetryReliability === 'MEASURED' ? styles.dataPillMeasured : styles.dataPillEstimated}`}>
                                {proc.resourceMetrics.telemetryReliability}
                              </span>
                            </div>
                          </div>
                        )}
                        {proc.resourceMetrics?.jsHeapUsedMb !== undefined && (
                          <div className={styles.detailTile}>
                            <div className={styles.detailLabel}>JS Heap At Exec</div>
                            <div className={styles.detailValue}>
                              {proc.resourceMetrics.jsHeapUsedMb} MB
                            </div>
                          </div>
                        )}
                      </div>

                      {proc.error && (
                        <div
                          style={{
                            background: 'rgba(198, 40, 40, 0.1)',
                            border: '1px solid var(--color-destructive)',
                            borderRadius: 'var(--radius-sm)',
                            padding: 'var(--space-2) var(--space-3)',
                            marginBottom: 'var(--space-3)',
                            fontSize: '0.75rem',
                            color: 'var(--color-destructive)',
                          }}
                        >
                          <strong>Error:</strong> {proc.error}
                        </div>
                      )}

                      <div className={styles.logBox}>
                        {proc.logs.map((log, idx) => (
                          <div key={idx} className={styles.logEntry}>
                            <span className={styles.logTime}>
                              {new Date(log.timestamp).toLocaleTimeString()}
                            </span>
                            <span className={styles.logStage}>[{log.stage}]</span>
                            <span className={styles.logMsg}>{log.message}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ── Test Once Diagnostic Runner Modal ─────────────────── */}
      {showTestModal && (
        <div className={styles.modalOverlay} onClick={() => !isTestRunning && setShowTestModal(false)}>
          <div className={styles.modalLarge} onClick={(e) => e.stopPropagation()}>
            {/* Modal Header */}
            <div className={styles.modalHeader}>
              <div>
                <div className={styles.modalTitleGroup}>
                  <Play size={18} style={{ color: 'var(--color-primary)' }} />
                  <h3 className={styles.modalTitle}>Test Once — Resource Telemetry Baseline</h3>
                </div>
                <p className={styles.modalSubtitle}>
                  Execute genuine inference against the active AI model to capture exact memory, compute, and lifecycle telemetry.
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowTestModal(false)}
                disabled={isTestRunning}
              >
                <X size={14} />
                <span>Close</span>
              </Button>
            </div>

            {/* Model & Runtime Identification */}
            <div className={styles.modelBadgeBox}>
              <div className={styles.modelBadgeItem}>
                <span className={styles.modelBadgeLabel}>Active Provider</span>
                <span className={styles.modelBadgeValue}>
                  {selectedModelInfo?.provider.toUpperCase() || 'LITERT-LM'}
                </span>
              </div>
              <div className={styles.modelBadgeItem}>
                <span className={styles.modelBadgeLabel}>Selected Model</span>
                <span className={styles.modelBadgeValue}>
                  {selectedModelInfo?.name || activeModelId || 'gemma-4-e2b-it-web'}
                </span>
              </div>
              <div className={styles.modelBadgeItem}>
                <span className={styles.modelBadgeLabel}>Version / Quantization</span>
                <span className={styles.modelBadgeValue}>
                  {selectedModelInfo?.quantization || selectedModelInfo?.version || 'Standard'}
                </span>
              </div>
              <div className={styles.modelBadgeItem}>
                <span className={styles.modelBadgeLabel}>Inference Backend</span>
                <span className={styles.modelBadgeValue}>
                  {selectedModelInfo?.backend || 'LiteRT WebGPU Engine'}
                </span>
              </div>
            </div>

            {/* Query Editor */}
            <div className={styles.querySection}>
              <div className={styles.queryHeaderRow}>
                <label className={styles.queryLabel}>Diagnostic Query Prompt:</label>
                <div className={styles.queryControls}>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleResetQuery}
                    disabled={isTestRunning || testQuery === DEFAULT_TEST_QUERY}
                  >
                    <span>Reset to Default</span>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setTestQuery('')}
                    disabled={isTestRunning || !testQuery}
                  >
                    <span>Clear</span>
                  </Button>
                </div>
              </div>
              <textarea
                value={testQuery}
                onChange={(e) => setTestQuery(e.target.value)}
                disabled={isTestRunning}
                className={styles.queryTextarea}
                rows={4}
                placeholder="Enter query for inference test..."
              />
            </div>

            {/* Action Bar (Go/Run + Cancel) */}
            <div className={styles.runActionsBar}>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleRunTest}
                  disabled={isTestRunning || !testQuery.trim()}
                >
                  <Play size={14} className={isTestRunning ? 'spin' : ''} />
                  <span>{isTestRunning ? 'Running Test...' : 'Go / Run Test'}</span>
                </Button>
                {isTestRunning && (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={handleCancelTest}
                  >
                    <XCircle size={14} />
                    <span>Cancel Test</span>
                  </Button>
                )}
              </div>

              {isTestRunning && (
                <div className={styles.runningIndicator}>
                  <RefreshCw size={14} className="spin" />
                  <span>Executing real inference & collecting telemetry...</span>
                </div>
              )}
            </div>

            {/* Error Banner */}
            {testErrorMessage && (
              <div
                style={{
                  background: 'rgba(198, 40, 40, 0.1)',
                  border: '1px solid var(--color-destructive)',
                  borderRadius: 'var(--radius-sm)',
                  padding: 'var(--space-2) var(--space-3)',
                  marginBottom: 'var(--space-4)',
                  fontSize: '0.8125rem',
                  color: 'var(--color-destructive)',
                }}
              >
                <strong>Inference Failure:</strong> {testErrorMessage}
              </div>
            )}

            {/* Test History Selector if past runs exist */}
            {testHistory.length > 0 && (
              <div className={styles.historySelectorRow}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Clock size={14} style={{ color: 'var(--color-primary)' }} />
                  <strong>Test Run History ({testHistory.length}):</strong>
                  <select
                    className={styles.historySelect}
                    value={activeDisplayResult?.testId || ''}
                    onChange={(e) => handleSelectHistory(e.target.value)}
                  >
                    {testHistory.map((t, idx) => (
                      <option key={t.testId} value={t.testId}>
                        {idx === 0 ? 'Latest: ' : ''}
                        {t.model.name} — {new Date(t.execution.startedAt).toLocaleTimeString()} ({t.execution.status})
                      </option>
                    ))}
                  </select>
                </div>
                <Button variant="outline" size="sm" onClick={handleClearHistory} disabled={isTestRunning}>
                  <Trash2 size={12} />
                  <span>Clear History</span>
                </Button>
              </div>
            )}

            {/* If a test result is available to inspect */}
            {activeDisplayResult && (
              <>
                {/* Level A: Query Summary */}
                <div className={styles.summarySection}>
                  <div className={styles.summaryHeader}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <CheckCircle2
                        size={16}
                        style={{
                          color:
                            activeDisplayResult.execution.status === 'COMPLETED'
                              ? 'var(--color-success)'
                              : 'var(--color-destructive)',
                        }}
                      />
                      <h4 className={styles.summaryTitle}>Query Resource Summary</h4>
                    </div>
                    <span
                      className={`${styles.opStatusPill} ${
                        activeDisplayResult.execution.status === 'COMPLETED'
                          ? styles.statusCompleted
                          : activeDisplayResult.execution.status === 'FAILED'
                          ? styles.statusFailed
                          : styles.statusCancelled
                      }`}
                    >
                      {activeDisplayResult.execution.status}
                    </span>
                  </div>

                  {/* Summary Metric Grid */}
                  <div className={styles.summaryGrid}>
                    <div className={styles.summaryTile}>
                      <span className={styles.summaryTileLabel}>Elapsed Duration</span>
                      <span className={styles.summaryTileValue}>
                        {activeDisplayResult.execution.durationMs} ms
                      </span>
                    </div>
                    <div className={styles.summaryTile}>
                      <span className={styles.summaryTileLabel}>Baseline JS Heap</span>
                      <span className={styles.summaryTileValue}>
                        {activeDisplayResult.queryResources.baselineApplicationMemoryBytes
                          ? `${(activeDisplayResult.queryResources.baselineApplicationMemoryBytes / (1024 * 1024)).toFixed(1)} MB`
                          : 'Unavailable'}
                      </span>
                    </div>
                    <div className={styles.summaryTile}>
                      <span className={styles.summaryTileLabel}>Peak Heap</span>
                      <span className={styles.summaryTileValue}>
                        {activeDisplayResult.queryResources.peakMemoryDuringBytes
                          ? `${(activeDisplayResult.queryResources.peakMemoryDuringBytes / (1024 * 1024)).toFixed(1)} MB`
                          : 'Unavailable'}
                      </span>
                    </div>
                    <div className={styles.summaryTile}>
                      <span className={styles.summaryTileLabel}>Incremental Peak</span>
                      <span className={styles.summaryTileValue}>
                        {activeDisplayResult.queryResources.incrementalPeakMemoryBytes
                          ? `${(activeDisplayResult.queryResources.incrementalPeakMemoryBytes / (1024 * 1024)).toFixed(1)} MB`
                          : '0 MB'}
                      </span>
                    </div>
                    <div className={styles.summaryTile}>
                      <span className={styles.summaryTileLabel}>Retained Memory</span>
                      <span className={styles.summaryTileValue}>
                        {activeDisplayResult.queryResources.memoryRetainedAfterBytes
                          ? `${(activeDisplayResult.queryResources.memoryRetainedAfterBytes / (1024 * 1024)).toFixed(1)} MB`
                          : '0 MB'}
                      </span>
                    </div>
                    <div className={styles.summaryTile}>
                      <span className={styles.summaryTileLabel}>Tokens (In / Out)</span>
                      <span className={styles.summaryTileValue}>
                        {activeDisplayResult.tokens.input} in / {activeDisplayResult.tokens.output} out
                      </span>
                    </div>
                    {activeDisplayResult.tokens.tokensPerSecond !== null && (
                      <div className={styles.summaryTile}>
                        <span className={styles.summaryTileLabel}>Generation Speed</span>
                        <span className={styles.summaryTileValue}>
                          {activeDisplayResult.tokens.tokensPerSecond} tok/s
                        </span>
                      </div>
                    )}
                    {activeDisplayResult.queryResources.gpuMemoryAllocationBytes && (
                      <div className={styles.summaryTile}>
                        <span className={styles.summaryTileLabel}>VRAM Allocation</span>
                        <span className={styles.summaryTileValue}>
                          {(activeDisplayResult.queryResources.gpuMemoryAllocationBytes / (1024 * 1024)).toFixed(0)} MB
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Component Participation Counts */}
                  <div className={styles.componentBreakdownRow}>
                    <span className={styles.componentBreakdownTag} style={{ color: 'var(--color-primary)' }}>
                      Used: {activeDisplayResult.queryResources.usedComponentsCount}
                    </span>
                    <span>•</span>
                    <span className={styles.componentBreakdownTag} style={{ color: 'var(--color-muted-foreground)' }}>
                      Not Used: {activeDisplayResult.queryResources.notUsedComponentsCount}
                    </span>
                    <span>•</span>
                    <span className={styles.componentBreakdownTag} style={{ color: 'var(--color-success)' }}>
                      Measured Zero: {activeDisplayResult.queryResources.measuredZeroComponentsCount}
                    </span>
                    <span>•</span>
                    <span className={styles.componentBreakdownTag} style={{ color: 'var(--color-warning)' }}>
                      Unavailable: {activeDisplayResult.queryResources.unavailableMeasurementsCount}
                    </span>
                    <span>•</span>
                    <span className={styles.componentBreakdownTag} style={{ color: 'var(--color-muted-foreground)' }}>
                      Unsupported: {activeDisplayResult.queryResources.notSupportedMeasurementsCount}
                    </span>
                    {activeDisplayResult.queryResources.errorMeasurementsCount > 0 && (
                      <>
                        <span>•</span>
                        <span className={styles.componentBreakdownTag} style={{ color: 'var(--color-destructive)' }}>
                          Errors: {activeDisplayResult.queryResources.errorMeasurementsCount}
                        </span>
                      </>
                    )}
                    <span>•</span>
                    <span className={styles.componentBreakdownTag}>
                      Coverage: {activeDisplayResult.measurementCoverage.coveragePercentage}%
                    </span>
                  </div>

                  {/* Response Text Preview (if generated) */}
                  {activeDisplayResult.response?.content && (
                    <div className={styles.responsePreviewBox}>
                      <div
                        className={styles.responsePreviewHeader}
                        onClick={() => setResponseExpanded((prev) => !prev)}
                      >
                        <span>Model Output Response ({activeDisplayResult.response.content.length} chars)</span>
                        {responseExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                      </div>
                      {responseExpanded && (
                        <div className={styles.responsePreviewText}>
                          {activeDisplayResult.response.content}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Level B: Complete Raw Telemetry (JSON Viewer) */}
                <div className={styles.rawTelemetrySection}>
                  <div className={styles.rawTelemetryHeader}>
                    <h4 className={styles.rawTelemetryTitle}>
                      <Code size={14} style={{ color: 'var(--color-primary)' }} />
                      <span>Complete Raw Telemetry (Structured JSON)</span>
                    </h4>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <Button variant="outline" size="sm" onClick={handleCopyJson}>
                        {jsonCopied ? <Check size={13} style={{ color: 'var(--color-success)' }} /> : <Copy size={13} />}
                        <span>{jsonCopied ? 'Copied' : 'Copy JSON'}</span>
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setTelemetryRawExpanded((prev) => !prev)}
                      >
                        {telemetryRawExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                        <span>{telemetryRawExpanded ? 'Collapse' : 'Expand'}</span>
                      </Button>
                    </div>
                  </div>
                  {telemetryRawExpanded && (
                    <pre className={styles.jsonViewerPre}>
                      {JSON.stringify(activeDisplayResult, null, 2)}
                    </pre>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
