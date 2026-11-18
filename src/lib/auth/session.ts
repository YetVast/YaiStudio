/**
 * YAI Studio — Server-only session management
 *
 * This module creates, reads and destroys the YAI host-bound session cookie.
 * It MUST NOT be imported from client components.
 *
 * Cookie: yai_session
 * Signed with: YAI_SESSION_SECRET (HS256 via jose)
 * SameSite=Lax, HttpOnly, Secure (production), Path=/, no wildcard domain.
 */
import 'server-only';

import { SignJWT, jwtVerify, type JWTPayload } from 'jose';
import { cookies } from 'next/headers';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SessionPayload {
  yvUserId: string;
  githubLogin?: string;
  githubConnected: boolean;
  repoVerified: boolean;
  /** Issued-at (seconds since epoch) */
  iat: number;
  /** Expiry (seconds since epoch) */
  exp: number;
}

type JoseSessionPayload = SessionPayload & JWTPayload;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const COOKIE_NAME = 'yai_session';
const SESSION_DURATION_SECONDS = 60 * 60 * 24 * 7; // 7 days

// ---------------------------------------------------------------------------
// Environment guard
// ---------------------------------------------------------------------------

function getSessionSecret(): Uint8Array {
  const secret = process.env.YAI_SESSION_SECRET;
  if (!secret || secret.trim() === '') {
    throw new Error(
      '[YAI Auth] YAI_SESSION_SECRET is not set. ' +
        'Set a random 32+ character secret in .env.local before running the app.',
    );
  }
  return new TextEncoder().encode(secret);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function cookieOptions() {
  const isProduction = process.env.NODE_ENV === 'production';
  return {
    name: COOKIE_NAME,
    httpOnly: true,
    // Strict transport security: only send over HTTPS in production
    secure: isProduction,
    // Lax allows top-level navigation to retain the session
    sameSite: 'lax' as const,
    path: '/',
    // No `domain` → host-bound; never set a wildcard parent domain.
    maxAge: SESSION_DURATION_SECONDS,
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Create a signed session JWT and set the yai_session cookie.
 * Caller supplies the payload sans iat/exp (we set those).
 * Optionally accepts a NextResponse to attach the cookie header directly.
 */
export async function createSession(
  payload: Omit<SessionPayload, 'iat' | 'exp'>,
  response?: NextResponse,
): Promise<void> {
  const secret = getSessionSecret();
  const now = Math.floor(Date.now() / 1000);
  const exp = now + SESSION_DURATION_SECONDS;

  const token = await new SignJWT({ ...payload } as JoseSessionPayload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt(now)
    .setExpirationTime(exp)
    .sign(secret);

  if (response) {
    response.cookies.set({ ...cookieOptions(), value: token });
  } else {
    const cookieStore = await cookies();
    cookieStore.set({ ...cookieOptions(), value: token });
  }
}

/**
 * Read and verify the session from a Next.js Request.
 * Returns null if cookie is absent, invalid or expired.
 */
export async function getSession(
  request: NextRequest,
): Promise<SessionPayload | null> {
  const token = request.cookies.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verifyToken(token);
}

/**
 * Read and verify the session from the cookie store (Server Components / Actions).
 * Returns null if cookie is absent, invalid or expired.
 */
export async function getSessionFromCookies(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verifyToken(token);
}

/**
 * Destroy the session cookie by setting it to an expired value.
 * Pass the response object so the Set-Cookie header is attached to it.
 */
export function destroySession(response: NextResponse): NextResponse {
  response.cookies.set({
    ...cookieOptions(),
    value: '',
    maxAge: 0,
  });
  return response;
}

/**
 * Require a valid session or throw.
 * Use in API route handlers that must be authenticated.
 */
export async function requireSession(
  request: NextRequest,
): Promise<SessionPayload> {
  const session = await getSession(request);
  if (!session) {
    throw new Error('[YAI Auth] No valid session. Unauthenticated.');
  }
  return session;
}

// ---------------------------------------------------------------------------
// Internal
// ---------------------------------------------------------------------------

async function verifyToken(token: string): Promise<SessionPayload | null> {
  try {
    const secret = getSessionSecret();
    const { payload } = await jwtVerify<JoseSessionPayload>(token, secret, {
      algorithms: ['HS256'],
    });
    return {
      yvUserId: payload.yvUserId,
      githubLogin: payload.githubLogin,
      githubConnected: payload.githubConnected,
      repoVerified: payload.repoVerified,
      iat: payload.iat ?? 0,
      exp: payload.exp ?? 0,
    };
  } catch {
    // Expired, tampered or malformed token — treat as unauthenticated.
    return null;
  }
}
