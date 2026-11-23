'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertOctagon,
  X,
  RotateCcw,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  FileText,
  Clock,
  Terminal,
  RefreshCw,
  CheckCircle2,
  Wrench,
  Compass,
  Activity,
  ExternalLink,
} from 'lucide-react';
import Button from '@/components/ui/Button';
import { useErrorNotification } from '@/components/providers/ErrorNotificationProvider';
import styles from './ErrorModal.module.css';

function getResolutionStatusClass(status?: string) {
  switch (status) {
    case 'READY_TO_RETRY':
      return styles.statusReadyToRetry;
    case 'RESOLVED':
      return styles.statusResolved;
    case 'MANUAL_FIX_REQUIRED':
      return styles.statusManualFix;
    case 'ACTION_REQUIRED':
    case 'WAITING_FOR_USER':
    case 'AUTOMATIC_FIX_AVAILABLE':
    case 'UNRESOLVED':
    default:
      return styles.statusActionRequired;
  }
}

export default function ErrorModal() {
  const {
    activeErrorModal,
    closeErrorModal,
    retryError,
    isRetrying,
    executeDiagnosticAction,
    isDiagnosing,
  } = useErrorNotification();
  const router = useRouter();

  const [copiedDetails, setCopiedDetails] = useState(false);
  const [copiedLogs, setCopiedLogs] = useState(false);
  const [copiedInstructions, setCopiedInstructions] = useState(false);
  const [showStackTrace, setShowStackTrace] = useState(false);
  const [logsExpanded, setLogsExpanded] = useState(true);

  // Close on Escape Key
  useEffect(() => {
    if (!activeErrorModal) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isRetrying) {
        closeErrorModal();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeErrorModal, isRetrying, closeErrorModal]);

  if (!activeErrorModal) return null;

  const isResolved = Boolean(activeErrorModal.resolvedAt) || activeErrorModal.retry.status === 'SUCCEEDED';
  const retryAvailable = activeErrorModal.retry.available && !isResolved;

  const handleCopyDetails = async () => {
    try {
      const summary = {
        id: activeErrorModal.id,
        title: activeErrorModal.title,
        message: activeErrorModal.message,
        category: activeErrorModal.category,
        source: activeErrorModal.source,
        details: activeErrorModal.details,
        retry: activeErrorModal.retry,
        occurredAt: activeErrorModal.occurredAt,
        resolvedAt: activeErrorModal.resolvedAt,
      };
      await navigator.clipboard.writeText(JSON.stringify(summary, null, 2));
      setCopiedDetails(true);
      setTimeout(() => setCopiedDetails(false), 2000);
    } catch (err) {
      console.warn('Failed to copy error details:', err);
    }
  };

  const handleCopyLogs = async () => {
    try {
      const logLines = activeErrorModal.logs.map(
        (l) => `[${l.timestamp}] [${l.level.toUpperCase()}] [${l.source}]: ${l.message}`
      );
      await navigator.clipboard.writeText(logLines.join('\n'));
      setCopiedLogs(true);
      setTimeout(() => setCopiedLogs(false), 2000);
    } catch (err) {
      console.warn('Failed to copy logs:', err);
    }
  };

  const handleCopyInstructions = async () => {
    if (!activeErrorModal?.resolution) return;
    try {
      const { summary, probableCauses, instructions } = activeErrorModal.resolution;
      const text = [
        `[Troubleshooting Guide] ${activeErrorModal.title}`,
        '',
        'What happened:',
        summary,
        '',
        'Probable Causes:',
        ...probableCauses.map(
          (c) =>
            `- [${c.confidence}] ${c.description}${
              c.evidence?.length ? ` (Evidence: ${c.evidence.join('; ')})` : ''
            }`
        ),
        '',
        'Recommended Solution:',
        ...instructions.map((i) => `${i.step}. ${i.title}: ${i.description}`),
      ].join('\n');

      await navigator.clipboard.writeText(text);
      setCopiedInstructions(true);
      setTimeout(() => setCopiedInstructions(false), 2000);
    } catch (err) {
      console.warn('Failed to copy instructions:', err);
    }
  };

  const handleRetry = async () => {
    if (!retryAvailable || isRetrying) return;
    await retryError(activeErrorModal.id);
  };

  return (
    <div
      className={styles.overlay}
      onClick={() => !isRetrying && closeErrorModal()}
      role="dialog"
      aria-modal="true"
      aria-labelledby="error-modal-title"
    >
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        {/* ─── A. Error Header ───────────────────────────────── */}
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <div className={styles.iconWrapper}>
              {isResolved ? (
                <CheckCircle2 size={20} style={{ color: 'var(--color-success)' }} />
              ) : (
                <AlertOctagon size={20} />
              )}
            </div>

            <div className={styles.titleArea}>
              <div className={styles.titleRow}>
                <h3 id="error-modal-title" className={styles.title}>
                  {activeErrorModal.title}
                </h3>
                <span className={styles.categoryBadge}>{activeErrorModal.category}</span>
              </div>

              <div className={styles.metaRow}>
                <span>
                  <strong>Module:</strong> {activeErrorModal.source.module}
                  {activeErrorModal.source.operation ? ` (${activeErrorModal.source.operation})` : ''}
                </span>
                <span>•</span>
                <span>
                  <Clock size={11} style={{ display: 'inline', marginRight: 3, verticalAlign: -1 }} />
                  {new Date(activeErrorModal.occurredAt).toLocaleTimeString()}
                </span>
              </div>
            </div>
          </div>

          <button
            type="button"
            className={styles.closeBtn}
            onClick={closeErrorModal}
            disabled={isRetrying}
            aria-label="Close error modal"
          >
            <X size={18} />
          </button>
        </div>

        {/* ─── Scrollable Modal Body ─────────────────────────── */}
        <div className={styles.body}>
          {/* ─── B. Error Summary ─────────────────────────────── */}
          <div className={`${styles.summaryBox}${isResolved ? ` ${styles.summaryBoxResolved}` : ''}`}>
            {isResolved ? (
              <div style={{ color: 'var(--color-success)', fontWeight: 600 }}>
                ✓ This operation was successfully recovered and resolved via retry.
              </div>
            ) : (
              <div>{activeErrorModal.message}</div>
            )}
          </div>

          {/* ─── B2. Troubleshooting & Resolution ─────────────── */}
          {activeErrorModal.resolution && (
            <div className={styles.troubleshootingSection}>
              <div className={styles.sectionHeader}>
                <h4 className={styles.sectionTitle}>
                  <Wrench size={14} />
                  <span>Troubleshooting & Resolution</span>
                </h4>
                <span
                  className={`${styles.resolutionStatusBadge} ${getResolutionStatusClass(
                    activeErrorModal.resolution.status
                  )}`}
                >
                  {activeErrorModal.resolution.status.replace(/_/g, ' ')}
                </span>
              </div>

              {/* What went wrong? */}
              <div className={styles.troubleshootBlock}>
                <h5 className={styles.troubleshootBlockTitle}>What went wrong?</h5>
                <p className={styles.troubleshootText}>
                  {activeErrorModal.resolution.summary}
                </p>
              </div>

              {/* Probable Causes */}
              {activeErrorModal.resolution.probableCauses.length > 0 && (
                <div className={styles.troubleshootBlock}>
                  <h5 className={styles.troubleshootBlockTitle}>Probable Causes</h5>
                  <div className={styles.probableCausesList}>
                    {activeErrorModal.resolution.probableCauses.map((cause, idx) => (
                      <div key={idx} className={styles.probableCauseCard}>
                        <div className={styles.probableCauseHeader}>
                          <span style={{ fontWeight: 600 }}>{cause.description}</span>
                          <span
                            className={`${styles.confidenceBadge} ${
                              cause.confidence === 'HIGH'
                                ? styles.confHigh
                                : cause.confidence === 'MEDIUM'
                                ? styles.confMedium
                                : styles.confLow
                            }`}
                          >
                            {cause.confidence} CONFIDENCE
                          </span>
                        </div>
                        {cause.evidence && cause.evidence.length > 0 && (
                          <ul className={styles.evidenceList}>
                            {cause.evidence.map((ev, i) => (
                              <li key={i}>{ev}</li>
                            ))}
                          </ul>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Recommended Solution */}
              {activeErrorModal.resolution.instructions.length > 0 && (
                <div className={styles.troubleshootBlock}>
                  <h5 className={styles.troubleshootBlockTitle}>Recommended Solution</h5>
                  <div className={styles.instructionList}>
                    {activeErrorModal.resolution.instructions.map((step) => (
                      <div key={step.step} className={styles.instructionItem}>
                        <div className={styles.stepCircle}>{step.step}</div>
                        <div className={styles.instructionBody}>
                          <div className={styles.instructionTitle}>{step.title}</div>
                          <p className={styles.instructionDesc}>{step.description}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Contextual Action Buttons */}
              {activeErrorModal.resolution.actions.length > 0 && (
                <div className={styles.resolutionActionsBar}>
                  {activeErrorModal.resolution.actions.map((act) => {
                    if (act.type === 'DIAGNOSTIC') {
                      return (
                        <Button
                          key={act.id}
                          variant="outline"
                          size="sm"
                          onClick={() => executeDiagnosticAction(act, activeErrorModal.id)}
                          disabled={isDiagnosing || !act.enabled}
                          title={act.description}
                        >
                          {isDiagnosing ? (
                            <RefreshCw size={12} className="spin" />
                          ) : (
                            <Activity size={12} />
                          )}
                          <span>{act.label}</span>
                        </Button>
                      );
                    }

                    if (act.type === 'NAVIGATE') {
                      return (
                        <Button
                          key={act.id}
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            if (act.target) {
                              router.push(act.target);
                              closeErrorModal();
                            }
                          }}
                          disabled={!act.enabled}
                          title={act.description}
                        >
                          <Compass size={12} />
                          <span>{act.label}</span>
                        </Button>
                      );
                    }

                    if (act.type === 'COPY') {
                      return (
                        <Button
                          key={act.id}
                          variant="outline"
                          size="sm"
                          onClick={handleCopyInstructions}
                          disabled={!act.enabled}
                          title={act.description}
                        >
                          {copiedInstructions ? (
                            <Check size={12} style={{ color: 'var(--color-success)' }} />
                          ) : (
                            <Copy size={12} />
                          )}
                          <span>{copiedInstructions ? 'Copied' : act.label}</span>
                        </Button>
                      );
                    }

                    if (act.type === 'EXTERNAL_LINK') {
                      return (
                        <Button
                          key={act.id}
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            if (act.target) {
                              window.open(act.target, '_blank', 'noopener,noreferrer');
                            }
                          }}
                          disabled={!act.enabled}
                          title={act.description}
                        >
                          <ExternalLink size={12} />
                          <span>{act.label}</span>
                        </Button>
                      );
                    }

                    if (act.type === 'RETRY') {
                      return (
                        <Button
                          key={act.id}
                          variant="primary"
                          size="sm"
                          onClick={handleRetry}
                          disabled={isRetrying || !act.enabled || isResolved}
                          title={act.description}
                        >
                          {isRetrying ? (
                            <RefreshCw size={12} className="spin" />
                          ) : (
                            <RotateCcw size={12} />
                          )}
                          <span>{act.label}</span>
                        </Button>
                      );
                    }

                    return null;
                  })}
                </div>
              )}
            </div>
          )}

          {/* ─── C. Technical Error Details ───────────────────── */}
          <div className={styles.sectionBlock}>
            <div className={styles.sectionHeader}>
              <h4 className={styles.sectionTitle}>
                <FileText size={14} />
                <span>Technical Details</span>
              </h4>
              {activeErrorModal.details.errorCode && (
                <span style={{ fontSize: '0.6875rem', fontFamily: 'var(--font-mono)', color: 'var(--color-muted-foreground)' }}>
                  Code: <strong>{activeErrorModal.details.errorCode}</strong>
                </span>
              )}
            </div>

            <div className={styles.detailsGrid}>
              {activeErrorModal.details.httpStatus && (
                <div className={styles.detailItem}>
                  <span className={styles.detailLabel}>HTTP Status:</span>
                  <span className={styles.detailValue}>{activeErrorModal.details.httpStatus}</span>
                </div>
              )}
              {activeErrorModal.details.endpoint && (
                <div className={styles.detailItem}>
                  <span className={styles.detailLabel}>API Endpoint:</span>
                  <span className={styles.detailValue}>{activeErrorModal.details.endpoint}</span>
                </div>
              )}
              {activeErrorModal.details.operationId && (
                <div className={styles.detailItem}>
                  <span className={styles.detailLabel}>Operation ID:</span>
                  <span className={styles.detailValue}>{activeErrorModal.details.operationId}</span>
                </div>
              )}
              {activeErrorModal.source.component && (
                <div className={styles.detailItem}>
                  <span className={styles.detailLabel}>Component:</span>
                  <span className={styles.detailValue}>{activeErrorModal.source.component}</span>
                </div>
              )}
              {activeErrorModal.details.provider && (
                <div className={styles.detailItem}>
                  <span className={styles.detailLabel}>Provider / Runtime:</span>
                  <span className={styles.detailValue}>{activeErrorModal.details.provider}</span>
                </div>
              )}
              {activeErrorModal.details.model && (
                <div className={styles.detailItem}>
                  <span className={styles.detailLabel}>Model:</span>
                  <span className={styles.detailValue}>{activeErrorModal.details.model}</span>
                </div>
              )}
            </div>

            {/* Original Error Message */}
            {activeErrorModal.details.originalMessage && (
              <div className={styles.originalMessageBlock}>
                <span className={styles.detailLabel}>Raw Exception Message:</span>
                <div className={styles.originalMessageText}>
                  {activeErrorModal.details.originalMessage}
                </div>
              </div>
            )}

            {/* Stack Trace (Collapsible) */}
            {activeErrorModal.details.stackTrace && (
              <div className={styles.stackTraceBox}>
                <button
                  type="button"
                  className={styles.stackTraceToggle}
                  onClick={() => setShowStackTrace((prev) => !prev)}
                >
                  {showStackTrace ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                  <span>{showStackTrace ? 'Hide Stack Trace' : 'View Stack Trace'}</span>
                </button>
                {showStackTrace && (
                  <pre className={styles.stackTracePre}>{activeErrorModal.details.stackTrace}</pre>
                )}
              </div>
            )}
          </div>

          {/* ─── D. Diagnostic Logs ───────────────────────────── */}
          <div className={styles.sectionBlock}>
            <div className={styles.sectionHeader}>
              <h4 className={styles.sectionTitle}>
                <Terminal size={14} />
                <span>Diagnostic Logs ({activeErrorModal.logs.length})</span>
              </h4>

              <div style={{ display: 'flex', gap: '6px' }}>
                {activeErrorModal.logs.length > 0 && (
                  <button
                    type="button"
                    className={styles.stackTraceToggle}
                    onClick={handleCopyLogs}
                    title="Copy diagnostic logs to clipboard"
                  >
                    {copiedLogs ? <Check size={12} style={{ color: 'var(--color-success)' }} /> : <Copy size={12} />}
                    <span>{copiedLogs ? 'Copied' : 'Copy Logs'}</span>
                  </button>
                )}
                <button
                  type="button"
                  className={styles.stackTraceToggle}
                  onClick={() => setLogsExpanded((v) => !v)}
                  aria-label={logsExpanded ? 'Collapse logs' : 'Expand logs'}
                >
                  {logsExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                </button>
              </div>
            </div>

            {logsExpanded && (
              activeErrorModal.logs.length === 0 ? (
                <div className={styles.emptyLogs}>
                  No diagnostic logs captured for this failure.
                </div>
              ) : (
                <div className={styles.logsList}>
                  {activeErrorModal.logs.map((log, idx) => (
                    <div key={idx} className={styles.logEntry}>
                      <span className={styles.logTimestamp}>
                        {new Date(log.timestamp).toLocaleTimeString()}
                      </span>
                      <span
                        className={`${styles.logLevel} ${
                          log.level === 'error'
                            ? styles.logLevelError
                            : log.level === 'warn'
                            ? styles.logLevelWarn
                            : styles.logLevelInfo
                        }`}
                      >
                        {log.level}
                      </span>
                      <span className={styles.logSource}>[{log.source}]</span>
                      <span className={styles.logMessage}>{log.message}</span>
                    </div>
                  ))}
                </div>
              )
            )}
          </div>
        </div>

        {/* ─── E. Actions Footer ─────────────────────────────── */}
        <div className={styles.footer}>
          <div className={styles.footerLeft}>
            {!retryAvailable && activeErrorModal.retry.reasonUnavailable && (
              <span className={styles.retryNotice}>
                {activeErrorModal.retry.reasonUnavailable}
              </span>
            )}
            {activeErrorModal.retry.attempts > 0 && (
              <span>
                Attempts: <strong>{activeErrorModal.retry.attempts}</strong>
                {activeErrorModal.retry.maxAttempts ? ` / ${activeErrorModal.retry.maxAttempts}` : ''}
              </span>
            )}
          </div>

          <div className={styles.footerRight}>
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopyDetails}
              disabled={isRetrying}
            >
              {copiedDetails ? <Check size={13} style={{ color: 'var(--color-success)' }} /> : <Copy size={13} />}
              <span>{copiedDetails ? 'Copied' : 'Copy Error Details'}</span>
            </Button>

            {retryAvailable && (
              <Button
                variant="primary"
                size="sm"
                onClick={handleRetry}
                disabled={isRetrying}
              >
                {isRetrying ? (
                  <RefreshCw size={13} className="spin" />
                ) : (
                  <RotateCcw size={13} />
                )}
                <span>
                  {isRetrying
                    ? 'Retrying...'
                    : activeErrorModal.retry.attempts > 0
                    ? `Retry (${activeErrorModal.retry.attempts + 1})`
                    : 'Retry'}
                </span>
              </Button>
            )}

            <Button
              variant="outline"
              size="sm"
              onClick={closeErrorModal}
              disabled={isRetrying}
            >
              <span>Close</span>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
