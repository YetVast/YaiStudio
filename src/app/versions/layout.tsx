import type { Metadata } from 'next';
import { ThemeProvider } from '@/components/providers/ThemeProvider';

export const metadata: Metadata = {
  title: 'Version History',
  description: 'Application version history, commit ledger, and engineering changelog for YAI Studio.',
};

export default function VersionsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <ThemeProvider>{children}</ThemeProvider>;
}
