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
  FileText,
  Copy,
  Check,
  Code,
  X,
  Save,
  ExternalLink,
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
import { errorHandler } from '@/lib/errors';
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

  // Section Expand / Collapse State
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    overview: true,
    memoryTelemetry: true,
    latestBaseline: true,
    operations: true,
  });

  const toggleSection = (sectionKey: string) => {
    setExpandedSections((prev) => ({
      ...prev,
      [sectionKey]: !prev[sectionKey],
    }));
  };

  // Test Once & Baseline Telemetry State
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

  // GitHub Save State
  const [isSavingToGitHub, setIsSavingToGitHub] = useState(false);
  const [githubSaveResult, setGithubSaveResult] = useState<{
    filename: string;
    path: string;
    repository: string;
    url: string;
  } | null>(null);
  const [githubSaveError, setGithubSaveError] = useState<string | null>(null);

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

  const toggleProcessExpand = (id: string) => {
    setExpandedProcessId((prev) => (prev === id ? null : id));
  };

  // ── Test Once Execution Handlers ───────────────────────────────
  const handleRunTest = async () => {
    if (isTestRunning || !testQuery.trim()) return;
    setIsTestRunning(true);
    setTestErrorMessage(null);
    setGithubSaveResult(null);
    setGithubSaveError(null);

    // Expand section if collapsed so the user sees real-time test progress
    setExpandedSections((prev) => ({ ...prev, latestBaseline: true }));

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
      const errorMsg = err instanceof Error ? err.message : String(err);
      setTestErrorMessage(errorMsg);
      const updatedHistory = await TestHistoryStorage.getTestResults();
      setTestHistory(updatedHistory);
      if (updatedHistory.length > 0) {
        setCurrentTestResult(updatedHistory[0]);
      }

      // Centralized Error Handling & Modal Invocation
      await errorHandler.captureError({
        error: err,
        title: 'Inference Test Execution Failed',
        message: errorMsg,
        category: 'MODEL',
        source: {
          module: 'AI Runtime Monitor',
          component: 'Test Once Runner',
          operation: 'Run Test Once',
        },
        details: {
          provider: selectedModelInfo?.provider,
          model: selectedModelInfo?.name || activeModelId,
          endpoint: selectedModelInfo?.backend || 'Local Runtime Engine',
        },
        logs: [
          {
            timestamp: new Date().toISOString(),
            level: 'info',
            source: 'Test Once Runner',
            message: `Starting baseline inference test for model ${selectedModelInfo?.name || activeModelId}...`,
          },
          {
            timestamp: new Date().toISOString(),
            level: 'error',
            source: 'Test Once Runner',
            message: `Inference failed: ${errorMsg}`,
          },
        ],
        retryHandler: async () => {
          await handleRunTest();
        },
      });
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
      setGithubSaveResult(null);
      setGithubSaveError(null);
    }
  };

  const handleSelectHistory = (id: string) => {
    setSelectedHistoryId(id);
    const found = testHistory.find((t) => t.testId === id);
    if (found) {
      setCurrentTestResult(found);
    }
    setGithubSaveResult(null);
    setGithubSaveError(null);
  };

  const activeDisplayResult = selectedHistoryId
    ? testHistory.find((t) => t.testId === selectedHistoryId) || currentTestResult
    : currentTestResult;

  // ── GitHub Persistence Handler ─────────────────────────────────
  const handleSaveDetailsToGitHub = async (): Promise<boolean> => {
    if (!activeDisplayResult || isSavingToGitHub) return false;
    setIsSavingToGitHub(true);
    setGithubSaveError(null);
    setGithubSaveResult(null);

    let httpStatus: number | null = null;
    try {
      const res = await fetch('/api/telemetry/save-github', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          testExecution: activeDisplayResult,
        }),
      });

      httpStatus = res.status;
      const data = await res.json();
      if (!res.ok) {
        const errorMsg = data.error || `Failed to save telemetry (${res.status})`;
        const httpError = new Error(errorMsg);
        (httpError as any).status = res.status;
        throw httpError;
      }

      setGithubSaveResult({
        filename: data.filename,
        path: data.path,
        repository: data.repository,
        url: data.url,
      });
      return true;
    } catch (err: any) {
      const status = (err && (err.status || httpStatus)) || null;
      const errorMsg = err instanceof Error ? err.message : String(err);
      setGithubSaveError(errorMsg);

      // Centralized Error Handling & Modal Invocation
      await errorHandler.captureError({
        error: err,
        title: 'GitHub Baseline Persistence Failed',
        message: errorMsg,
        category: status === 401 ? 'AUTHENTICATION' : status === 403 ? 'AUTHORIZATION' : 'API',
        source: {
          module: 'AI Runtime Monitor',
          component: 'GitHub Persistence',
          operation: 'Save Baseline Details',
        },
        details: {
          httpStatus: status,
          endpoint: '/api/telemetry/save-github',
          provider: activeDisplayResult.model.provider,
          model: activeDisplayResult.model.name,
          operationId: activeDisplayResult.testId,
        },
        logs: [
          {
            timestamp: new Date().toISOString(),
            level: 'info',
            source: 'GitHub Persistence',
            message: `Initiating commit of telemetry baseline (${activeDisplayResult.testId}) to repository YVSApps_Data_YaiStudio/telemetry-tests/...`,
          },
          {
            timestamp: new Date().toISOString(),
            level: 'error',
            source: 'GitHub Persistence',
            message: `Save request failed with HTTP ${status || 'unknown'}: ${errorMsg}`,
          },
        ],
        retryHandler: async () => {
          // Re-executes the exact GitHub save operation using the existing activeDisplayResult!
          // Guarantees NO re-inference is executed!
          return await handleSaveDetailsToGitHub();
        },
      });
      return false;
    } finally {
      setIsSavingToGitHub(false);
    }
  };

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

      {/* ── Section 1: Overview Summary Tiles (Collapsible) ───── */}
      <section className={styles.section}>
        <div
          className={`${styles.sectionHeader} ${styles.sectionHeaderClickable}`}
          onClick={() => toggleSection('overview')}
        >
          <div className={styles.sectionTitleGroup}>
            <Activity size={18} style={{ color: 'var(--color-primary)' }} />
            <h2 className={styles.sectionTitle}>Runtime Overview & Metrics</h2>
          </div>
          <div className={styles.headerActionsRight} onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className={styles.toggleBtn}
              onClick={() => toggleSection('overview')}
              aria-label={expandedSections.overview ? 'Collapse overview' : 'Expand overview'}
              title={expandedSections.overview ? 'Collapse overview' : 'Expand overview'}
            >
              {expandedSections.overview ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
          </div>
        </div>

        {expandedSections.overview && (
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
        )}
      </section>

      {/* ── Section 2: Memory & Resource Telemetry (Collapsible) ── */}
      <section className={styles.section}>
        <div
          className={`${styles.sectionHeader} ${styles.sectionHeaderClickable}`}
          onClick={() => toggleSection('memoryTelemetry')}
        >
          <div className={styles.sectionTitleGroup}>
            <HardDrive size={18} style={{ color: 'var(--color-primary)' }} />
            <h2 className={styles.sectionTitle}>Memory & Resource Telemetry</h2>
          </div>
          <div className={styles.headerActionsRight} onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className={styles.toggleBtn}
              onClick={() => toggleSection('memoryTelemetry')}
              aria-label={expandedSections.memoryTelemetry ? 'Collapse memory telemetry' : 'Expand memory telemetry'}
              title={expandedSections.memoryTelemetry ? 'Collapse memory telemetry' : 'Expand memory telemetry'}
            >
              {expandedSections.memoryTelemetry ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
          </div>
        </div>

        {expandedSections.memoryTelemetry && (
          <>
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
                  <span
                    className={`${styles.dataPill} ${
                      runningOllamaModels.length > 0 ? styles.dataPillMeasured : styles.dataPillEstimated
                    }`}
                  >
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
          </>
        )}
      </section>

      {/* ── Section 3: Latest Baseline Telemetry (Local Telemetry) ─ */}
      <section className={styles.section}>
        {/* A. Latest Baseline Telemetry — Section Header */}
        <div
          className={`${styles.sectionHeader} ${styles.sectionHeaderClickable}`}
          onClick={() => toggleSection('latestBaseline')}
        >
          <div className={styles.sectionTitleGroup}>
            <Play size={18} style={{ color: 'var(--color-primary)' }} />
            <h2 className={styles.sectionTitle}>
              Latest Baseline Telemetry
              {activeDisplayResult?.model?.name ? ` — ${activeDisplayResult.model.name}` : ''}
            </h2>
          </div>

          <div className={styles.headerActionsRight} onClick={(e) => e.stopPropagation()}>
            <Button
              variant="primary"
              size="sm"
              onClick={handleRunTest}
              disabled={isTestRunning || !testQuery.trim()}
            >
              <Play size={14} className={isTestRunning ? 'spin' : ''} />
              <span>{isTestRunning ? 'Running Test...' : 'Test Once'}</span>
            </Button>
            <button
              type="button"
              className={styles.toggleBtn}
              onClick={() => toggleSection('latestBaseline')}
              aria-label={expandedSections.latestBaseline ? 'Collapse section' : 'Expand section'}
              title={expandedSections.latestBaseline ? 'Collapse section' : 'Expand section'}
            >
              {expandedSections.latestBaseline ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
          </div>
        </div>

        {expandedSections.latestBaseline && (
          <div>
            {/* B. Active Model Information */}
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

            {/* C. Diagnostic Query Prompt & Execution Controls */}
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

            {/* Run Actions Bar */}
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
                  <Button variant="destructive" size="sm" onClick={handleCancelTest}>
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

            {/* Inference Failure Banner */}
            {testErrorMessage && (
              <div className={styles.githubErrorBanner}>
                <AlertTriangle size={16} style={{ color: 'var(--color-destructive)', flexShrink: 0, marginTop: 2 }} />
                <div style={{ flex: 1 }}>
                  <strong>Inference Failure:</strong> {testErrorMessage}
                </div>
                <button
                  type="button"
                  className={styles.dismissBtn}
                  onClick={() => setTestErrorMessage(null)}
                  aria-label="Dismiss banner"
                >
                  <X size={14} />
                </button>
              </div>
            )}

            {/* D. Test Run History */}
            {testHistory.length > 0 && (
              <div className={styles.historySelectorRow}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
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

            {/* E. Query Resource Summary */}
            {activeDisplayResult ? (
              <>
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

                    {/* Top-Right Save Details Action */}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleSaveDetailsToGitHub}
                      disabled={isSavingToGitHub || !activeDisplayResult}
                    >
                      {isSavingToGitHub ? (
                        <RefreshCw size={13} className="spin" />
                      ) : (
                        <Save size={13} style={{ color: 'var(--color-primary)' }} />
                      )}
                      <span>{isSavingToGitHub ? 'Saving to GitHub...' : 'Save Details'}</span>
                    </Button>
                  </div>

                  {/* GitHub Save Feedback Banners */}
                  {githubSaveResult && (
                    <div className={styles.githubSuccessBanner}>
                      <CheckCircle2 size={16} style={{ color: 'var(--color-success)', flexShrink: 0, marginTop: 2 }} />
                      <div style={{ flex: 1 }}>
                        <div>
                          <strong>Successfully saved telemetry baseline:</strong>{' '}
                          <code>{githubSaveResult.filename}</code>
                        </div>
                        <div style={{ fontSize: '0.75rem', marginTop: 2, color: 'var(--color-muted-foreground)' }}>
                          Repository: <strong>{githubSaveResult.repository}</strong> | Path:{' '}
                          <code>{githubSaveResult.path}</code>
                          {githubSaveResult.url && (
                            <a
                              href={githubSaveResult.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className={styles.githubLink}
                            >
                              <span>View file in GitHub</span>
                              <ExternalLink size={12} />
                            </a>
                          )}
                        </div>
                      </div>
                      <button
                        type="button"
                        className={styles.dismissBtn}
                        onClick={() => setGithubSaveResult(null)}
                        aria-label="Dismiss banner"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  )}

                  {githubSaveError && (
                    <div className={styles.githubErrorBanner}>
                      <AlertTriangle size={16} style={{ color: 'var(--color-destructive)', flexShrink: 0, marginTop: 2 }} />
                      <div style={{ flex: 1 }}>
                        <strong>Failed to save telemetry to GitHub:</strong> {githubSaveError}
                      </div>
                      <button
                        type="button"
                        className={styles.dismissBtn}
                        onClick={() => setGithubSaveError(null)}
                        aria-label="Dismiss banner"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  )}

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

                  {/* F. Model Output Response (Expandable) */}
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

                {/* G. Complete Raw Telemetry (Structured JSON) */}
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
            ) : (
              <div className={styles.emptyState}>
                <Play size={28} className={styles.emptyStateIcon} />
                <p style={{ margin: 0, fontWeight: 500 }}>No baseline telemetry recorded yet</p>
                <p style={{ fontSize: '0.8125rem', margin: '4px 0 0' }}>
                  Click <strong>Test Once</strong> above or <strong>Go / Run Test</strong> to execute a genuine inference test and establish a telemetry baseline.
                </p>
              </div>
            )}
          </div>
        )}
      </section>

      {/* ── Section 4: Ongoing & Recent Operations (Collapsible) ── */}
      <section className={styles.section}>
        <div
          className={`${styles.sectionHeader} ${styles.sectionHeaderClickable}`}
          onClick={() => toggleSection('operations')}
        >
          <div className={styles.sectionTitleGroup}>
            <Activity size={18} style={{ color: 'var(--color-primary)' }} />
            <h2 className={styles.sectionTitle}>Ongoing & Recent Operations</h2>
          </div>
          <div className={styles.headerActionsRight} onClick={(e) => e.stopPropagation()}>
            <span style={{ fontSize: '0.8125rem', color: 'var(--color-muted-foreground)', marginRight: 'var(--space-2)' }}>
              {processes.length} recorded operation{processes.length === 1 ? '' : 's'}
            </span>
            <button
              type="button"
              className={styles.toggleBtn}
              onClick={() => toggleSection('operations')}
              aria-label={expandedSections.operations ? 'Collapse operations' : 'Expand operations'}
              title={expandedSections.operations ? 'Collapse operations' : 'Expand operations'}
            >
              {expandedSections.operations ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
          </div>
        </div>

        {expandedSections.operations && (
          <div>
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
                      <div className={styles.opHeader} onClick={() => toggleProcessExpand(proc.id)}>
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

                        <div className={styles.opActions} onClick={(e) => e.stopPropagation()}>
                          {isRunning && proc.canCancel && (
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => cancelProcess(proc.id)}
                            >
                              <XCircle size={12} />
                              <span>Cancel</span>
                            </Button>
                          )}
                          {isFailed && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => retryProcess(proc.id)}
                            >
                              <RefreshCw size={12} />
                              <span>Retry</span>
                            </Button>
                          )}
                          <button
                            type="button"
                            className={styles.toggleBtn}
                            onClick={() => toggleProcessExpand(proc.id)}
                            aria-label={isExpanded ? 'Collapse' : 'Expand'}
                          >
                            {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                          </button>
                        </div>
                      </div>

                      {isExpanded && (
                        <div className={styles.opBody}>
                          <div className={styles.opDetailGrid}>
                            <div className={styles.detailTile}>
                              <div className={styles.detailLabel}>Process ID</div>
                              <div className={styles.detailValue} style={{ fontSize: '0.6875rem' }}>
                                {proc.id}
                              </div>
                            </div>
                            <div className={styles.detailTile}>
                              <div className={styles.detailLabel}>Model</div>
                              <div className={styles.detailValue}>{proc.model || 'System'}</div>
                            </div>
                            {proc.resourceMetrics?.durationMs !== undefined && (
                              <div className={styles.detailTile}>
                                <div className={styles.detailLabel}>Total Duration</div>
                                <div className={styles.detailValue}>
                                  {proc.resourceMetrics.durationMs} ms
                                </div>
                              </div>
                            )}
                            {proc.resourceMetrics?.loadDurationMs !== undefined && proc.resourceMetrics.loadDurationMs > 0 && (
                              <div className={styles.detailTile}>
                                <div className={styles.detailLabel}>Load Duration</div>
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
                                  <span
                                    className={`${styles.dataPill} ${
                                      proc.resourceMetrics.telemetryReliability === 'MEASURED'
                                        ? styles.dataPillMeasured
                                        : styles.dataPillEstimated
                                    }`}
                                  >
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
          </div>
        )}
      </section>
    </div>
  );
}
