'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Moon, Sun, Menu } from 'lucide-react';
import { ThemeProvider, useTheme } from '@/components/providers/ThemeProvider';
import AppNav from '@/components/navigation/AppNav';
import styles from './AppShell.module.css';

function ShellInner({ children }: { children: React.ReactNode }) {
  const { theme, toggleTheme } = useTheme();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = usePathname();

  // Requirement 4: Automatically close mobile sidebar on navigation (including back/forward)
  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  // Requirement 4: Close mobile sidebar on Escape key
  useEffect(() => {
    if (!sidebarOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSidebarOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [sidebarOpen]);

  const closeSidebar = () => setSidebarOpen(false);

  return (
    <div className={styles.shell}>
      {/* ─── Header: Exactly 4 elements (Sidebar toggle, Logo, Theme toggle, Avatar) ── */}
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <button
            className={styles.iconButton}
            aria-label="Toggle navigation"
            onClick={() => setSidebarOpen((v) => !v)}
            aria-expanded={sidebarOpen}
          >
            <Menu size={16} />
          </button>
          <Link
            href="/"
            className={styles.wordmarkLink}
            aria-label="YAI Studio"
            title="YAI Studio"
          >
            <span className={styles.wordmark}>
              <span className={styles.wordmarkAccent}>YAI</span> Studio
            </span>
          </Link>
        </div>
        <div className={styles.headerRight}>
          <button
            className={styles.iconButton}
            aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
            onClick={toggleTheme}
            title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
          >
            {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          </button>
          <Link
            href="/"
            className={styles.avatar}
            aria-label="Personal Intelligence Overview"
            title="Personal Intelligence Overview"
          >
            YV
          </Link>
        </div>
      </header>

      {/* ─── Mobile Backdrop Overlay (Requirement 4: Outside-click dismissal) ── */}
      {sidebarOpen && (
        <div
          className={styles.backdrop}
          onClick={closeSidebar}
          aria-hidden="true"
        />
      )}

      {/* ─── Sidebar ────────────────────────── */}
      <aside
        className={`${styles.sidebar}${sidebarOpen ? ` ${styles.open}` : ''}`}
        aria-label="Application navigation"
      >
        <AppNav onNavigate={closeSidebar} />
      </aside>

      {/* ─── Main content ───────────────────── */}
      <main className={styles.main}>{children}</main>
    </div>
  );
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <ShellInner>{children}</ShellInner>
    </ThemeProvider>
  );
}
