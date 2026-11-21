'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Cpu,
  Key,
  CheckCircle2,
  AlertTriangle,
  Trash2,
  ExternalLink,
  RefreshCw,
  AlertCircle,
  Eye,
  EyeOff,
  ShieldCheck,
  Shield,
  HardDrive,
} from 'lucide-react';
import type { ProviderKeyStatus } from '@/lib/providers/key-store';
import Button from '@/components/ui/Button';
import { detectDeviceCapabilities } from '@/lib/inference/device-capabilities';
import { LocalModelManager } from '@/lib/inference/model-manager';
import { LocalAIConfig } from '@/lib/inference/local-ai-config';
import { getLocalModelDescriptor } from '@/lib/inference/local-model-registry';
import type { DeviceCapabilityReport, InstalledModelRecord, LocalProviderStatus } from '@/lib/inference/types';
import styles from './Providers.module.css';

export default function ProvidersPage() {
  const router = useRouter();
  const [providers, setProviders] = useState<ProviderKeyStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Local LiteRT Provider State
  const [localCaps, setLocalCaps] = useState<DeviceCapabilityReport | null>(null);
  const [localRecords, setLocalRecords] = useState<InstalledModelRecord[]>([]);
  const [activeLocalModelId, setActiveLocalModelId] = useState<string>('gemma-4-e2b-it-web');

  // Key entry state
  const [activeProvider, setActiveProvider] = useState<'openrouter' | 'google-ai' | null>(null);
  const [enteredKey, setEnteredKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [savingKey, setSavingKey] = useState(false);

  const fetchProviders = async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const [res, caps] = await Promise.all([
        fetch('/api/providers'),
        detectDeviceCapabilities().catch(() => null),
      ]);

      if (res.ok) {
        const data = await res.json();
        setProviders(data.providers || []);
      }

      setLocalCaps(caps);
      const records = LocalModelManager.getModelRecords();
      setLocalRecords(records);
      setActiveLocalModelId(LocalAIConfig.getActiveModelId());
    } catch {
      setErrorMessage('Failed to load provider configuration');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProviders();

    const handleConfigChange = () => {
      setActiveLocalModelId(LocalAIConfig.getActiveModelId());
      setLocalRecords(LocalModelManager.getModelRecords());
    };
    window.addEventListener('yai_local_config_change', handleConfigChange);
    return () => window.removeEventListener('yai_local_config_change', handleConfigChange);
  }, []);

  const handleSaveKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeProvider || !enteredKey.trim() || savingKey) return;

    setSavingKey(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const res = await fetch(`/api/providers/${activeProvider}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: enteredKey.trim() }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to validate and save key');
      }

      setSuccessMessage(`API key for ${activeProvider} validated and saved successfully.`);
      setActiveProvider(null);
      setEnteredKey('');
      await fetchProviders();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Key validation failed');
    } finally {
      setSavingKey(false);
    }
  };

  const handleDeleteKey = async (provider: 'openrouter' | 'google-ai') => {
    if (!confirm(`Are you sure you want to remove your ${provider} API key?`)) return;

    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const res = await fetch(`/api/providers/${provider}`, { method: 'DELETE' });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Deletion failed');
      }
      setSuccessMessage(`Key for ${provider} removed.`);
      await fetchProviders();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to delete key');
    }
  };

  const getProviderStatus = (p: 'openrouter' | 'google-ai') => {
    return providers.find((item) => item.provider === p);
  };

  const openRouterStatus = getProviderStatus('openrouter');
  const googleAiStatus = getProviderStatus('google-ai');

  const localStatus: LocalProviderStatus = LocalAIConfig.computeStatus(
    localCaps,
    localRecords,
    activeLocalModelId
  );
  const activeModelDescriptor = getLocalModelDescriptor(activeLocalModelId);

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>AI Providers & Models</h1>
          <p className={styles.subtitle}>
            Configure on-device AI with LiteRT-LM for maximum privacy, or connect Bring-Your-Own-Key
            (BYOK) cloud AI credentials for access to massive multi-modal frontier models.
          </p>
        </div>
      </div>

      {/* Warning Notice about V0 storage */}
      <div className={styles.warningBox}>
        <AlertTriangle size={18} className={styles.warningIcon} />
        <div>
          <strong>AI Provider Execution Boundary</strong>
          <p>
            Local AI models run entirely on your device with zero outbound network requests. Cloud
            BYOK keys are encrypted server-side with AES-256-GCM and never stored in client bundles or
            data repositories.
          </p>
        </div>
      </div>

      {errorMessage && (
        <div className={styles.errorBanner} role="alert">
          <AlertCircle size={16} />
          <span>{errorMessage}</span>
        </div>
      )}

      {successMessage && (
        <div className={styles.successBanner} role="alert">
          <CheckCircle2 size={16} />
          <span>{successMessage}</span>
        </div>
      )}

      {loading ? (
        <div className={styles.loadingBox}>
          <RefreshCw className={styles.spinner} size={24} />
          <p>Loading configured providers...</p>
        </div>
      ) : (
        <div className={styles.providerGrid}>
          {/* Card 1: Go Local with LiteRT-LM (Primary On-Device Provider) */}
          <div
            className={`${styles.providerCard} ${styles.localProviderCard}`}
            onClick={() => router.push('/settings/yai-local')}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                router.push('/settings/yai-local');
              }
            }}
            aria-label="Go Local with LiteRT-LM — Primary Provider"
          >
            <div className={styles.cardHeader}>
              <div className={styles.providerIdentity}>
                <ShieldCheck size={20} className={styles.localProviderIcon} />
                <div>
                  <div className={styles.providerTitleRow}>
                    <h3>Go Local with LiteRT-LM</h3>
                    <span className={styles.primaryBadge}>Primary Provider</span>
                  </div>
                  <span className={styles.providerType}>On-Device AI Provider</span>
                </div>
              </div>
              <span
                className={`${styles.statusPill} ${
                  localStatus === 'ready'
                    ? styles.statusConfigured
                    : localStatus === 'device_unsupported' || localStatus === 'error'
                    ? styles.statusError
                    : styles.statusPending
                }`}
              >
                {LocalAIConfig.getStatusLabel(localStatus)}
              </span>
            </div>

            <p className={styles.providerDesc}>
              Run AI models directly on your device. Your prompts and conversations remain on your
              device during local inference, without sending inference requests to cloud AI providers.
            </p>

            <div className={styles.keyDetails}>
              <div className={styles.localInfoGrid}>
                <div>
                  <span className={styles.keyLabel}>Active Model:</span>
                  <span className={styles.localInfoValue}>
                    {activeModelDescriptor ? activeModelDescriptor.name : (activeLocalModelId || 'Gemma 4 E2B Instruct (WebGPU)')}
                  </span>
                </div>
                <div>
                  <span className={styles.keyLabel}>Inference Privacy:</span>
                  <span className={styles.localPrivacyPill}>
                    <Shield size={11} />
                    <span>Strict On-Device</span>
                  </span>
                </div>
              </div>
            </div>

            <div className={styles.cardFooter}>
              <Button
                href="/settings/yai-local"
                variant="primary"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                }}
              >
                <Cpu size={14} />
                <span>{LocalAIConfig.getActionLabel(localStatus)}</span>
              </Button>
            </div>
          </div>

          {/* Card 2: OpenRouter (Cloud Provider) */}
          <div className={styles.providerCard}>
            <div className={styles.cardHeader}>
              <div className={styles.providerIdentity}>
                <Cpu size={20} className={styles.providerIcon} />
                <div>
                  <div className={styles.providerTitleRow}>
                    <h3>OpenRouter</h3>
                    <span className={styles.cloudBadge}>Cloud Provider</span>
                  </div>
                  <span className={styles.providerType}>BYOK Cloud Gateway</span>
                </div>
              </div>
              <span
                className={`${styles.statusPill} ${
                  openRouterStatus?.configured ? styles.statusConfigured : styles.statusUnconfigured
                }`}
              >
                {openRouterStatus?.configured ? 'Configured' : 'Not Configured'}
              </span>
            </div>

            <p className={styles.providerDesc}>
              Access Anthropic Claude, OpenAI GPT, Meta Llama, and hundreds of top models through
              your own OpenRouter API key.
            </p>

            <div className={styles.keyDetails}>
              {openRouterStatus?.configured ? (
                <div className={styles.configuredKeyRow}>
                  <div>
                    <span className={styles.keyLabel}>Active Key:</span>
                    <code className={styles.maskedKey}>{openRouterStatus.maskedKey}</code>
                  </div>
                  <div className={styles.keyBtnGroup}>
                    <Button
                      onClick={() => setActiveProvider('openrouter')}
                      variant="outline"
                      size="sm"
                    >
                      Replace
                    </Button>
                    <button
                      onClick={() => handleDeleteKey('openrouter')}
                      className={styles.deleteBtn}
                      title="Delete key"
                      aria-label="Delete OpenRouter key"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ) : (
                <div className={styles.unconfiguredBox}>
                  <p>No key configured. Add your OpenRouter API key to enable conversation generation.</p>
                  <Button
                    onClick={() => setActiveProvider('openrouter')}
                    variant="primary"
                    size="sm"
                  >
                    <Key size={14} />
                    <span>Add OpenRouter Key</span>
                  </Button>
                </div>
              )}
            </div>

            <div className={styles.cardFooter}>
              <a
                href="https://openrouter.ai/keys"
                target="_blank"
                rel="noopener noreferrer"
                className={styles.extLink}
              >
                <span>Get an OpenRouter Key</span>
                <ExternalLink size={12} />
              </a>
            </div>
          </div>

          {/* Card 3: Google AI Studio (Cloud Provider) */}
          <div className={styles.providerCard}>
            <div className={styles.cardHeader}>
              <div className={styles.providerIdentity}>
                <Cpu size={20} className={styles.providerIcon} />
                <div>
                  <div className={styles.providerTitleRow}>
                    <h3>Google AI Studio</h3>
                    <span className={styles.cloudBadge}>Cloud Provider</span>
                  </div>
                  <span className={styles.providerType}>Gemini Cloud Provider</span>
                </div>
              </div>
              <span
                className={`${styles.statusPill} ${
                  googleAiStatus?.configured ? styles.statusConfigured : styles.statusUnconfigured
                }`}
              >
                {googleAiStatus?.configured ? 'Configured' : 'Not Configured'}
              </span>
            </div>

            <p className={styles.providerDesc}>
              Connect directly to Gemini 1.5 Flash and Pro models using your Google AI Studio API
              key.
            </p>

            <div className={styles.keyDetails}>
              {googleAiStatus?.configured ? (
                <div className={styles.configuredKeyRow}>
                  <div>
                    <span className={styles.keyLabel}>Active Key:</span>
                    <code className={styles.maskedKey}>{googleAiStatus.maskedKey}</code>
                  </div>
                  <div className={styles.keyBtnGroup}>
                    <Button
                      onClick={() => setActiveProvider('google-ai')}
                      variant="outline"
                      size="sm"
                    >
                      Replace
                    </Button>
                    <button
                      onClick={() => handleDeleteKey('google-ai')}
                      className={styles.deleteBtn}
                      title="Delete key"
                      aria-label="Delete Google AI key"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ) : (
                <div className={styles.unconfiguredBox}>
                  <p>Optional secondary provider for direct Gemini model queries.</p>
                  <Button
                    onClick={() => setActiveProvider('google-ai')}
                    variant="primary"
                    size="sm"
                  >
                    <Key size={14} />
                    <span>Add Google AI Key</span>
                  </Button>
                </div>
              )}
            </div>

            <div className={styles.cardFooter}>
              <a
                href="https://aistudio.google.com/app/apikey"
                target="_blank"
                rel="noopener noreferrer"
                className={styles.extLink}
              >
                <span>Get a Google AI Key</span>
                <ExternalLink size={12} />
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Key Entry Modal */}
      {activeProvider && (
        <div className={styles.modalOverlay}>
          <form onSubmit={handleSaveKey} className={styles.modalCard}>
            <h3>Configure {activeProvider === 'openrouter' ? 'OpenRouter' : 'Google AI'} Key</h3>
            <p>
              Your key will be verified with {activeProvider} before saving and stored encrypted
              server-side. It will never be returned to your browser.
            </p>

            <div className={styles.inputWrapper}>
              <input
                type={showKey ? 'text' : 'password'}
                placeholder={`Enter ${activeProvider} API key...`}
                value={enteredKey}
                onChange={(e) => setEnteredKey(e.target.value)}
                className={styles.keyInput}
                autoFocus
                required
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className={styles.eyeBtn}
                aria-label={showKey ? 'Hide key' : 'Show key'}
              >
                {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>

            <div className={styles.modalActions}>
              <Button
                type="button"
                onClick={() => {
                  setActiveProvider(null);
                  setEnteredKey('');
                }}
                variant="outline"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={savingKey}
                loading={savingKey}
                variant="primary"
              >
                {savingKey ? 'Verifying...' : 'Validate & Save Key'}
              </Button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
