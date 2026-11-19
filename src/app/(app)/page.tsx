import React from 'react';
import Link from 'next/link';
import {
  Brain,
  MessageSquare,
  Activity,
  Cpu,
  GitBranch,
  ShieldCheck,
  Plus,
  ArrowRight,
  Database,
  CheckCircle2,
  Clock,
} from 'lucide-react';
import Button from '@/components/ui/Button';
import styles from './Overview.module.css';

export default function OverviewPage() {
  return (
    <div className={styles.container}>
      {/* ── Page Header ── */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Personal Intelligence Overview</h1>
          <p className={styles.subtitle}>
            Welcome to YAI Studio. Your user-owned intelligence, memories, and conversations.
          </p>
        </div>
        <div className={styles.headerActions}>
          <Button href="/conversations" variant="primary">
            <Plus size={16} />
            <span>New Conversation</span>
          </Button>
        </div>
      </div>

      {/* ── Status Grid ── */}
      <div className={styles.statusGrid}>
        {/* Card 1: Data Repository */}
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <div className={styles.cardTitle}>
              <GitBranch size={16} className={styles.cardIcon} />
              <span>Storage Repository</span>
            </div>
            <span className={styles.statusPillActive}>
              <CheckCircle2 size={12} />
              <span>User Owned</span>
            </span>
          </div>
          <div className={styles.cardBody}>
            <p className={styles.repoName}>YVSApps_Data_YaiStudio</p>
            <p className={styles.cardDesc}>
              Private GitHub repository storing conversations, structured memories,
              knowledge, and activity logs.
            </p>
          </div>
          <div className={styles.cardFooter}>
            <Link href="/repo-setup" className={styles.cardLink}>
              <span>Storage status</span>
              <ArrowRight size={14} />
            </Link>
          </div>
        </div>

        {/* Card 2: AI Provider */}
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <div className={styles.cardTitle}>
              <Cpu size={16} className={styles.cardIcon} />
              <span>AI Engine</span>
            </div>
            <span className={styles.statusPill}>Cloud BYOK</span>
          </div>
          <div className={styles.cardBody}>
            <p className={styles.primaryMetric}>OpenRouter</p>
            <p className={styles.cardDesc}>
              Primary cloud provider path. API keys are kept encrypted server-side and never
              reach client bundles.
            </p>
          </div>
          <div className={styles.cardFooter}>
            <Link href="/providers" className={styles.cardLink}>
              <span>Configure providers</span>
              <ArrowRight size={14} />
            </Link>
          </div>
        </div>

        {/* Card 3: Memory Candidates */}
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <div className={styles.cardTitle}>
              <Brain size={16} className={styles.cardIcon} />
              <span>Personal Memory</span>
            </div>
            <span className={styles.statusPill}>Approval Mode</span>
          </div>
          <div className={styles.cardBody}>
            <p className={styles.primaryMetric}>6 Categories</p>
            <p className={styles.cardDesc}>
              Facts, preferences, interests, goals, relationships, and decisions.
              New candidates require your explicit review.
            </p>
          </div>
          <div className={styles.cardFooter}>
            <Link href="/memory" className={styles.cardLink}>
              <span>Review memories</span>
              <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      </div>

      {/* ── Main Dashboard Sections ── */}
      <div className={styles.contentGrid}>
        {/* Recent Conversations */}
        <div className={styles.sectionCard}>
          <div className={styles.sectionHeader}>
            <div className={styles.sectionTitle}>
              <MessageSquare size={18} />
              <h2>Recent Conversations</h2>
            </div>
            <Link href="/conversations" className={styles.viewAllLink}>
              View all
            </Link>
          </div>

          <div className={styles.emptyCardBox}>
            <MessageSquare size={32} className={styles.emptyIcon} />
            <h3>No conversations yet</h3>
            <p>Start a conversation with YAI to explore your thoughts and build context.</p>
            <Button href="/conversations" variant="primary" size="sm">
              <Plus size={14} />
              <span>Start Conversation</span>
            </Button>
          </div>
        </div>

        {/* Recent Intelligence Activity */}
        <div className={styles.sectionCard}>
          <div className={styles.sectionHeader}>
            <div className={styles.sectionTitle}>
              <Activity size={18} />
              <h2>Cross-Product Activity Ledger</h2>
            </div>
            <Link href="/activity" className={styles.viewAllLink}>
              View ledger
            </Link>
          </div>

          <div className={styles.emptyCardBox}>
            <Activity size={32} className={styles.emptyIcon} />
            <h3>No recent activity events</h3>
            <p>
              Interactions across YAI Studio and authorized Yet Vast products (Cogmit, Fyuniverse)
              are recorded here.
            </p>
            <Button href="/activity" variant="outline" size="sm">
              <span>Inspect Activity Ledger</span>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
