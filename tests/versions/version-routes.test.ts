import { describe, it, expect } from 'vitest';
import { NextRequest } from 'next/server';
import { middleware } from '@/middleware';
import { GET as getVersionsApi } from '@/app/api/versions/route';

describe('Version Routes & Middleware Public Access', () => {
  const baseUrl = 'http://localhost:3000';

  it('allows public access to /versions without authentication cookie', () => {
    const req = new NextRequest(new URL('/versions', baseUrl));
    const res = middleware(req);

    // Should not redirect to /sign-in
    expect(res.status).toBe(200);
    expect(res.headers.get('location')).toBeNull();
  });

  it('allows public access to /api/versions without authentication cookie', () => {
    const req = new NextRequest(new URL('/api/versions', baseUrl));
    const res = middleware(req);

    expect(res.status).toBe(200);
    expect(res.headers.get('location')).toBeNull();
  });

  it('protects authenticated web routes and redirects to /sign-in when unauthenticated', () => {
    const protectedWebPaths = ['/', '/conversations', '/workspaces', '/memory', '/settings', '/about'];

    for (const path of protectedWebPaths) {
      const req = new NextRequest(new URL(path, baseUrl));
      const res = middleware(req);

      expect(res.status).toBe(307);
      const location = res.headers.get('location');
      expect(location).toContain('/sign-in');
    }
  });

  it('protects authenticated API routes and returns 401 Unauthorized when unauthenticated', async () => {
    const protectedApiPaths = [
      '/api/conversations',
      '/api/memory/candidates',
      '/api/yai/generate',
      '/api/github/connection',
    ];

    for (const path of protectedApiPaths) {
      const req = new NextRequest(new URL(path, baseUrl));
      const res = middleware(req);

      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.error).toBe('Unauthorized');
    }
  });

  it('allows protected web routes when valid yai_session cookie is present', () => {
    const req = new NextRequest(new URL('/conversations', baseUrl), {
      headers: {
        cookie: 'yai_session=valid_jwt_token_payload',
      },
    });
    const res = middleware(req);

    expect(res.status).toBe(200);
    expect(res.headers.get('location')).toBeNull();
  });

  it('/api/versions returns 200 with the version history manifest', async () => {
    const res = await getVersionsApi();
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.applicationName).toBe('YAI Studio');
    expect(json.baseline.version).toBe('v0.1');
    expect(json.baseline.shortCommitHash).toBe('d4cabeb');
    expect(json.totalVersions).toBeGreaterThanOrEqual(6);
    expect(Array.isArray(json.versions)).toBe(true);
    expect(json.versions.length).toBeGreaterThanOrEqual(6);
  });
});
