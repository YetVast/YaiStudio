import React from 'react';
import { GitBranch, Shield, Lock, ExternalLink, ArrowRight } from 'lucide-react';
import styles from './GitHubConnect.module.css';

export default function GitHubConnectPage() {
  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <div className={styles.iconCircle}>
          <GitBranch size={32} />
        </div>

        <h1 className={styles.title}>Connect GitHub Storage</h1>
        <p className={styles.subtitle}>
          YAI Studio stores your personal intelligence in your own private GitHub
          repository named <code>YVSApps_Data_YaiStudio</code>.
        </p>

        <div className={styles.infoBox}>
          <div className={styles.infoItem}>
            <Shield size={18} className={styles.infoIcon} />
            <div>
              <strong>User-Owned Data</strong>
              <p>Your intelligence, memories, and conversations remain 100% owned by you in your private repository.</p>
            </div>
          </div>

          <div className={styles.infoItem}>
            <Lock size={18} className={styles.infoIcon} />
            <div>
              <strong>Separate Authorization</strong>
              <p>Yet Vast Auth verifies who you are. This grant specifically authorizes YAI Studio to read and write your data repository.</p>
            </div>
          </div>
        </div>

        <div className={styles.actions}>
          <a href="/api/auth/github/connect" className={styles.connectButton}>
            <span>Authorize GitHub Storage</span>
            <ArrowRight size={16} />
          </a>
        </div>

        <p className={styles.note}>
          We request repository access to read and update your personal intelligence files.
          Your tokens are encrypted server-side and never exposed to browser bundles.
        </p>
      </div>
    </div>
  );
}
