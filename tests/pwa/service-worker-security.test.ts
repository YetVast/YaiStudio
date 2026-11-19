import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('Service Worker Security and Caching Policy', () => {
  const swPath = path.resolve(process.cwd(), 'public/sw.js');
  const swContent = fs.readFileSync(swPath, 'utf-8');

  it('verifies that sw.js exists in public directory', () => {
    expect(fs.existsSync(swPath)).toBe(true);
  });

  it('enforces strict cache bypass for /api/ routes', () => {
    expect(swContent).toContain("'/api/'");
    expect(swContent).toMatch(/shouldBypassCache/);
  });

  it('enforces strict cache bypass for sign-in and OAuth endpoints', () => {
    expect(swContent).toContain("'/sign-in'");
  });

  it('enforces cache bypass for Authorization and no-store headers', () => {
    expect(swContent).toContain("request.headers.get('Authorization')");
    expect(swContent).toContain("'no-store'");
  });

  it('enforces cross-origin cache bypass', () => {
    expect(swContent).toContain('url.origin !== self.location.origin');
  });

  it('bypasses non-GET HTTP methods', () => {
    expect(swContent).toContain("request.method !== 'GET'");
  });

  it('purges outdated caches on activate', () => {
    expect(swContent).toContain('caches.delete');
    expect(swContent).toContain('self.clients.claim()');
  });

  it('supports SKIP_WAITING message for seamless updates', () => {
    expect(swContent).toContain('SKIP_WAITING');
    expect(swContent).toContain('self.skipWaiting()');
  });
});
