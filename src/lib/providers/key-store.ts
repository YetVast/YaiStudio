/**
 * YAI Studio — Provider Key Store (server-only)
 *
 * Manages user-supplied BYOK (Bring Your Own Key) credentials for cloud AI providers.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * ARCHITECTURAL LIMITATION & GATE NOTE (V0):
 * In V0 on Vercel without a persistent per-user encrypted KV store, keys are
 * stored encrypted in server-side memory using AES-256-GCM.
 * This means keys reset when the server instance restarts.
 *
 * PRODUCTION REQUIRED DECISION:
 * An approved encrypted database or secret store (e.g. Vercel KV, Upstash)
 * must be configured for durable multi-instance BYOK key persistence.
 * Keys MUST NEVER be stored in the user's GitHub data repository, browser
 * local storage, or plaintext logs.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * @module lib/providers/key-store
 */
import 'server-only';
import crypto from 'node:crypto';

export interface ProviderKeyStatus {
  provider: 'openrouter' | 'google-ai';
  configured: boolean;
  maskedKey?: string;
  storedAt?: string;
}

interface EncryptedKeyRecord {
  ciphertext: string;
  iv: string;
  tag: string;
  maskedKey: string;
  storedAt: string;
}

// In-memory encrypted store: Map<userId:provider, EncryptedKeyRecord>
const keyStore = new Map<string, EncryptedKeyRecord>();

function getEncryptionKey(): Buffer {
  const envKey = process.env.YAI_CREDENTIAL_ENCRYPTION_KEY;
  if (!envKey) {
    // Development fallback deterministic key
    return crypto.createHash('sha256').update('yai-studio-default-dev-key').digest();
  }
  return crypto.createHash('sha256').update(envKey).digest();
}

export function maskKey(rawKey: string): string {
  const trimmed = rawKey.trim();
  if (trimmed.length <= 10) return '********';
  const prefix = trimmed.slice(0, 6);
  const suffix = trimmed.slice(-4);
  return `${prefix}...${suffix}`;
}

export async function storeProviderKey(
  yvUserId: string,
  provider: 'openrouter' | 'google-ai',
  rawKey: string,
): Promise<void> {
  const trimmedKey = rawKey.trim();
  if (!trimmedKey) {
    throw new Error('Provider key cannot be empty');
  }

  const key = getEncryptionKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

  let ciphertext = cipher.update(trimmedKey, 'utf8', 'hex');
  ciphertext += cipher.final('hex');
  const tag = cipher.getAuthTag().toString('hex');

  const record: EncryptedKeyRecord = {
    ciphertext,
    iv: iv.toString('hex'),
    tag,
    maskedKey: maskKey(trimmedKey),
    storedAt: new Date().toISOString(),
  };

  const storeKey = `${yvUserId}:${provider}`;
  keyStore.set(storeKey, record);
}

export async function getProviderKey(
  yvUserId: string,
  provider: 'openrouter' | 'google-ai',
): Promise<string | null> {
  const storeKey = `${yvUserId}:${provider}`;
  const record = keyStore.get(storeKey);
  if (!record) return null;

  try {
    const key = getEncryptionKey();
    const iv = Buffer.from(record.iv, 'hex');
    const tag = Buffer.from(record.tag, 'hex');

    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);

    let decrypted = decipher.update(record.ciphertext, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (error) {
    console.error('[YAI KeyStore] Failed to decrypt provider key:', error);
    return null;
  }
}

export async function getProviderKeyStatus(
  yvUserId: string,
  provider: 'openrouter' | 'google-ai',
): Promise<ProviderKeyStatus> {
  const storeKey = `${yvUserId}:${provider}`;
  const record = keyStore.get(storeKey);
  if (!record) {
    return { provider, configured: false };
  }
  return {
    provider,
    configured: true,
    maskedKey: record.maskedKey,
    storedAt: record.storedAt,
  };
}

export async function listConfiguredProviders(yvUserId: string): Promise<ProviderKeyStatus[]> {
  const providers: Array<'openrouter' | 'google-ai'> = ['openrouter', 'google-ai'];
  const results: ProviderKeyStatus[] = [];
  for (const p of providers) {
    results.push(await getProviderKeyStatus(yvUserId, p));
  }
  return results;
}

export async function deleteProviderKey(
  yvUserId: string,
  provider: 'openrouter' | 'google-ai',
): Promise<void> {
  const storeKey = `${yvUserId}:${provider}`;
  keyStore.delete(storeKey);
}
