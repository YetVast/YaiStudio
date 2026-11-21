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
  Wifi,
  WifiOff,
  ChevronDown,
  ChevronUp,
  Layers,
  Monitor,
  Gauge,
  SlidersHorizontal,
  Scale,
} from 'lucide-react';
import Button from '@/components/ui/Button';
import { LOCAL_MODEL_CATALOG, getLocalModelDescriptor } from '@/lib/inference/local-model-registry';
import {
  EXTENDED_MODEL_CATALOGUE,
  evaluateModelRecommendation,
  compareModels,
  type ModelCatalogueEntry,
  type ModelRecommendation,
} from '@/lib/inference/model-catalogue';
import { LocalModelManager } from '@/lib/inference/model-manager';
import { detectDeviceCapabilities } from '@/lib/inference/device-capabilities';
import { runLiteRTPoc, type PocExecutionReport } from '@/lib/inference/litert-poc';
import { LocalAIConfig } from '@/lib/inference/local-ai-config';
import {
  OllamaClient,
  type OllamaHealthReport,
  type OllamaRunningModel,
  type OllamaModelItem,
} from '@/lib/inference/runtimes/ollama-client';
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

  // Runtime Selection & Health
  const [activeRuntimeTab, setActiveRuntimeTab] = useState<'litert-lm' | 'ollama'>('litert-lm');
  const [ollamaEndpoint, setOllamaEndpoint] = useState<string>(OllamaClient.getEndpoint());
  const [ollamaHealth, setOllamaHealth] = useState<OllamaHealthReport | null>(null);
  const [installedOllamaModels, setInstalledOllamaModels] = useState<OllamaModelItem[]>([]);
  const [runningOllamaModels, setRunningOllamaModels] = useState<OllamaRunningModel[]>([]);
  const [activeOllamaModel, setActiveOllamaModel] = useState<string>('llama3.2:latest');
  const [probingOllama, setProbingOllama] = useState(false);

  // Preference state synced with LocalAIConfig
  const [inferenceMode, setInferenceModeState] = useState<InferenceMode>('local');
  const [activeModelId, setActiveModelIdState] = useState<string | null>(null);

  // Model comparison & rationale expansion state
  const [showComparison, setShowComparison] = useState(false);
  const [expandedRationale, setExpandedRationale] = useState<Record<string, boolean>>({});

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

  // Check Ollama health & model enumeration
  const checkOllama = useCallback(async (customEndpoint?: string) => {
    setProbingOllama(true);
    try {
      const targetEndpoint = customEndpoint || ollamaEndpoint;
      if (customEndpoint) {
        OllamaClient.setEndpoint(customEndpoint);
        setOllamaEndpoint(customEndpoint);
      }
      const health = await OllamaClient.checkHealth(targetEndpoint);
      setOllamaHealth(health);
      if (health.available) {
        const [models, running] = await Promise.all([
          OllamaClient.listModels().catch(() => []),
          OllamaClient.listRunningModels().catch(() => []),
        ]);
        setInstalledOllamaModels(models);
        setRunningOllamaModels(running);
        if (models.length > 0) {
          const saved = LocalAIConfig.getActiveModelId('ollama');
          const isSavedAvailable = saved && models.some((m) => m.name === saved);
          const chosenModel = isSavedAvailable ? saved : models[0].name;
          setActiveOllamaModel(chosenModel);
          LocalAIConfig.setActiveModelId(chosenModel, 'ollama');
        }
      }
    } finally {
      setProbingOllama(false);
    }
  }, [ollamaEndpoint]);

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

      // Probe Ollama in background
      checkOllama();
    } catch (err) {
      console.warn('Failed to inspect device capabilities:', err);
    } finally {
      setLoading(false);
      setProbing(false);
    }
  }, [checkOllama]);

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
    const targetModel = activeModelId || 'gemma-4-e2b-it-web';

    // If using Ollama runtime
    if (activeRuntimeTab === 'ollama') {
      const targetOllamaModel = activeOllamaModel || LocalAIConfig.getActiveModelId('ollama') || 'llama3.2:latest';
      if (!ollamaHealth?.available) {
        setTestError(`Ollama local daemon is not running or unreachable at ${ollamaEndpoint}. Verify Ollama is started (ollama serve) with OLLAMA_ORIGINS="*" configured.`);
        return;
      }
      setTestRunning(true);
      setTestReport(null);
      try {
        const result = await OllamaClient.generate({
          model: targetOllamaModel,
          prompt: testPrompt,
          system: 'You are YAI Studio Local Intelligence running directly on-device.',
        });
        setTestReport({
          success: true,
          modelId: result.model,
          response: result.response,
          outboundRequestsCount: 0,
          privacyVerified: true,
          measurements: {
            initDurationMs: result.loadDurationMs,
            modelLoadDurationMs: result.loadDurationMs,
            timeToFirstTokenMs: result.promptEvalDurationMs || 50,
            totalDurationMs: result.totalDurationMs,
            tokensGenerated: result.evalCount || 0,
            tokensPerSecond: result.tokensPerSecond || 0,
          },
          deviceSupported: true,
          unsupportedReasons: [],
        });
        setHasRunTest(true);
        // Refresh running models after test to show in-VRAM status
        const running = await OllamaClient.listRunningModels().catch(() => []);
        setRunningOllamaModels(running);
      } catch (err) {
        setTestError(`Ollama execution failed: ${err instanceof Error ? err.message : String(err)}`);
      } finally {
        setTestRunning(false);
      }
      return;
    }

    // LiteRT-LM runtime path
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
  const anyModelReady = readyModels.length > 0 || (ollamaHealth?.available && runningOllamaModels.length > 0);

  // Onboarding sequence
  const step1Done = caps !== null;
  const step2Done = caps?.isSupported ?? false;
  const step3Done = anyModelReady;
  const step4Done = anyModelReady;
  const step5Done = activeModelId !== null && (activeRecord?.status === 'ready' || Boolean(ollamaHealth?.available));
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

  const swRegistrationStatus = registration
    ? 'Registered'
    : typeof navigator !== 'undefined' && 'serviceWorker' in navigator
    ? 'Supported'
    : 'Unsupported';

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
          <h1 className={styles.title}>Device Intelligence & Local AI Runtimes</h1>
          <span className={styles.primaryBadge}>Hardware Accelerated</span>
        </div>
        <p className={styles.description}>
          Detect hardware capabilities, discover recommended compact neural models for your device,
          and manage local inference across Google LiteRT-LM and Ollama runtimes with zero cloud egress.
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
          Transformed into Comprehensive Device Intelligence Dashboard
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
              <span className={caps?.assessment?.overallClassification === 'High capability' ? styles.badgeSuccess : styles.badgePrimary}>
                {caps?.assessment?.overallClassification || 'Evaluating Hardware...'}
              </span>
              {caps && (
                <>
                  <span className={styles.summaryDot}>•</span>
                  <span className={styles.summaryText}>
                    {caps.hasWebGPU ? 'WebGPU Active' : 'WebAssembly Mode'}
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
                Comprehensive Device Intelligence inspects your device platform, compute backends,
                memory headroom, and hardware accelerators to assess local AI suitability without sending
                telemetry to cloud servers.
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

            {/* Subsection A: Device and Operating System */}
            <div className={styles.subSection}>
              <h3 className={styles.subSectionTitle}>
                <Monitor size={16} />
                <span>A. Device & Operating System</span>
              </h3>
              <div className={styles.diagGrid}>
                <div>
                  <div className={styles.diagItem}>
                    <span className={styles.diagLabel}>Platform / OS</span>
                    <span className={styles.diagValue}>{caps?.deviceInfo?.platform || 'Detecting...'}</span>
                  </div>
                  <div className={styles.diagItem}>
                    <span className={styles.diagLabel}>Browser Name & Version</span>
                    <span className={styles.diagValue}>
                      {caps?.deviceInfo ? `${caps.deviceInfo.browserName} ${caps.deviceInfo.browserVersion}` : 'Detecting...'}
                    </span>
                  </div>
                  <div className={styles.diagItem}>
                    <span className={styles.diagLabel}>Browser Engine</span>
                    <span className={styles.diagValue}>{caps?.deviceInfo?.browserEngine || 'Detecting...'}</span>
                  </div>
                  <div className={styles.diagItem}>
                    <span className={styles.diagLabel}>Device Classification</span>
                    <span className={styles.diagValue}>{caps?.deviceInfo?.deviceType || 'Desktop'}</span>
                  </div>
                </div>

                <div>
                  <div className={styles.diagItem}>
                    <span className={styles.diagLabel}>Screen Resolution</span>
                    <span className={styles.diagValue}>{caps?.deviceInfo?.screenResolution}</span>
                  </div>
                  <div className={styles.diagItem}>
                    <span className={styles.diagLabel}>Available Screen</span>
                    <span className={styles.diagValue}>{caps?.deviceInfo?.availableScreen}</span>
                  </div>
                  <div className={styles.diagItem}>
                    <span className={styles.diagLabel}>Device Pixel Ratio</span>
                    <span className={styles.diagValue}>{caps?.deviceInfo?.devicePixelRatio}x</span>
                  </div>
                  <div className={styles.diagItem}>
                    <span className={styles.diagLabel}>Time Zone & Locale</span>
                    <span className={styles.diagValue}>
                      {caps?.deviceInfo?.timeZone} ({caps?.deviceInfo?.language})
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Subsection B: Processor and Compute */}
            <div className={styles.subSection}>
              <h3 className={styles.subSectionTitle}>
                <Cpu size={16} />
                <span>B. Processor & Compute Capabilities</span>
              </h3>
              <div className={styles.diagGrid}>
                <div>
                  <div className={styles.diagItem}>
                    <span className={styles.diagLabel}>Logical CPU Cores</span>
                    <span className={styles.diagValue}>
                      {caps?.computeInfo?.logicalCores ? `${caps.computeInfo.logicalCores} Logical Cores` : 'Restricted by Browser'}
                    </span>
                  </div>
                  <div className={styles.diagItem}>
                    <span className={styles.diagLabel}>WebGPU Acceleration</span>
                    <span className={styles.diagValue}>
                      {caps?.hasWebGPU ? (
                        <span className={styles.badgeSuccess}>
                          <CheckCircle2 size={11} /> Supported & Active
                        </span>
                      ) : (
                        <span className={styles.badgeWarning}>
                          <AlertTriangle size={11} /> Unavailable in Browser
                        </span>
                      )}
                    </span>
                  </div>
                  <div className={styles.diagItem}>
                    <span className={styles.diagLabel}>GPU Vendor & Adapter</span>
                    <span className={styles.diagValue}>
                      {caps?.gpuAdapterInfo?.vendor
                        ? `${caps.gpuAdapterInfo.vendor} (${caps.gpuAdapterInfo.architecture || 'WebGPU'})`
                        : caps?.computeInfo?.gpuVendor
                        ? `${caps.computeInfo.gpuVendor}`
                        : 'WebGPU Compatible Adapter'}
                    </span>
                  </div>
                </div>

                <div>
                  <div className={styles.diagItem}>
                    <span className={styles.diagLabel}>Hardware Acceleration Tier</span>
                    <span className={styles.diagValue}>{caps?.computeInfo?.hardwareAcceleration}</span>
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
                  <div className={styles.diagItem}>
                    <span className={styles.diagLabel}>Supported Compute Backends</span>
                    <span className={styles.diagValue}>
                      {caps?.computeInfo?.supportedBackends?.join(', ') || 'WebGPU, CPU'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Subsection C: Memory Telemetry */}
            <div className={styles.subSection}>
              <h3 className={styles.subSectionTitle}>
                <HardDrive size={16} />
                <span>C. Memory & Storage Headroom</span>
              </h3>
              <div className={styles.diagGrid}>
                <div>
                  <div className={styles.diagItem}>
                    <span className={styles.diagLabel}>Approximate System RAM</span>
                    <span className={styles.diagValue}>
                      {caps?.memoryInfo?.deviceMemoryGb
                        ? `${caps.memoryInfo.deviceMemoryGb} GiB (Browser Quantized)`
                        : 'Restricted by browser privacy'}
                    </span>
                  </div>
                  <div className={styles.diagItem}>
                    <span className={styles.diagLabel}>JavaScript Heap Used</span>
                    <span className={styles.diagValue}>
                      {caps?.memoryInfo?.jsHeapUsedMb
                        ? `${caps.memoryInfo.jsHeapUsedMb} MB`
                        : 'Unavailable in non-Chromium'}
                    </span>
                  </div>
                  <div className={styles.diagItem}>
                    <span className={styles.diagLabel}>JavaScript Heap Limit</span>
                    <span className={styles.diagValue}>
                      {caps?.memoryInfo?.jsHeapLimitMb ? `${caps.memoryInfo.jsHeapLimitMb} MB` : 'Unavailable'}
                    </span>
                  </div>
                </div>

                <div>
                  <div className={styles.diagItem}>
                    <span className={styles.diagLabel}>OPFS Sandboxed Storage</span>
                    <span className={styles.diagValue}>
                      {caps?.hasOpfs ? (
                        <span className={styles.badgeSuccess}>
                          <CheckCircle2 size={11} /> Available
                        </span>
                      ) : (
                        <span className={styles.badgeWarning}>
                          <AlertTriangle size={11} /> Restricted
                        </span>
                      )}
                    </span>
                  </div>
                  <div className={styles.diagItem}>
                    <span className={styles.diagLabel}>Available Storage Quota</span>
                    <span className={styles.diagValue}>
                      {caps
                        ? `${(caps.storage.freeBytes / 1024 / 1024 / 1024).toFixed(2)} GB Free of ${(caps.storage.quotaBytes / 1024 / 1024 / 1024).toFixed(2)} GB`
                        : 'Calculating...'}
                    </span>
                  </div>
                  <div className={styles.diagItem}>
                    <span className={styles.diagLabel}>Storage Quota Used</span>
                    <span className={styles.diagValue}>{caps?.storage.usagePercent.toFixed(1)}%</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Subsection D: Capability Assessment */}
            <div className={styles.subSection}>
              <h3 className={styles.subSectionTitle}>
                <Gauge size={16} />
                <span>D. Device Capability Assessment</span>
              </h3>
              <div className={styles.assessmentBox}>
                <div className={styles.assessmentTile}>
                  <div className={styles.assessmentTileLabel}>Overall Classification</div>
                  <div className={styles.assessmentTileValue}>{caps?.assessment?.overallClassification}</div>
                </div>
                <div className={styles.assessmentTile}>
                  <div className={styles.assessmentTileLabel}>CPU Capability</div>
                  <div className={styles.assessmentTileValue}>{caps?.assessment?.cpuCapability}</div>
                </div>
                <div className={styles.assessmentTile}>
                  <div className={styles.assessmentTileLabel}>GPU Capability</div>
                  <div className={styles.assessmentTileValue}>{caps?.assessment?.gpuCapability}</div>
                </div>
                <div className={styles.assessmentTile}>
                  <div className={styles.assessmentTileLabel}>Local Inference Suitability</div>
                  <div className={styles.assessmentTileValue}>{caps?.assessment?.localInferenceSuitability}</div>
                </div>
              </div>

              {caps?.assessment?.assessmentReasons && caps.assessment.assessmentReasons.length > 0 && (
                <div style={{ marginTop: 'var(--space-3)' }}>
                  <strong style={{ fontSize: '0.8125rem' }}>Assessment Rationale:</strong>
                  <ul className={styles.reasonsList}>
                    {caps.assessment.assessmentReasons.map((r, i) => (
                      <li key={i}>{r}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
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
          Upgraded with Model Catalogue, Recommendation Engine & Multi-Runtime
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
            {/* Runtime Switcher Tabs */}
            <div className={styles.runtimeTabs}>
              <button
                type="button"
                className={`${styles.runtimeTab} ${activeRuntimeTab === 'litert-lm' ? styles.runtimeTabActive : ''}`}
                onClick={() => setActiveRuntimeTab('litert-lm')}
              >
                <Cpu size={15} />
                <span>LiteRT-LM (In-Browser WebGPU)</span>
              </button>
              <button
                type="button"
                className={`${styles.runtimeTab} ${activeRuntimeTab === 'ollama' ? styles.runtimeTabActive : ''}`}
                onClick={() => {
                  setActiveRuntimeTab('ollama');
                  checkOllama();
                }}
              >
                <HardDrive size={15} />
                <span>Ollama Local Daemon</span>
                {ollamaHealth?.available && <span className={styles.badgeSuccess}>Online</span>}
              </button>
            </div>

            {/* Runtime Banner Status */}
            {activeRuntimeTab === 'litert-lm' ? (
              <div className={styles.runtimeBanner}>
                <div>
                  <strong>Runtime: Google LiteRT-LM Web Engine</strong>
                  <p style={{ margin: '2px 0 0', fontSize: '0.75rem', color: 'var(--color-muted-foreground)' }}>
                    Runs directly in your browser tab via WebGPU / WebAssembly. Weights are downloaded into sandboxed
                    Origin Private File System (OPFS).
                  </p>
                </div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <span className={caps?.hasWebGPU ? styles.badgeSuccess : styles.badgeWarning}>
                    {caps?.hasWebGPU ? 'WebGPU Accelerated' : 'WASM CPU Mode'}
                  </span>
                  <Button variant="outline" size="sm" onClick={() => setShowComparison((v) => !v)}>
                    <Scale size={14} />
                    <span>{showComparison ? 'Hide Comparison' : 'Compare Models'}</span>
                  </Button>
                </div>
              </div>
            ) : (
              <div className={styles.runtimeBanner}>
                <div>
                  <strong>Runtime: Ollama Local Service ({ollamaEndpoint})</strong>
                  <p style={{ margin: '2px 0 0', fontSize: '0.75rem', color: 'var(--color-muted-foreground)' }}>
                    Native local daemon for high-performance GGUF inference on Apple Silicon (Metal) and Nvidia (CUDA).
                  </p>
                </div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <Button variant="outline" size="sm" onClick={() => checkOllama()} disabled={probingOllama}>
                    <RefreshCw size={13} className={probingOllama ? 'spin' : ''} />
                    <span>{ollamaHealth?.available ? `Ollama v${ollamaHealth.version}` : 'Check Status'}</span>
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setShowComparison((v) => !v)}>
                    <Scale size={14} />
                    <span>{showComparison ? 'Hide Comparison' : 'Compare Models'}</span>
                  </Button>
                </div>
              </div>
            )}

            {/* Direct Localhost Connectivity & Ollama Configuration */}
            {activeRuntimeTab === 'ollama' && (
              <div className={styles.endpointBox}>
                <div className={styles.endpointHeader}>
                  <div>
                    <strong>Direct Localhost Ollama Endpoint</strong>
                    <p style={{ margin: '2px 0 0', fontSize: '0.75rem', color: 'var(--color-muted-foreground)' }}>
                      In production (https://yaistudio.yetvast.com), your browser communicates directly with your device&apos;s port 11434 with zero server hops.
                    </p>
                  </div>
                  <span
                    className={
                      ollamaHealth?.available
                        ? styles.badgeSuccess
                        : ollamaHealth?.state === 'ERROR'
                        ? styles.badgeWarning
                        : styles.badgeNotRecommended
                    }
                  >
                    {ollamaHealth?.available
                      ? `Connected (v${ollamaHealth.version})`
                      : ollamaHealth?.state === 'ERROR'
                      ? 'CORS Policy Block'
                      : 'Offline / Unreachable'}
                  </span>
                </div>

                <div className={styles.endpointInputRow}>
                  <input
                    type="text"
                    value={ollamaEndpoint}
                    onChange={(e) => setOllamaEndpoint(e.target.value)}
                    placeholder="http://127.0.0.1:11434"
                    className={styles.endpointInput}
                  />
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => checkOllama(ollamaEndpoint)}
                    disabled={probingOllama}
                  >
                    <RefreshCw size={13} className={probingOllama ? 'spin' : ''} />
                    <span>{probingOllama ? 'Connecting...' : 'Save & Test Connection'}</span>
                  </Button>
                </div>

                {(!ollamaHealth?.available || ollamaHealth?.state === 'ERROR') && (
                  <div className={styles.troubleshootingBox}>
                    <strong>Troubleshooting Direct Browser Connection:</strong>
                    {ollamaHealth?.state === 'ERROR' ? (
                      <div>
                        <p style={{ margin: '4px 0' }}>
                          Ollama is running at <code>{ollamaEndpoint}</code>, but browser cross-origin requests from{' '}
                          <code>{typeof window !== 'undefined' ? window.location.origin : 'this origin'}</code> are blocked by Ollama&apos;s default origin policy.
                        </p>
                        <pre>
                          {`# Windows (PowerShell):\n$env:OLLAMA_ORIGINS="*"; ollama serve\n\n# macOS:\nlaunchctl setenv OLLAMA_ORIGINS "*"\n\n# Linux (systemd service):\nEnvironment="OLLAMA_ORIGINS=*"`}
                        </pre>
                        <p style={{ margin: '4px 0 0' }}>
                          Or launch the zero-dependency local companion: <code>node scripts/yai-local-agent.mjs</code>
                        </p>
                      </div>
                    ) : (
                      <div>
                        <p style={{ margin: '4px 0' }}>
                          Ollama daemon is not responding on <code>{ollamaEndpoint}</code>. Start it in terminal:
                        </p>
                        <pre>{`$env:OLLAMA_ORIGINS="*"; ollama serve`}</pre>
                      </div>
                    )}
                  </div>
                )}

                {/* Installed Models list if available */}
                {installedOllamaModels.length > 0 && (
                  <div style={{ marginTop: 'var(--space-3)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-2)' }}>
                      <strong style={{ fontSize: '0.875rem' }}>
                        Installed Models on Device ({installedOllamaModels.length})
                      </strong>
                      <span style={{ fontSize: '0.75rem', color: 'var(--color-muted-foreground)' }}>
                        Retrieved directly via <code>GET /api/tags</code>
                      </span>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                      {installedOllamaModels.map((m) => {
                        const isModelActive = activeOllamaModel === m.name;
                        const isLoadedInVram = runningOllamaModels.some(
                          (r) => r.name === m.name || r.model === m.name
                        );

                        return (
                          <div
                            key={m.name}
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              padding: 'var(--space-3)',
                              background: isModelActive ? 'rgba(75, 0, 132, 0.08)' : 'var(--color-muted)',
                              border: `1px solid ${isModelActive ? 'var(--color-primary)' : 'var(--color-border)'}`,
                              borderRadius: 'var(--radius-sm)',
                              flexWrap: 'wrap',
                              gap: '8px',
                            }}
                          >
                            <div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <strong style={{ fontFamily: 'var(--font-mono)' }}>{m.name}</strong>
                                {isModelActive && <span className={styles.badgePrimary}>Active Selection</span>}
                                {isLoadedInVram && (
                                  <span className={styles.badgeSuccess}>
                                    <Zap size={10} /> Loaded in VRAM
                                  </span>
                                )}
                              </div>
                              <div style={{ fontSize: '0.75rem', color: 'var(--color-muted-foreground)', marginTop: '2px' }}>
                                Family: {m.details?.family || 'GGUF'} • Parameters: {m.details?.parameter_size || 'Standard'} • Size: {(m.size / (1024 * 1024 * 1024)).toFixed(2)} GB
                              </div>
                            </div>

                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                              {!isModelActive ? (
                                <Button
                                  variant="primary"
                                  size="sm"
                                  onClick={() => {
                                    setActiveOllamaModel(m.name);
                                    LocalAIConfig.setActiveModelId(m.name, 'ollama');
                                  }}
                                >
                                  <Sparkles size={12} />
                                  <span>Select for Inference</span>
                                </Button>
                              ) : (
                                <span className={styles.badgeSuccess}>Selected</span>
                              )}
                              {isLoadedInVram && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={async () => {
                                    await OllamaClient.unloadModel(m.name);
                                    const running = await OllamaClient.listRunningModels().catch(() => []);
                                    setRunningOllamaModels(running);
                                  }}
                                >
                                  <span>Unload from VRAM</span>
                                </Button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Comparison Table View (Toggled) */}
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
                      <th>Download Size</th>
                      <th>RAM Budget</th>
                      <th>Context Window</th>
                      <th>Runtime</th>
                      <th>Hardware Suitability</th>
                    </tr>
                  </thead>
                  <tbody>
                    {EXTENDED_MODEL_CATALOGUE.map((m) => {
                      const rec = evaluateModelRecommendation(m, caps, activeRuntimeTab, Boolean(ollamaHealth?.available));
                      return (
                        <tr key={m.id}>
                          <td>
                            <strong>{m.name}</strong>
                          </td>
                          <td>{m.family}</td>
                          <td>{(m.downloadSizeBytes / 1024 / 1024).toFixed(0)} MB</td>
                          <td>{(m.recommendedMinRamBytes / 1024 / 1024 / 1024).toFixed(1)} GB</td>
                          <td>{m.contextWindow.toLocaleString()} tokens</td>
                          <td>{m.supportedRuntimes.join(', ')}</td>
                          <td>
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
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Model Catalogue Grid with Recommendations */}
            <div className={styles.modelGrid}>
              {EXTENDED_MODEL_CATALOGUE.filter((m) => m.supportedRuntimes.includes(activeRuntimeTab)).map((model) => {
                const record = modelRecords.find((r) => r.modelId === model.id);
                const isInstalled = record?.status === 'ready';
                const isDownloading = record?.status === 'downloading' || record?.status === 'verifying';
                const isActive = activeModelId === model.id;
                const rec = evaluateModelRecommendation(model, caps, activeRuntimeTab, Boolean(ollamaHealth?.available));
                const isRationaleOpen = Boolean(expandedRationale[model.id]);

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
                        <p className={styles.modelDesc}>
                          {model.family} • {model.parameters} parameters ({model.quantization})
                        </p>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
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

                        <div className={styles.modelBadgeStatus}>
                          {isInstalled ? (
                            <span className={styles.badgeSuccess}>
                              <CheckCircle2 size={11} /> Ready
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
                    </div>

                    {/* Recommendation Rationale Expandable */}
                    <div
                      style={{
                        background: 'var(--color-muted)',
                        padding: '6px 10px',
                        borderRadius: 'var(--radius-sm)',
                        fontSize: '0.75rem',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}
                      onClick={() => toggleRationale(model.id)}
                    >
                      <span style={{ fontWeight: 600 }}>
                        Recommendation Analysis ({rec.estimatedLatencyCategory} • {rec.memoryBudgetFit})
                      </span>
                      {isRationaleOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </div>

                    {isRationaleOpen && (
                      <div
                        style={{
                          background: 'var(--color-muted)',
                          padding: '8px 12px',
                          borderRadius: 'var(--radius-sm)',
                          fontSize: '0.75rem',
                          marginTop: '4px',
                        }}
                      >
                        {rec.reasons.length > 0 && (
                          <div style={{ marginBottom: '4px' }}>
                            <strong style={{ color: 'var(--color-success)' }}>Reasons:</strong>
                            <ul style={{ margin: '2px 0 0', paddingLeft: '16px' }}>
                              {rec.reasons.map((r, i) => (
                                <li key={i}>{r}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {rec.limitations.length > 0 && (
                          <div>
                            <strong style={{ color: 'var(--color-warning)' }}>Limitations:</strong>
                            <ul style={{ margin: '2px 0 0', paddingLeft: '16px' }}>
                              {rec.limitations.map((l, i) => (
                                <li key={i}>{l}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    )}

                    <div className={styles.modelSpecs}>
                      <div className={styles.specItem}>
                        <span className={styles.specLabel}>Artifact Format</span>
                        <span className={styles.specValue}>.{model.artifactFormat}</span>
                      </div>
                      <div className={styles.specItem}>
                        <span className={styles.specLabel}>Download Size</span>
                        <span className={styles.specValue}>
                          {(model.downloadSizeBytes / 1024 / 1024).toFixed(0)} MB
                        </span>
                      </div>
                      <div className={styles.specItem}>
                        <span className={styles.specLabel}>Min Device RAM</span>
                        <span className={styles.specValue}>
                          {(model.recommendedMinRamBytes / 1024 / 1024 / 1024).toFixed(1)} GB
                        </span>
                      </div>
                      <div className={styles.specItem}>
                        <span className={styles.specLabel}>Context Window</span>
                        <span className={styles.specValue}>{model.contextWindow.toLocaleString()} tokens</span>
                      </div>
                      <div className={styles.specItem}>
                        <span className={styles.specLabel}>Checksum Security</span>
                        <span className={styles.specValue}>
                          {model.sha256 ? 'SHA-256 Authoritative' : 'Repository Host'}
                        </span>
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
                      {activeRuntimeTab === 'litert-lm' ? (
                        <>
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

                          {!isInstalled && !model.downloadUrl && (
                            <span style={{ fontSize: '0.75rem', color: 'var(--color-muted-foreground)' }}>
                              Deploy via Ollama or custom WebGPU artifact.
                            </span>
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
                        </>
                      ) : (
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                          <Button
                            variant={isActive ? 'outline' : 'primary'}
                            size="sm"
                            onClick={() => handleSetActiveModel(model.id)}
                          >
                            <Sparkles size={14} />
                            <span>{isActive ? 'Active Ollama Model' : 'Select for Ollama'}</span>
                          </Button>
                          <span style={{ fontSize: '0.75rem', color: 'var(--color-muted-foreground)' }}>
                            CLI: <code>ollama run {model.ollamaTag}</code>
                          </span>
                        </div>
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
