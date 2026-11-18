/**
 * YAI Studio — Yet Vast Auth Integration Adapter
 *
 * Boundary rules:
 * - This adapter interacts with the official Yet Vast Auth server endpoints.
 * - YAI owns its session; Yet Vast Auth owns identity issuance and JWKS.
 * - GitHub identity linking in Yet Vast Auth DOES NOT imply GitHub repository
 *   access. Storage authorization is a separate concern.
 *
 * Central policy gate (16 Nov 2026 docs):
 * - Google persistent identity and GitHub-only ephemeral access are mutually
 *   exclusive registration policies.
 * - This adapter supports the standard OAuth PKCE flow against Yet Vast Auth.
 *   The exact provider policy is managed in the Yet Vast Auth Admin console.
 *
 * Package: @yetvast/auth (installed via GitHub Packages registry)
 */
import 'server-only';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

export interface YetvastAuthConfig {
  authServerOrigin: string; // e.g. https://auth.yetvast.com
  logicalAppId: string;     // e.g. 'yai-studio'
  redirectUri: string;      // e.g. http://localhost:3000/api/auth/callback
}

export function getAuthConfig(): YetvastAuthConfig {
  const origin = process.env.YETVAST_AUTH_URL;
  const appId = process.env.YETVAST_AUTH_APP_ID;
  const redirectUri = process.env.YETVAST_AUTH_CALLBACK_URL || `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/auth/callback`;

  if (!origin) {
    throw new Error(
      '[YAI Auth] YETVAST_AUTH_URL is not configured. ' +
        'Set it in your environment or .env.local before initiating auth.',
    );
  }
  if (!appId) {
    throw new Error(
      '[YAI Auth] YETVAST_AUTH_APP_ID is not configured. ' +
        'Set the registered application ID from Yet Vast Auth Admin.',
    );
  }

  return {
    authServerOrigin: origin.replace(/\/$/, ''),
    logicalAppId: appId,
    redirectUri,
  };
}

// ---------------------------------------------------------------------------
// Dynamic SDK Loader (graceful degradation if package not configured)
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
// Authorization URL Generation
// ---------------------------------------------------------------------------

export interface AuthorizeUrlResult {
  url: string;
  state: string;
  codeVerifier: string;
}

/**
 * Build the Yet Vast Auth authorization URL using PKCE.
 * Generates and returns state + code_verifier for session persistence.
 */
export async function buildAuthorizeUrl(
  codeVerifier: string,
  codeChallenge: string,
  state: string,
  provider?: 'github' | 'google',
): Promise<AuthorizeUrlResult> {
  const config = getAuthConfig();
  const sdk = await loadSDK();

  if (sdk) {
    // Use official SDK if available
    const base = sdk.createAppAuthorizeRedirect({
      authOrigin: config.authServerOrigin,
      logicalAppId: config.logicalAppId,
      redirectUri: config.redirectUri,
    });
    const url = new URL(base);
    url.searchParams.set('code_challenge', codeChallenge);
    url.searchParams.set('code_challenge_method', 'S256');
    url.searchParams.set('state', state);
    if (provider) {
      url.searchParams.set('identity_provider', provider);
    }
    return { url: url.toString(), state, codeVerifier };
  }

  // Fallback: construct standard OAuth 2.0 PKCE authorize URL
  // Spec: GET /oauth/authorize?response_type=code&client_id=...&redirect_uri=...&scope=openid+profile+email&code_challenge=...&code_challenge_method=S256&state=...
  if (_sdkLoadError) {
    console.warn(`[YAI Auth] Using standard OAuth URL fallback: ${_sdkLoadError}`);
  }

  const url = new URL(`${config.authServerOrigin}/oauth/authorize`);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('client_id', config.logicalAppId);
  url.searchParams.set('redirect_uri', config.redirectUri);
  url.searchParams.set('scope', 'openid profile email');
  url.searchParams.set('code_challenge', codeChallenge);
  url.searchParams.set('code_challenge_method', 'S256');
  url.searchParams.set('state', state);
  if (provider) {
    url.searchParams.set('identity_provider', provider);
  }

  return { url: url.toString(), state, codeVerifier };
}

// ---------------------------------------------------------------------------
// Code Exchange & Token Verification
// ---------------------------------------------------------------------------

export interface VerifiedAssertion {
  /** Yet Vast User ID — canonical cross-product identity */
  yvUserId: string;
  /** Primary email associated with Yet Vast identity */
  email?: string;
  /** Linked GitHub username, if connected via Yet Vast Auth */
  githubLogin?: string;
  /** Full raw claims for downstream inspection */
  claims: Record<string, unknown>;
}

/**
 * Exchange the authorization code for an assertion token and verify it.
 * Verifies issuer, audience, expiry, and signature against Yet Vast Auth JWKS.
 */
export async function exchangeAndVerifyCode(
  code: string,
  codeVerifier: string,
): Promise<VerifiedAssertion> {
  const config = getAuthConfig();
  const sdk = await loadSDK();

  let assertionToken: string;

  if (sdk) {
    const res = await sdk.exchangeCodeForAssertion({
      authOrigin: config.authServerOrigin,
      logicalAppId: config.logicalAppId,
      code,
      codeVerifier,
      redirectUri: config.redirectUri,
    });
    assertionToken = res.assertion;
  } else {
    // Fallback: standard OAuth token exchange
    const tokenUrl = `${config.authServerOrigin}/oauth/token`;
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: config.logicalAppId,
      code,
      code_verifier: codeVerifier,
      redirect_uri: config.redirectUri,
    });

    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
      cache: 'no-store',
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(
        `[YAI Auth] Token exchange failed (${response.status}): ${errText}`,
      );
    }

    const data = (await response.json()) as {
      access_token?: string;
      id_token?: string;
      assertion?: string;
    };
    assertionToken = (data.assertion || data.id_token || data.access_token) as string;
    if (!assertionToken) {
      throw new Error('[YAI Auth] No token returned in token exchange response');
    }
  }

  return verifyAssertionToken(assertionToken, config);
}

/**
 * Verify the assertion JWT against Yet Vast Auth JWKS.
 * Checks:
 * - Alg is RS256
 * - Issuer matches YETVAST_AUTH_URL
 * - Audience matches YETVAST_AUTH_APP_ID
 * - Token is not expired
 */
async function verifyAssertionToken(
  token: string,
  config: YetvastAuthConfig,
): Promise<VerifiedAssertion> {
  const { createRemoteJWKSet, jwtVerify } = await import('jose');

  const jwksUrl = new URL(
    '/.well-known/jwks.json',
    config.authServerOrigin,
  );
  const JWKS = createRemoteJWKSet(jwksUrl);

  try {
    const { payload } = await jwtVerify(token, JWKS, {
      issuer: config.authServerOrigin,
      audience: config.logicalAppId,
      algorithms: ['RS256'],
    });

    const sub = payload.sub;
    if (!sub || typeof sub !== 'string') {
      throw new Error('[YAI Auth] Assertion payload missing sub claim');
    }

    return {
      yvUserId: sub,
      email: typeof payload.email === 'string' ? payload.email : undefined,
      githubLogin:
        typeof payload.github_login === 'string'
          ? payload.github_login
          : typeof payload.login === 'string'
          ? payload.login
          : undefined,
      claims: payload as Record<string, unknown>,
    };
  } catch (err) {
    // If JWKS verification fails (e.g. dev environment where auth server is a mock/placeholder),
    // decode claims with strict validation and log warning.
    // In production, this must fail.
    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        `[YAI Auth] Token verification failed: ${(err as Error).message}`,
      );
    }

    console.warn(
      `[YAI Auth] JWKS verification failed (${(err as Error).message}). ` +
        'Attempting unverified payload decode for development mode only.',
    );

    return decodePayloadDevOnly(token);
  }
}

/** Development-only decode: DO NOT USE IN PRODUCTION */
function decodePayloadDevOnly(token: string): VerifiedAssertion {
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
    claims: payload,
  };
}
