/**
 * YAI Studio — Yet Vast Auth SDK integration (server-only)
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * AUTH REGISTRATION GATE
 * ═══════════════════════════════════════════════════════════════════════════
 * YAI Studio has NOT yet been registered at auth.yetvast.com.
 * No real OAuth flow can run until:
 *  1. The application is registered at https://auth.yetvast.com/admin/applications/register
 *  2. A logicalAppId (YAI_LOGICAL_APP_ID) is assigned
 *  3. The exact callback URI (YAI_AUTH_CALLBACK_URI) is approved
 *  4. The provider policy is confirmed with Yet Vast Auth Admins
 *
 * All env vars required by this module are PLACEHOLDER until registration.
 * Missing vars cause descriptive runtime errors — they do NOT crash at build.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * SDK version target: @yetvast/auth ^0.3.0
 * If the package cannot be imported (NODE_AUTH_TOKEN absent at dev time),
 * stub functions throw descriptive errors rather than crashing the build.
 *
 * JWKS verification is always done in-process via jose against:
 *   https://auth.yetvast.com/.well-known/jwks.json
 *
 * Signing algorithm: EdDSA (Ed25519) per YVA-PROJECT-HANDBOOK §5.2
 */
import 'server-only';

import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose';

// ---------------------------------------------------------------------------
// @yetvast/auth SDK — conditional import
// ---------------------------------------------------------------------------

/**
 * SDK shape we depend on (subset of @yetvast/auth ^0.3.0 exports).
 * We use a dynamic import so the build succeeds even when the private
 * package cannot be resolved (NODE_AUTH_TOKEN absent in local dev).
 */
interface YetvastAuthSDK {
  createAppAuthorizeRedirect: (params: {
    logicalAppId: string;
    redirectUri: string;
    state: string;
    codeChallenge: string;
    codeChallengeMethod: 'S256';
    authOrigin: string;
  }) => string;

  exchangeCodeForAssertion: (params: {
    code: string;
    codeVerifier: string;
    redirectUri: string;
    logicalAppId: string;
    authOrigin: string;
  }) => Promise<{ assertion: string }>;
}

let _sdk: YetvastAuthSDK | null = null;
let _sdkLoadAttempted = false;
let _sdkLoadError: string | null = null;

async function loadSDK(): Promise<YetvastAuthSDK | null> {
  if (_sdkLoadAttempted) return _sdk;
  _sdkLoadAttempted = true;
  try {
    // Dynamic import — does not throw at module-load time if unresolvable
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    _sdk = require('@yetvast/auth') as YetvastAuthSDK;

    // Validate that the exports we depend on are present
    if (
      typeof _sdk?.createAppAuthorizeRedirect !== 'function' ||
      typeof _sdk?.exchangeCodeForAssertion !== 'function'
    ) {
      _sdkLoadError =
        '@yetvast/auth is installed but is missing expected exports ' +
        '(createAppAuthorizeRedirect, exchangeCodeForAssertion). ' +
        'Check the installed package version — expected ^0.3.0.';
      _sdk = null;
    }
  } catch (err) {
    _sdkLoadError =
      `Could not load @yetvast/auth: ${(err as Error).message}. ` +
      'Ensure NODE_AUTH_TOKEN is set for the GitHub Packages registry ' +
      '(@yetvast:registry=https://npm.pkg.github.com) and run npm install.';
    _sdk = null;
  }
  return _sdk;
}

// ---------------------------------------------------------------------------
// Environment helpers
// ---------------------------------------------------------------------------

function requireEnv(name: string): string {
  const val = process.env[name];
  if (!val || val.trim() === '') {
    throw new Error(
      `[YAI Auth] Environment variable ${name} is not set. ` +
        'YAI Studio has not yet been registered at auth.yetvast.com. ' +
        'Complete the registration and set all required env vars before ' +
        'enabling authentication.',
    );
  }
  return val;
}

function getAuthConfig() {
  return {
    authOrigin: requireEnv('YETVAST_AUTH_ORIGIN'),
    logicalAppId: requireEnv('YAI_LOGICAL_APP_ID'),
    callbackUri: requireEnv('YAI_AUTH_CALLBACK_URI'),
  };
}

// ---------------------------------------------------------------------------
// JWKS
// ---------------------------------------------------------------------------

let _jwks: ReturnType<typeof createRemoteJWKSet> | null = null;

function getJWKS(): ReturnType<typeof createRemoteJWKSet> {
  if (!_jwks) {
    const authOrigin = process.env.YETVAST_AUTH_ORIGIN ?? 'https://auth.yetvast.com';
    _jwks = createRemoteJWKSet(
      new URL(`${authOrigin}/.well-known/jwks.json`),
    );
  }
  return _jwks;
}

// ---------------------------------------------------------------------------
// Verified identity assertion shape
// ---------------------------------------------------------------------------

export interface VerifiedYetvastIdentity {
  yvUserId: string;
  email?: string;
  githubLogin?: string;
}

type AssertionPayload = JWTPayload & {
  sub: string;
  email?: string;
  github_login?: string;
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Build the Yet Vast Auth authorization URL to redirect the user to.
 *
 * Uses @yetvast/auth SDK if available; falls back to a manual URL build
 * matching the documented OAuth initiation contract.
 *
 * @throws if required env vars are not set (AUTH REGISTRATION GATE)
 * @throws if SDK is unavailable and cannot construct URL
 */
export async function buildAuthorizationUrl(
  state: string,
  codeChallenge: string,
  codeChallengeMethod: 'S256',
): Promise<string> {
  const { authOrigin, logicalAppId, callbackUri } = getAuthConfig();
  const sdk = await loadSDK();

  if (sdk) {
    return sdk.createAppAuthorizeRedirect({
      logicalAppId,
      redirectUri: callbackUri,
      state,
      codeChallenge,
      codeChallengeMethod,
      authOrigin,
    });
  }

  // SDK unavailable — build URL manually matching documented /api/oauth/start contract
  if (_sdkLoadError) {
    console.warn(`[YAI Auth] SDK unavailable: ${_sdkLoadError}`);
  }

  const url = new URL(`${authOrigin}/api/oauth/start`);
  url.searchParams.set('logical_app_id', logicalAppId);
  url.searchParams.set('redirect_uri', callbackUri);
  url.searchParams.set('state', state);
  url.searchParams.set('code_challenge', codeChallenge);
  url.searchParams.set('code_challenge_method', codeChallengeMethod);
  url.searchParams.set('response_type', 'code');
  return url.toString();
}

/**
 * Exchange an authorization code + PKCE verifier for a signed identity assertion.
 *
 * @throws if required env vars are not set (AUTH REGISTRATION GATE)
 * @throws if SDK unavailable or exchange fails
 */
export async function exchangeCode(
  code: string,
  codeVerifier: string,
  redirectUri: string,
): Promise<{ assertion: string }> {
  const { authOrigin, logicalAppId } = getAuthConfig();
  const sdk = await loadSDK();

  if (sdk) {
    return sdk.exchangeCodeForAssertion({
      code,
      codeVerifier,
      redirectUri,
      logicalAppId,
      authOrigin,
    });
  }

  // SDK unavailable — attempt raw HTTP exchange matching /api/token contract
  if (_sdkLoadError) {
    throw new Error(
      `[YAI Auth] Cannot exchange authorization code: SDK unavailable. ${_sdkLoadError}`,
    );
  }

  const response = await fetch(`${authOrigin}/api/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      code_verifier: codeVerifier,
      redirect_uri: redirectUri,
      logical_app_id: logicalAppId,
    }).toString(),
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
 * Verify a Yet Vast Auth signed identity assertion against central JWKS.
 *
 * Validates: issuer, audience, expiry, signature (EdDSA/RS256).
 *
 * @throws if assertion is invalid, expired, or env vars are missing
 */
export async function verifyAssertion(
  assertion: string,
): Promise<VerifiedYetvastIdentity> {
  const { authOrigin, logicalAppId } = getAuthConfig();
  const jwks = getJWKS();

  const { payload } = await jwtVerify<AssertionPayload>(assertion, jwks, {
    issuer: authOrigin,
    audience: logicalAppId,
    algorithms: ['EdDSA', 'RS256'],
  });

  if (!payload.sub) {
    throw new Error(
      '[YAI Auth] Assertion missing sub claim (yvUserId). ' +
        'Unexpected response from Yet Vast Auth.',
    );
  }

  return {
    yvUserId: payload.sub,
    email: payload.email,
    githubLogin: payload.github_login,
  };
}

/**
 * Returns diagnostic information about the SDK load state.
 * Safe to call in health/status endpoints.
 */
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
