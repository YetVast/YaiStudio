import React from 'react';
import styles from './StatusBadge.module.css';

export type SyncStatus = 'saved' | 'saving' | 'pending' | 'error';

interface StatusBadgeProps {
  status: SyncStatus;
  label?: string;
}

export function StatusBadge({ status, label }: StatusBadgeProps) {
  const defaultLabels: Record<SyncStatus, string> = {
    saved: 'Saved to GitHub',
    saving: 'Saving...',
    pending: 'Unsaved changes',
    error: 'Save failed',
  };

  const displayText = label || defaultLabels[status];

  return (
    <span className={`${styles.badge} ${styles[status]}`}>
      <span className={styles.dot} />
      {displayText}
    </span>
  );
}
