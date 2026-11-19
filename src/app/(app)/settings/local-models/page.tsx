'use client';

import React, { useEffect, useState } from 'react';
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
} from 'lucide-react';
import Button from '@/components/ui/Button';
import { LOCAL_MODEL_CATALOG } from '@/lib/inference/local-model-registry';
import { LocalModelManager } from '@/lib/inference/model-manager';
import { detectDeviceCapabilities } from '@/lib/inference/device-capabilities';
import { runLiteRTPoc, type PocExecutionReport } from '@/lib/inference/litert-poc';
import type { DeviceCapabilityReport, InstalledModelRecord } from '@/lib/inference/types';
import styles from './LocalModels.module.css';

export default function LocalModelsPage() {
  const [caps, setCaps] = useState<DeviceCapabilityReport | null>(null);
  const [modelRecords, setModelRecords] = useState<InstalledModelRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);
  const [pocReport, setPocReport] = useState<PocExecutionReport | null>(null);
  const [pocRunning, setPocRunning] = useState(false);

  const refreshData = async () => {
    try {
      const detected = await detectDeviceCapabilities();
      setCaps(detected);
      const records = LocalModelManager.getModelRecords();
      setModelRecords(records);
    } catch (err) {
      console.warn('Failed to inspect device capabilities:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshData();
  }, []);

  const handleInstall = async (modelId: string) => {
    setActionInProgress(modelId);
    try {
      await LocalModelManager.installModel(modelId, (updated) => {
        setModelRecords((prev) =>
          prev.map((r) => (r.modelId === updated.modelId ? updated : r))
        );
      });
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Installation failed');
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
    } finally {
      setActionInProgress(null);
      refreshData();
    }
  };

  const handleRunPoc = async (modelId: string) => {
    setPocRunning(true);
    setPocReport(null);
    try {
      const report = await runLiteRTPoc({ modelId });
      setPocReport(report);
    } catch (err) {
      alert(`POC execution error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setPocRunning(false);
    }
  };

  return (
    <div className={styles.root}>
      {/* ── Header ── */}
      <div className={styles.header}>
        <Link href="/settings" className={styles.backLink}>
          <ArrowLeft size={14} />
          <span>Back to Settings</span>
        </Link>
        <h1 className={styles.title}>Local AI Models & LiteRT-LM</h1>
        <p className={styles.description}>
          Execute language models directly on your device using WebGPU and Google LiteRT-LM.
          Zero prompt data leaves your machine when local mode is selected.
        </p>
      </div>

      {/* ── Privacy Guarantee Banner ── */}
      <div className={styles.privacyBanner}>
        <ShieldCheck size={24} style={{ flexShrink: 0, color: 'var(--color-primary)' }} />
        <div>
          <strong>Strict Local Mode Privacy Guarantee</strong>
          <br />
          When running local models, prompt formatting, context retrieval, and token generation
          occur strictly on your hardware. If local inference cannot execute, YAI Studio reports
          the error explicitly — no silent cloud fallback ever occurs.
        </div>
      </div>

      {/* ── Hardware & Storage Capabilities Card ── */}
      <section className={styles.card}>
        <div className={styles.cardHeader}>
          <Cpu size={18} />
          <span>Device Hardware & WebGPU Runtime</span>
        </div>

        <div className={styles.gridTwoCol}>
          <div>
            <div className={styles.metricRow}>
              <span className={styles.metricLabel}>WebGPU Acceleration</span>
              <span className={styles.metricValue}>
                {caps?.hasWebGPU ? (
                  <span className={`${styles.badgePill} ${styles.badgeSuccess}`}>
                    <CheckCircle2 size={11} /> Supported
                  </span>
                ) : (
                  <span className={`${styles.badgePill} ${styles.badgeWarning}`}>
                    <AlertTriangle size={11} /> Unavailable
                  </span>
                )}
              </span>
            </div>

            <div className={styles.metricRow}>
              <span className={styles.metricLabel}>WebAssembly Runtime</span>
              <span className={styles.metricValue}>
                {caps?.hasWasm ? (
                  <span className={`${styles.badgePill} ${styles.badgeSuccess}`}>
                    <CheckCircle2 size={11} /> Active
                  </span>
                ) : (
                  <span className={`${styles.badgePill} ${styles.badgeWarning}`}>
                    <AlertTriangle size={11} /> Unsupported
                  </span>
                )}
              </span>
            </div>

            <div className={styles.metricRow}>
              <span className={styles.metricLabel}>Origin Private FS (OPFS)</span>
              <span className={styles.metricValue}>
                {caps?.hasOpfs ? (
                  <span className={`${styles.badgePill} ${styles.badgeSuccess}`}>
                    <CheckCircle2 size={11} /> Ready
                  </span>
                ) : (
                  <span className={`${styles.badgePill} ${styles.badgeWarning}`}>
                    <AlertTriangle size={11} /> Restricted
                  </span>
                )}
              </span>
            </div>
          </div>

          <div>
            <div className={styles.metricRow}>
              <span className={styles.metricLabel}>GPU Architecture</span>
              <span className={styles.metricValue}>
                {caps?.gpuAdapterInfo?.vendor
                  ? `${caps.gpuAdapterInfo.vendor} (${caps.gpuAdapterInfo.architecture || 'WebGPU'})`
                  : 'Default WebGPU Adapter'}
              </span>
            </div>

            <div className={styles.metricRow}>
              <span className={styles.metricLabel}>Available Disk Quota</span>
              <span className={styles.metricValue}>
                {caps ? `${(caps.storage.freeBytes / 1024 / 1024 / 1024).toFixed(2)} GB Free` : 'Probing...'}
              </span>
            </div>

            <div className={styles.storageBar}>
              <div
                className={styles.storageProgress}
                style={{ width: `${Math.min(100, caps?.storage.usagePercent || 0)}%` }}
              />
            </div>
          </div>
        </div>
      </section>

      {/* ── Local Model Catalog ── */}
      <section className={styles.card}>
        <div className={styles.cardHeader}>
          <HardDrive size={18} />
          <span>Vetted Local Model Catalog</span>
        </div>

        {LOCAL_MODEL_CATALOG.map((model) => {
          const record = modelRecords.find((r) => r.modelId === model.id);
          const isInstalled = record?.status === 'ready';
          const isDownloading = record?.status === 'downloading' || record?.status === 'verifying';

          return (
            <div key={model.id} className={styles.modelCard}>
              <div className={styles.modelHeader}>
                <div>
                  <h3 className={styles.modelTitle}>{model.name}</h3>
                  <p className={styles.modelDesc}>{model.description}</p>
                </div>
                <div>
                  {isInstalled ? (
                    <span className={`${styles.badgePill} ${styles.badgeSuccess}`}>
                      <CheckCircle2 size={11} /> Ready on Device
                    </span>
                  ) : isDownloading ? (
                    <span className={`${styles.badgePill} ${styles.badgeWarning}`}>
                      <RefreshCw size={11} /> {record?.status === 'verifying' ? 'Verifying SHA-256' : 'Downloading'}
                    </span>
                  ) : (
                    <span className={`${styles.badgePill} ${styles.badgeMuted}`}>
                      Not Installed
                    </span>
                  )}
                </div>
              </div>

              <div className={styles.modelMetaGrid}>
                <div>
                  <span className={styles.metaItemLabel}>Parameters: </span>
                  <span className={styles.metaItemValue}>{model.parameters}</span>
                </div>
                <div>
                  <span className={styles.metaItemLabel}>Quantization: </span>
                  <span className={styles.metaItemValue}>{model.quantization}</span>
                </div>
                <div>
                  <span className={styles.metaItemLabel}>Download Size: </span>
                  <span className={styles.metaItemValue}>
                    {(model.downloadSizeBytes / 1024 / 1024).toFixed(0)} MB
                  </span>
                </div>
                <div>
                  <span className={styles.metaItemLabel}>Format: </span>
                  <span className={styles.metaItemValue}>.{model.format}</span>
                </div>
                <div>
                  <span className={styles.metaItemLabel}>Context Window: </span>
                  <span className={styles.metaItemValue}>{model.contextLength} tokens</span>
                </div>
                <div>
                  <span className={styles.metaItemLabel}>VRAM Needed: </span>
                  <span className={styles.metaItemValue}>{model.recommendedGpuMemoryGb} GB</span>
                </div>
              </div>

              {isDownloading && (
                <div className={styles.progressBarContainer}>
                  <div className={styles.progressLabel}>
                    <span>
                      {record?.status === 'verifying'
                        ? 'Verifying cryptographic hash...'
                        : 'Streaming model weights...'}
                    </span>
                    <span>{record?.progressPercent}%</span>
                  </div>
                  <div className={styles.progressBar}>
                    <div
                      className={styles.progressFill}
                      style={{ width: `${record?.progressPercent}%` }}
                    />
                  </div>
                </div>
              )}

              <div className={styles.actionsRow}>
                {!isInstalled && !isDownloading && (
                  <Button
                    variant="primary"
                    onClick={() => handleInstall(model.id)}
                    disabled={actionInProgress === model.id}
                  >
                    <Download size={14} />
                    <span>Download Model ({(model.downloadSizeBytes / 1024 / 1024).toFixed(0)} MB)</span>
                  </Button>
                )}

                {isInstalled && (
                  <>
                    <Button
                      variant="primary"
                      onClick={() => handleRunPoc(model.id)}
                      disabled={pocRunning}
                    >
                      <Play size={14} />
                      <span>{pocRunning ? 'Evaluating...' : 'Run Local POC Test'}</span>
                    </Button>

                    <Button
                      variant="outline"
                      onClick={() => handleDelete(model.id)}
                      disabled={actionInProgress === model.id}
                    >
                      <Trash2 size={14} />
                      <span>Delete & Free Space</span>
                    </Button>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </section>

      {/* ── POC Verification Results Box ── */}
      {pocReport && (
        <section className={styles.card}>
          <div className={styles.cardHeader}>
            <ShieldCheck size={18} />
            <span>LiteRT-LM Technical Proof of Concept — Verification Report</span>
          </div>

          <div className={styles.pocResultsBox}>
            <div className={styles.metricRow}>
              <span className={styles.metricLabel}>Model Executed:</span>
              <span className={styles.metricValue}>{pocReport.modelId}</span>
            </div>
            <div className={styles.metricRow}>
              <span className={styles.metricLabel}>Zero Cloud Outbound Invariant:</span>
              <span className={styles.metricValue}>
                {pocReport.privacyVerified ? (
                  <span className={`${styles.badgePill} ${styles.badgeSuccess}`}>
                    ✓ PASS (0 outbound requests)
                  </span>
                ) : (
                  <span className={`${styles.badgePill} ${styles.badgeWarning}`}>
                    FAIL ({pocReport.outboundRequestsCount} outbound requests)
                  </span>
                )}
              </span>
            </div>
            <div className={styles.metricRow}>
              <span className={styles.metricLabel}>Total Execution Time:</span>
              <span className={styles.metricValue}>{pocReport.measurements.totalDurationMs} ms</span>
            </div>
            <div className={styles.metricRow}>
              <span className={styles.metricLabel}>Tokens Generated / Speed:</span>
              <span className={styles.metricValue}>
                {pocReport.measurements.tokensGenerated} tokens ({pocReport.measurements.tokensPerSecond} tokens/sec)
              </span>
            </div>

            <div style={{ marginTop: 8 }}>
              <strong>Generated Response:</strong>
              <div className={styles.pocOutput}>{pocReport.response}</div>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
