'use client';

import React, { useEffect, useState, useCallback, useId } from 'react';
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
  Wifi,
  WifiOff,
  ChevronDown,
  ChevronUp,
  Layers,
} from 'lucide-react';
import Button from '@/components/ui/Button';
import { LOCAL_MODEL_CATALOG, getLocalModelDescriptor } from '@/lib/inference/local-model-registry';
import { LocalModelManager } from '@/lib/inference/model-manager';
import { detectDeviceCapabilities } from '@/lib/inference/device-capabilities';
import { runLiteRTPoc, type PocExecutionReport } from '@/lib/inference/litert-poc';
import { LocalAIConfig } from '@/lib/inference/local-ai-config';
import { usePWA } from '@/lib/pwa/pwa-context';
import type {
  DeviceCapabilityReport,
  InstalledModelRecord,
  InferenceMode,
  LocalProviderStatus,
} from '@/lib/inference/types';
import styles from './YaiLocal.module.css';

const QUICK_PROMPTS = [
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

  // Inference test state
  const [testPrompt, setTestPrompt] = useState(QUICK_PROMPTS[0]);
  const [testRunning, setTestRunning] = useState(false);
  const [testReport, setTestReport] = useState<PocExecutionReport | null>(null);
  const [testError, setTestError] = useState<string | null>(null);
  const [hasRunTest, setHasRunTest] = useState(false);

  // PWA display mode state (detectable client-side)
  const [displayMode, setDisplayMode] = useState<'standalone' | 'browser'>('browser');

  // Collapsible section state: Section 1 expanded by default; sections toggle independently
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    pwa: true,
    device: false,
    onboarding: false,
    models: false,
    testing: false,
    privacy: false,
  });

  const toggleSection = (sectionId: string) => {
    setExpandedSections((prev) => ({
      ...prev,
      [sectionId]: !prev[sectionId],
    }));
  };

  const isExpanded = (id: string) => Boolean(expandedSections[id]);

  const openAndScrollToSection = (sectionId: string) => {
    setExpandedSections((prev) => ({
      ...prev,
      [sectionId]: true,
    }));
    if (typeof window !== 'undefined') {
      setTimeout(() => {
        const el = document.getElementById(`section-${sectionId}`);
        el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 50);
    }
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
    LocalAIConfig.setActiveModelId(modelId);
    setActiveModelIdState(modelId);
  };

  const handleInstall = async (modelId: string) => {
    setActionInProgress(modelId);
    try {
      await LocalModelManager.installModel(modelId, (updated) => {
        setModelRecords((prev) =>
          prev.map((r) => (r.modelId === updated.modelId ? updated : r))
        );
      });
      // Automatically make it active if no model is currently active
      if (!activeModelId) {
        LocalAIConfig.setActiveModelId(modelId);
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

  const handleDelete = async (modelId: string) => {
    if (!confirm('Are you sure you want to remove this local model and reclaim disk space?')) {
      return;
    }
    setActionInProgress(modelId);
    try {
      await LocalModelManager.deleteModel(modelId);
      if (activeModelId === modelId) {
        LocalAIConfig.setActiveModelId(null);
        setActiveModelIdState(null);
      }
    } finally {
      setActionInProgress(null);
      refreshData();
    }
  };

  const handleRunTest = async () => {
    setTestError(null);
    const targetModel = activeModelId || 'gemma-2-2b-it-int4';
    const isReady = modelRecords.find((r) => r.modelId === targetModel)?.status === 'ready';

    if (!isReady) {
      setTestError('No local model is downloaded and ready. Download a model in Section 4 before testing.');
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
    } catch (err) {
      setTestError(`Inference test execution error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setTestRunning(false);
    }
  };

  // Model metadata calculations
  const activeRecord = activeModelId
    ? modelRecords.find((r) => r.modelId === activeModelId)
    : null;
  const activeDescriptor = activeModelId ? getLocalModelDescriptor(activeModelId) : null;
  const readyModels = modelRecords.filter((r) => r.status === 'ready');
  const anyModelReady = readyModels.length > 0;

  // Onboarding 7-step sequence calculation
  const step1Done = caps !== null;
  const step2Done = caps?.isSupported ?? false;
  const step3Done = anyModelReady;
  const step4Done = anyModelReady;
  const step5Done = activeModelId !== null && activeRecord?.status === 'ready';
  const step6Done = hasRunTest;
  const step7Done = inferenceMode !== undefined;

  const completedStepsCount = [
    step1Done,
    step2Done,
    step3Done,
    step4Done,
    step5Done,
    step6Done,
    step7Done,
  ].filter(Boolean).length;

  const nextIncompleteStep = !step1Done
    ? 1
    : !step2Done
    ? 2
    : !step3Done
    ? 3
    : !step4Done
    ? 4
    : !step5Done
    ? 5
    : !step6Done
    ? 6
    : !step7Done
    ? 7
    : null;

  // Service worker registration status string
  const swRegistrationStatus = registration
    ? 'Registered'
    : typeof navigator !== 'undefined' && 'serviceWorker' in navigator
    ? 'Supported'
    : 'Unsupported';

  // Service worker activation status string
  const swActivationStatus = registration?.active
    ? 'Active'
    : registration?.waiting
    ? 'Waiting'
    : registration?.installing
    ? 'Installing'
    : typeof navigator !== 'undefined' && navigator.serviceWorker?.controller
    ? 'Active Controller'
    : 'Inactive';

  return (
    <div className={styles.root}>
      {/* ── Page Header & Navigation ── */}
      <div className={styles.header}>
        <Link href="/providers" className={styles.backLink}>
          <ArrowLeft size={14} />
          <span>Back to AI Providers</span>
        </Link>
        <div className={styles.titleRow}>
          <h1 className={styles.title}>Go Local with LiteRT-LM</h1>
          <span className={styles.primaryBadge}>Primary Provider</span>
        </div>
        <p className={styles.description}>
          Run high-performance language models directly on your hardware using WebGPU and Google
          LiteRT-LM. Inference queries, context retrieval, and generation remain entirely on your
          device without routing to cloud servers.
        </p>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════════
          SECTION 1 — PWA Information & Installation Status (Collapsible, Default Open)
          ══════════════════════════════════════════════════════════════════════════ */}
      <section className={styles.sectionCard}>
        <div
          className={styles.collapsibleHeader}
          onClick={() => toggleSection('pwa')}
          role="button"
          tabIndex={0}
          aria-expanded={isExpanded('pwa')}
          aria-controls="section-pwa"
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              toggleSection('pwa');
            }
          }}
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
              <span className={styles.summaryDot}>•</span>
              <span className={isOnline ? styles.badgeSuccess : styles.badgeWarning}>
                {isOnline ? 'Online' : 'Offline'}
              </span>
            </div>
          </div>
          <button
            type="button"
            className={styles.chevronBtn}
            aria-label={isExpanded('pwa') ? 'Collapse section' : 'Expand section'}
            tabIndex={-1}
          >
            {isExpanded('pwa') ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        </div>

        {isExpanded('pwa') && (
          <div id="section-pwa" className={styles.sectionBody}>
            <p className={styles.sectionDesc}>
              Progressive Web App (PWA) status enables reliable offline operation, service worker caching,
              and dedicated desktop window execution with zero external network dependencies for local inference.
            </p>

            {/* PWA State Grid */}
            <div className={styles.diagGrid}>
              <div>
                <div className={styles.diagItem}>
                  <span className={styles.diagLabel}>PWA Installation Availability</span>
                  <span className={styles.diagValue}>
                    {isInstallable ? (
                      <span className={styles.badgePrimary}>
                        <Download size={11} /> Installable
                      </span>
                    ) : isInstalled || displayMode === 'standalone' ? (
                      <span className={styles.badgeSuccess}>
                        <CheckCircle2 size={11} /> Already Installed
                      </span>
                    ) : (
                      <span className={styles.badgeMuted}>Unavailable in Browser</span>
                    )}
                  </span>
                </div>

                <div className={styles.diagItem}>
                  <span className={styles.diagLabel}>Application Installed State</span>
                  <span className={styles.diagValue}>
                    {isInstalled || displayMode === 'standalone' ? (
                      <span className={styles.badgeSuccess}>
                        <CheckCircle2 size={11} /> Installed
                      </span>
                    ) : (
                      <span className={styles.badgeMuted}>Not Installed</span>
                    )}
                  </span>
                </div>

                <div className={styles.diagItem}>
                  <span className={styles.diagLabel}>Current Display Mode</span>
                  <span className={styles.diagValue}>
                    {displayMode === 'standalone' ? (
                      <span className={styles.badgeSuccess}>Standalone Window</span>
                    ) : (
                      <span className={styles.badgeMuted}>Browser Tab</span>
                    )}
                  </span>
                </div>

                <div className={styles.diagItem}>
                  <span className={styles.diagLabel}>Application Update Availability</span>
                  <span className={styles.diagValue}>
                    {isUpdateAvailable ? (
                      <span className={styles.badgeWarning}>
                        <RefreshCw size={11} /> Update Available
                      </span>
                    ) : (
                      <span className={styles.badgeSuccess}>
                        <CheckCircle2 size={11} /> Up to Date
                      </span>
                    )}
                  </span>
                </div>
              </div>

              <div>
                <div className={styles.diagItem}>
                  <span className={styles.diagLabel}>Network Connectivity</span>
                  <span className={styles.diagValue}>
                    {isOnline ? (
                      <span className={styles.badgeSuccess}>
                        <Wifi size={11} /> Online
                      </span>
                    ) : (
                      <span className={styles.badgeWarning}>
                        <WifiOff size={11} /> Offline (Local-Only)
                      </span>
                    )}
                  </span>
                </div>

                <div className={styles.diagItem}>
                  <span className={styles.diagLabel}>Service Worker Registration</span>
                  <span className={styles.diagValue}>
                    {registration ? (
                      <span className={styles.badgeSuccess}>
                        <CheckCircle2 size={11} /> {swRegistrationStatus}
                      </span>
                    ) : (
                      <span className={styles.badgeMuted}>{swRegistrationStatus}</span>
                    )}
                  </span>
                </div>

                <div className={styles.diagItem}>
                  <span className={styles.diagLabel}>Service Worker Activation</span>
                  <span className={styles.diagValue}>
                    <span
                      className={
                        swActivationStatus === 'Active' || swActivationStatus === 'Active Controller'
                          ? styles.badgeSuccess
                          : styles.badgeWarning
                      }
                    >
                      {swActivationStatus}
                    </span>
                  </span>
                </div>

                <div className={styles.diagItem}>
                  <span className={styles.diagLabel}>Offline Local Inference</span>
                  <span className={styles.diagValue}>
                    <span className={styles.badgeSuccess}>
                      <ShieldCheck size={11} /> Independent of Cloud
                    </span>
                  </span>
                </div>
              </div>
            </div>

            {/* PWA Actions Banner */}
            <div className={styles.actionBanner}>
              {isInstallable && (
                <div className={styles.bannerRow}>
                  <div>
                    <strong>Install YAI Studio Application:</strong>
                    <p className={styles.bannerDesc}>
                      Install YAI Studio as an application on your operating system for faster access and a dedicated distraction-free window.
                    </p>
                  </div>
                  <Button variant="primary" size="sm" onClick={promptInstall}>
                    <Download size={14} />
                    <span>Install Application</span>
                  </Button>
                </div>
              )}

              {isUpdateAvailable && (
                <div className={styles.bannerRow}>
                  <div>
                    <strong>Application Update Ready:</strong>
                    <p className={styles.bannerDesc}>
                      A newer version of YAI Studio has been cached by the service worker. Apply now to update assets.
                    </p>
                  </div>
                  <Button variant="primary" size="sm" onClick={applyUpdate}>
                    <RefreshCw size={14} />
                    <span>Reload & Apply Update</span>
                  </Button>
                </div>
              )}

              {!isInstallable && !isUpdateAvailable && (
                <p className={styles.bannerNotice}>
                  {isInstalled || displayMode === 'standalone'
                    ? 'YAI Studio is running as an installed standalone application. Service worker caches are active and up to date.'
                    : 'YAI Studio is operating in standard browser mode. When available, browser installation prompts will appear here.'}
                </p>
              )}
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
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              toggleSection('device');
            }
          }}
        >
          <div className={styles.collapsibleTitleGroup}>
            <div className={styles.sectionTitle}>
              <Cpu size={18} />
              <span>2. Device Compatibility & Hardware Runtime</span>
            </div>
            <div className={styles.headerSummaryPills}>
              <span className={caps?.isSupported ? styles.badgeSuccess : styles.badgeWarning}>
                {caps?.isSupported ? 'WebGPU Supported' : 'Partially Supported'}
              </span>
              {caps && (
                <>
                  <span className={styles.summaryDot}>•</span>
                  <span className={styles.summaryText}>
                    {(caps.storage.freeBytes / 1024 / 1024 / 1024).toFixed(1)} GB Free
                  </span>
                </>
              )}
            </div>
          </div>
          <button
            type="button"
            className={styles.chevronBtn}
            aria-label={isExpanded('device') ? 'Collapse section' : 'Expand section'}
            tabIndex={-1}
          >
            {isExpanded('device') ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        </div>

        {isExpanded('device') && (
          <div id="section-device" className={styles.sectionBody}>
            <div className={styles.sectionSubHeader}>
              <p className={styles.sectionDesc}>
                LiteRT-LM requires browser support for WebGPU acceleration, WebAssembly SIMD instructions,
                and sandboxed Origin Private File System (OPFS) storage for caching model weights.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={handleRerunCompatibility}
                disabled={probing}
              >
                <RefreshCw size={14} className={probing ? 'spin' : ''} />
                <span>{probing ? 'Probing Hardware...' : 'Recheck Compatibility'}</span>
              </Button>
            </div>

            <div className={styles.diagGrid}>
              <div>
                <div className={styles.diagItem}>
                  <span className={styles.diagLabel}>Browser & Platform</span>
                  <span className={styles.diagValue}>
                    {typeof navigator !== 'undefined'
                      ? navigator.userAgent.includes('Chrome')
                        ? 'Chromium / V8 Engine'
                        : navigator.userAgent.includes('Firefox')
                        ? 'Firefox / Gecko'
                        : navigator.userAgent.includes('Safari')
                        ? 'Safari / WebKit'
                        : 'Modern Web Browser'
                      : 'Client Runtime'}
                  </span>
                </div>

                <div className={styles.diagItem}>
                  <span className={styles.diagLabel}>WebGPU Acceleration</span>
                  <span className={styles.diagValue}>
                    {caps?.hasWebGPU ? (
                      <span className={styles.badgeSuccess}>
                        <CheckCircle2 size={11} /> Supported
                      </span>
                    ) : (
                      <span className={styles.badgeWarning}>
                        <AlertTriangle size={11} /> Not Available
                      </span>
                    )}
                  </span>
                </div>

                <div className={styles.diagItem}>
                  <span className={styles.diagLabel}>WebGPU Adapter Status</span>
                  <span className={styles.diagValue}>
                    {caps?.gpuAdapterInfo?.vendor
                      ? `${caps.gpuAdapterInfo.vendor} (${caps.gpuAdapterInfo.architecture || 'WebGPU'})`
                      : caps?.hasWebGPU
                      ? 'WebGPU Compatible Adapter'
                      : 'No WebGPU Adapter Detected'}
                  </span>
                </div>

                <div className={styles.diagItem}>
                  <span className={styles.diagLabel}>WebAssembly SIMD Runtime</span>
                  <span className={styles.diagValue}>
                    {caps?.hasWasm ? (
                      <span className={styles.badgeSuccess}>
                        <CheckCircle2 size={11} /> Supported
                      </span>
                    ) : (
                      <span className={styles.badgeWarning}>
                        <AlertTriangle size={11} /> Unsupported
                      </span>
                    )}
                  </span>
                </div>
              </div>

              <div>
                <div className={styles.diagItem}>
                  <span className={styles.diagLabel}>Origin Private FS (OPFS)</span>
                  <span className={styles.diagValue}>
                    {caps?.hasOpfs ? (
                      <span className={styles.badgeSuccess}>
                        <CheckCircle2 size={11} /> Available
                      </span>
                    ) : (
                      <span className={styles.badgeWarning}>
                        <AlertTriangle size={11} /> Fallback to Cache
                      </span>
                    )}
                  </span>
                </div>

                <div className={styles.diagItem}>
                  <span className={styles.diagLabel}>IndexedDB Persistent Storage</span>
                  <span className={styles.diagValue}>
                    <span className={styles.badgeSuccess}>
                      <CheckCircle2 size={11} /> Ready
                    </span>
                  </span>
                </div>

                <div className={styles.diagItem}>
                  <span className={styles.diagLabel}>Available Browser Storage</span>
                  <span className={styles.diagValue}>
                    {caps
                      ? `${(caps.storage.freeBytes / 1024 / 1024 / 1024).toFixed(2)} GB Free of ${(caps.storage.quotaBytes / 1024 / 1024 / 1024).toFixed(2)} GB`
                      : 'Calculating...'}
                  </span>
                </div>

                <div className={styles.diagItem}>
                  <span className={styles.diagLabel}>LiteRT-LM Compatibility Assessment</span>
                  <span className={styles.diagValue}>
                    {caps?.isSupported ? (
                      <span className={styles.badgeSuccess}>Supported (WebGPU Accelerated)</span>
                    ) : caps?.hasWasm ? (
                      <span className={styles.badgeWarning}>Partially Supported (CPU Fallback)</span>
                    ) : (
                      <span className={styles.badgeWarning}>Unsupported</span>
                    )}
                  </span>
                </div>
              </div>
            </div>

            {caps && (
              <div className={styles.storageBarContainer}>
                <div className={styles.storageBarHeader}>
                  <span>Storage Quota Utilization</span>
                  <span>{caps.storage.usagePercent.toFixed(1)}% Used</span>
                </div>
                <div className={styles.storageBar}>
                  <div
                    className={styles.storageProgress}
                    style={{ width: `${Math.min(100, Math.max(5, caps.storage.usagePercent))}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        )}
      </section>

      {/* ══════════════════════════════════════════════════════════════════════════
          SECTION 3 — Local AI Onboarding (Collapsible)
          ══════════════════════════════════════════════════════════════════════════ */}
      <section className={styles.sectionCard}>
        <div
          className={styles.collapsibleHeader}
          onClick={() => toggleSection('onboarding')}
          role="button"
          tabIndex={0}
          aria-expanded={isExpanded('onboarding')}
          aria-controls="section-onboarding"
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              toggleSection('onboarding');
            }
          }}
        >
          <div className={styles.collapsibleTitleGroup}>
            <div className={styles.sectionTitle}>
              <Sliders size={18} />
              <span>3. Local AI Onboarding Process</span>
            </div>
            <div className={styles.headerSummaryPills}>
              <span className={completedStepsCount === 7 ? styles.badgeSuccess : styles.badgePrimary}>
                {completedStepsCount} of 7 Completed
              </span>
              {nextIncompleteStep !== null && (
                <>
                  <span className={styles.summaryDot}>•</span>
                  <span className={styles.summaryText}>Step {nextIncompleteStep} Next</span>
                </>
              )}
            </div>
          </div>
          <button
            type="button"
            className={styles.chevronBtn}
            aria-label={isExpanded('onboarding') ? 'Collapse section' : 'Expand section'}
            tabIndex={-1}
          >
            {isExpanded('onboarding') ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        </div>

        {isExpanded('onboarding') && (
          <div id="section-onboarding" className={styles.sectionBody}>
            <p className={styles.sectionDesc}>
              Follow the 7-step onboarding process below to verify your hardware, install local neural weights,
              benchmark execution performance, and configure your privacy mode.
            </p>

            <div className={styles.stepper}>
              {/* Step 1 */}
              <div className={styles.stepRow}>
                <span className={`${styles.stepNumber} ${step1Done ? styles.stepCompleted : styles.stepCurrent}`}>
                  {step1Done ? <Check size={12} /> : 1}
                </span>
                <div className={styles.stepInfo}>
                  <span className={styles.stepText}>1. Check Device Compatibility</span>
                  <span className={styles.stepSubtext}>Verify browser support for WebGPU, WebAssembly SIMD, and OPFS storage.</span>
                </div>
                <span className={styles.stepStatus}>{step1Done ? 'COMPLETED' : 'PENDING'}</span>
              </div>

              {/* Step 2 */}
              <div className={styles.stepRow}>
                <span className={`${styles.stepNumber} ${step2Done ? styles.stepCompleted : step1Done ? styles.stepCurrent : styles.stepPending}`}>
                  {step2Done ? <Check size={12} /> : 2}
                </span>
                <div className={styles.stepInfo}>
                  <span className={styles.stepText}>2. Select an Available Local Model</span>
                  <span className={styles.stepSubtext}>Browse the catalogue of vetted lightweight Gemma models optimized for WebGPU.</span>
                </div>
                <span className={styles.stepStatus}>{step2Done ? 'READY' : 'EVALUATING'}</span>
              </div>

              {/* Step 3 */}
              <div className={styles.stepRow}>
                <span className={`${styles.stepNumber} ${step3Done ? styles.stepCompleted : step2Done ? styles.stepCurrent : styles.stepPending}`}>
                  {step3Done ? <Check size={12} /> : 3}
                </span>
                <div className={styles.stepInfo}>
                  <span className={styles.stepText}>3. Download the Model</span>
                  <span className={styles.stepSubtext}>Stream model weights into the sandboxed browser Origin Private File System.</span>
                </div>
                <span className={styles.stepStatus}>{step3Done ? 'INSTALLED' : 'REQUIRED'}</span>
              </div>

              {/* Step 4 */}
              <div className={styles.stepRow}>
                <span className={`${styles.stepNumber} ${step4Done ? styles.stepCompleted : step3Done ? styles.stepCurrent : styles.stepPending}`}>
                  {step4Done ? <Check size={12} /> : 4}
                </span>
                <div className={styles.stepInfo}>
                  <span className={styles.stepText}>4. Verify Model Integrity</span>
                  <span className={styles.stepSubtext}>Cryptographic SHA-256 binary validation to prevent weight tampering.</span>
                </div>
                <span className={styles.stepStatus}>{step4Done ? 'VERIFIED' : 'PENDING'}</span>
              </div>

              {/* Step 5 */}
              <div className={styles.stepRow}>
                <span className={`${styles.stepNumber} ${step5Done ? styles.stepCompleted : step4Done ? styles.stepCurrent : styles.stepPending}`}>
                  {step5Done ? <Check size={12} /> : 5}
                </span>
                <div className={styles.stepInfo}>
                  <span className={styles.stepText}>5. Activate the Model</span>
                  <span className={styles.stepSubtext}>Designate the installed binary as the primary active local model.</span>
                </div>
                <span className={styles.stepStatus}>{step5Done ? 'ACTIVE' : 'READY TO ACTIVATE'}</span>
              </div>

              {/* Step 6 */}
              <div className={styles.stepRow}>
                <span className={`${styles.stepNumber} ${step6Done ? styles.stepCompleted : step5Done ? styles.stepCurrent : styles.stepPending}`}>
                  {step6Done ? <Check size={12} /> : 6}
                </span>
                <div className={styles.stepInfo}>
                  <span className={styles.stepText}>6. Run a Local Inference Test</span>
                  <span className={styles.stepSubtext}>Execute interactive benchmark measuring tokens/sec and zero network egress.</span>
                </div>
                <span className={styles.stepStatus}>{step6Done ? 'VERIFIED' : 'OPTIONAL'}</span>
              </div>

              {/* Step 7 */}
              <div className={styles.stepRow}>
                <span className={`${styles.stepNumber} ${step7Done ? styles.stepCompleted : styles.stepPending}`}>
                  <Check size={12} />
                </span>
                <div className={styles.stepInfo}>
                  <span className={styles.stepText}>7. Select the Desired Inference Mode</span>
                  <span className={styles.stepSubtext}>Choose between Local Only, Automatic (Hybrid), and Cloud Only.</span>
                </div>
                <span className={styles.stepStatus}>{inferenceMode.toUpperCase()} ACTIVE</span>
              </div>
            </div>

            {/* Quick Continue Action Button */}
            {nextIncompleteStep !== null && (
              <div className={styles.continueSetupCard}>
                <div className={styles.continueSetupText}>
                  <strong>Ready to continue onboarding?</strong>
                  <span>Next incomplete step: Step {nextIncompleteStep}</span>
                </div>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => {
                    if (nextIncompleteStep <= 5) openAndScrollToSection('models');
                    else if (nextIncompleteStep === 6) openAndScrollToSection('testing');
                    else openAndScrollToSection('privacy');
                  }}
                >
                  <span>
                    {nextIncompleteStep <= 5
                      ? 'Continue: Manage Models (Section 4)'
                      : nextIncompleteStep === 6
                      ? 'Continue: Test Inference (Section 5)'
                      : 'Continue: Configure Privacy (Section 6)'}
                  </span>
                </Button>
              </div>
            )}
          </div>
        )}
      </section>

      {/* ══════════════════════════════════════════════════════════════════════════
          SECTION 4 — Local Model Management (Collapsible)
          ══════════════════════════════════════════════════════════════════════════ */}
      <section className={styles.sectionCard}>
        <div
          className={styles.collapsibleHeader}
          onClick={() => toggleSection('models')}
          role="button"
          tabIndex={0}
          aria-expanded={isExpanded('models')}
          aria-controls="section-models"
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              toggleSection('models');
            }
          }}
        >
          <div className={styles.collapsibleTitleGroup}>
            <div className={styles.sectionTitle}>
              <HardDrive size={18} />
              <span>4. Local Model Management</span>
            </div>
            <div className={styles.headerSummaryPills}>
              <span className={anyModelReady ? styles.badgeSuccess : styles.badgeMuted}>
                {readyModels.length} Model{readyModels.length === 1 ? '' : 's'} Ready
              </span>
              {activeDescriptor && (
                <>
                  <span className={styles.summaryDot}>•</span>
                  <span className={styles.summaryText}>Active: {activeDescriptor.name}</span>
                </>
              )}
            </div>
          </div>
          <button
            type="button"
            className={styles.chevronBtn}
            aria-label={isExpanded('models') ? 'Collapse section' : 'Expand section'}
            tabIndex={-1}
          >
            {isExpanded('models') ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        </div>

        {isExpanded('models') && (
          <div id="section-models" className={styles.sectionBody}>
            <p className={styles.sectionDesc}>
              Available and installed on-device models. All downloads are user-initiated and cryptographically
              verified against SHA-256 checksums before local execution.
            </p>

            <div className={styles.modelGrid}>
              {LOCAL_MODEL_CATALOG.map((model) => {
                const record = modelRecords.find((r) => r.modelId === model.id);
                const isInstalled = record?.status === 'ready';
                const isDownloading = record?.status === 'downloading' || record?.status === 'verifying';
                const isActive = activeModelId === model.id;
                const storageConsumedMb = isInstalled ? (model.downloadSizeBytes / 1024 / 1024).toFixed(0) : '0';

                return (
                  <div
                    key={model.id}
                    className={`${styles.modelCard} ${isActive ? styles.modelCardActive : ''}`}
                  >
                    <div className={styles.modelHeader}>
                      <div>
                        <div className={styles.modelTitleRow}>
                          <h3 className={styles.modelName}>{model.name}</h3>
                          {isActive && <span className={styles.primaryBadge}>Active Local Model</span>}
                        </div>
                        <p className={styles.modelDesc}>{model.description}</p>
                      </div>

                      <div className={styles.modelBadgeStatus}>
                        {isInstalled ? (
                          <span className={styles.badgeSuccess}>
                            <CheckCircle2 size={11} /> Installed
                          </span>
                        ) : isDownloading ? (
                          <span className={styles.badgeWarning}>
                            <RefreshCw size={11} className="spin" />{' '}
                            {record?.status === 'verifying' ? 'Verifying SHA-256' : 'Downloading'}
                          </span>
                        ) : (
                          <span className={styles.badgeMuted}>Not Downloaded</span>
                        )}
                      </div>
                    </div>

                    <div className={styles.modelSpecs}>
                      <div className={styles.specItem}>
                        <span className={styles.specLabel}>Model Name</span>
                        <span className={styles.specValue}>{model.name}</span>
                      </div>
                      <div className={styles.specItem}>
                        <span className={styles.specLabel}>Format</span>
                        <span className={styles.specValue}>.{model.format}</span>
                      </div>
                      <div className={styles.specItem}>
                        <span className={styles.specLabel}>Quantization</span>
                        <span className={styles.specValue}>{model.quantization}</span>
                      </div>
                      <div className={styles.specItem}>
                        <span className={styles.specLabel}>Download Size</span>
                        <span className={styles.specValue}>
                          {(model.downloadSizeBytes / 1024 / 1024).toFixed(0)} MB
                        </span>
                      </div>
                      <div className={styles.specItem}>
                        <span className={styles.specLabel}>Verification</span>
                        <span className={styles.specValue}>
                          {isInstalled ? 'SHA-256 Verified' : 'Cryptographic Hash'}
                        </span>
                      </div>
                      <div className={styles.specItem}>
                        <span className={styles.specLabel}>Storage Consumed</span>
                        <span className={styles.specValue}>{storageConsumedMb} MB</span>
                      </div>
                      <div className={styles.specItem}>
                        <span className={styles.specLabel}>Activation Status</span>
                        <span className={styles.specValue}>
                          {isActive ? 'Active' : isInstalled ? 'Ready to Activate' : 'Inactive'}
                        </span>
                      </div>
                    </div>

                    {isDownloading && (
                      <div className={styles.progressBarContainer}>
                        <div className={styles.progressLabel}>
                          <span>
                            {record?.status === 'verifying'
                              ? 'Verifying cryptographic SHA-256 hash...'
                              : 'Streaming model weights via chunked pipeline...'}
                          </span>
                          <span>{record?.progressPercent || 0}%</span>
                        </div>
                        <div className={styles.progressBar}>
                          <div
                            className={styles.progressFill}
                            style={{ width: `${record?.progressPercent || 0}%` }}
                          />
                        </div>
                      </div>
                    )}

                    <div className={styles.modelActions}>
                      {!isInstalled && !isDownloading && (
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
                        <>
                          {!isActive && (
                            <Button
                              variant="primary"
                              size="sm"
                              onClick={() => handleSetActiveModel(model.id)}
                            >
                              <Sparkles size={14} />
                              <span>Activate Model</span>
                            </Button>
                          )}

                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleDelete(model.id)}
                            disabled={actionInProgress === model.id}
                          >
                            <Trash2 size={14} />
                            <span>Delete Model</span>
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </section>

      {/* ══════════════════════════════════════════════════════════════════════════
          SECTION 5 — Local Inference Testing (Collapsible)
          ══════════════════════════════════════════════════════════════════════════ */}
      <section className={styles.sectionCard}>
        <div
          className={styles.collapsibleHeader}
          onClick={() => toggleSection('testing')}
          role="button"
          tabIndex={0}
          aria-expanded={isExpanded('testing')}
          aria-controls="section-testing"
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              toggleSection('testing');
            }
          }}
        >
          <div className={styles.collapsibleTitleGroup}>
            <div className={styles.sectionTitle}>
              <Play size={18} />
              <span>5. Local Inference Testing</span>
            </div>
            <div className={styles.headerSummaryPills}>
              {testReport ? (
                <span className={styles.badgeSuccess}>
                  {testReport.measurements.tokensPerSecond} tok/s (0 Cloud Calls)
                </span>
              ) : anyModelReady ? (
                <span className={styles.badgePrimary}>Ready for Benchmark</span>
              ) : (
                <span className={styles.badgeMuted}>Requires Local Model</span>
              )}
            </div>
          </div>
          <button
            type="button"
            className={styles.chevronBtn}
            aria-label={isExpanded('testing') ? 'Collapse section' : 'Expand section'}
            tabIndex={-1}
          >
            {isExpanded('testing') ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        </div>

        {isExpanded('testing') && (
          <div id="section-testing" className={styles.sectionBody}>
            <p className={styles.sectionDesc}>
              Test on-device model execution with live latency and generation performance metrics,
              verifying the zero-outbound-network invariant during generation.
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
                  Sample prompts:
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
                placeholder="Type a prompt to run through your local model..."
              />

              <div>
                <Button
                  variant="primary"
                  onClick={handleRunTest}
                  disabled={testRunning}
                >
                  <Play size={14} />
                  <span>{testRunning ? 'Executing on Hardware...' : 'Run Local Test Inference'}</span>
                </Button>
              </div>
            </div>

            {testReport && (
              <div className={styles.testResultBox}>
                <div className={styles.modelHeader}>
                  <strong>Generated Response (Zero Outbound Requests):</strong>
                  <span
                    className={testReport.privacyVerified ? styles.badgeSuccess : styles.badgeWarning}
                  >
                    {testReport.privacyVerified ? '✓ 0 Network Calls' : 'Network Detected'}
                  </span>
                </div>

                <div className={styles.testResponse}>{testReport.response}</div>

                <div className={styles.metricsGrid}>
                  <div className={styles.metricTile}>
                    <div className={styles.metricTileLabel}>Model Load Time</div>
                    <div className={styles.metricTileValue}>
                      {testReport.measurements.modelLoadDurationMs} ms
                    </div>
                  </div>

                  <div className={styles.metricTile}>
                    <div className={styles.metricTileLabel}>Time to First Token</div>
                    <div className={styles.metricTileValue}>
                      {testReport.measurements.timeToFirstTokenMs} ms
                    </div>
                  </div>

                  <div className={styles.metricTile}>
                    <div className={styles.metricTileLabel}>Total Duration</div>
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
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              toggleSection('privacy');
            }
          }}
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
          <button
            type="button"
            className={styles.chevronBtn}
            aria-label={isExpanded('privacy') ? 'Collapse section' : 'Expand section'}
            tabIndex={-1}
          >
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
              {/* Mode 1: Local Only */}
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
                  If no local model is available or the device cannot run inference, the request is refused rather than risking cloud egress.
                </p>
              </div>

              {/* Mode 2: Automatic */}
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
                  Prefers on-device LiteRT-LM when a compatible local model is ready. Seamlessly falls back to your configured
                  cloud provider (OpenRouter or Google AI Studio) when local inference is unavailable or constrained.
                </p>
              </div>

              {/* Mode 3: Cloud Only */}
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
                  Recommended for advanced frontier models with larger parameter sizes.
                </p>
              </div>
            </div>

            {/* Privacy Callout */}
            <div className={styles.privacyCallout}>
              <Shield size={20} style={{ flexShrink: 0, color: 'var(--color-primary)' }} />
              <div>
                <strong>Inference Privacy vs. Data Storage Distinction:</strong>
                <br />
                In Local Mode, model prompt tokens and generated text never leave your machine during
                inference. However, persistent conversation storage synchronizes with your personal
                private GitHub repository (<code>YVSApps_Data_YaiStudio</code>) when online, under your
                exclusive authorization. Local inference does not make application authentication, GitHub
                synchronization, or the entire application network-independent.
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
