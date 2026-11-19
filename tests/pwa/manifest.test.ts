import { describe, it, expect } from 'vitest';
import manifest from '@/app/manifest';

describe('PWA Web App Manifest', () => {
  it('exports a compliant PWA manifest object', () => {
    const data = manifest();

    expect(data.name).toBe('YAI Studio — Personal Intelligence Workspace');
    expect(data.short_name).toBe('YAI Studio');
    expect(data.start_url).toBe('/');
    expect(data.display).toBe('standalone');
    expect(data.background_color).toBe('#09060D');
    expect(data.theme_color).toBe('#4B0084');
  });

  it('includes required icons for standalone and maskable launchers', () => {
    const data = manifest();
    const icons = data.icons ?? [];

    expect(icons.length).toBeGreaterThanOrEqual(4);

    const sizes = icons.map((i) => i.sizes);
    expect(sizes).toContain('192x192');
    expect(sizes).toContain('512x512');

    const maskable = icons.filter((i) => i.purpose === 'maskable');
    expect(maskable.length).toBeGreaterThanOrEqual(2);

    const svgIcon = icons.find((i) => i.type === 'image/svg+xml');
    expect(svgIcon).toBeDefined();
    expect(svgIcon?.src).toBe('/icons/icon.svg');
  });
});
