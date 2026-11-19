'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Database, Plus, CheckCircle, RefreshCw, AlertCircle, FileCode, GitBranch } from 'lucide-react';
import Button from '@/components/ui/Button';
import styles from './RepoSetup.module.css';

interface ConnectionStatus {
  connected: boolean;
  githubLogin?: string;
  repoName: string;
  repoExists?: boolean;
  repoPrivate?: boolean;
  repoOwnerMatch?: boolean;
  isInitialized?: boolean;
  error?: string;
}

export default function RepoSetupPage() {
  const router = useRouter();
  const [status, setStatus] = useState<ConnectionStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const fetchStatus = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/github/connection');
      if (res.ok) {
        const data = await res.json();
        setStatus(data);
        if (!data.connected) {
          setErrorMessage('GitHub storage is not authorized. Please authorize GitHub storage access first.');
        } else {
          setErrorMessage(null);
          if (data.repoExists && data.isInitialized) {
            router.push('/');
          }
        }
      }
    } catch {
      setErrorMessage('Failed to check repository status');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  const handleCreateRepo = async () => {
    setActionLoading(true);
    setErrorMessage(null);
    try {
      const res = await fetch('/api/github/repository/create', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to create repository');
      }
      setSuccessMessage('Private repository created successfully! Now initialize the storage layout.');
      await fetchStatus();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Repository creation failed');
    } finally {
      setActionLoading(false);
    }
  };

  const handleInitialize = async () => {
    setActionLoading(true);
    setErrorMessage(null);
    try {
      const res = await fetch('/api/storage/initialize', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to initialize storage');
      }
      setSuccessMessage('Storage initialized successfully! Redirecting...');
      setTimeout(() => {
        router.push('/');
      }, 1500);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Initialization failed');
    } finally {
      setActionLoading(false);
    }
  };

  const isAuthRequired =
    status?.connected === false ||
    (errorMessage !== null &&
      (errorMessage.toLowerCase().includes('not authorized') ||
        errorMessage.toLowerCase().includes('authorize github')));

  if (loading) {
    return (
      <div className={styles.loadingContainer}>
        <RefreshCw className={styles.spinner} size={24} />
        <p>Checking personal intelligence repository...</p>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <div className={styles.iconCircle}>
          <Database size={32} />
        </div>

        <h1 className={styles.title}>Personal Intelligence Storage Setup</h1>
        <p className={styles.subtitle}>
          Repository: <strong>{status?.githubLogin ? `${status.githubLogin}/YVSApps_Data_YaiStudio` : 'YVSApps_Data_YaiStudio'}</strong>
        </p>

        {errorMessage && (
          <div className={styles.errorAlert} role="alert">
            <div className={styles.errorContent}>
              <AlertCircle size={18} className={styles.errorIcon} />
              <div className={styles.errorText}>
                <span>{errorMessage}</span>
              </div>
            </div>
            {isAuthRequired && (
              <div className={styles.errorAction}>
                <Button
                  href="/api/auth/github/connect"
                  variant="primary"
                  size="sm"
                >
                  <GitBranch size={14} />
                  <span>Authorize GitHub</span>
                </Button>
              </div>
            )}
          </div>
        )}

        {successMessage && (
          <div className={styles.successAlert} role="alert">
            <CheckCircle size={16} />
            <span>{successMessage}</span>
          </div>
        )}

        {!status?.repoExists ? (
          <div className={styles.stepBox}>
            <div className={styles.stepHeader}>
              <span className={styles.stepBadge}>Step 1</span>
              <h3>Create Private Repository</h3>
            </div>
            <p className={styles.stepDesc}>
              The repository <code>YVSApps_Data_YaiStudio</code> was not found under your GitHub
              account (<code>@{status?.githubLogin || 'unknown'}</code>).
              Per YAI Studio invariants, it must be created explicitly with private visibility.
            </p>
            <Button
              onClick={handleCreateRepo}
              disabled={actionLoading}
              loading={actionLoading}
              variant="primary"
              size="lg"
              fullWidth
            >
              <Plus size={16} />
              <span>{actionLoading ? 'Creating repository...' : 'Create Private Repository'}</span>
            </Button>
          </div>
        ) : !status?.isInitialized ? (
          <div className={styles.stepBox}>
            <div className={styles.stepHeader}>
              <span className={styles.stepBadge}>Step 2</span>
              <h3>Initialize Personal Intelligence Schema</h3>
            </div>
            <p className={styles.stepDesc}>
              The private repository exists. Before writing personal data, initialize
              the directory layout and schema manifest.
            </p>

            <div className={styles.previewBox}>
              <div className={styles.previewTitle}>
                <FileCode size={14} />
                <span>Proposed Structure</span>
              </div>
              <ul className={styles.fileList}>
                <li><code>README.md</code> — Storage overview</li>
                <li><code>yaiManifest.json</code> — Version and schema definition</li>
                <li><code>conversationsIndex.json</code> — Fast navigation index</li>
                <li><code>memory/facts.json</code>, <code>preferences.json</code>, etc.</li>
                <li><code>workspaces/</code> & <code>unfiledConversations/</code></li>
              </ul>
            </div>

            <Button
              onClick={handleInitialize}
              disabled={actionLoading}
              loading={actionLoading}
              variant="primary"
              size="lg"
              fullWidth
            >
              <CheckCircle size={16} />
              <span>{actionLoading ? 'Initializing...' : 'Initialize Personal Intelligence Storage'}</span>
            </Button>
          </div>
        ) : (
          <div className={styles.readyBox}>
            <CheckCircle size={32} className={styles.readyIcon} />
            <h3>Storage is ready!</h3>
            <p>Your repository is private and initialized.</p>
            <Button href="/" variant="primary" size="lg" fullWidth>
              Go to Overview
            </Button>
          </div>
        )}

        <div className={styles.footerActions}>
          <Button
            onClick={fetchStatus}
            disabled={actionLoading}
            variant="ghost"
            size="sm"
          >
            <RefreshCw size={14} />
            <span>Re-check repository status</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
