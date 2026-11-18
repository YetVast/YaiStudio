/**
 * YAI Studio — URL and Origin Utilities (server-only)
 *
 * Ensures full compatibility across:
 * - Local development (http://localhost:3000)
 * - Vercel preview branch deployments (https://yaistudio-<branch>-<team>.vercel.app)
 * - Vercel production canonical deployments (https://yaistudio.yetvast.com)
 */
import 'server-only';

import type { NextRequest } from 'next/server';

/**
 * Resolves the accurate public base URL of the YAI Studio application.
 *
 * Priority:
 * 1. Explicit NEXT_PUBLIC_YAI_ORIGIN or NEXT_PUBLIC_APP_URL if defined.
 * 2. Incoming request's `x-forwarded-host` / `host` headers (crucial for Vercel preview & custom domains).
 * 3. VERCEL_URL environment variable provided by Vercel runtime.
 * 4. Fallback to http://localhost:3000.
 */
export function getAppBaseUrl(request?: NextRequest): string {
  // 1. Explicit configured origin
  const explicit = process.env.NEXT_PUBLIC_YAI_ORIGIN || process.env.NEXT_PUBLIC_APP_URL;
  if (explicit && explicit.trim() !== '') {
    return explicit.replace(/\/$/, '');
  }

  // 2. Dynamic request inspection (handles Vercel multi-domain & preview branches)
  if (request) {
    const forwardedHost = request.headers.get('x-forwarded-host');
    const host = forwardedHost || request.headers.get('host');
    if (host) {
      const proto =
        request.headers.get('x-forwarded-proto') ||
        (host.startsWith('localhost') || host.startsWith('127.0.0.1') ? 'http' : 'https');
      return `${proto}://${host}`;
    }
  }

  // 3. Vercel deployment URL
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }

  // 4. Default fallback
  return 'http://localhost:3000';
}
