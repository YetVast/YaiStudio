'use client';

import React, { useEffect, useState } from 'react';
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
} from 'lucide-react';
import type { ProviderKeyStatus } from '@/lib/providers/key-store';
import styles from './Providers.module.css';

export default function ProvidersPage() {
  const [providers, setProviders] = useState<ProviderKeyStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Key entry state
  const [activeProvider, setActiveProvider] = useState<'openrouter' | 'google-ai' | null>(null);
  const [enteredKey, setEnteredKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [savingKey, setSavingKey] = useState(false);

  const fetchProviders = async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const res = await fetch('/api/providers');
      if (res.ok) {
        const data = await res.json();
        setProviders(data.providers || []);
      }
    } catch {
      setErrorMessage('Failed to load provider configuration');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProviders();
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

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>AI Providers & Models</h1>
          <p className={styles.subtitle}>
            Configure Bring-Your-Own-Key (BYOK) cloud AI credentials. Keys are encrypted
            server-side and used exclusively for your Personal Intelligence queries.
          </p>
        </div>
      </div>

      {/* Warning Notice about V0 storage */}
      <div className={styles.warningBox}>
        <AlertTriangle size={18} className={styles.warningIcon} />
        <div>
          <strong>V0 Provider Key Storage Boundary</strong>
          <p>
            In V0, your API keys are stored in encrypted server-side memory (AES-256-GCM). Keys are
            cleared if the server instance restarts. Multi-instance persistent encrypted secret
            storage (e.g. Vercel KV) requires central decision approval.
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
          {/* Card 1: OpenRouter (Primary) */}
          <div className={styles.providerCard}>
            <div className={styles.cardHeader}>
              <div className={styles.providerIdentity}>
                <Cpu size={20} className={styles.providerIcon} />
                <div>
                  <div className={styles.providerTitleRow}>
                    <h3>OpenRouter</h3>
                    <span className={styles.primaryBadge}>Primary Provider</span>
                  </div>
                  <span className={styles.providerType}>BYOK Cloud Provider</span>
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
                    <button
                      onClick={() => setActiveProvider('openrouter')}
                      className={styles.smallActionBtn}
                    >
                      Replace
                    </button>
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
                  <button
                    onClick={() => setActiveProvider('openrouter')}
                    className={styles.addKeyBtn}
                  >
                    <Key size={14} />
                    <span>Add OpenRouter Key</span>
                  </button>
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

          {/* Card 2: Google AI Studio (Optional) */}
          <div className={styles.providerCard}>
            <div className={styles.cardHeader}>
              <div className={styles.providerIdentity}>
                <Cpu size={20} className={styles.providerIcon} />
                <div>
                  <div className={styles.providerTitleRow}>
                    <h3>Google AI Studio</h3>
                    <span className={styles.optionalBadge}>Secondary</span>
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
                    <button
                      onClick={() => setActiveProvider('google-ai')}
                      className={styles.smallActionBtn}
                    >
                      Replace
                    </button>
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
                  <button
                    onClick={() => setActiveProvider('google-ai')}
                    className={styles.addKeyBtn}
                  >
                    <Key size={14} />
                    <span>Add Google AI Key</span>
                  </button>
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
              <button
                type="button"
                onClick={() => {
                  setActiveProvider(null);
                  setEnteredKey('');
                }}
                className={styles.modalCancelBtn}
              >
                Cancel
              </button>
              <button type="submit" disabled={savingKey} className={styles.modalSubmitBtn}>
                {savingKey ? 'Verifying...' : 'Validate & Save Key'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
