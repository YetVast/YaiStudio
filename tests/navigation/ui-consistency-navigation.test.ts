import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('UI Consistency, Global Navbar & Navigation Architecture', () => {
  const appShellPath = path.resolve(process.cwd(), 'src/components/layout/AppShell.tsx');
  const appShellContent = fs.readFileSync(appShellPath, 'utf-8');

  const appNavPath = path.resolve(process.cwd(), 'src/components/navigation/AppNav.tsx');
  const appNavContent = fs.readFileSync(appNavPath, 'utf-8');

  const versionsLayoutPath = path.resolve(process.cwd(), 'src/app/versions/layout.tsx');
  const versionsLayoutContent = fs.readFileSync(versionsLayoutPath, 'utf-8');

  const versionsClientPath = path.resolve(process.cwd(), 'src/app/versions/VersionsClient.tsx');
  const versionsClientContent = fs.readFileSync(versionsClientPath, 'utf-8');

  const yaiLocalPagePath = path.resolve(process.cwd(), 'src/app/(app)/settings/yai-local/page.tsx');
  const yaiLocalContent = fs.readFileSync(yaiLocalPagePath, 'utf-8');

  const conversationsPagePath = path.resolve(process.cwd(), 'src/app/(app)/conversations/page.tsx');
  const conversationsContent = fs.readFileSync(conversationsPagePath, 'utf-8');

  it('verifies AppShell global navbar contains exactly the 4 required elements and no extra buttons', () => {
    // 1. Sidebar toggle button
    expect(appShellContent).toContain('aria-label="Toggle navigation"');
    // 2. YAI Studio wordmark title/logo
    expect(appShellContent).toContain('className={styles.wordmarkLink}');
    expect(appShellContent).toContain('YAI');
    expect(appShellContent).toContain('Studio');
    // 3. Theme toggle
    expect(appShellContent).toContain('onClick={toggleTheme}');
    // 4. User profile/avatar button
    expect(appShellContent).toContain('className={styles.avatar}');

    // Explicitly forbidden in global navbar:
    expect(appShellContent).not.toContain('versionBadge');
    expect(appShellContent).not.toContain('offlinePill');
    expect(appShellContent).not.toContain('updatePill');
    expect(appShellContent).not.toContain('installButton');
    expect(appShellContent).not.toContain('Launch Studio');
  });

  it('verifies AppNav maintains Version History item pointing to /versions in the sidebar', () => {
    expect(appNavContent).toContain("href: '/versions'");
    expect(appNavContent).toContain("label: 'Version History'");
    expect(appNavContent).toContain('History');
  });

  it('verifies /versions route uses the shared AppShell and eliminates duplicate navbar', () => {
    // /versions/layout.tsx must wrap children in <AppShell>
    expect(versionsLayoutContent).toContain("import AppShell from '@/components/layout/AppShell'");
    expect(versionsLayoutContent).toContain('<AppShell>{children}</AppShell>');

    // VersionsClient must not render duplicate header or Launch Studio button
    expect(versionsClientContent).not.toContain('className={styles.topNav}');
    expect(versionsClientContent).not.toContain('Launch Studio');
    expect(versionsClientContent).not.toContain('navBadge');
  });

  it('verifies Conversations page includes a right-side conversation details sidebar and toggle button', () => {
    // Conversation info toggle button in header
    expect(conversationsContent).toContain('setShowInfoSidebar');
    expect(conversationsContent).toContain("showInfoSidebar ? 'Hide conversation details' : 'Show conversation details'");
    expect(conversationsContent).toContain('Conversation Details');

    // Display of actual conversation metadata
    expect(conversationsContent).toContain('activeMeta.title');
    expect(conversationsContent).toContain('activeMeta.id');
    expect(conversationsContent).toContain('activeMeta.createdAt');
    expect(conversationsContent).toContain('activeMeta.updatedAt');
    expect(conversationsContent).toContain('messages.length');
    expect(conversationsContent).toContain('activeMeta.status');
    expect(conversationsContent).toContain('workspacePath');
    expect(conversationsContent).toContain('syncStatus');
  });

  it('verifies /settings/yai-local follows the exact 6 collapsible sections in required order', () => {
    const section1Idx = yaiLocalContent.indexOf('1. PWA Information & Installation Status');
    const section2Idx = yaiLocalContent.indexOf('2. Device Compatibility & Hardware Runtime');
    const section3Idx = yaiLocalContent.indexOf('3. Local AI Onboarding Process');
    const section4Idx = yaiLocalContent.indexOf('4. Local Model Management');
    const section5Idx = yaiLocalContent.indexOf('5. Local Inference Testing');
    const section6Idx = yaiLocalContent.indexOf('6. Privacy & Inference Configuration');

    expect(section1Idx).toBeGreaterThan(0);
    expect(section2Idx).toBeGreaterThan(section1Idx);
    expect(section3Idx).toBeGreaterThan(section2Idx);
    expect(section4Idx).toBeGreaterThan(section3Idx);
    expect(section5Idx).toBeGreaterThan(section4Idx);
    expect(section6Idx).toBeGreaterThan(section5Idx);

    // Section 1 is expanded by default
    expect(yaiLocalContent).toContain('pwa: true');

    // Accessible collapse attributes
    expect(yaiLocalContent).toContain('aria-expanded');
    expect(yaiLocalContent).toContain('aria-controls');

    // Strict local mode privacy guarantee
    expect(yaiLocalContent).toContain('Local Only will never silently fall back to cloud inference');
  });
});
