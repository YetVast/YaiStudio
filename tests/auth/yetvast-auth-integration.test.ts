import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import {
  getYetVastAuthConfig,
  getYetVastAuthClient,
  createAuthorizeRedirect,
  buildAuthorizationUrl,
  buildAuthorizeUrl,
} from '@/lib/auth/yetvast-auth';
import { GET as authorizeHandler } from '@/app/api/auth/authorize/route';
import { GET as callbackHandler } from '@/app/api/auth/callback/route';
import { getSession } from '@/lib/auth/session';
import { generateAssertionSigningKeyPair } from '@yetvast/auth/server';
import { SignJWT, exportJWK } from 'jose';

describe('Yet Vast Auth Generic Discovery & Migration', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
    process.env.YETVAST_AUTH_ORIGIN = 'https://auth.yetvast.com';
    process.env.NEXT_PUBLIC_YAI_ORIGIN = 'https://yaistudio.yetvast.com';
    process.env.YAI_SESSION_SECRET = 'test-secret-at-least-32-chars-long-for-signing';
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('initializes using only authServerOrigin and appOrigin without configured Application ID', () => {
    const config = getYetVastAuthConfig();
    expect(config.authServerOrigin).toBe('https://auth.yetvast.com');
    expect(config.appOrigin).toBe('https://yaistudio.yetvast.com');

    // Confirm no appId exists in the config object
    expect('applicationId' in config).toBe(false);
    expect('logicalAppId' in config).toBe(false);
  });

  it('generates production authorization URL using yaistudio-yetvast-com-4dfnb2r9, NOT yai-studio', async () => {
    const client = getYetVastAuthClient();
    const result = await client.createAuthorizeRedirect();

    expect(result.applicationId).toBe('yaistudio-yetvast-com-4dfnb2r9');
    expect(result.redirectUri).toBe('https://yaistudio.yetvast.com/api/auth/callback');

    const parsedUrl = new URL(result.authorizeUrl);
    expect(parsedUrl.origin).toBe('https://auth.yetvast.com');
    expect(parsedUrl.pathname).toBe('/authorize');
    expect(parsedUrl.searchParams.get('app_id')).toBe('yaistudio-yetvast-com-4dfnb2r9');
    expect(parsedUrl.searchParams.get('redirect_uri')).toBe('https://yaistudio.yetvast.com/api/auth/callback');
    expect(parsedUrl.searchParams.get('state')).toBe(result.state);
    expect(parsedUrl.searchParams.get('code_challenge')).toBeTruthy();
    expect(parsedUrl.searchParams.get('code_challenge_method')).toBe('S256');

    // Strict invariant: obsolete slug 'yai-studio' MUST NOT appear anywhere in the URL
    expect(result.authorizeUrl).not.toContain('yai-studio');
    expect(parsedUrl.searchParams.get('app_id')).not.toBe('yai-studio');
  });

  it('correctly includes provider=google when requested for Google login', async () => {
    const client = getYetVastAuthClient();
    const result = await client.createAuthorizeRedirect({ provider: 'google' });

    const parsedUrl = new URL(result.authorizeUrl);
    expect(parsedUrl.searchParams.get('provider')).toBe('google');
    expect(parsedUrl.searchParams.get('app_id')).toBe('yaistudio-yetvast-com-4dfnb2r9');
    expect(parsedUrl.searchParams.get('redirect_uri')).toBe('https://yaistudio.yetvast.com/api/auth/callback');
  });

  it('authorize route handler sets state & verifier cookies and redirects to canonical URL', async () => {
    const req = new NextRequest('https://yaistudio.yetvast.com/api/auth/authorize?provider=google');
    const response = await authorizeHandler(req);

    expect(response.status).toBe(307); // NextResponse.redirect
    const location = response.headers.get('location');
    expect(location).toBeTruthy();

    const redirectUrl = new URL(location!);
    expect(redirectUrl.origin).toBe('https://auth.yetvast.com');
    expect(redirectUrl.searchParams.get('app_id')).toBe('yaistudio-yetvast-com-4dfnb2r9');
    expect(redirectUrl.searchParams.get('provider')).toBe('google');

    // Check cookies
    const stateCookie = response.cookies.get('yai_oauth_state');
    const verifierCookie = response.cookies.get('yai_oauth_verifier');
    expect(stateCookie?.value).toBe(redirectUrl.searchParams.get('state'));
    expect(verifierCookie?.value).toBeTruthy();
  });
});

describe('Full Google Login, Callback, Code Exchange & Session Flow', () => {
  const originalEnv = { ...process.env };
  let sharedKeyPair: ReturnType<typeof generateAssertionSigningKeyPair>;
  let sharedPrivateKeyObj: any;
  let sharedJwk: any;

  beforeEach(async () => {
    process.env = { ...originalEnv };
    process.env.YETVAST_AUTH_ORIGIN = 'https://auth.yetvast.com';
    process.env.NEXT_PUBLIC_YAI_ORIGIN = 'https://yaistudio.yetvast.com';
    process.env.YAI_SESSION_SECRET = 'test-secret-at-least-32-chars-long-for-signing';

    if (!sharedKeyPair) {
      sharedKeyPair = generateAssertionSigningKeyPair({ kid: 'shared-test-key-01', alg: 'EdDSA' });
      const crypto = await import('node:crypto');
      sharedPrivateKeyObj = crypto.createPrivateKey(sharedKeyPair.privateKeyPem);
      sharedJwk = await exportJWK(sharedPrivateKeyObj);
      sharedJwk.kid = 'shared-test-key-01';
      sharedJwk.alg = 'EdDSA';
      sharedJwk.use = 'sig';
    }
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('completes token exchange, verifies Google identity, and issues authenticated session', async () => {
    const testAppId = 'yaistudio-yetvast-com-4dfnb2r9';
    const testUserId = 'yv_usr_google_tester_987';
    const testEmail = 'tester@yetvast.com';

    // Sign an identity assertion token as central Yet Vast Auth
    const assertionPayload = {
      iss: 'https://auth.yetvast.com',
      aud: testAppId,
      sub: testUserId,
      yvUserId: testUserId,
      authKind: 'persistent',
      provider: 'google',
      providerSubjectId: 'google-sub-12345',
      displayName: 'Google Tester',
      email: testEmail,
      emailVerified: true,
      authenticatedAt: new Date().toISOString(),
      jti: 'assertion-token-id-123',
    };

    const assertionToken = await new SignJWT(assertionPayload)
      .setProtectedHeader({ alg: 'EdDSA', kid: 'shared-test-key-01' })
      .setIssuedAt()
      .setExpirationTime('1h')
      .sign(sharedPrivateKeyObj);

    // Mock fetch for discovery, token exchange, and JWKS
    const mockFetch: typeof fetch = async (input, init) => {
      const urlStr = typeof input === 'string' ? input : input instanceof URL ? input.toString() : (input as Request).url;
      const url = new URL(urlStr);

      if (url.pathname === '/api/applications/discover') {
        return new Response(
          JSON.stringify({
            applicationId: testAppId,
            name: 'YAI Studio',
            primaryOrigin: 'https://yaistudio.yetvast.com',
            callbackUrl: 'https://yaistudio.yetvast.com/api/auth/callback',
            status: 'APPROVED',
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }

      if (url.pathname === '/api/token') {
        const body = JSON.parse((init?.body as string) || '{}');
        expect(body.app_id).toBe(testAppId);
        expect(body.grant_type).toBe('authorization_code');
        expect(body.code).toBe('test-auth-code');
        expect(body.redirect_uri).toBe('https://yaistudio.yetvast.com/api/auth/callback');

        return new Response(
          JSON.stringify({
            assertion_token: assertionToken,
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }

      if (url.pathname === '/.well-known/jwks.json') {
        return new Response(
          JSON.stringify({
            keys: [sharedJwk],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }

      return new Response('Not Found', { status: 404 });
    };

    // 1. Direct client exchangeCallback test with mockFetch
    const client = getYetVastAuthClient(undefined, { fetchImpl: mockFetch });
    const exchangeResult = await client.exchangeCallback({
      code: 'test-auth-code',
      codeVerifier: 'test-code-verifier',
    });

    expect(exchangeResult.applicationId).toBe(testAppId);
    expect(exchangeResult.assertion.yvUserId).toBe(testUserId);
    expect(exchangeResult.assertion.email).toBe(testEmail);
    expect(exchangeResult.assertion.provider).toBe('google');

    // 2. Full HTTP callback route simulation
    const state = 'secure-oauth-state-token';
    const codeVerifier = 'secure-code-verifier-token';
    const callbackUrl = `https://yaistudio.yetvast.com/api/auth/callback?code=test-auth-code&state=${state}`;

    const req = new NextRequest(callbackUrl, {
      headers: {
        cookie: `yai_oauth_state=${state}; yai_oauth_verifier=${codeVerifier}`,
      },
    });

    // Provide mock fetch to global fetch during route execution
    const originalFetch = globalThis.fetch;
    globalThis.fetch = mockFetch;
    try {
      const response = await callbackHandler(req);

      // Verify redirect target: Google users without connected GitHub redirect to /github-connect
      expect(response.status).toBe(307);
      const redirectLocation = response.headers.get('location');
      expect(redirectLocation).toBe('https://yaistudio.yetvast.com/github-connect');

      // Verify OAuth state cookies were cleared
      expect(response.cookies.get('yai_oauth_state')?.value).toBe('');
      expect(response.cookies.get('yai_oauth_verifier')?.value).toBe('');

      // Verify host-bound YAI session cookie was created
      const sessionCookie = response.cookies.get('yai_session');
      expect(sessionCookie).toBeTruthy();
      expect(sessionCookie?.httpOnly).toBe(true);

      // Verify session contents
      const reqWithSession = new NextRequest('https://yaistudio.yetvast.com/api/auth/session', {
        headers: {
          cookie: `yai_session=${sessionCookie?.value}`,
        },
      });
      const session = await getSession(reqWithSession);
      expect(session).not.toBeNull();
      expect(session?.yvUserId).toBe(testUserId);
      expect(session?.githubConnected).toBe(false);
      expect(session?.repoVerified).toBe(false);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('rejects callback with invalid OAuth state', async () => {
    const req = new NextRequest('https://yaistudio.yetvast.com/api/auth/callback?code=code123&state=tampered-state', {
      headers: {
        cookie: 'yai_oauth_state=expected-state; yai_oauth_verifier=verifier123',
      },
    });

    const response = await callbackHandler(req);
    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe('https://yaistudio.yetvast.com/sign-in?error=invalid_oauth_state');
  });

  it('rejects callback when authority returns an error', async () => {
    const req = new NextRequest('https://yaistudio.yetvast.com/api/auth/callback?error=access_denied&error_description=User+declined', {
      headers: {
        cookie: 'yai_oauth_state=state123; yai_oauth_verifier=verifier123',
      },
    });

    const response = await callbackHandler(req);
    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toContain('sign-in?error=access_denied');
  });

  it('redirects to / when callback assertions contain a verified GitHub login', async () => {
    const testAppId = 'yaistudio-yetvast-com-4dfnb2r9';
    const testUserId = 'yv_usr_gh_tester_456';

    const assertionPayload = {
      iss: 'https://auth.yetvast.com',
      aud: testAppId,
      sub: testUserId,
      yvUserId: testUserId,
      authKind: 'persistent',
      provider: 'github',
      providerSubjectId: 'gh_sub_999',
      displayName: 'octocat',
      email: 'octocat@github.com',
      emailVerified: true,
      authenticatedAt: new Date().toISOString(),
      jti: 'assertion-token-id-456',
    };

    const assertionToken = await new SignJWT(assertionPayload)
      .setProtectedHeader({ alg: 'EdDSA', kid: 'shared-test-key-01' })
      .setIssuedAt()
      .setExpirationTime('1h')
      .sign(sharedPrivateKeyObj);

    const mockFetch: typeof fetch = async (input) => {
      const urlStr = typeof input === 'string' ? input : input instanceof URL ? input.toString() : (input as Request).url;
      const url = new URL(urlStr);

      if (url.pathname === '/api/applications/discover') {
        return new Response(
          JSON.stringify({
            applicationId: testAppId,
            name: 'YAI Studio',
            primaryOrigin: 'https://yaistudio.yetvast.com',
            callbackUrl: 'https://yaistudio.yetvast.com/api/auth/callback',
            status: 'APPROVED',
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }
      if (url.pathname === '/api/token') {
        return new Response(JSON.stringify({ assertion_token: assertionToken }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      if (url.pathname === '/.well-known/jwks.json') {
        return new Response(JSON.stringify({ keys: [sharedJwk] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response('Not Found', { status: 404 });
    };

    const state = 'state-gh-test';
    const codeVerifier = 'verifier-gh-test';
    const req = new NextRequest(`https://yaistudio.yetvast.com/api/auth/callback?code=gh-code&state=${state}`, {
      headers: {
        cookie: `yai_oauth_state=${state}; yai_oauth_verifier=${codeVerifier}`,
      },
    });

    const originalFetch = globalThis.fetch;
    globalThis.fetch = mockFetch;
    try {
      const response = await callbackHandler(req);
      expect(response.status).toBe(307);
      expect(response.headers.get('location')).toBe('https://yaistudio.yetvast.com/');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('buildAuthorizationUrl and buildAuthorizeUrl helpers use discovered canonical appId', async () => {
    const url = await buildAuthorizationUrl('test-state', 'test-challenge', 'S256');
    const parsed = new URL(url);
    expect(parsed.searchParams.get('app_id')).toBe('yaistudio-yetvast-com-4dfnb2r9');
    expect(parsed.searchParams.get('redirect_uri')).toBe('https://yaistudio.yetvast.com/api/auth/callback');

    const result = await buildAuthorizeUrl('test-verifier', 'test-challenge', 'test-state', 'google');
    expect(result.applicationId).toBe('yaistudio-yetvast-com-4dfnb2r9');
    expect(result.redirectUri).toBe('https://yaistudio.yetvast.com/api/auth/callback');
    const parsedGoogle = new URL(result.url);
    expect(parsedGoogle.searchParams.get('provider')).toBe('google');
  });
});
