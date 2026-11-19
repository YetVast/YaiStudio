'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Settings as SettingsIcon,
  User,
  GitBranch,
  Shield,
  Key,
  Moon,
  Sun,
  LogOut,
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Info,
  Database,
  Cpu,
  Layers,
  Smartphone,
  Wifi,
  WifiOff,
  Download,
} from 'lucide-react';
import { useTheme } from '@/components/providers/ThemeProvider';
import { usePWA } from '@/lib/pwa/pwa-context';
import Button from '@/components/ui/Button';
import styles from './Settings.module.css';

interface SessionUser {
  yvUserId: string;
  githubLogin: string | null;
  githubConnected: boolean;
  repoVerified: boolean;
  expiresAt: string;
}

interface StorageConnectionStatus {
  connected: boolean;
  githubLogin?: string;
  repoName: string;
  repoExists?: boolean;
  repoPrivate?: boolean;
  repoOwnerMatch?: boolean;
  isInitialized?: boolean;
  error?: string;
}

export default function SettingsPage() {
  const router = useRouter();
  const { theme, toggleTheme } = useTheme();
  const {
    isOnline,
    isInstallable,
    isInstalled,
    isUpdateAvailable,
    promptInstall,
    applyUpdate,
  } = usePWA();

  const [user, setUser] = useState<SessionUser | null>(null);
  const [storageStatus, setStorageStatus] = useState<StorageConnectionStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const [sessRes, connRes] = await Promise.all([
          fetch('/api/auth/session'),
          fetch('/api/github/connection'),
        ]);

        if (sessRes.ok) {
          const sessData = await sessRes.json();
          if (sessData.authenticated) {
            setUser(sessData.user);
          }
        }

        if (connRes.ok) {
          const connData = await connRes.json();
          setStorageStatus(connData);
        }
      } catch (err) {
        console.error('Failed to load settings data:', err);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await fetch('/api/auth/sign-out', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      router.push('/sign-in');
    } catch {
      setSigningOut(false);
    }
  };

  return (
    <div className={styles.container}>
      {/* ── Page Header ── */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Settings & Diagnostics</h1>
          <p className={styles.subtitle}>
            Manage your personal intelligence storage connection, session identity, privacy
            boundaries, and system configuration.
          </p>
        </div>
      </div>

      {/* ── Section: User Identity & Session ── */}
      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <User size={18} className={styles.sectionIcon} />
          <span>Identity & Session</span>
        </div>

        <div className={styles.card}>
          <div className={styles.cardRow}>
            <span className={styles.rowLabel}>Yet Vast Identity ID</span>
            <span className={`${styles.rowValue} ${styles.mono}`}>
              {user?.yvUserId || (loading ? 'Loading...' : 'Anonymous / Ephemeral')}
            </span>
          </div>

          <div className={styles.cardRow}>
            <span className={styles.rowLabel}>Connected GitHub Account</span>
            <span className={styles.rowValue}>
              {user?.githubLogin ? (
                <>
                  <span className={styles.badgeSuccess}>
                    <CheckCircle2 size={12} />
                    @{user.githubLogin}
                  </span>
                </>
              ) : (
                <span className={styles.badgeWarning}>
                  <AlertTriangle size={12} />
                  Not linked
                </span>
              )}
            </span>
          </div>

          <div className={styles.cardRow}>
            <span className={styles.rowLabel}>Authentication Authority</span>
            <span className={styles.rowValue}>Yet Vast Auth v0.2.0</span>
          </div>

          <div className={styles.cardFooter}>
            <Button
              onClick={handleSignOut}
              disabled={signingOut}
              loading={signingOut}
              variant="destructive"
            >
              <LogOut size={14} />
              <span>{signingOut ? 'Signing Out...' : 'Sign Out of YAI Studio'}</span>
            </Button>
          </div>
        </div>
      </section>

      {/* ── Section: Storage Connection & Data Authority ── */}
      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <GitBranch size={18} className={styles.sectionIcon} />
          <span>GitHub Storage Authorization & Repository</span>
        </div>

        <div className={styles.card}>
          <div className={styles.cardRow}>
            <span className={styles.rowLabel}>Target Repository</span>
            <span className={`${styles.rowValue} ${styles.mono}`}>
              {storageStatus?.repoName || 'YVSApps_Data_YaiStudio'}
            </span>
          </div>

          <div className={styles.cardRow}>
            <span className={styles.rowLabel}>Storage Authorization Grant</span>
            <span className={styles.rowValue}>
              {storageStatus?.connected ? (
                <span className={styles.badgeSuccess}>
                  <CheckCircle2 size={12} />
                  Authorized
                </span>
              ) : (
                <span className={styles.badgeWarning}>
                  <AlertTriangle size={12} />
                  Authorization Required
                </span>
              )}
            </span>
          </div>

          <div className={styles.cardRow}>
            <span className={styles.rowLabel}>Repository Verification</span>
            <span className={styles.rowValue}>
              {storageStatus?.repoExists ? (
                <span className={styles.badgeSuccess}>
                  <CheckCircle2 size={12} />
                  Private Repository Verified
                </span>
              ) : (
                <span className={styles.badgeWarning}>
                  <AlertTriangle size={12} />
                  Repository Missing
                </span>
              )}
            </span>
          </div>

          <div className={styles.cardRow}>
            <span className={styles.rowLabel}>Schema Initialization</span>
            <span className={styles.rowValue}>
              {storageStatus?.isInitialized ? (
                <span className={styles.badgeSuccess}>
                  <CheckCircle2 size={12} />
                  v0 Schema Initialized
                </span>
              ) : (
                <span className={styles.badgeWarning}>
                  <AlertTriangle size={12} />
                  Pending Setup
                </span>
              )}
            </span>
          </div>

          <div className={styles.infoBox}>
            <Shield size={20} />
            <div>
              <strong>User Data Ownership Guarantee</strong>
              YAI Studio maintains zero central intelligence databases. All personal memories,
              conversations, knowledge, and preferences are stored directly in your private GitHub
              repository.
            </div>
          </div>

          <div className={styles.cardFooter}>
            <Button
              href="/api/auth/github/connect"
              variant="primary"
            >
              <RefreshCw size={14} />
              <span>Reconnect / Re-authorize GitHub</span>
            </Button>
            {storageStatus?.githubLogin && (
              <Button
                href={`https://github.com/${storageStatus.githubLogin}/${storageStatus.repoName || 'YVSApps_Data_YaiStudio'}`}
                target="_blank"
                rel="noopener noreferrer"
                variant="outline"
              >
                <span>View on GitHub</span>
                <ExternalLink size={14} />
              </Button>
            )}
          </div>
        </div>
      </section>

      {/* ── Section: AI Provider Foundations ── */}
      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <Cpu size={18} className={styles.sectionIcon} />
          <span>AI Provider Configuration</span>
        </div>

        <div className={styles.card}>
          <p className={styles.subtitle}>
            YAI Studio utilizes Bring-Your-Own-Key (BYOK) architecture in v0. OpenRouter is the
            primary multi-model gateway, with Google AI Studio (Gemini) as secondary.
          </p>

          <div className={styles.infoBox}>
            <Key size={20} />
            <div>
              <strong>Secure Key Handling</strong>
              Provider keys are held encrypted with AES-256-GCM in your server-side vault (Vercel
              KV / encrypted session vault). Keys are never committed to your data repository and
              never sent to client bundles.
            </div>
          </div>

          <div className={styles.cardFooter}>
            <Button href="/providers" variant="primary">
              <Key size={14} />
              <span>Configure AI Provider Keys</span>
            </Button>
            <Button href="/settings/yai-local" variant="outline">
              <Cpu size={14} />
              <span>Manage Local Models (LiteRT-LM)</span>
            </Button>
          </div>
        </div>
      </section>

      {/* ── Section: Visual Appearance & Theme ── */}
      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <Layers size={18} className={styles.sectionIcon} />
          <span>Interface Appearance</span>
        </div>

        <div className={styles.card}>
          <div className={styles.cardRow}>
            <span className={styles.rowLabel}>Current Visual Theme</span>
            <span className={styles.rowValue} style={{ textTransform: 'capitalize' }}>
              {theme} Mode
            </span>
          </div>

          <div className={styles.cardRow}>
            <span className={styles.rowLabel}>Design Tokens</span>
            <span className={styles.rowValue}>
              YVS Canonical Palette (#FFFF11 Accent / #4B0084 Primary)
            </span>
          </div>

          <div className={styles.cardFooter}>
            <Button onClick={toggleTheme} variant="outline">
              {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
              <span>Switch to {theme === 'dark' ? 'Light' : 'Dark'} Theme</span>
            </Button>
          </div>
        </div>
      </section>

      {/* ── Section: Local-First PWA & Offline Platform ── */}
      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <Smartphone size={18} className={styles.sectionIcon} />
          <span>Local-First PWA & Offline Platform</span>
        </div>

        <div className={styles.card}>
          <div className={styles.cardRow}>
            <span className={styles.rowLabel}>Network Connectivity</span>
            <span className={styles.rowValue}>
              {isOnline ? (
                <span className={styles.badgeSuccess}>
                  <Wifi size={12} />
                  Online — Live Synchronization
                </span>
              ) : (
                <span className={styles.badgeWarning}>
                  <WifiOff size={12} />
                  Offline — Local Mode
                </span>
              )}
            </span>
          </div>

          <div className={styles.cardRow}>
            <span className={styles.rowLabel}>Application Environment</span>
            <span className={styles.rowValue}>
              {isInstalled ? (
                <span className={styles.badgeSuccess}>
                  <CheckCircle2 size={12} />
                  Installed PWA (Standalone)
                </span>
              ) : (
                <span>Web Browser Tab</span>
              )}
            </span>
          </div>

          <div className={styles.cardRow}>
            <span className={styles.rowLabel}>Offline App Shell</span>
            <span className={styles.rowValue}>
              <span className={styles.badgeSuccess}>
                <CheckCircle2 size={12} />
                Service Worker Cached (v1)
              </span>
            </span>
          </div>

          <div className={styles.infoBox}>
            <Info size={20} />
            <div>
              <strong>Local-First Architecture</strong>
              YAI Studio caches the application shell and UI offline. When disconnected from the internet,
              you can continue reviewing workspaces, viewing cached conversations, and using local intelligence.
              Mutations will synchronize to GitHub once connectivity is restored.
            </div>
          </div>

          {(isInstallable || isUpdateAvailable) && (
            <div className={styles.cardFooter}>
              {isInstallable && (
                <Button onClick={promptInstall} variant="primary">
                  <Download size={14} />
                  <span>Install YAI Studio Application</span>
                </Button>
              )}
              {isUpdateAvailable && (
                <Button onClick={applyUpdate} variant="outline">
                  <RefreshCw size={14} />
                  <span>Apply Application Update</span>
                </Button>
              )}
            </div>
          )}
        </div>
      </section>

      {/* ── Section: System Information ── */}
      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <Info size={18} className={styles.sectionIcon} />
          <span>System Information</span>
        </div>

        <div className={styles.card}>
          <div className={styles.gridTwoCol}>
            <div className={styles.cardRow}>
              <span className={styles.rowLabel}>Application</span>
              <span className={styles.rowValue}>YAI Studio</span>
            </div>
            <div className={styles.cardRow}>
              <span className={styles.rowLabel}>Version</span>
              <span className={`${styles.rowValue} ${styles.mono}`}>0.1.0-v0.foundation</span>
            </div>
            <div className={styles.cardRow}>
              <span className={styles.rowLabel}>Framework</span>
              <span className={styles.rowValue}>Next.js 15 App Router</span>
            </div>
            <div className={styles.cardRow}>
              <span className={styles.rowLabel}>Styling System</span>
              <span className={styles.rowValue}>CSS Modules Only</span>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
