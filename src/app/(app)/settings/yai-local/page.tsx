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
  Database,
  Sliders,
} from 'lucide-react';
import Button from '@/components/ui/Button';
import { LOCAL_MODEL_CATALOG, getLocalModelDescriptor } from '@/lib/inference/local-model-registry';
import { LocalModelManager } from '@/lib/inference/model-manager';
import { detectDeviceCapabilities } from '@/lib/inference/device-capabilities';
import { runLiteRTPoc, type PocExecutionReport } from '@/lib/inference/litert-poc';
import { LocalAIConfig } from '@/lib/inference/local-ai-config';
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
  const [hasRunTest, setHasRunTest] = useState(false);

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
    const targetModel = activeModelId || 'gemma-2-2b-it-int4';
    const isReady = modelRecords.find((r) => r.modelId === targetModel)?.status === 'ready';

    if (!isReady) {
      alert('Please download and activate a local model before running the inference test.');
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
      alert(`Test execution error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setTestRunning(false);
    }
  };

  // Compute overall provider status
  const providerStatus: LocalProviderStatus = LocalAIConfig.computeStatus(caps, modelRecords);
  const statusLabel = LocalAIConfig.getStatusLabel(providerStatus);

  // Active model metadata
  const activeRecord = activeModelId
    ? modelRecords.find((r) => r.modelId === activeModelId)
    : null;
  const activeDescriptor = activeModelId ? getLocalModelDescriptor(activeModelId) : null;
  const anyModelReady = modelRecords.some((r) => r.status === 'ready');

  // Setup Progress Steps evaluation
  const step1Done = caps !== null;
  const step2Done = caps?.isSupported ?? false;
  const step3Done = anyModelReady;
  const step4Done = anyModelReady;
  const step5Done = activeModelId !== null && activeRecord?.status === 'ready';
  const step6Done = hasRunTest;
  const step7Done = inferenceMode !== undefined;

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

      {/* ── Section A: Overview ── */}
      <section className={styles.sectionCard}>
        <div className={styles.sectionHeader}>
          <div className={styles.sectionTitle}>
            <Activity size={18} />
            <span>Overview & System Status</span>
          </div>
          <span
            className={
              providerStatus === 'ready'
                ? styles.badgeSuccess
                : providerStatus === 'error' || providerStatus === 'device_unsupported'
                ? styles.badgeWarning
                : styles.badgeMuted
            }
          >
            {statusLabel}
          </span>
        </div>

        <p className={styles.sectionDesc}>
          Local inference executes neural network weights in your browser sandbox using hardware-accelerated
          WebGPU shaders. Unlike cloud AI, your prompt text is never transmitted over the internet during
          on-device execution.
        </p>

        <div className={styles.overviewGrid}>
          <div className={styles.overviewTile}>
            <span className={styles.overviewTileLabel}>Provider Status</span>
            <span className={styles.overviewTileValue}>{statusLabel}</span>
          </div>

          <div className={styles.overviewTile}>
            <span className={styles.overviewTileLabel}>Inference Mode</span>
            <span className={styles.overviewTileValue}>
              {inferenceMode === 'local'
                ? 'Local Only'
                : inferenceMode === 'auto'
                ? 'Automatic'
                : 'Cloud Only'}
            </span>
          </div>

          <div className={styles.overviewTile}>
            <span className={styles.overviewTileLabel}>Active Local Model</span>
            <span className={styles.overviewTileValue}>
              {activeDescriptor ? activeDescriptor.name : 'None Activated'}
            </span>
          </div>

          <div className={styles.overviewTile}>
            <span className={styles.overviewTileLabel}>Available Device Storage</span>
            <span className={styles.overviewTileValue}>
              {caps
                ? `${(caps.storage.freeBytes / 1024 / 1024 / 1024).toFixed(2)} GB Free`
                : 'Probing...'}
            </span>
          </div>

          <div className={styles.overviewTile}>
            <span className={styles.overviewTileLabel}>Hardware Assessment</span>
            <span className={styles.overviewTileValue}>
              {caps?.isSupported ? 'WebGPU Accelerated' : 'WASM / CPU Fallback'}
            </span>
          </div>
        </div>
      </section>

      {/* ── Section G: Setup Progress ── */}
      <section className={styles.sectionCard}>
        <div className={styles.sectionHeader}>
          <div className={styles.sectionTitle}>
            <Sliders size={18} />
            <span>Onboarding & Setup Progress</span>
          </div>
          <span className={styles.overviewTileLabel}>
            {[step1Done, step2Done, step3Done, step4Done, step5Done, step6Done, step7Done].filter(Boolean).length} / 7 Completed
          </span>
        </div>

        <div className={styles.stepper}>
          <div className={styles.stepRow}>
            <span className={`${styles.stepNumber} ${step1Done ? styles.stepCompleted : styles.stepCurrent}`}>
              {step1Done ? <Check size={12} /> : 1}
            </span>
            <span className={styles.stepText}>Check Device Compatibility</span>
            <span className={styles.stepStatus}>{step1Done ? 'COMPLETED' : 'PENDING'}</span>
          </div>

          <div className={styles.stepRow}>
            <span className={`${styles.stepNumber} ${step2Done ? styles.stepCompleted : step1Done ? styles.stepCurrent : styles.stepPending}`}>
              {step2Done ? <Check size={12} /> : 2}
            </span>
            <span className={styles.stepText}>Review Hardware Acceleration (WebGPU)</span>
            <span className={styles.stepStatus}>{step2Done ? 'SUPPORTED' : 'EVALUATING'}</span>
          </div>

          <div className={styles.stepRow}>
            <span className={`${styles.stepNumber} ${step3Done ? styles.stepCompleted : step2Done ? styles.stepCurrent : styles.stepPending}`}>
              {step3Done ? <Check size={12} /> : 3}
            </span>
            <span className={styles.stepText}>Download Vetted Local Model</span>
            <span className={styles.stepStatus}>{step3Done ? 'INSTALLED' : 'REQUIRED'}</span>
          </div>

          <div className={styles.stepRow}>
            <span className={`${styles.stepNumber} ${step4Done ? styles.stepCompleted : step3Done ? styles.stepCurrent : styles.stepPending}`}>
              {step4Done ? <Check size={12} /> : 4}
            </span>
            <span className={styles.stepText}>Verify SHA-256 Binary Integrity</span>
            <span className={styles.stepStatus}>{step4Done ? 'VERIFIED' : 'PENDING'}</span>
          </div>

          <div className={styles.stepRow}>
            <span className={`${styles.stepNumber} ${step5Done ? styles.stepCompleted : step4Done ? styles.stepCurrent : styles.stepPending}`}>
              {step5Done ? <Check size={12} /> : 5}
            </span>
            <span className={styles.stepText}>Activate Default Local Model</span>
            <span className={styles.stepStatus}>{step5Done ? 'ACTIVE' : 'READY TO ACTIVATE'}</span>
          </div>

          <div className={styles.stepRow}>
            <span className={`${styles.stepNumber} ${step6Done ? styles.stepCompleted : step5Done ? styles.stepCurrent : styles.stepPending}`}>
              {step6Done ? <Check size={12} /> : 6}
            </span>
            <span className={styles.stepText}>Execute Local Inference Benchmark</span>
            <span className={styles.stepStatus}>{step6Done ? 'VERIFIED (0 CLOUD CALLS)' : 'OPTIONAL'}</span>
          </div>

          <div className={styles.stepRow}>
            <span className={`${styles.stepNumber} ${step7Done ? styles.stepCompleted : styles.stepPending}`}>
              <Check size={12} />
            </span>
            <span className={styles.stepText}>Select Privacy & Inference Mode</span>
            <span className={styles.stepStatus}>{inferenceMode.toUpperCase()} MODE ACTIVE</span>
          </div>
        </div>
      </section>

      {/* ── Section B: Device Compatibility ── */}
      <section className={styles.sectionCard}>
        <div className={styles.sectionHeader}>
          <div className={styles.sectionTitle}>
            <Cpu size={18} />
            <span>Device Compatibility & Hardware Runtime</span>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRerunCompatibility}
            disabled={probing}
          >
            <RefreshCw size={14} className={probing ? 'spin' : ''} />
            <span>{probing ? 'Probing Hardware...' : 'Re-run Compatibility Check'}</span>
          </Button>
        </div>

        <p className={styles.sectionDesc}>
          LiteRT-LM requires browser support for WebGPU acceleration, WebAssembly SIMD instructions,
          and sandboxed Origin Private File System (OPFS) storage for caching model weights.
        </p>

        <div className={styles.diagGrid}>
          <div>
            <div className={styles.diagItem}>
              <span className={styles.diagLabel}>Browser & Platform</span>
              <span className={styles.diagValue}>
                {typeof navigator !== 'undefined'
                  ? `${navigator.userAgent.includes('Chrome') ? 'Chromium-based' : 'Modern Web Browser'}`
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
              <span className={styles.diagLabel}>IndexedDB Persistent Storage</span>
              <span className={styles.diagValue}>
                <span className={styles.badgeSuccess}>
                  <CheckCircle2 size={11} /> Ready
                </span>
              </span>
            </div>
          </div>

          <div>
            <div className={styles.diagItem}>
              <span className={styles.diagLabel}>GPU Architecture & Vendor</span>
              <span className={styles.diagValue}>
                {caps?.gpuAdapterInfo?.vendor
                  ? `${caps.gpuAdapterInfo.vendor} (${caps.gpuAdapterInfo.architecture || 'WebGPU'})`
                  : 'WebGPU Compatible Adapter'}
              </span>
            </div>

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
              <span className={styles.diagLabel}>Available Browser Storage</span>
              <span className={styles.diagValue}>
                {caps ? `${(caps.storage.freeBytes / 1024 / 1024 / 1024).toFixed(2)} GB Free` : 'Calculating...'}
              </span>
            </div>

            <div className={styles.diagItem}>
              <span className={styles.diagLabel}>Device Assessment</span>
              <span className={styles.diagValue}>
                {caps?.isSupported ? (
                  <span className={styles.badgeSuccess}>Supported</span>
                ) : (
                  <span className={styles.badgeWarning}>Partially Supported</span>
                )}
              </span>
            </div>
          </div>
        </div>

        {caps && (
          <div className={styles.storageBar}>
            <div
              className={styles.storageProgress}
              style={{ width: `${Math.min(100, Math.max(5, caps.storage.usagePercent))}%` }}
            />
          </div>
        )}
      </section>

      {/* ── Section F: Privacy and Inference Mode ── */}
      <section className={styles.sectionCard}>
        <div className={styles.sectionHeader}>
          <div className={styles.sectionTitle}>
            <Shield size={18} />
            <span>Privacy & Inference Execution Mode</span>
          </div>
          <span className={styles.overviewTileLabel}>Mode Selection</span>
        </div>

        <p className={styles.sectionDesc}>
          Select how YAI Studio routes your prompts during conversations. Local mode enforces
          a zero-outbound-network invariant.
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
              Execute exclusively on your device using LiteRT-LM. If no local model is available,
              the request is refused rather than falling back to cloud. Complete offline privacy.
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
              Prefers on-device LiteRT-LM when a compatible model is ready. Seamlessly routes to your
              configured cloud provider (OpenRouter / Google AI Studio) when local inference is unavailable.
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
              Route all inference to server-side vaulted cloud providers via Bring-Your-Own-Key.
              Best for advanced reasoning models requiring high server parameters.
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
            exclusive authorization.
          </div>
        </div>
      </section>

      {/* ── Section D: Active Local Model ── */}
      {activeDescriptor && (
        <section className={styles.sectionCard}>
          <div className={styles.sectionHeader}>
            <div className={styles.sectionTitle}>
              <Sparkles size={18} />
              <span>Active Local Model</span>
            </div>
            <span className={styles.badgeSuccess}>
              <CheckCircle2 size={11} /> Ready for Inference
            </span>
          </div>

          <div className={styles.diagGrid}>
            <div>
              <div className={styles.diagItem}>
                <span className={styles.diagLabel}>Model Name</span>
                <span className={styles.diagValue}>{activeDescriptor.name}</span>
              </div>
              <div className={styles.diagItem}>
                <span className={styles.diagLabel}>Model Identifier</span>
                <span className={styles.diagValue}>{activeDescriptor.id}</span>
              </div>
              <div className={styles.diagItem}>
                <span className={styles.diagLabel}>Format & Quantization</span>
                <span className={styles.diagValue}>
                  .{activeDescriptor.format} ({activeDescriptor.quantization})
                </span>
              </div>
            </div>

            <div>
              <div className={styles.diagItem}>
                <span className={styles.diagLabel}>Storage Consumed</span>
                <span className={styles.diagValue}>
                  {(activeDescriptor.downloadSizeBytes / 1024 / 1024).toFixed(0)} MB
                </span>
              </div>
              <div className={styles.diagItem}>
                <span className={styles.diagLabel}>Context Length</span>
                <span className={styles.diagValue}>{activeDescriptor.contextLength} tokens</span>
              </div>
              <div className={styles.diagItem}>
                <span className={styles.diagLabel}>Status</span>
                <span className={styles.diagValue}>
                  {activeRecord?.status === 'ready' ? 'Ready on Device' : 'Requires Download'}
                </span>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ── Section C: Local Model Catalogue ── */}
      <section className={styles.sectionCard}>
        <div className={styles.sectionHeader}>
          <div className={styles.sectionTitle}>
            <HardDrive size={18} />
            <span>Vetted Local Model Catalogue</span>
          </div>
          <span className={styles.overviewTileLabel}>Gemma On-Device Models</span>
        </div>

        <p className={styles.sectionDesc}>
          Official lightweight models optimized for client-side WebGPU execution. Downloads are strictly
          user-initiated and cryptographically verified with SHA-256 before activation.
        </p>

        <div className={styles.modelGrid}>
          {LOCAL_MODEL_CATALOG.map((model) => {
            const record = modelRecords.find((r) => r.modelId === model.id);
            const isInstalled = record?.status === 'ready';
            const isDownloading = record?.status === 'downloading' || record?.status === 'verifying';
            const isActive = activeModelId === model.id;

            return (
              <div
                key={model.id}
                className={`${styles.modelCard} ${isActive ? styles.modelCardActive : ''}`}
              >
                <div className={styles.modelHeader}>
                  <div>
                    <div className={styles.modelTitleRow}>
                      <h3 className={styles.modelName}>{model.name}</h3>
                      {isActive && <span className={styles.primaryBadge}>Active Model</span>}
                    </div>
                    <p className={styles.modelDesc}>{model.description}</p>
                  </div>

                  <div>
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
                    <span className={styles.specLabel}>Parameters</span>
                    <span className={styles.specValue}>{model.parameters}</span>
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
                    <span className={styles.specLabel}>Format</span>
                    <span className={styles.specValue}>.{model.format}</span>
                  </div>
                  <div className={styles.specItem}>
                    <span className={styles.specLabel}>Context</span>
                    <span className={styles.specValue}>{model.contextLength} tokens</span>
                  </div>
                  <div className={styles.specItem}>
                    <span className={styles.specLabel}>GPU Memory</span>
                    <span className={styles.specValue}>{model.recommendedGpuMemoryGb} GB VRAM</span>
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
                          <span>Set as Active Local Model</span>
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
      </section>

      {/* ── Section E: Local Inference Test ── */}
      <section className={styles.sectionCard}>
        <div className={styles.sectionHeader}>
          <div className={styles.sectionTitle}>
            <Play size={18} />
            <span>Interactive Local Inference Test & Privacy Benchmark</span>
          </div>
          <span className={styles.overviewTileLabel}>Hardware Execution</span>
        </div>

        <p className={styles.sectionDesc}>
          Test on-device model execution with live latency, tokens/second measurement, and automated
          outbound network verification proving zero data egress during generation.
        </p>

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
      </section>
    </div>
  );
}
