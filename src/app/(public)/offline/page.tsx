'use client';

import React from 'react';
import Link from 'next/link';
import { WifiOff, RefreshCw } from 'lucide-react';
import Button from '@/components/ui/Button';
import styles from './Offline.module.css';

export default function OfflinePage() {
  const handleRetry = () => {
    window.location.reload();
  };

  return (
    <div className={styles.card}>
      <div className={styles.iconWrapper} aria-hidden="true">
        <WifiOff size={28} />
      </div>

      <h1 className={styles.title}>You are offline</h1>

      <div className={styles.statusPill}>
        <span className={styles.statusDot} aria-hidden="true" />
        <span>Local Mode Active</span>
      </div>

      <p className={styles.description}>
        YAI Studio is operating offline. Your locally cached workspaces and conversations are available.
        GitHub synchronization and cloud provider requests will resume automatically once connectivity returns.
      </p>

      <div className={styles.actions}>
        <Button
          variant="primary"
          onClick={handleRetry}
          className={styles.retryButton}
        >
          <RefreshCw size={15} style={{ marginRight: 6 }} />
          Retry Connection
        </Button>

        <Link href="/" className={styles.returnLink}>
          Return to Workspace
        </Link>
      </div>
    </div>
  );
}
