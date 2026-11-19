import React from 'react';
import Link from 'next/link';
import { ShieldCheck, ExternalLink, ArrowRight, GitBranch } from 'lucide-react';
import styles from './SignIn.module.css';

export default function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  return <SignInClient searchParams={searchParams} />;
}

async function SignInClient({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <div className={styles.header}>
          <div className={styles.brandBadge}>YVS Personal Intelligence</div>
          <h1 className={styles.title}>
            <span className={styles.brandAccent}>YAI</span> Studio
          </h1>
          <p className={styles.tagline}>
            Your central, user-owned intelligence platform. Private memories,
            knowledge, and AI assistance backed by your own GitHub repository.
          </p>
        </div>

        {error && (
          <div className={styles.errorAlert} role="alert">
            <span className={styles.errorTitle}>Sign-in issue:</span> {error}
          </div>
        )}

        <div className={styles.actions}>
          <a href="/api/auth/authorize" className={styles.primaryButton}>
            <ShieldCheck size={18} />
            <span>Sign in with Yet Vast Auth</span>
            <ArrowRight size={16} />
          </a>
        </div>

        <div className={styles.footerNotice}>
          <p>
            Yet Vast Auth provides unified identity across Yet Vast Solutions products.
            Your personal intelligence is stored exclusively in your private GitHub repository
            (<code>YVSApps_Data_YaiStudio</code>).
          </p>
          <div className={styles.links}>
            <a
              href="https://auth.yetvast.com"
              target="_blank"
              rel="noopener noreferrer"
              className={styles.link}
            >
              <span>About Yet Vast Auth</span>
              <ExternalLink size={12} />
            </a>
            <Link href="/versions" className={styles.link}>
              <span>Version History</span>
              <GitBranch size={12} />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
