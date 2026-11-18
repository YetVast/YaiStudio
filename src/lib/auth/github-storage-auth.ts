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
 * SCOPE: `repo` (grants permission to discover, verify, create and update
 * private repository `YVSApps_Data_YaiStudio`).
 *
 * Token storage:
 * Delegated to `@/lib/storage/credential-vault` which implements:
 * 1. AES-256-GCM encryption at rest with YAI_CREDENTIAL_ENCRYPTION_KEY.
 * 2. Vercel KV / Upstash Redis REST persistent storage across serverless instances.
 * 3. Encrypted host-bound cookie fallback.
 * 4. Zero exposure to client-side code, logs, or API responses.
 */
import 'server-only';

import type { NextRequest } from 'next/server';
import { getAppBaseUrl } from '@/lib/auth/url-utils';

export {
  storeGitHubToken,
  getStoredGitHubToken,
  deleteStoredGitHubToken,
} from '@/lib/storage/credential-vault';

// ---------------------------------------------------------------------------
// Environment & Configuration
// ---------------------------------------------------------------------------

function getGitHubConfig(request?: NextRequest) {
  const clientId = process.env.YAI_GITHUB_CLIENT_ID || process.env.GITHUB_CLIENT_ID;
  const clientSecret = process.env.YAI_GITHUB_CLIENT_SECRET || process.env.GITHUB_CLIENT_SECRET;

  if (!clientId || clientId.trim() === '') {
    throw new Error(
      '[YAI GitHub Auth] GITHUB_CLIENT_ID or YAI_GITHUB_CLIENT_ID is not set. ' +
        'Configure your GitHub OAuth App credentials before enabling GitHub storage.',
    );
  }
  if (!clientSecret || clientSecret.trim() === '') {
    throw new Error(
      '[YAI GitHub Auth] GITHUB_CLIENT_SECRET or YAI_GITHUB_CLIENT_SECRET is not set. ' +
        'Configure your GitHub OAuth App credentials before enabling GitHub storage.',
    );
  }

  const base = getAppBaseUrl(request);
  const callbackUri = process.env.YAI_GITHUB_CALLBACK_URI || `${base}/api/auth/github/callback`;

  return {
    clientId: clientId.trim(),
    clientSecret: clientSecret.trim(),
    callbackUri,
  };
}

// ---------------------------------------------------------------------------
// GitHub User Shape
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
 * Scope: `repo`.
 * @param state — CSRF state token; must be validated in the callback.
 * @param request — Optional NextRequest to dynamically infer the host domain on Vercel.
 */
export function buildGitHubAuthUrl(state: string, request?: NextRequest): string {
  const { clientId, callbackUri } = getGitHubConfig(request);

  const url = new URL('https://github.com/login/oauth/authorize');
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('redirect_uri', callbackUri);
  url.searchParams.set('scope', 'repo');
  url.searchParams.set('state', state);
  url.searchParams.set('allow_signup', 'false');
  return url.toString();
}

/**
 * Exchange a GitHub authorization code for an access token.
 *
 * Returns the raw token; callers must immediately pass it to
 * storeGitHubToken — it must NEVER be returned to the browser.
 */
export async function exchangeGitHubCode(
  code: string,
  request?: NextRequest,
): Promise<string> {
  const { clientId, clientSecret, callbackUri } = getGitHubConfig(request);

  const response = await fetch('https://github.com/login/oauth/access_token', {
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
  });

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
