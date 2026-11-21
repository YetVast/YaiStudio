'use client';

import React from 'react';
import Link from 'next/link';
import { Activity, AlertTriangle } from 'lucide-react';
import { useTelemetry } from '@/lib/telemetry/telemetry-context';
import styles from './ProcessIndicator.module.css';

export default function ProcessIndicator() {
  const { activeCount, hasErrors, activeProcesses } = useTelemetry();

  let tooltip = 'AI Runtime Monitor (All systems nominal)';
  if (activeCount > 0) {
    const firstName = activeProcesses[0]?.operationName || 'Operation in progress';
    tooltip = `${activeCount} active operation${activeCount > 1 ? 's' : ''}: ${firstName} — Open Runtime Monitor`;
  } else if (hasErrors) {
    tooltip = 'Recent operation warning or failure — Open Runtime Monitor';
  }

  const isRunning = activeCount > 0;

  return (
    <Link
      href="/monitor"
      className={styles.button}
      aria-label={tooltip}
      title={tooltip}
    >
      {hasErrors && !isRunning ? (
        <AlertTriangle size={16} className={styles.iconWarning} />
      ) : (
        <Activity
          size={16}
          className={isRunning ? styles.iconActive : styles.iconNeutral}
          strokeWidth={isRunning ? 2.5 : 2}
        />
      )}

      {isRunning && (
        <span className={styles.badge} aria-hidden="true">
          {activeCount > 9 ? '9+' : activeCount}
        </span>
      )}
      {!isRunning && hasErrors && (
        <span className={`${styles.badge} ${styles.badgeWarning}`} aria-hidden="true">
          !
        </span>
      )}
    </Link>
  );
}
