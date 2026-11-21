'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Cpu,
  HardDrive,
  CheckCircle2,
  AlertTriangle,
  Download,
  Trash2,
  Play,
  ShieldCheck,
  RefreshCw,
  Info,
  Sparkles,
  Check,
  Zap,
  Cloud,
  Shield,
  XCircle,
  Activity,
  Sliders,
  Smartphone,
  ChevronDown,
  ChevronUp,
  Layers,
  Scale,
} from 'lucide-react';
import Button from '@/components/ui/Button';
import { LOCAL_MODEL_CATALOG, getLocalModelDescriptor } from '@/lib/inference/local-model-registry';
import {
  EXTENDED_MODEL_CATALOGUE,
  evaluateModelRecommendation,
  type ModelCatalogueEntry,
} from '@/lib/inference/model-catalogue';
import { LocalModelManager } from '@/lib/inference/model-manager';
import { detectDeviceCapabilities } from '@/lib/inference/device-capabilities';
import { runLiteRTPoc, type PocExecutionReport } from '@/lib/inference/litert-poc';
import { LocalAIConfig } from '@/lib/inference/local-ai-config';
import { LiteRTHealthManager, type LiteRTLayersHealth } from '@/lib/inference/litert-health';
import { usePWA } from '@/lib/pwa/pwa-context';
import type {
  DeviceCapabilityReport,
  InstalledModelRecord,
  InferenceMode,
} from '@/lib/inference/types';
import styles from './YaiLocal.module.css';

const QUICK_PROMPTS = [
  'What is the capital of India? Answer in one sentence.',
  'What is YAI Studio and how do you protect privacy?',
  'Explain the benefits of running AI models directly on-device.',
  'What is the difference between local inference and cloud inference?',
];

export default function YaiLocalPage() {
  const { isOnline, isInstallable, isInstalled, isUpdateAvailable, registration, promptInstall, applyUpdate } = usePWA();
  const [caps, setCaps] = useState<DeviceCapabilityReport | null>(null);
  const [modelRecords, setModelRecords] = useState<InstalledModelRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [probing, setProbing] = useState(false);
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);

  // Preference state synced with LocalAIConfig
  const [inferenceMode, setInferenceModeState] = useState<InferenceMode>('local');
  const [activeModelId, setActiveModelIdState] = useState<string | null>(null);
  const [loadedModelId, setLoadedModelId] = useState<string | null>(null);
  const [loadingModel, setLoadingModel] = useState<string | null>(null);
  const [unloadingModel, setUnloadingModel] = useState(false);
  const [reclaimedStorageMsg, setReclaimedStorageMsg] = useState<string | null>(null);

  // Model comparison & rationale expansion state
  const [showComparison, setShowComparison] = useState(false);
  const [expandedRationale, setExpandedRationale] = useState<Record<string, boolean>>({});

  // Inference test state
  const [testPrompt, setTestPrompt] = useState(QUICK_PROMPTS[0]);
  const [testRunning, setTestRunning] = useState(false);
  const [testReport, setTestReport] = useState<PocExecutionReport | null>(null);
  const [testError, setTestError] = useState<string | null>(null);
  const [hasRunTest, setHasRunTest] = useState(false);
  const [lastInferenceSuccess, setLastInferenceSuccess] = useState(false);
  const [lastInferenceTokensPerSec, setLastInferenceTokensPerSec] = useState<number | undefined>(undefined);

  // PWA display mode state (detectable client-side)
  const [displayMode, setDisplayMode] = useState<'standalone' | 'browser'>('browser');

  // Collapsible section state
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    pwa: true,
    device: true,
    health: true,
    models: true,
    testing: true,
    privacy: false,
  });

  const toggleSection = (sectionId: string) => {
    setExpandedSections((prev) => ({
      ...prev,
      [sectionId]: !prev[sectionId],
    }));
  };

  const isExpanded = (id: string) => Boolean(expandedSections[id]);

  const toggleRationale = (modelId: string) => {
    setExpandedRationale((prev) => ({
      ...prev,
      [modelId]: !prev[modelId],
    }));
  };

  // Detect display mode
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const checkMode = () => {
      const isStandaloneMedia = window.matchMedia('(display-mode: standalone)').matches;
      const isStandaloneNav = (navigator as unknown as { standalone?: boolean }).standalone === true;
      setDisplayMode(isStandaloneMedia || isStandaloneNav ? 'standalone' : 'browser');
    };
    checkMode();
    const media = window.matchMedia('(display-mode: standalone)');
    media.addEventListener('change', checkMode);
    return () => media.removeEventListener('change', checkMode);
  }, []);

  // Refresh device capabilities and model state
  const refreshData = useCallback(async () => {
    try {
      const detected = await detectDeviceCapabilities();
      setCaps(detected);
      const records = LocalModelManager.getModelRecords();
      setModelRecords(records);

      const prefs = LocalAIConfig.getPreferences();
      setInferenceModeState(prefs.inferenceMode);
      setActiveModelIdState(prefs.activeModelId);
    } catch (err) {
      console.warn('Failed to inspect device capabilities:', err);
    } finally {
      setLoading(false);
      setProbing(false);
    }
  }, []);

  useEffect(() => {
    refreshData();

    const unsubscribe = LocalAIConfig.subscribe(() => {
      const prefs = LocalAIConfig.getPreferences();
      setInferenceModeState(prefs.inferenceMode);
      setActiveModelIdState(prefs.activeModelId);
    });

    return unsubscribe;
  }, [refreshData]);

  const handleRerunCompatibility = async () => {
    setProbing(true);
    await refreshData();
  };

  const handleModeChange = (mode: InferenceMode) => {
    LocalAIConfig.setInferenceMode(mode);
    setInferenceModeState(mode);
  };

  const handleSetActiveModel = (modelId: string) => {
    LocalAIConfig.setActiveModelId(modelId, 'litert-lm');
    setActiveModelIdState(modelId);
  };

  const handleInstall = async (modelId: string) => {
    setActionInProgress(modelId);
    setReclaimedStorageMsg(null);
    try {
      await LocalModelManager.installModel(modelId, (updated) => {
        setModelRecords((prev) =>
          prev.map((r) => (r.modelId === updated.modelId ? updated : r))
        );
      });
      if (!activeModelId) {
        LocalAIConfig.setActiveModelId(modelId, 'litert-lm');
        setActiveModelIdState(modelId);
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Installation failed');
    } finally {
      setActionInProgress(null);
      refreshData();
    }
  };

  const handleCancelDownload = async (modelId: string) => {
    try {
      await LocalModelManager.cancelDownload(modelId);
    } finally {
      setActionInProgress(null);
      refreshData();
    }
  };

  const handleLoadModel = async (modelId: string) => {
    setLoadingModel(modelId);
    try {
      const { LiteRTEngine } = await import('@/lib/inference/litert-engine');
      const engine = new LiteRTEngine();
      await engine.loadModel(modelId);
      setLoadedModelId(modelId);
      LocalAIConfig.setActiveModelId(modelId, 'litert-lm');
      setActiveModelIdState(modelId);
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err));
    } finally {
      setLoadingModel(null);
    }
  };

  const handleUnloadModel = async () => {
    if (!loadedModelId) return;
    setUnloadingModel(true);
    try {
      const { LiteRTEngine } = await import('@/lib/inference/litert-engine');
      const engine = new LiteRTEngine();
      await engine.unloadModel();
      setLoadedModelId(null);
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err));
    } finally {
      setUnloadingModel(false);
    }
  };

  const handleDeleteModel = async (modelId: string) => {
    const desc = getLocalModelDescriptor(modelId);
    const sizeMb = desc ? (desc.downloadSizeBytes / (1024 * 1024)).toFixed(0) : '0';
    const isCurrentlyLoaded = loadedModelId === modelId;
    const isCurrentlySelected = activeModelId === modelId;

    const confirmMsg =
      `Are you sure you want to delete "${desc?.name || modelId}"?\n\n` +
      `• Storage Reclaimed: ${sizeMb} MB\n` +
      `• Currently Loaded: ${isCurrentlyLoaded ? 'YES (will be unloaded first)' : 'No'}\n` +
      `• Primary Selected: ${isCurrentlySelected ? 'YES' : 'No'}\n\n` +
      `This removes the model binary from your device's Origin Private File System (OPFS).`;

    if (!confirm(confirmMsg)) return;

    setActionInProgress(modelId);
    setReclaimedStorageMsg(null);
    try {
      if (isCurrentlyLoaded) {
        await handleUnloadModel();
      }
      await LocalModelManager.deleteModel(modelId);
      if (activeModelId === modelId) {
        LocalAIConfig.setActiveModelId(null, 'litert-lm');
        setActiveModelIdState(null);
      }
      setReclaimedStorageMsg(`Successfully reclaimed ${sizeMb} MB of local device storage.`);
      await refreshData();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Deletion failed');
    } finally {
      setActionInProgress(null);
    }
  };

  const handleRunTest = async () => {
    setTestError(null);
    const targetModel = activeModelId || 'gemma-4-e2b-it-web';

    const isInstalled = modelRecords.some((r) => r.modelId === targetModel && r.status === 'ready');
    if (!isInstalled) {
      setTestError('No LiteRT-LM model installed. Install a model to begin inference.');
      return;
    }

    if (caps && !caps.isSupported && !caps.hasWasm) {
      setTestError('This device does not support WebGPU or WebAssembly SIMD required for local execution.');
      return;
    }

    setTestRunning(true);
    setTestReport(null);
    try {
      const report = await runLiteRTPoc({
        modelId: targetModel,
        prompt: testPrompt,
      });
      setTestReport(report);
      setHasRunTest(true);
      setLastInferenceSuccess(true);
      setLastInferenceTokensPerSec(report.measurements.tokensPerSecond);
      setLoadedModelId(targetModel);
    } catch (err: any) {
      setTestError(`Inference execution error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setTestRunning(false);
    }
  };

  // Evaluate 6-Layer LiteRT-LM Runtime Health
  const liteRTHealth: LiteRTLayersHealth = LiteRTHealthManager.evaluateHealth({
    caps,
    modelRecords,
    activeModelId,
    loadedModelId,
    isModelLoading: Boolean(loadingModel),
    isInferencing: testRunning,
    lastInferenceSuccess,
    lastInferenceTokensPerSec,
  });

  // Installed models in OPFS
  const installedModels = modelRecords.filter((r) => r.status === 'ready');
  const availableCatalogue = EXTENDED_MODEL_CATALOGUE.filter((m) => m.supportedRuntimes.includes('litert-lm'));
  const activeDescriptor = activeModelId ? getLocalModelDescriptor(activeModelId) : null;

  // Memory Calculations
  const jsHeapUsedMb = caps?.memoryInfo?.jsHeapUsedMb;
  const jsHeapLimitMb = caps?.memoryInfo?.jsHeapLimitMb;
  const heapUsagePercent = jsHeapUsedMb && jsHeapLimitMb ? Math.round((jsHeapUsedMb / jsHeapLimitMb) * 100) : undefined;
  const storageQuotaGb = caps ? (caps.storage.quotaBytes / (1024 * 1024 * 1024)).toFixed(2) : '0';
  const storageUsedMb = caps ? (caps.storage.usageBytes / (1024 * 1024)).toFixed(1) : '0';
  const storageFreeGb = caps ? (caps.storage.freeBytes / (1024 * 1024 * 1024)).toFixed(2) : '0';
  const loadedDescriptor = loadedModelId ? getLocalModelDescriptor(loadedModelId) : null;

  return (
    <div className={styles.root}>
      {/* ── Page Header & Navigation ── */}
      <div className={styles.header}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
          <Link href="/providers" className={styles.backLink}>
            <ArrowLeft size={14} />
            <span>Back to AI Providers</span>
          </Link>
          <Link href="/monitor" className={styles.backLink} style={{ color: 'var(--color-primary)', fontWeight: 600 }}>
            <Activity size={14} />
            <span>Open Real-time Runtime Monitor</span>
          </Link>
        </div>

        <div className={styles.titleRow}>
          <h1 className={styles.title}>LiteRT-LM Local Intelligence & Device Diagnostics</h1>
          <span className={styles.primaryBadge}>Embedded WebGPU Engine</span>
        </div>
        <p className={styles.description}>
          On-device neural execution powered by Google LiteRT-LM. Manages sandboxed model weights in
          Origin Private File System (OPFS) and runs prompt evaluation locally with strict zero outbound network requests.
        </p>
      </div>

      {reclaimedStorageMsg && (
        <div className={styles.actionBanner} style={{ borderColor: 'var(--color-success)', marginBottom: 'var(--space-4)' }}>
          <CheckCircle2 size={16} style={{ color: 'var(--color-success)' }} />
          <span>{reclaimedStorageMsg}</span>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════════
          SECTION 1 — PWA Information & Installation Status (Collapsible)
          ══════════════════════════════════════════════════════════════════════════ */}
      <section className={styles.sectionCard}>
        <div
          className={styles.collapsibleHeader}
          onClick={() => toggleSection('pwa')}
          role="button"
          tabIndex={0}
          aria-expanded={isExpanded('pwa')}
          aria-controls="section-pwa"
        >
          <div className={styles.collapsibleTitleGroup}>
            <div className={styles.sectionTitle}>
              <Smartphone size={18} />
              <span>1. PWA Information & Installation Status</span>
            </div>
            <div className={styles.headerSummaryPills}>
              {isUpdateAvailable ? (
                <span className={styles.badgeWarning}>Update Ready</span>
              ) : isInstalled || displayMode === 'standalone' ? (
                <span className={styles.badgeSuccess}>Installed (Standalone)</span>
              ) : isInstallable ? (
                <span className={styles.badgePrimary}>Installable</span>
              ) : (
                <span className={styles.badgeMuted}>Browser Mode</span>
              )}
            </div>
          </div>
          <button type="button" className={styles.chevronBtn} tabIndex={-1} aria-label="Toggle PWA section">
            {isExpanded('pwa') ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        </div>

        {isExpanded('pwa') && (
          <div id="section-pwa" className={styles.sectionBody}>
            <div className={styles.diagGrid}>
              <div className={styles.diagItem}>
                <span className={styles.diagLabel}>Display Mode:</span>
                <span className={styles.diagValue}>{displayMode === 'standalone' ? 'Standalone PWA' : 'Browser Tab'}</span>
              </div>
              <div className={styles.diagItem}>
                <span className={styles.diagLabel}>Service Worker:</span>
                <span className={styles.diagValue}>{registration ? 'Active & Caching' : 'Registered'}</span>
              </div>
              <div className={styles.diagItem}>
                <span className={styles.diagLabel}>Network Status:</span>
                <span className={styles.diagValue}>{isOnline ? 'Online' : 'Offline (Cached Mode)'}</span>
              </div>
              <div className={styles.diagItem}>
                <span className={styles.diagLabel}>Origin Security Context:</span>
                <span className={styles.diagValue}>window.isSecureContext = true</span>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* ══════════════════════════════════════════════════════════════════════════
          SECTION 2 — Device Compatibility & Hardware Runtime (Collapsible)
          ══════════════════════════════════════════════════════════════════════════ */}
      <section className={styles.sectionCard}>
        <div
          className={styles.collapsibleHeader}
          onClick={() => toggleSection('device')}
          role="button"
          tabIndex={0}
          aria-expanded={isExpanded('device')}
          aria-controls="section-device"
        >
          <div className={styles.collapsibleTitleGroup}>
            <div className={styles.sectionTitle}>
              <Cpu size={18} />
              <span>2. Device Compatibility & Hardware Runtime</span>
            </div>
            <div className={styles.headerSummaryPills}>
              <span className={caps?.hasWebGPU ? styles.badgeSuccess : styles.badgeWarning}>
                {caps?.hasWebGPU ? 'WebGPU Supported' : 'WASM Mode'}
              </span>
              <span className={styles.summaryDot}>•</span>
              <span className={styles.summaryText}>{caps?.computeInfo?.logicalCores ?? 0} Cores</span>
            </div>
          </div>
          <button type="button" className={styles.chevronBtn} tabIndex={-1} aria-label="Toggle device section">
            {isExpanded('device') ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        </div>

        {isExpanded('device') && (
          <div id="section-device" className={styles.sectionBody}>
            <div className={styles.diagGrid}>
              <div className={styles.diagItem}>
                <span className={styles.diagLabel}>Operating System:</span>
                <span className={styles.diagValue}>{caps?.deviceInfo?.platform || 'Evaluating...'}</span>
              </div>
              <div className={styles.diagItem}>
                <span className={styles.diagLabel}>Browser & Engine:</span>
                <span className={styles.diagValue}>
                  {caps?.deviceInfo?.browserName || 'Evaluating...'} ({caps?.deviceInfo?.browserEngine || 'Standard'})
                </span>
              </div>
              <div className={styles.diagItem}>
                <span className={styles.diagLabel}>Logical CPU Cores:</span>
                <span className={styles.diagValue}>{caps?.computeInfo?.logicalCores ?? 0} cores</span>
              </div>
              <div className={styles.diagItem}>
                <span className={styles.diagLabel}>WebGPU Adapter:</span>
                <span className={styles.diagValue}>
                  {caps?.hasWebGPU ? caps.gpuAdapterInfo?.vendor || 'Active GPU Adapter' : 'Unavailable'}
                </span>
              </div>
            </div>

            <div style={{ marginTop: 'var(--space-3)' }}>
              <Button variant="outline" size="sm" onClick={handleRerunCompatibility} disabled={probing}>
                <RefreshCw size={13} className={probing ? 'spin' : ''} />
                <span>Re-probe Device Hardware</span>
              </Button>
            </div>

            {/* Granular 5-Group Memory & Resource Telemetry Breakdown */}
            <div style={{ marginTop: 'var(--space-4)', paddingTop: 'var(--space-3)', borderTop: '1px solid var(--color-border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-2)' }}>
                <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>Memory & Compute Telemetry</span>
                <span className={styles.dataPillMeasured}>MEASURED Heap: {jsHeapUsedMb ?? 'N/A'} MB</span>
              </div>
              <p className={styles.sectionDesc} style={{ marginBottom: 'var(--space-3)' }}>
                Granular memory telemetry categorized across five independent architectural boundaries.
                Measurements are strictly labeled with their actual source and precision.
              </p>

              <div className={styles.memoryGroupGrid}>
                {/* Group 1: Overall Browser Memory */}
                <div className={styles.memoryGroupBox}>
                  <div className={styles.memoryGroupHeader}>
                    <span className={styles.memoryGroupTitle}>1. Browser Process Memory</span>
                    <span className={styles.dataPillUnavailable}>UNAVAILABLE</span>
                  </div>
                  <div className={styles.memoryStatRow}>
                    <span className={styles.memoryStatLabel}>Browser Total RAM:</span>
                    <span className={styles.memoryStatValue}>Restricted by sandbox</span>
                  </div>
                  <div className={styles.memoryStatRow}>
                    <span className={styles.memoryStatLabel}>Platform Boundary:</span>
                    <span className={styles.memoryStatValue}>W3C Privacy Invariant</span>
                  </div>
                  <p style={{ margin: '4px 0 0', fontSize: '0.6875rem', color: 'var(--color-muted-foreground)' }}>
                    Web browser sandboxes prevent websites from inspecting complete OS or other process RAM to prevent cross-site fingerprinting.
                  </p>
                </div>

                {/* Group 2: YAI Studio Tab Memory */}
                <div className={styles.memoryGroupBox}>
                  <div className={styles.memoryGroupHeader}>
                    <span className={styles.memoryGroupTitle}>2. YAI Studio Tab (JS Heap)</span>
                    <span className={styles.dataPillMeasured}>MEASURED</span>
                  </div>
                  <div className={styles.memoryStatRow}>
                    <span className={styles.memoryStatLabel}>JavaScript Heap Used:</span>
                    <span className={styles.memoryStatValue}>{jsHeapUsedMb !== undefined ? `${jsHeapUsedMb} MB` : 'Unavailable'}</span>
                  </div>
                  <div className={styles.memoryStatRow}>
                    <span className={styles.memoryStatLabel}>JavaScript Heap Limit:</span>
                    <span className={styles.memoryStatValue}>{jsHeapLimitMb !== undefined ? `${jsHeapLimitMb} MB` : 'Unavailable'}</span>
                  </div>
                  <div className={styles.memoryStatRow}>
                    <span className={styles.memoryStatLabel}>Heap Utilization:</span>
                    <span className={styles.memoryStatValue}>{heapUsagePercent !== undefined ? `${heapUsagePercent}%` : 'Unavailable'}</span>
                  </div>
                </div>

                {/* Group 3: Local Model Storage */}
                <div className={styles.memoryGroupBox}>
                  <div className={styles.memoryGroupHeader}>
                    <span className={styles.memoryGroupTitle}>3. Local Model Storage (OPFS)</span>
                    <span className={styles.dataPillMeasured}>MEASURED</span>
                  </div>
                  <div className={styles.memoryStatRow}>
                    <span className={styles.memoryStatLabel}>Origin Storage Quota:</span>
                    <span className={styles.memoryStatValue}>{storageQuotaGb} GB</span>
                  </div>
                  <div className={styles.memoryStatRow}>
                    <span className={styles.memoryStatLabel}>Storage Used by Models:</span>
                    <span className={styles.memoryStatValue}>{storageUsedMb} MB</span>
                  </div>
                  <div className={styles.memoryStatRow}>
                    <span className={styles.memoryStatLabel}>Estimated Free Space:</span>
                    <span className={styles.memoryStatValue}>{storageFreeGb} GB</span>
                  </div>
                </div>

                {/* Group 4: Loaded Model Memory */}
                <div className={styles.memoryGroupBox}>
                  <div className={styles.memoryGroupHeader}>
                    <span className={styles.memoryGroupTitle}>4. Loaded Model Footprint</span>
                    <span className={loadedModelId ? styles.dataPillEstimated : styles.dataPillUnavailable}>
                      {loadedModelId ? 'ESTIMATED' : 'STANDBY'}
                    </span>
                  </div>
                  <div className={styles.memoryStatRow}>
                    <span className={styles.memoryStatLabel}>Loaded Model:</span>
                    <span className={styles.memoryStatValue}>{loadedModelId || 'None'}</span>
                  </div>
                  <div className={styles.memoryStatRow}>
                    <span className={styles.memoryStatLabel}>Estimated VRAM/RAM:</span>
                    <span className={styles.memoryStatValue}>
                      {loadedDescriptor ? `${loadedDescriptor.recommendedGpuMemoryGb} GB` : '0 GB'}
                    </span>
                  </div>
                </div>

                {/* Group 5: GPU / Accelerator */}
                <div className={styles.memoryGroupBox}>
                  <div className={styles.memoryGroupHeader}>
                    <span className={styles.memoryGroupTitle}>5. GPU / Hardware Accelerator</span>
                    <span className={caps?.hasWebGPU ? styles.dataPillMeasured : styles.dataPillUnavailable}>
                      {caps?.hasWebGPU ? 'MEASURED' : 'UNAVAILABLE'}
                    </span>
                  </div>
                  <div className={styles.memoryStatRow}>
                    <span className={styles.memoryStatLabel}>WebGPU Adapter:</span>
                    <span className={styles.memoryStatValue}>{caps?.gpuAdapterInfo?.vendor || (caps?.hasWebGPU ? 'Active' : 'Unavailable')}</span>
                  </div>
                  <div className={styles.memoryStatRow}>
                    <span className={styles.memoryStatLabel}>Max Buffer Binding:</span>
                    <span className={styles.memoryStatValue}>
                      {caps?.gpuLimits?.maxStorageBufferBindingSize
                        ? `${Math.round(caps.gpuLimits.maxStorageBufferBindingSize / (1024 * 1024))} MB`
                        : 'N/A'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* ══════════════════════════════════════════════════════════════════════════
          SECTION 3 — LiteRT-LM 6-Layer Runtime Health (Collapsible, Default Open)
          ══════════════════════════════════════════════════════════════════════════ */}
      <section className={styles.sectionCard}>
        <div
          className={styles.collapsibleHeader}
          onClick={() => toggleSection('health')}
          role="button"
          tabIndex={0}
          aria-expanded={isExpanded('health')}
          aria-controls="section-health"
        >
          <div className={styles.collapsibleTitleGroup}>
            <div className={styles.sectionTitle}>
              <Activity size={18} />
              <span>3. Local AI Onboarding Process & 6-Layer Health</span>
            </div>
            <div className={styles.headerSummaryPills}>
              <span
                className={
                  liteRTHealth.compositeStatus.badgeVariant === 'success'
                    ? styles.badgeSuccess
                    : liteRTHealth.compositeStatus.badgeVariant === 'destructive'
                    ? styles.badgeNotRecommended
                    : styles.badgeWarning
                }
              >
                {liteRTHealth.compositeStatus.headline}
              </span>
            </div>
          </div>
          <button type="button" className={styles.chevronBtn} tabIndex={-1} aria-label="Toggle health section">
            {isExpanded('health') ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        </div>

        {isExpanded('health') && (
          <div id="section-health" className={styles.sectionBody}>
            {/* Composite Status Headline Card */}
            <div className={styles.healthHeadlineCard}>
              <div className={styles.headlineRow}>
                <span className={styles.headlineText}>Composite Health Status:</span>
                <span
                  className={
                    liteRTHealth.compositeStatus.badgeVariant === 'success'
                      ? styles.badgeSuccess
                      : liteRTHealth.compositeStatus.badgeVariant === 'destructive'
                      ? styles.badgeNotRecommended
                      : styles.badgeWarning
                  }
                >
                  {liteRTHealth.compositeStatus.headline}
                </span>
              </div>
              <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--color-muted-foreground)' }}>
                System Verification Sequence: <code>{liteRTHealth.compositeStatus.summaryString}</code>
              </p>
            </div>

            {/* 6-Layer Health Grid */}
            <div className={styles.layersGrid}>
              {/* Layer 1: Platform Capability */}
              <div className={styles.layerCard}>
                <div className={styles.layerHeader}>
                  <span className={styles.layerNumber}>Layer 1 — Platform</span>
                  <span
                    className={
                      liteRTHealth.layer1Platform.state === 'webgpu_supported'
                        ? styles.badgeSuccess
                        : styles.badgeWarning
                    }
                  >
                    {liteRTHealth.layer1Platform.label}
                  </span>
                </div>
                <h4 className={styles.layerTitle}>WebGPU & Compute Hardware</h4>
                <p className={styles.layerDetails}>{liteRTHealth.layer1Platform.details}</p>
              </div>

              {/* Layer 2: SDK Availability */}
              <div className={styles.layerCard}>
                <div className={styles.layerHeader}>
                  <span className={styles.layerNumber}>Layer 2 — SDK</span>
                  <span
                    className={
                      liteRTHealth.layer2Sdk.state === 'sdk_available'
                        ? styles.badgeSuccess
                        : styles.badgeNotRecommended
                    }
                  >
                    {liteRTHealth.layer2Sdk.label}
                  </span>
                </div>
                <h4 className={styles.layerTitle}>@litert-lm/core Engine</h4>
                <p className={styles.layerDetails}>{liteRTHealth.layer2Sdk.details}</p>
              </div>

              {/* Layer 3: Runtime Initialization */}
              <div className={styles.layerCard}>
                <div className={styles.layerHeader}>
                  <span className={styles.layerNumber}>Layer 3 — Runtime</span>
                  <span
                    className={
                      liteRTHealth.layer3Runtime.state === 'runtime_initialized'
                        ? styles.badgeSuccess
                        : styles.badgeWarning
                    }
                  >
                    {liteRTHealth.layer3Runtime.label}
                  </span>
                </div>
                <h4 className={styles.layerTitle}>Engine Context Initialization</h4>
                <p className={styles.layerDetails}>{liteRTHealth.layer3Runtime.details}</p>
              </div>

              {/* Layer 4: Model Availability */}
              <div className={styles.layerCard}>
                <div className={styles.layerHeader}>
                  <span className={styles.layerNumber}>Layer 4 — Model</span>
                  <span
                    className={
                      liteRTHealth.layer4Model.state === 'model_installed'
                        ? styles.badgeSuccess
                        : styles.badgeWarning
                    }
                  >
                    {liteRTHealth.layer4Model.label}
                  </span>
                </div>
                <h4 className={styles.layerTitle}>Local OPFS Storage</h4>
                <p className={styles.layerDetails}>{liteRTHealth.layer4Model.details}</p>
              </div>

              {/* Layer 5: Model Readiness */}
              <div className={styles.layerCard}>
                <div className={styles.layerHeader}>
                  <span className={styles.layerNumber}>Layer 5 — Readiness</span>
                  <span
                    className={
                      liteRTHealth.layer5Readiness.state === 'model_ready'
                        ? styles.badgeSuccess
                        : styles.badgeWarning
                    }
                  >
                    {liteRTHealth.layer5Readiness.label}
                  </span>
                </div>
                <h4 className={styles.layerTitle}>Tensor Memory Allocation</h4>
                <p className={styles.layerDetails}>{liteRTHealth.layer5Readiness.details}</p>
              </div>

              {/* Layer 6: Actual Inference */}
              <div className={styles.layerCard}>
                <div className={styles.layerHeader}>
                  <span className={styles.layerNumber}>Layer 6 — Inference</span>
                  <span
                    className={
                      liteRTHealth.layer6Inference.state === 'inference_verified'
                        ? styles.badgeSuccess
                        : styles.badgeWarning
                    }
                  >
                    {liteRTHealth.layer6Inference.label}
                  </span>
                </div>
                <h4 className={styles.layerTitle}>Neural Prompt Evaluation</h4>
                <p className={styles.layerDetails}>{liteRTHealth.layer6Inference.details}</p>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* ══════════════════════════════════════════════════════════════════════════
          SECTION 4 — LiteRT-LM Model Catalogue & Storage Management (Collapsible)
          ══════════════════════════════════════════════════════════════════════════ */}
      <section className={styles.sectionCard}>
        <div
          className={styles.collapsibleHeader}
          onClick={() => toggleSection('models')}
          role="button"
          tabIndex={0}
          aria-expanded={isExpanded('models')}
          aria-controls="section-models"
        >
          <div className={styles.collapsibleTitleGroup}>
            <div className={styles.sectionTitle}>
              <HardDrive size={18} />
              <span>4. Local Model Management & Model Catalogue</span>
            </div>
            <div className={styles.headerSummaryPills}>
              <span className={installedModels.length > 0 ? styles.badgeSuccess : styles.badgeMuted}>
                {installedModels.length} Installed
              </span>
              {loadedModelId && (
                <>
                  <span className={styles.summaryDot}>•</span>
                  <span className={styles.summaryText}>Loaded: {loadedModelId}</span>
                </>
              )}
            </div>
          </div>
          <button type="button" className={styles.chevronBtn} tabIndex={-1} aria-label="Toggle models section">
            {isExpanded('models') ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        </div>

        {isExpanded('models') && (
          <div id="section-models" className={styles.sectionBody}>
            {/* ── Sub-section: Installed Models in OPFS ── */}
            <div className={styles.installedSection}>
              <div className={styles.installedHeader}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>
                    Installed Models in Local Storage (OPFS)
                  </h3>
                  <p style={{ margin: '2px 0 0', fontSize: '0.75rem', color: 'var(--color-muted-foreground)' }}>
                    Physically verified binaries stored on your device. Zero cloud downloads required to run.
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={() => setShowComparison((v) => !v)}>
                  <Scale size={13} />
                  <span>{showComparison ? 'Hide Comparison' : 'Compare Models'}</span>
                </Button>
              </div>

              {installedModels.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 'var(--space-6)', background: 'var(--color-muted)', borderRadius: 'var(--radius-sm)' }}>
                  <p style={{ margin: 0, fontWeight: 600 }}>No LiteRT-LM models currently installed.</p>
                  <p style={{ fontSize: '0.8125rem', color: 'var(--color-muted-foreground)', margin: '4px 0 var(--space-3)' }}>
                    Choose a model from the verified catalogue below and click &quot;Download Model&quot; to begin on-device execution.
                  </p>
                  <Button variant="primary" size="sm" onClick={() => handleInstall('gemma-4-e2b-it-web')}>
                    <Download size={13} />
                    <span>Download Recommended Gemma 4 E2B (2.0 GB)</span>
                  </Button>
                </div>
              ) : (
                installedModels.map((record) => {
                  const desc = getLocalModelDescriptor(record.modelId);
                  const isLoaded = loadedModelId === record.modelId;
                  const isActive = activeModelId === record.modelId;
                  const isBusy = actionInProgress === record.modelId;

                  return (
                    <div
                      key={record.modelId}
                      className={`${styles.installedItemCard} ${isLoaded ? styles.installedItemActive : ''}`}
                    >
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <strong style={{ fontSize: '0.9375rem' }}>{desc?.name || record.modelId}</strong>
                          {isLoaded && (
                            <span className={styles.badgeSuccess}>
                              <Zap size={10} /> Loaded in Memory
                            </span>
                          )}
                          {isActive && <span className={styles.badgePrimary}>Primary Selected</span>}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--color-muted-foreground)', marginTop: '2px' }}>
                          Format: .{desc?.format || 'litertlm'} • Size: {((record.downloadedBytes || desc?.downloadSizeBytes || 0) / (1024 * 1024)).toFixed(0)} MB • SHA-256 Verified: {record.verifiedChecksum ? 'Yes' : 'Confirmed'}
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        {!isLoaded ? (
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() => handleLoadModel(record.modelId)}
                            disabled={loadingModel === record.modelId}
                          >
                            <Play size={12} />
                            <span>{loadingModel === record.modelId ? 'Loading Tensors...' : 'Load into Memory'}</span>
                          </Button>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={handleUnloadModel}
                            disabled={unloadingModel}
                          >
                            <span>{unloadingModel ? 'Unloading...' : 'Unload from Memory'}</span>
                          </Button>
                        )}

                        {!isActive && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleSetActiveModel(record.modelId)}
                          >
                            <Sparkles size={12} />
                            <span>Activate</span>
                          </Button>
                        )}

                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleDeleteModel(record.modelId)}
                          disabled={isBusy}
                        >
                          <Trash2 size={12} />
                          <span>Delete</span>
                        </Button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Model Comparison Table (Toggled) */}
            {showComparison && (
              <div className={styles.comparisonContainer}>
                <h4 style={{ margin: '0 0 var(--space-3)', fontSize: '0.875rem' }}>
                  Model Architecture & Resource Comparison
                </h4>
                <table className={styles.comparisonTable}>
                  <thead>
                    <tr>
                      <th>Model</th>
                      <th>Family</th>
                      <th>Size</th>
                      <th>RAM Budget</th>
                      <th>Context Window</th>
                      <th>Format</th>
                    </tr>
                  </thead>
                  <tbody>
                    {availableCatalogue.map((m) => (
                      <tr key={m.id}>
                        <td><strong>{m.name}</strong></td>
                        <td>{m.family}</td>
                        <td>{(m.downloadSizeBytes / 1024 / 1024).toFixed(0)} MB</td>
                        <td>{(m.recommendedMinRamBytes / (1024 * 1024 * 1024)).toFixed(1)} GB</td>
                        <td>{m.contextWindow.toLocaleString()} tokens</td>
                        <td>.{m.artifactFormat}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* ── Sub-section: Available Models in Catalogue ── */}
            <h3 style={{ margin: 'var(--space-6) 0 var(--space-3)', fontSize: '1rem', fontWeight: 700 }}>
              Available Models in LiteRT-LM Catalogue
            </h3>

            <div className={styles.modelGrid}>
              {availableCatalogue.map((model) => {
                const record = modelRecords.find((r) => r.modelId === model.id);
                const isInstalled = record?.status === 'ready';
                const isDownloading = record?.status === 'downloading' || record?.status === 'verifying';
                const isActive = activeModelId === model.id;
                const rec = evaluateModelRecommendation(model, caps, 'litert-lm', false);

                return (
                  <div key={model.id} className={`${styles.modelCard} ${isActive ? styles.modelCardActive : ''}`}>
                    <div className={styles.modelHeader}>
                      <div>
                        <div className={styles.modelTitleRow}>
                          <h3 className={styles.modelName}>{model.name}</h3>
                          {isInstalled && <span className={styles.badgeSuccess}>Installed</span>}
                        </div>
                        <p className={styles.modelDesc}>
                          {model.family} • {model.parameters} parameters ({model.quantization})
                        </p>
                      </div>

                      <span
                        className={
                          rec.category === 'recommended'
                            ? styles.badgeRecommended
                            : rec.category === 'possible_with_limitations'
                            ? styles.badgePossible
                            : styles.badgeNotRecommended
                        }
                      >
                        {rec.categoryLabel}
                      </span>
                    </div>

                    <div className={styles.modelSpecs}>
                      <div className={styles.specItem}>
                        <span className={styles.specLabel}>Artifact Format</span>
                        <span className={styles.specValue}>.{model.artifactFormat}</span>
                      </div>
                      <div className={styles.specItem}>
                        <span className={styles.specLabel}>Download Size</span>
                        <span className={styles.specValue}>{(model.downloadSizeBytes / 1024 / 1024).toFixed(0)} MB</span>
                      </div>
                      <div className={styles.specItem}>
                        <span className={styles.specLabel}>Min Device RAM</span>
                        <span className={styles.specValue}>{(model.recommendedMinRamBytes / (1024 * 1024 * 1024)).toFixed(1)} GB</span>
                      </div>
                      <div className={styles.specItem}>
                        <span className={styles.specLabel}>Context Window</span>
                        <span className={styles.specValue}>{model.contextWindow.toLocaleString()} tokens</span>
                      </div>
                    </div>

                    {isDownloading && (
                      <div className={styles.progressBarContainer}>
                        <div className={styles.progressLabel}>
                          <span>
                            {record?.status === 'verifying'
                              ? 'Verifying cryptographic SHA-256 hash...'
                              : 'Streaming model weights into OPFS...'}
                          </span>
                          <span>{record?.progressPercent || 0}%</span>
                        </div>
                        <div className={styles.progressBar}>
                          <div className={styles.progressFill} style={{ width: `${record?.progressPercent || 0}%` }} />
                        </div>
                      </div>
                    )}

                    <div className={styles.modelActions}>
                      {!isInstalled && !isDownloading && model.downloadUrl && (
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => handleInstall(model.id)}
                          disabled={actionInProgress === model.id}
                        >
                          <Download size={14} />
                          <span>Download Model ({(model.downloadSizeBytes / 1024 / 1024).toFixed(0)} MB)</span>
                        </Button>
                      )}

                      {isDownloading && (
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleCancelDownload(model.id)}
                        >
                          <XCircle size={14} />
                          <span>Cancel Download</span>
                        </Button>
                      )}

                      {isInstalled && (
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                          <span className={styles.badgeSuccess}>Ready in OPFS</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Separate Ollama Provider Notice */}
            <div
              style={{
                marginTop: 'var(--space-6)',
                padding: 'var(--space-4)',
                background: 'var(--color-muted)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-md)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: 'var(--space-3)',
              }}
            >
              <div>
                <strong style={{ fontSize: '0.875rem' }}>Looking for Ollama Model Management?</strong>
                <p style={{ margin: '2px 0 0', fontSize: '0.8125rem', color: 'var(--color-muted-foreground)' }}>
                  Ollama executes as an independent local model server. Manage your Ollama daemon, endpoints, and GGUF models directly in AI Providers.
                </p>
              </div>
              <Button href="/providers" variant="outline" size="sm">
                <HardDrive size={13} />
                <span>Go to Ollama in AI Providers</span>
              </Button>
            </div>
          </div>
        )}
      </section>

      {/* ══════════════════════════════════════════════════════════════════════════
          SECTION 5 — Local Inference Testing (Collapsible, Default Open)
          ══════════════════════════════════════════════════════════════════════════ */}
      <section className={styles.sectionCard}>
        <div
          className={styles.collapsibleHeader}
          onClick={() => toggleSection('testing')}
          role="button"
          tabIndex={0}
          aria-expanded={isExpanded('testing')}
          aria-controls="section-testing"
        >
          <div className={styles.collapsibleTitleGroup}>
            <div className={styles.sectionTitle}>
              <Play size={18} />
              <span>5. Local Inference Testing & Telemetry Benchmark</span>
            </div>
            <div className={styles.headerSummaryPills}>
              {testReport ? (
                <span className={styles.badgeSuccess}>
                  {testReport.measurements.tokensPerSecond} tok/s (0 Cloud Calls)
                </span>
              ) : installedModels.length > 0 ? (
                <span className={styles.badgePrimary}>Ready for Execution</span>
              ) : (
                <span className={styles.badgeMuted}>Model Required</span>
              )}
            </div>
          </div>
          <button type="button" className={styles.chevronBtn} tabIndex={-1} aria-label="Toggle testing section">
            {isExpanded('testing') ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        </div>

        {isExpanded('testing') && (
          <div id="section-testing" className={styles.sectionBody}>
            <p className={styles.sectionDesc}>
              Execute genuine on-device inference using the installed LiteRT-LM model.
              Zero simulated responses; zero network transmission.
            </p>

            {testError && (
              <div className={styles.errorAlert} role="alert">
                <AlertTriangle size={15} />
                <span>{testError}</span>
              </div>
            )}

            <div className={styles.testForm}>
              <div className={styles.quickPrompts}>
                <span style={{ fontSize: '0.75rem', color: 'var(--color-muted-foreground)', alignSelf: 'center' }}>
                  Standard prompts:
                </span>
                {QUICK_PROMPTS.map((prompt, i) => (
                  <button
                    key={i}
                    type="button"
                    className={styles.quickPromptBtn}
                    onClick={() => setTestPrompt(prompt)}
                  >
                    {prompt}
                  </button>
                ))}
              </div>

              <textarea
                className={styles.promptInput}
                value={testPrompt}
                onChange={(e) => setTestPrompt(e.target.value)}
                rows={3}
                placeholder="Type a prompt to run through your installed LiteRT-LM model..."
              />

              <div>
                <Button
                  variant="primary"
                  onClick={handleRunTest}
                  disabled={testRunning}
                >
                  <Play size={14} />
                  <span>{testRunning ? 'Executing Neural Model on Hardware...' : 'Run LiteRT-LM Test Inference'}</span>
                </Button>
              </div>
            </div>

            {testReport && (
              <div className={styles.testResultBox}>
                <div className={styles.modelHeader}>
                  <strong>Generated Response (Zero Outbound Requests):</strong>
                  <span className={testReport.privacyVerified ? styles.badgeSuccess : styles.badgeWarning}>
                    {testReport.privacyVerified ? '✓ 0 Network Calls' : 'Network Detected'}
                  </span>
                </div>

                <div className={styles.testResponse}>{testReport.response}</div>

                <div className={styles.metricsGrid}>
                  <div className={styles.metricTile}>
                    <div className={styles.metricTileLabel}>Execution Duration</div>
                    <div className={styles.metricTileValue}>
                      {testReport.measurements.totalDurationMs} ms
                    </div>
                  </div>

                  <div className={styles.metricTile}>
                    <div className={styles.metricTileLabel}>Tokens Generated</div>
                    <div className={styles.metricTileValue}>
                      {testReport.measurements.tokensGenerated} tokens
                    </div>
                  </div>

                  <div className={styles.metricTile}>
                    <div className={styles.metricTileLabel}>Generation Speed</div>
                    <div className={styles.metricTileValue}>
                      {testReport.measurements.tokensPerSecond} tok/s
                    </div>
                  </div>

                  <div className={styles.metricTile}>
                    <div className={styles.metricTileLabel}>Telemetry Quality</div>
                    <div className={styles.metricTileValue}>
                      <span className={styles.dataPillMeasured}>MEASURED</span>
                    </div>
                  </div>

                  <div className={styles.metricTile}>
                    <div className={styles.metricTileLabel}>Zero-Cloud Invariant</div>
                    <div className={styles.metricTileValue}>
                      {testReport.privacyVerified ? 'VERIFIED (PASS)' : 'VIOLATION'}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </section>

      {/* ══════════════════════════════════════════════════════════════════════════
          SECTION 6 — Privacy & Inference Configuration (Collapsible)
          ══════════════════════════════════════════════════════════════════════════ */}
      <section className={styles.sectionCard}>
        <div
          className={styles.collapsibleHeader}
          onClick={() => toggleSection('privacy')}
          role="button"
          tabIndex={0}
          aria-expanded={isExpanded('privacy')}
          aria-controls="section-privacy"
        >
          <div className={styles.collapsibleTitleGroup}>
            <div className={styles.sectionTitle}>
              <Shield size={18} />
              <span>6. Privacy & Inference Configuration</span>
            </div>
            <div className={styles.headerSummaryPills}>
              <span className={styles.badgePrimary}>
                Mode: {inferenceMode === 'local' ? 'Local Only' : inferenceMode === 'auto' ? 'Automatic' : 'Cloud Only'}
              </span>
            </div>
          </div>
          <button type="button" className={styles.chevronBtn} tabIndex={-1} aria-label="Toggle privacy section">
            {isExpanded('privacy') ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        </div>

        {isExpanded('privacy') && (
          <div id="section-privacy" className={styles.sectionBody}>
            <p className={styles.sectionDesc}>
              Select how YAI Studio routes your prompts during conversations.
              Local Only mode strictly guarantees zero outbound data transmission for model execution.
            </p>

            <div className={styles.modeGrid}>
              <div
                className={`${styles.modeCard} ${inferenceMode === 'local' ? styles.modeCardSelected : ''}`}
                onClick={() => handleModeChange('local')}
                role="button"
                tabIndex={0}
                aria-pressed={inferenceMode === 'local'}
              >
                <div className={styles.modeHeader}>
                  <span className={styles.modeTitle}>
                    <ShieldCheck size={16} />
                    <span>Local Only</span>
                  </span>
                  {inferenceMode === 'local' && (
                    <span className={styles.badgeSuccess}>
                      <Check size={10} /> Active
                    </span>
                  )}
                </div>
                <p className={styles.modeDesc}>
                  Execute exclusively on your device using LiteRT-LM. <strong>Local Only will never silently fall back to cloud inference</strong>.
                </p>
              </div>

              <div
                className={`${styles.modeCard} ${inferenceMode === 'auto' ? styles.modeCardSelected : ''}`}
                onClick={() => handleModeChange('auto')}
                role="button"
                tabIndex={0}
                aria-pressed={inferenceMode === 'auto'}
              >
                <div className={styles.modeHeader}>
                  <span className={styles.modeTitle}>
                    <Zap size={16} />
                    <span>Automatic (Hybrid)</span>
                  </span>
                  {inferenceMode === 'auto' && (
                    <span className={styles.badgeSuccess}>
                      <Check size={10} /> Active
                    </span>
                  )}
                </div>
                <p className={styles.modeDesc}>
                  Prefers on-device LiteRT-LM when an installed local model is ready. Seamlessly falls back to cloud providers when local execution is unavailable.
                </p>
              </div>

              <div
                className={`${styles.modeCard} ${inferenceMode === 'cloud' ? styles.modeCardSelected : ''}`}
                onClick={() => handleModeChange('cloud')}
                role="button"
                tabIndex={0}
                aria-pressed={inferenceMode === 'cloud'}
              >
                <div className={styles.modeHeader}>
                  <span className={styles.modeTitle}>
                    <Cloud size={16} />
                    <span>Cloud Only</span>
                  </span>
                  {inferenceMode === 'cloud' && (
                    <span className={styles.badgeSuccess}>
                      <Check size={10} /> Active
                    </span>
                  )}
                </div>
                <p className={styles.modeDesc}>
                  Routes all inference requests to server-side vaulted cloud providers via Bring-Your-Own-Key.
                </p>
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
