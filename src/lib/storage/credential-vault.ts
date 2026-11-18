/**
 * YAI Studio — Server-Only Persistent Credential Vault
 *
 * Implements secure, isolated, persistent credential storage suitable for
 * Vercel Serverless deployments and horizontal auto-scaling.
 *
 * Architecture:
 * 1. Storage Tier 1 — Serverless KV (Vercel KV / Upstash Redis REST API):
 *    - Triggered if KV_REST_API_URL and KV_REST_API_TOKEN (or UPSTASH_REDIS_REST_URL/TOKEN) are configured.
 *    - Uses standard HTTPS REST calls via native `fetch` (zero additional npm dependencies).
 *    - Persists across cold starts, redeployments, and independent serverless lambda instances.
 *    - Enables cross-product background API calls (e.g., Cogmit, Fyuniverse) when user browser is not present.
 *
 * 2. Storage Tier 2 — Encrypted Host-Bound Cookie (`yai_vault`):
 *    - Automatically carried by the user's browser in request headers.
 *    - HttpOnly, Secure, SameSite=Lax.
 *    - Zero-infrastructure fallback: Works seamlessly out-of-the-box on Vercel even before external KV is attached.
 *
 * 3. Storage Tier 3 — In-Memory Process Cache:
 *    - Sub-millisecond memoization during the lifetime of a single lambda invocation.
 *
 * Encryption & Isolation:
 * - All credentials (GitHub OAuth tokens, BYOK OpenRouter/Google AI keys) are encrypted
 *   at rest with AES-256-GCM using YAI_CREDENTIAL_ENCRYPTION_KEY.
 * - Every record is strictly isolated and validated against the verified `yvUserId`.
 * - Tokens and keys are NEVER returned in plaintext in API responses, logs, or client bundles.
 */
import 'server-only';

import crypto from 'node:crypto';
import { cookies } from 'next/headers';
import type { NextResponse } from 'next/server';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ProviderKeyStatus {
  provider: 'openrouter' | 'google-ai';
  configured: boolean;
  maskedKey?: string;
  storedAt?: string;
}

export interface UserVaultData {
  yvUserId: string;
  githubToken?: string;
  openrouterKey?: string;
  googleAiKey?: string;
  openrouterMasked?: string;
  googleAiMasked?: string;
  updatedAt: string;
}

interface EncryptedPayload {
  ciphertext: string; // hex
  iv: string;         // hex
  tag: string;        // hex
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Constants & Configuration
// ---------------------------------------------------------------------------

const VAULT_COOKIE_NAME = 'yai_vault';
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days

// In-memory memoization cache: Map<yvUserId, UserVaultData>
const _memoryCache = new Map<string, UserVaultData>();

// ---------------------------------------------------------------------------
// Encryption Key Derivation (AES-256-GCM 32-byte key)
// ---------------------------------------------------------------------------

export function getCredentialEncryptionKey(): Buffer {
  const rawKey =
    process.env.YAI_CREDENTIAL_ENCRYPTION_KEY ||
    process.env.CREDENTIAL_ENCRYPTION_SECRET ||
    process.env.YAI_SESSION_SECRET;

  if (!rawKey || rawKey.trim() === '') {
    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        '[YAI Credential Vault] Critical: YAI_CREDENTIAL_ENCRYPTION_KEY is not set. ' +
          'Configure a random 32-byte secret in Vercel Project Settings.',
      );
    }
    // Development fallback
    return crypto.createHash('sha256').update('yai-studio-dev-vault-secret').digest();
  }

  // If a valid base64 32-byte key is supplied
  try {
    const buf = Buffer.from(rawKey, 'base64');
    if (buf.length === 32) return buf;
  } catch {}

  // Deterministically hash to 32 bytes
  return crypto.createHash('sha256').update(rawKey).digest();
}

function encryptVaultData(data: UserVaultData): string {
  const key = getCredentialEncryptionKey();
  const iv = crypto.randomBytes(12); // 96-bit IV for AES-GCM
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

  const jsonStr = JSON.stringify(data);
  let ciphertext = cipher.update(jsonStr, 'utf8', 'hex');
  ciphertext += cipher.final('hex');
  const tag = cipher.getAuthTag().toString('hex');

  const payload: EncryptedPayload = {
    ciphertext,
    iv: iv.toString('hex'),
    tag,
    updatedAt: data.updatedAt,
  };

  return Buffer.from(JSON.stringify(payload)).toString('base64url');
}

function decryptVaultData(serialized: string, expectedUserId: string): UserVaultData | null {
  try {
    const rawJson = Buffer.from(serialized, 'base64url').toString('utf8');
    const payload = JSON.parse(rawJson) as EncryptedPayload;

    const key = getCredentialEncryptionKey();
    const iv = Buffer.from(payload.iv, 'hex');
    const tag = Buffer.from(payload.tag, 'hex');

    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);

    let decrypted = decipher.update(payload.ciphertext, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    const vault = JSON.parse(decrypted) as UserVaultData;
    // Strict user isolation check
    if (vault.yvUserId !== expectedUserId) {
      console.warn(`[YAI Vault] Security: Vault user mismatch (stored: ${vault.yvUserId}, requested: ${expectedUserId})`);
      return null;
    }

    return vault;
  } catch (err) {
    console.error('[YAI Vault] Decryption error (invalid tag or tampered data):', (err as Error).message);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Vercel KV / Upstash Redis REST Client (Native fetch, zero dependencies)
// ---------------------------------------------------------------------------

function getKvConfig(): { url: string; token: string } | null {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

  if (url && token && url.trim() !== '' && token.trim() !== '') {
    return { url: url.replace(/\/$/, ''), token };
  }
  return null;
}

async function kvGet(key: string): Promise<string | null> {
  const kv = getKvConfig();
  if (!kv) return null;

  try {
    const res = await fetch(`${kv.url}/get/${encodeURIComponent(key)}`, {
      headers: { Authorization: `Bearer ${kv.token}` },
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { result?: string };
    return data.result ?? null;
  } catch (err) {
    console.warn('[YAI Vault] KV read error:', (err as Error).message);
    return null;
  }
}

async function kvSet(key: string, value: string): Promise<boolean> {
  const kv = getKvConfig();
  if (!kv) return false;

  try {
    const res = await fetch(`${kv.url}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${kv.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(['SET', key, value]),
      cache: 'no-store',
    });
    return res.ok;
  } catch (err) {
    console.warn('[YAI Vault] KV write error:', (err as Error).message);
    return false;
  }
}

async function kvDel(key: string): Promise<boolean> {
  const kv = getKvConfig();
  if (!kv) return false;

  try {
    const res = await fetch(`${kv.url}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${kv.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(['DEL', key]),
      cache: 'no-store',
    });
    return res.ok;
  } catch (err) {
    console.warn('[YAI Vault] KV del error:', (err as Error).message);
    return false;
  }
}

// ---------------------------------------------------------------------------
// Vault Retrieval & Mutation
// ---------------------------------------------------------------------------

function cookieOptions() {
  const isProduction = process.env.NODE_ENV === 'production';
  return {
    name: VAULT_COOKIE_NAME,
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax' as const,
    path: '/',
    maxAge: COOKIE_MAX_AGE_SECONDS,
  };
}

/**
 * Retrieve user's decrypted vault data.
 * Tries: 1. In-Memory Cache -> 2. Vercel KV REST -> 3. Encrypted Cookie.
 */
export async function getUserVault(yvUserId: string): Promise<UserVaultData> {
  if (!yvUserId || yvUserId.trim() === '') {
    return { yvUserId: '', updatedAt: new Date().toISOString() };
  }

  // 1. In-Memory Process Cache
  const cached = _memoryCache.get(yvUserId);
  if (cached) return cached;

  const kvKey = `yai:vault:${yvUserId}`;

  // 2. Vercel KV REST API
  const kvCipher = await kvGet(kvKey);
  if (kvCipher) {
    const decrypted = decryptVaultData(kvCipher, yvUserId);
    if (decrypted) {
      _memoryCache.set(yvUserId, decrypted);
      return decrypted;
    }
  }

  // 3. Encrypted Host-Bound Cookie fallback
  try {
    const cookieStore = await cookies();
    const cookieCipher = cookieStore.get(VAULT_COOKIE_NAME)?.value;
    if (cookieCipher) {
      const decrypted = decryptVaultData(cookieCipher, yvUserId);
      if (decrypted) {
        _memoryCache.set(yvUserId, decrypted);
        // Sync to KV if KV is available but was missing
        if (getKvConfig()) {
          void kvSet(kvKey, cookieCipher);
        }
        return decrypted;
      }
    }
  } catch {
    // In environments where cookies() is not available (e.g. CLI), ignore
  }

  return {
    yvUserId,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Save user's vault data encrypted.
 * Persists to: In-memory cache + Vercel KV (if configured) + Cookie (if response supplied).
 */
export async function saveUserVault(
  vault: UserVaultData,
  response?: NextResponse,
): Promise<void> {
  vault.updatedAt = new Date().toISOString();
  _memoryCache.set(vault.yvUserId, vault);

  const encrypted = encryptVaultData(vault);

  // 1. Write to Vercel KV if configured
  const kvKey = `yai:vault:${vault.yvUserId}`;
  await kvSet(kvKey, encrypted);

  // 2. Write to Cookie
  if (response) {
    response.cookies.set({
      ...cookieOptions(),
      value: encrypted,
    });
  } else {
    try {
      const cookieStore = await cookies();
      cookieStore.set({
        ...cookieOptions(),
        value: encrypted,
      });
    } catch {
      // In some Next.js GET contexts cookies().set() throws — safe to ignore when response is not passed
    }
  }
}

// ---------------------------------------------------------------------------
// Helper: Key Masking
// ---------------------------------------------------------------------------

export function maskKey(rawKey: string): string {
  const trimmed = rawKey.trim();
  if (trimmed.length <= 10) return '********';
  const prefix = trimmed.slice(0, 6);
  const suffix = trimmed.slice(-4);
  return `${prefix}...${suffix}`;
}

// ---------------------------------------------------------------------------
// GitHub Storage Authorization API
// ---------------------------------------------------------------------------

export async function storeGitHubToken(
  yvUserId: string,
  token: string,
  response?: NextResponse,
): Promise<void> {
  const vault = await getUserVault(yvUserId);
  vault.githubToken = token;
  await saveUserVault(vault, response);
}

export async function getStoredGitHubToken(yvUserId: string): Promise<string | null> {
  const vault = await getUserVault(yvUserId);
  return vault.githubToken ?? null;
}

export async function deleteStoredGitHubToken(
  yvUserId: string,
  response?: NextResponse,
): Promise<void> {
  const vault = await getUserVault(yvUserId);
  delete vault.githubToken;
  await saveUserVault(vault, response);
}

// ---------------------------------------------------------------------------
// AI Provider Key Management API
// ---------------------------------------------------------------------------

export async function storeProviderKey(
  yvUserId: string,
  provider: 'openrouter' | 'google-ai',
  rawKey: string,
  response?: NextResponse,
): Promise<void> {
  const trimmed = rawKey.trim();
  if (!trimmed) throw new Error('Provider key cannot be empty');

  const vault = await getUserVault(yvUserId);
  if (provider === 'openrouter') {
    vault.openrouterKey = trimmed;
    vault.openrouterMasked = maskKey(trimmed);
  } else if (provider === 'google-ai') {
    vault.googleAiKey = trimmed;
    vault.googleAiMasked = maskKey(trimmed);
  }

  await saveUserVault(vault, response);
}

export async function getProviderKey(
  yvUserId: string,
  provider: 'openrouter' | 'google-ai',
): Promise<string | null> {
  const vault = await getUserVault(yvUserId);
  if (provider === 'openrouter') return vault.openrouterKey ?? null;
  if (provider === 'google-ai') return vault.googleAiKey ?? null;
  return null;
}

export async function getProviderKeyStatus(
  yvUserId: string,
  provider: 'openrouter' | 'google-ai',
): Promise<ProviderKeyStatus> {
  const vault = await getUserVault(yvUserId);
  if (provider === 'openrouter') {
    return {
      provider,
      configured: Boolean(vault.openrouterKey),
      maskedKey: vault.openrouterMasked,
      storedAt: vault.updatedAt,
    };
  }
  if (provider === 'google-ai') {
    return {
      provider,
      configured: Boolean(vault.googleAiKey),
      maskedKey: vault.googleAiMasked,
      storedAt: vault.updatedAt,
    };
  }
  return { provider, configured: false };
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
  response?: NextResponse,
): Promise<void> {
  const vault = await getUserVault(yvUserId);
  if (provider === 'openrouter') {
    delete vault.openrouterKey;
    delete vault.openrouterMasked;
  } else if (provider === 'google-ai') {
    delete vault.googleAiKey;
    delete vault.googleAiMasked;
  }
  await saveUserVault(vault, response);
}
