/**
 * YAI Studio — Yet Vast Auth SDK Integration (server-only)
 *
 * Uses the official @yetvast/auth SDK with registry-backed consumer
 * identity discovery and canonical callback derivation.
 *
 * Initialized using only the Auth server origin and YaiStudio's primary
 * application origin. No Application ID is hardcoded or configured; the SDK
 * dynamically queries the central discovery endpoint (/api/applications/discover)
 * to resolve the approved registration (yaistudio-yetvast-com-4dfnb2r9).
 *
 * SDK version: @yetvast/auth ^0.3.0
 */
import 'server-only';

import type { NextRequest } from 'next/server';
import {
  createYetVastAuthClient,
  type YetVastAuthConsumerClient,
  type AppAuthorizeRedirectResult,
  type ExchangeCodeForAssertionResult,
  type DiscoveredApplicationIdentity,
} from '@yetvast/auth/server';
import type { ApplicationIdentityAssertion } from '@yetvast/auth';
import { getAppBaseUrl } from '@/lib/auth/url-utils';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

export interface YetvastAuthConfig {
  authServerOrigin: string; // e.g. https://auth.yetvast.com
  appOrigin: string;        // e.g. https://yaistudio.yetvast.com
}

/**
 * Returns the resolved Yet Vast Auth configuration.
 * Note: No Application ID is configured here. The SDK automatically discovers
 * the canonical applicationId from Yet Vast Auth's central registry by appOrigin.
 */
export function getYetVastAuthConfig(request?: NextRequest): YetvastAuthConfig {
  const authServerOrigin = (
    process.env.YETVAST_AUTH_ORIGIN ||
    process.env.YETVAST_AUTH_URL ||
    'https://auth.yetvast.com'
  ).trim().replace(/\/+$/, '');

  // Resolve application origin: explicit environment override, or dynamic request URL, or production canonical
  const explicitOrigin = (
    process.env.NEXT_PUBLIC_YAI_ORIGIN ||
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.YAI_PRIMARY_ORIGIN ||
    ''
  ).trim().replace(/\/+$/, '');

  const appOrigin = explicitOrigin || getAppBaseUrl(request) || 'https://yaistudio.yetvast.com';

  return {
    authServerOrigin,
    appOrigin,
  };
}

// ---------------------------------------------------------------------------
// Client Cache & Factory
// ---------------------------------------------------------------------------

const clientCache = new Map<string, YetVastAuthConsumerClient>();

export function getYetVastAuthClient(
  request?: NextRequest,
  options?: { fetchImpl?: typeof fetch },
): YetVastAuthConsumerClient {
  const config = getYetVastAuthConfig(request);
  const cacheKey = `${config.authServerOrigin}|${config.appOrigin}|${options?.fetchImpl ? 'custom-fetch' : 'default-fetch'}`;

  if (!options?.fetchImpl) {
    const cached = clientCache.get(cacheKey);
    if (cached) return cached;
  }

  const client = createYetVastAuthClient({
    authServerOrigin: config.authServerOrigin,
    appOrigin: config.appOrigin,
    ...(process.env.YETVAST_AUTH_CLIENT_SECRET
      ? { clientSecret: process.env.YETVAST_AUTH_CLIENT_SECRET.trim() }
      : {}),
    ...(options?.fetchImpl ? { fetchImpl: options.fetchImpl } : {}),
  });

  if (!options?.fetchImpl) {
    clientCache.set(cacheKey, client);
  }

  return client;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface VerifiedYetvastIdentity {
  yvUserId: string;
  email?: string;
  githubLogin?: string;
}

export interface AuthorizeUrlResult {
  url: string;
  state: string;
  codeVerifier: string;
  applicationId: string;
  redirectUri: string;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Creates the authorization redirect URL with PKCE parameters, automatically
 * discovering canonical registered Application ID and callback URL via the SDK.
 */
export async function createAuthorizeRedirect(options?: {
  provider?: string;
  redirectUri?: string;
  request?: NextRequest;
  fetchImpl?: typeof fetch;
}): Promise<AppAuthorizeRedirectResult> {
  const client = getYetVastAuthClient(options?.request, { fetchImpl: options?.fetchImpl });
  return client.createAuthorizeRedirect({
    ...(options?.provider ? { provider: options.provider } : {}),
    ...(options?.redirectUri ? { redirectUri: options.redirectUri } : {}),
  });
}

/**
 * Build authorization URL for a given state & code challenge.
 * Automatically queries Yet Vast Auth discovery to populate canonical app_id.
 */
export async function buildAuthorizationUrl(
  state: string,
  codeChallenge: string,
  codeChallengeMethod: 'S256',
  request?: NextRequest,
): Promise<string> {
  const client = getYetVastAuthClient(request);
  const identity = await client.discoverIdentity();
  const redirectUri = client.getCanonicalCallbackUrl();

  const url = new URL('/authorize', client.config.authServerOrigin);
  url.searchParams.set('app_id', identity.applicationId);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('state', state);
  url.searchParams.set('code_challenge', codeChallenge);
  url.searchParams.set('code_challenge_method', codeChallengeMethod);

  return url.toString();
}

/**
 * Convenience alias returning state, codeVerifier, and canonical authorization URL.
 */
export async function buildAuthorizeUrl(
  codeVerifier: string,
  codeChallenge: string,
  state: string,
  provider?: 'github' | 'google',
  request?: NextRequest,
): Promise<AuthorizeUrlResult> {
  const client = getYetVastAuthClient(request);
  const identity = await client.discoverIdentity();
  const redirectUri = client.getCanonicalCallbackUrl();

  const url = new URL('/authorize', client.config.authServerOrigin);
  url.searchParams.set('app_id', identity.applicationId);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('state', state);
  url.searchParams.set('code_challenge', codeChallenge);
  url.searchParams.set('code_challenge_method', 'S256');
  if (provider) {
    url.searchParams.set('provider', provider);
  }

  return {
    url: url.toString(),
    state,
    codeVerifier,
    applicationId: identity.applicationId,
    redirectUri,
  };
}

/**
 * Exchange an authorization code + PKCE verifier for a signed identity assertion.
 */
export async function exchangeCode(
  code: string,
  codeVerifier: string,
  redirectUri?: string,
  request?: NextRequest,
): Promise<{ assertion: string }> {
  const client = getYetVastAuthClient(request);
  const result = await client.exchangeCallback({
    code,
    codeVerifier,
    ...(redirectUri ? { redirectUri } : {}),
  });
  return { assertion: result.assertionToken };
}

/**
 * Verify a Yet Vast Auth signed identity assertion against central JWKS.
 */
export async function verifyAssertion(
  assertionToken: string,
  request?: NextRequest,
): Promise<VerifiedYetvastIdentity> {
  const client = getYetVastAuthClient(request);
  const payload = await client.verifyAssertion(assertionToken);
  const yvUserId = (payload.yvUserId || payload.sub) as string;

  return {
    yvUserId,
    email: payload.email ?? undefined,
    githubLogin:
      payload.provider === 'github'
        ? (payload.displayName || payload.providerSubjectId)
        : undefined,
  };
}

/**
 * Convenience helper to exchange authorization code and verify assertion in one step.
 */
export async function exchangeAndVerifyCode(
  code: string,
  codeVerifier: string,
  request?: NextRequest,
): Promise<VerifiedYetvastIdentity> {
  const client = getYetVastAuthClient(request);
  const result = await client.exchangeCallback({
    code,
    codeVerifier,
  });

  const yvUserId = (result.assertion.yvUserId || result.assertion.sub) as string;
  return {
    yvUserId,
    email: result.assertion.email ?? undefined,
    githubLogin:
      result.assertion.provider === 'github'
        ? (result.assertion.displayName || result.assertion.providerSubjectId)
        : undefined,
  };
}

/**
 * Discover canonical application registration from the central registry.
 */
export async function discoverIdentity(
  request?: NextRequest,
): Promise<DiscoveredApplicationIdentity> {
  const client = getYetVastAuthClient(request);
  return client.discoverIdentity();
}

/** Diagnostic helper for status checks */
export function getSdkDiagnostics(): {
  sdkAvailable: boolean;
  version: string;
} {
  return {
    sdkAvailable: typeof createYetVastAuthClient === 'function',
    version: '0.3.0',
  };
}
