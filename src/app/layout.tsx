import type { Metadata, Viewport } from 'next';
import { PWAProvider } from '@/lib/pwa/pwa-context';
import { LocalStoreProvider } from '@/lib/storage/client/local-store-provider';
import '@/styles/globals.css';

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#4B0084' },
    { media: '(prefers-color-scheme: dark)', color: '#09060D' },
  ],
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
};

export const metadata: Metadata = {
  title: {
    template: '%s — YAI Studio',
    default: 'YAI Studio',
  },
  description: 'Your personal intelligence workspace — YAI Studio by Yet Vast Solutions',
  manifest: '/manifest.webmanifest',
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: '32x32' },
      { url: '/icons/icon.svg', type: 'image/svg+xml' },
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
    ],
    apple: [
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
    ],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'YAI Studio',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      {/* Theme detection script runs before paint to avoid flash */}
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
(function() {
  try {
    var stored = localStorage.getItem('yai-theme');
    if (stored === 'light' || stored === 'dark') {
      document.documentElement.setAttribute('data-theme', stored);
    } else {
      var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      document.documentElement.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
    }
  } catch (e) {}
})();
            `.trim(),
          }}
        />
      </head>
      <body>
        <PWAProvider>
          <LocalStoreProvider>{children}</LocalStoreProvider>
        </PWAProvider>
      </body>
    </html>
  );
}
