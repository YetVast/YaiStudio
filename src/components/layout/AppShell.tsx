'use client';

import { Moon, Sun, Menu } from 'lucide-react';
import { useState } from 'react';
import { ThemeProvider, useTheme } from '@/components/providers/ThemeProvider';
import AppNav from '@/components/navigation/AppNav';
import styles from './AppShell.module.css';

function ShellInner({ children }: { children: React.ReactNode }) {
  const { theme, toggleTheme } = useTheme();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className={styles.shell}>
      {/* ─── Header ─────────────────────────── */}
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
          <span className={styles.wordmark}>
            <span className={styles.wordmarkAccent}>YAI</span> Studio
          </span>
        </div>
        <div className={styles.headerRight}>
          <button
            className={styles.iconButton}
            aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
            onClick={toggleTheme}
          >
            {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          </button>
          <button className={styles.avatar} aria-label="User account menu">
            YV
          </button>
        </div>
      </header>

      {/* ─── Sidebar ────────────────────────── */}
      <aside
        className={`${styles.sidebar}${sidebarOpen ? ` ${styles.open}` : ''}`}
        aria-label="Application navigation"
      >
        <AppNav />
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
