/**
 * YAI Studio — Yet Vast Auth SDK Integration (server-only)
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * AUTH REGISTRATION GATE
 * ═══════════════════════════════════════════════════════════════════════════
 * To connect to production Yet Vast Auth:
 *  1. Register the application at https://auth.yetvast.com/admin/applications/register
 *  2. Configure YAI_LOGICAL_APP_ID / YETVAST_AUTH_APP_ID
 *  3. Configure exact callback URI in Auth Admin: https://<domain>/api/auth/callback
 *  4. Confirm provider policy (GitHub ephemeral vs Google persistent) with Yet Vast Auth Admins.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * SDK version: @yetvast/auth ^0.2.0 (ESM export under @yetvast/auth/server)
 * JWKS verification via jose against: /.well-known/jwks.json
 * Signing algorithms: EdDSA / RS256
 */
import 'server-only';

import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose';
import type { NextRequest } from 'next/server';
import { getAppBaseUrl } from '@/lib/auth/url-utils';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

export interface YetvastAuthConfig {
  authServerOrigin: string; // e.g. https://auth.yetvast.com
  logicalAppId: string;     // e.g. 'yai-studio'
  redirectUri: string;      // e.g. https://<domain>/api/auth/callback
}

export function getAuthConfig(request?: NextRequest): YetvastAuthConfig {
  const origin =
    process.env.YETVAST_AUTH_ORIGIN ||
    process.env.YETVAST_AUTH_URL ||
    'https://auth.yetvast.com';
  const appId =
    process.env.YAI_LOGICAL_APP_ID ||
    process.env.YETVAST_AUTH_APP_ID ||
    'yai-studio';
  const base = getAppBaseUrl(request);
  const redirectUri =
    process.env.YAI_AUTH_CALLBACK_URI ||
    process.env.YETVAST_AUTH_CALLBACK_URL ||
    `${base}/api/auth/callback`;

  return {
    authServerOrigin: origin.replace(/\/$/, ''),
    logicalAppId: appId,
    redirectUri,
  };
}

// ---------------------------------------------------------------------------
// @yetvast/auth SDK — Conditional ESM Import
// ---------------------------------------------------------------------------

interface YetvastAuthSDK {
  createAppAuthorizeRedirect: (params: {
    authOrigin: string;
    logicalAppId: string;
    redirectUri: string;
  }) => string;
  exchangeCodeForAssertion: (params: {
    authOrigin: string;
    logicalAppId: string;
    code: string;
    codeVerifier: string;
    redirectUri: string;
  }) => Promise<{ assertion: string }>;
}

let _sdk: YetvastAuthSDK | null = null;
let _sdkLoadAttempted = false;
let _sdkLoadError: string | null = null;

async function loadSDK(): Promise<YetvastAuthSDK | null> {
  if (_sdkLoadAttempted) return _sdk;
  _sdkLoadAttempted = true;
  try {
    const serverModule = await import('@yetvast/auth/server');
    if (
      typeof serverModule.createAppAuthorizeRedirect === 'function' &&
      typeof serverModule.exchangeCodeForAssertion === 'function'
    ) {
      _sdk = {
        createAppAuthorizeRedirect: (params) => {
          const res = serverModule.createAppAuthorizeRedirect({
            authServerOrigin: params.authOrigin,
            applicationId: params.logicalAppId as any,
            redirectUri: params.redirectUri,
          });
          return res.authorizeUrl;
        },
        exchangeCodeForAssertion: async (params) => {
          const res = await serverModule.exchangeCodeForAssertion({
            authServerOrigin: params.authOrigin,
            applicationId: params.logicalAppId as any,
            code: params.code,
            codeVerifier: params.codeVerifier,
            redirectUri: params.redirectUri,
          });
          return { assertion: res.assertionToken };
        },
      };
    } else {
      _sdkLoadError = '@yetvast/auth/server is missing expected exports.';
      _sdk = null;
    }
  } catch (err) {
    _sdkLoadError =
      `Could not load @yetvast/auth/server: ${(err as Error).message}. ` +
      'Ensure @yetvast/auth is installed and run npm install.';
    _sdk = null;
  }
  return _sdk;
}

// ---------------------------------------------------------------------------
// JWKS Client
// ---------------------------------------------------------------------------

let _jwks: ReturnType<typeof createRemoteJWKSet> | null = null;

function getJWKS(authOrigin: string) {
  if (!_jwks) {
    _jwks = createRemoteJWKSet(
      new URL(`${authOrigin}/.well-known/jwks.json`),
    );
  }
  return _jwks;
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
}

type AssertionPayload = JWTPayload & {
  sub: string;
  email?: string;
  github_login?: string;
  login?: string;
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Build the Yet Vast Auth authorization URL using PKCE.
 */
export async function buildAuthorizationUrl(
  state: string,
  codeChallenge: string,
  codeChallengeMethod: 'S256',
  request?: NextRequest,
): Promise<string> {
  const config = getAuthConfig(request);
  const sdk = await loadSDK();

  if (sdk) {
    const base = sdk.createAppAuthorizeRedirect({
      authOrigin: config.authServerOrigin,
      logicalAppId: config.logicalAppId,
      redirectUri: config.redirectUri,
    });
    const url = new URL(base);
    url.searchParams.set('state', state);
    url.searchParams.set('code_challenge', codeChallenge);
    url.searchParams.set('code_challenge_method', codeChallengeMethod);
    return url.toString();
  }

  // Fallback: construct standard OAuth PKCE authorize URL
  const url = new URL(`${config.authServerOrigin}/api/oauth/start`);
  url.searchParams.set('logical_app_id', config.logicalAppId);
  url.searchParams.set('redirect_uri', config.redirectUri);
  url.searchParams.set('state', state);
  url.searchParams.set('code_challenge', codeChallenge);
  url.searchParams.set('code_challenge_method', codeChallengeMethod);
  url.searchParams.set('response_type', 'code');
  return url.toString();
}

/**
 * Convenience alias for buildAuthorizationUrl returning state + codeVerifier bundle.
 */
export async function buildAuthorizeUrl(
  codeVerifier: string,
  codeChallenge: string,
  state: string,
  provider?: 'github' | 'google',
  request?: NextRequest,
): Promise<AuthorizeUrlResult> {
  const urlStr = await buildAuthorizationUrl(state, codeChallenge, 'S256', request);
  const url = new URL(urlStr);
  if (provider) {
    url.searchParams.set('identity_provider', provider);
  }
  return { url: url.toString(), state, codeVerifier };
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
  const config = getAuthConfig(request);
  const targetRedirectUri = redirectUri || config.redirectUri;
  const sdk = await loadSDK();

  if (sdk) {
    return sdk.exchangeCodeForAssertion({
      code,
      codeVerifier,
      redirectUri: targetRedirectUri,
      logicalAppId: config.logicalAppId,
      authOrigin: config.authServerOrigin,
    });
  }

  // Fallback: raw token exchange
  const response = await fetch(`${config.authServerOrigin}/api/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      code_verifier: codeVerifier,
      redirect_uri: targetRedirectUri,
      logical_app_id: config.logicalAppId,
    }).toString(),
    cache: 'no-store',
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(
      `[YAI Auth] Token exchange failed: HTTP ${response.status}. ${body}`,
    );
  }

  const data = (await response.json()) as { assertion?: string };
  if (!data.assertion) {
    throw new Error('[YAI Auth] Token exchange returned no assertion.');
  }
  return { assertion: data.assertion };
}

/**
 * Convenience alias for exchangeCode + verifyAssertion.
 */
export async function exchangeAndVerifyCode(
  code: string,
  codeVerifier: string,
  request?: NextRequest,
): Promise<VerifiedYetvastIdentity> {
  const { assertion } = await exchangeCode(code, codeVerifier, undefined, request);
  return verifyAssertion(assertion, request);
}

/**
 * Verify a Yet Vast Auth signed identity assertion against central JWKS.
 */
export async function verifyAssertion(
  assertion: string,
  request?: NextRequest,
): Promise<VerifiedYetvastIdentity> {
  const config = getAuthConfig(request);
  const jwks = getJWKS(config.authServerOrigin);

  try {
    const { payload } = await jwtVerify<AssertionPayload>(assertion, jwks, {
      issuer: config.authServerOrigin,
      audience: config.logicalAppId,
      algorithms: ['EdDSA', 'RS256'],
    });

    if (!payload.sub) {
      throw new Error('[YAI Auth] Assertion missing sub claim (yvUserId).');
    }

    return {
      yvUserId: payload.sub,
      email: payload.email,
      githubLogin: payload.github_login || payload.login,
    };
  } catch (err) {
    // If JWKS verification fails in development mode (placeholder auth server)
    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        `[YAI Auth] Token verification failed: ${(err as Error).message}`,
      );
    }

    console.warn(
      `[YAI Auth] JWKS verification failed (${(err as Error).message}). ` +
        'Using unverified payload decode for development mode only.',
    );

    return decodePayloadDevOnly(assertion);
  }
}

/** Development-only decode: DO NOT USE IN PRODUCTION */
function decodePayloadDevOnly(token: string): VerifiedYetvastIdentity {
  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new Error('[YAI Auth] Malformed JWT token');
  }
  const payloadJson = Buffer.from(parts[1], 'base64url').toString('utf-8');
  const payload = JSON.parse(payloadJson) as Record<string, unknown>;

  const sub = (payload.sub || payload.uid || payload.userId) as string;
  if (!sub) {
    throw new Error('[YAI Auth] Token payload missing sub/userId');
  }

  return {
    yvUserId: sub,
    email: payload.email as string | undefined,
    githubLogin: (payload.github_login || payload.login) as string | undefined,
  };
}

/** Diagnostic helper for status checks */
export function getSdkDiagnostics(): {
  sdkAvailable: boolean;
  sdkLoadAttempted: boolean;
  sdkLoadError: string | null;
} {
  return {
    sdkAvailable: _sdk !== null,
    sdkLoadAttempted: _sdkLoadAttempted,
    sdkLoadError: _sdkLoadError,
  };
}
