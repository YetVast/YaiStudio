/**
 * YAI Studio — PKCE utilities (server-only)
 *
 * Implements RFC 7636 Proof Key for Code Exchange using Node.js crypto.
 * All functions are synchronous / server-safe.
 */
import 'server-only';

import { randomBytes, createHash } from 'crypto';

/**
 * Generate a cryptographically random code_verifier.
 * 32 bytes → 43 base64url characters (within RFC 7636 43–128 char limit).
 */
export function generateCodeVerifier(): string {
  return randomBytes(32).toString('base64url');
}

/**
 * Derive the S256 code_challenge from a code_verifier.
 * SHA-256(verifier) encoded as base64url — no padding.
 */
export function generateCodeChallenge(verifier: string): string {
  return createHash('sha256').update(verifier).digest('base64url');
}

/**
 * Generate a random state token for OAuth CSRF protection.
 * 16 bytes → 32 hex characters.
 */
export function generateState(): string {
  return randomBytes(16).toString('hex');
}
