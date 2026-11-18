/**
 * YAI Studio — GitHub storage authorization (server-only)
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * IMPORTANT: This is NOT the Yet Vast Auth GitHub identity linking flow.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * This module implements a SEPARATE GitHub OAuth flow to obtain a GitHub
 * access token for private repository CRUD. The user's Yet Vast identity
 * (authenticated via YVA OAuth) and the GitHub storage grant are independent
 * authorization concerns. A linked GitHub identity in Yet Vast Auth does NOT
 * automatically provide repository access tokens.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * SCOPE DECISION — `repo` vs fine-grained token:
 * ───────────────────────────────────────────────────────────────────────────
 * Classic OAuth App scope: `repo`
 *   - Grants full access to public and private repos.
 *   - Required for: creating private repos, reading/writing contents, checking
 *     privacy settings, verifying ownership.
 *   - Tradeoff: broad — covers ALL user repos, not just YVSApps_Data_YaiStudio.
 *
 * Fine-grained personal access token (PAT):
 *   - Can be scoped to a single repo with `contents:write` + `metadata:read`.
 *   - Better principle of least privilege for an existing repo.
 *   - LIMITATION: Fine-grained tokens cannot be issued through GitHub OAuth
 *     App flows (OAuth Apps issue classic tokens only). They require the user
 *     to manually create a PAT or use a GitHub App.
 *   - GitHub Apps with fine-grained installation permissions are the
 *     recommended long-term approach but require a registered GitHub App with
 *     installation approval from the user.
 *
 * CURRENT DECISION (v0):
 *   Use classic OAuth App with `repo` scope. This is the only approach
 *   compatible with the standard OAuth redirect flow.
 *
 * TODO (v1 — requires explicit approval):
 *   Migrate to a GitHub App with `contents:write` and `metadata:read`
 *   installation permissions, scoped to the single YVSApps_Data_YaiStudio
 *   repository. This eliminates the broad `repo` grant.
 * ───────────────────────────────────────────────────────────────────────────
 *
 * Token storage:
 *   Tokens are encrypted at rest with AES-256-GCM using
 *   YAI_CREDENTIAL_ENCRYPTION_KEY. The store is currently an in-memory Map.
 *   This is a stub — tokens are lost on server restart.
 *
 * TODO: Replace in-memory Map with an approved persistent encrypted secret
 *   store (e.g., Vercel KV with encryption, or similar) once the storage
 *   mechanism decision has been made and approved. See AGENTS.md "Stop and
 *   ask before" — do NOT introduce a database without demonstrated requirement
 *   and explicit approval.
 */
import 'server-only';

import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

// ---------------------------------------------------------------------------
// Environment helpers
// ---------------------------------------------------------------------------

function requireEnv(name: string): string {
  const val = process.env[name];
  if (!val || val.trim() === '') {
    throw new Error(
      `[YAI GitHub Auth] Environment variable ${name} is not set. ` +
        'Configure GitHub OAuth App credentials before enabling GitHub storage.',
    );
  }
  return val;
}

function getGitHubConfig() {
  return {
    clientId: requireEnv('YAI_GITHUB_CLIENT_ID'),
    clientSecret: requireEnv('YAI_GITHUB_CLIENT_SECRET'),
    callbackUri: `${process.env.NEXT_PUBLIC_YAI_ORIGIN ?? 'http://localhost:3000'}/api/auth/github/callback`,
  };
}

function getEncryptionKey(): Buffer {
  const key = requireEnv('YAI_CREDENTIAL_ENCRYPTION_KEY');
  // Expect a base64-encoded 32-byte key
  const buf = Buffer.from(key, 'base64');
  if (buf.length !== 32) {
    throw new Error(
      '[YAI GitHub Auth] YAI_CREDENTIAL_ENCRYPTION_KEY must be a base64-encoded 32-byte key. ' +
        'Generate with: openssl rand -base64 32',
    );
  }
  return buf;
}

// ---------------------------------------------------------------------------
// Token encryption/decryption (AES-256-GCM)
// ---------------------------------------------------------------------------

function encryptToken(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = randomBytes(12); // 96-bit IV for GCM
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  // Format: iv(12 bytes) | authTag(16 bytes) | ciphertext — base64 encoded
  return Buffer.concat([iv, authTag, encrypted]).toString('base64');
}

function decryptToken(ciphertext: string): string {
  const key = getEncryptionKey();
  const data = Buffer.from(ciphertext, 'base64');
  const iv = data.subarray(0, 12);
  const authTag = data.subarray(12, 28);
  const encrypted = data.subarray(28);
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);
  return decipher.update(encrypted) + decipher.final('utf8');
}

// ---------------------------------------------------------------------------
// In-memory token store (STUB — not persistent)
// ---------------------------------------------------------------------------

/**
 * TODO: Replace this in-memory Map with a persistent encrypted secret store.
 *
 * Requirements for the production store:
 * - Persistent across server restarts and horizontal scaling
 * - Encrypted at rest (tokens are already encrypted before storage, but the
 *   store itself should also be access-controlled)
 * - Keyed by yvUserId (server-verified, never browser-supplied)
 * - Supports TTL / expiry for token rotation
 * - Candidates: Vercel KV, AWS Secrets Manager, HashiCorp Vault
 * - Decision must be approved before implementation (see AGENTS.md)
 *
 * CURRENT LIMITATION: Tokens are lost on server restart.
 */
const _tokenStore = new Map<string, string>(); // yvUserId → encrypted token

console.warn(
  '[YAI GitHub Auth] WARN: Using in-memory token store. ' +
    'GitHub tokens are not persisted across server restarts. ' +
    'Replace with an approved persistent encrypted store before production.',
);

// ---------------------------------------------------------------------------
// GitHub user shape
// ---------------------------------------------------------------------------

export interface GitHubUser {
  login: string;
  id: number;
  name?: string;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Build the GitHub OAuth authorization URL.
 *
 * Scope: `repo` (see file header for scope decision rationale).
 * @param state — CSRF state token; must be validated in the callback
 */
export function buildGitHubAuthUrl(state: string): string {
  const { clientId, callbackUri } = getGitHubConfig();

  const url = new URL('https://github.com/login/oauth/authorize');
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('redirect_uri', callbackUri);
  url.searchParams.set('scope', 'repo');
  url.searchParams.set('state', state);
  // Request only the user's own account access
  url.searchParams.set('allow_signup', 'false');
  return url.toString();
}

/**
 * Exchange a GitHub authorization code for an access token.
 *
 * Returns the raw token; callers must immediately pass it to
 * storeGitHubToken — it must NEVER be returned to the browser.
 *
 * @throws on network error or GitHub error response
 */
export async function exchangeGitHubCode(code: string): Promise<string> {
  const { clientId, clientSecret, callbackUri } = getGitHubConfig();

  const response = await fetch(
    'https://github.com/login/oauth/access_token',
    {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: callbackUri,
      }).toString(),
    },
  );

  if (!response.ok) {
    throw new Error(
      `[YAI GitHub Auth] Token exchange HTTP error: ${response.status}`,
    );
  }

  const data = (await response.json()) as {
    access_token?: string;
    error?: string;
    error_description?: string;
  };

  if (data.error || !data.access_token) {
    throw new Error(
      `[YAI GitHub Auth] GitHub returned an error: ${data.error ?? 'no access_token'} — ${data.error_description ?? ''}`,
    );
  }

  return data.access_token;
}

/**
 * Fetch the authenticated GitHub user's profile.
 *
 * Used to verify the GitHub account identity and bind it to the YAI session.
 * Never persisted directly — only the login and numeric ID are stored in session.
 */
export async function getGitHubUser(token: string): Promise<GitHubUser> {
  const response = await fetch('https://api.github.com/user', {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  });

  if (!response.ok) {
    throw new Error(
      `[YAI GitHub Auth] Failed to fetch GitHub user: HTTP ${response.status}`,
    );
  }

  const user = (await response.json()) as {
    login: string;
    id: number;
    name?: string;
  };

  return {
    login: user.login,
    id: user.id,
    name: user.name,
  };
}

/**
 * Encrypt and store a GitHub access token server-side.
 *
 * Key: yvUserId (server-verified — never accept from browser).
 * Token is encrypted with AES-256-GCM before storage.
 *
 * TODO: Replace in-memory store with approved persistent encrypted store.
 */
export function storeGitHubToken(yvUserId: string, token: string): void {
  if (!yvUserId || yvUserId.trim() === '') {
    throw new Error(
      '[YAI GitHub Auth] storeGitHubToken: yvUserId must be a non-empty ' +
        'server-verified user ID.',
    );
  }
  const encrypted = encryptToken(token);
  _tokenStore.set(yvUserId, encrypted);
}

/**
 * Retrieve and decrypt a stored GitHub access token for a user.
 *
 * Returns null if no token is stored (user has not connected GitHub storage).
 *
 * Key: yvUserId (server-verified — never accept from browser).
 *
 * TODO: Replace in-memory store with approved persistent encrypted store.
 */
export function getStoredGitHubToken(yvUserId: string): string | null {
  const encrypted = _tokenStore.get(yvUserId);
  if (!encrypted) return null;
  try {
    return decryptToken(encrypted);
  } catch {
    // Corrupted ciphertext or key mismatch — treat as no token
    console.error(
      `[YAI GitHub Auth] Failed to decrypt stored token for user ${yvUserId}. ` +
        'Token may be invalid or the encryption key may have changed.',
    );
    _tokenStore.delete(yvUserId);
    return null;
  }
}

/**
 * Delete a stored GitHub token (e.g. on disconnect / revocation).
 */
export function deleteStoredGitHubToken(yvUserId: string): void {
  _tokenStore.delete(yvUserId);
}
