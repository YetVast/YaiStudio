import React from 'react';
import Link from 'next/link';
import {
  Brain,
  ShieldCheck,
  GitBranch,
  Cpu,
  Layers,
  ArrowRight,
  Database,
  Lock,
  Workflow,
  Sparkles,
  ExternalLink,
} from 'lucide-react';
import Button from '@/components/ui/Button';
import styles from './About.module.css';

export default function AboutPage() {
  return (
    <div className={styles.container}>
      {/* ── Header ── */}
      <header className={styles.header}>
        <div className={styles.badge}>
          <Brain size={14} className={styles.badgeIcon} />
          <span>Yet Vast Solutions — Platform Architecture</span>
        </div>
        <h1 className={styles.title}>
          About <span className={styles.titleAccent}>YAI Studio</span>
        </h1>
        <p className={styles.lead}>
          YAI Studio is the central Personal Intelligence platform within the Yet Vast Solutions
          ecosystem. It is an identity-aware intelligence system that manages your personal context,
          persistent memories, knowledge, goals, relationships, decisions, and cross-product activity.
        </p>
      </header>

      {/* ── Core Mission / Definition ── */}
      <section className={styles.section}>
        <div className={styles.card}>
          <div className={styles.sectionHeader}>
            <Sparkles size={20} className={styles.sectionIcon} />
            <h2>What YAI Studio Is (and Is Not)</h2>
          </div>
          <p className={styles.bodyText}>
            YAI Studio is <strong>not simply a chat interface</strong> and is <strong>not itself an LLM</strong>.
            Instead, it is an authoritative personal intelligence coordinator:
          </p>
          <div className={styles.gridTwoCol}>
            <div className={styles.featureItem}>
              <h3>Intelligence Coordinator</h3>
              <p>
                Orchestrates configured cloud model providers (via Bring-Your-Own-Key gateways) and
                server-side context assembly to provide personalized, grounded answers.
              </p>
            </div>
            <div className={styles.featureItem}>
              <h3>User-Controlled Context Store</h3>
              <p>
                Maintains a transparent, portable, and user-inspected context store where memories
                are structured, reviewed, and persisted under your direct control.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Key Architectural Pillars ── */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Architectural Pillars</h2>

        <div className={styles.pillarGrid}>
          {/* Pillar 1: User-Owned GitHub Storage */}
          <div className={styles.pillarCard}>
            <div className={styles.pillarHeader}>
              <div className={styles.pillarIconCircle}>
                <GitBranch size={20} />
              </div>
              <div>
                <h3>User-Owned Data Architecture</h3>
                <span className={styles.pillarSub}>Zero Central Intelligence Databases</span>
              </div>
            </div>
            <p className={styles.pillarDesc}>
              Authoritative persistence for your personal intelligence is stored directly in a private
              repository in your personal GitHub account (<code>YVSApps_Data_YaiStudio</code>).
              YAI Studio maintains zero central intelligence databases. Your memories, transcripts,
              and knowledge graphs remain 100% portable, version-controlled, and private.
            </p>
            <div className={styles.pillarTags}>
              <span className={styles.tag}>Private GitHub Repository</span>
              <span className={styles.tag}>Git Version Control</span>
              <span className={styles.tag}>Full Portability</span>
            </div>
          </div>

          {/* Pillar 2: Persistent Personal Memory */}
          <div className={styles.pillarCard}>
            <div className={styles.pillarHeader}>
              <div className={styles.pillarIconCircle}>
                <Brain size={20} />
              </div>
              <div>
                <h3>Persistent Personal Context</h3>
                <span className={styles.pillarSub}>Structured Memory Lifecycle</span>
              </div>
            </div>
            <p className={styles.pillarDesc}>
              Personal intelligence is organized across six discrete, structured categories:
              <strong> Facts</strong>, <strong>Preferences</strong>, <strong>Interests</strong>,
              <strong> Goals</strong>, <strong>Values</strong>, and <strong>Relationships</strong>.
              Not every prompt becomes a permanent memory; memory candidates are explicitly generated,
              reviewed, and accepted into your permanent knowledge base.
            </p>
            <div className={styles.pillarTags}>
              <span className={styles.tag}>Candidate Review</span>
              <span className={styles.tag}>6 Memory Categories</span>
              <span className={styles.tag}>Markdown Transcripts</span>
            </div>
          </div>

          {/* Pillar 3: BYOK Cloud AI Providers */}
          <div className={styles.pillarCard}>
            <div className={styles.pillarHeader}>
              <div className={styles.pillarIconCircle}>
                <Cpu size={20} />
              </div>
              <div>
                <h3>Bring-Your-Own-Key (BYOK) AI Model</h3>
                <span className={styles.pillarSub}>Encrypted Server-Side Vault</span>
              </div>
            </div>
            <p className={styles.pillarDesc}>
              In v0, YAI Studio utilizes a Bring-Your-Own-Key architecture. OpenRouter serves as the
              primary multi-model gateway, with Google AI Studio (Gemini) as secondary. Your provider
              keys are encrypted with AES-256-GCM in server-side storage and never committed to your
              data repository or exposed to client bundles.
            </p>
            <div className={styles.pillarTags}>
              <span className={styles.tag}>OpenRouter Gateway</span>
              <span className={styles.tag}>Google AI Gemini</span>
              <span className={styles.tag}>AES-256-GCM Encryption</span>
            </div>
          </div>

          {/* Pillar 4: Ecosystem Integration */}
          <div className={styles.pillarCard}>
            <div className={styles.pillarHeader}>
              <div className={styles.pillarIconCircle}>
                <Workflow size={20} />
              </div>
              <div>
                <h3>Yet Vast Solutions Ecosystem</h3>
                <span className={styles.pillarSub}>Cross-Product Activity Ledger</span>
              </div>
            </div>
            <p className={styles.pillarDesc}>
              YAI Studio acts as the central intelligence authority and API integration boundary for
              independently deployed Yet Vast Solutions applications (such as Cogmit and Fyuniverse).
              Originating products retain full ownership of their product-specific data, submitting only
              explicitly authorized activity events and candidate memories to YAI Studio.
            </p>
            <div className={styles.pillarTags}>
              <span className={styles.tag}>Yet Vast Auth</span>
              <span className={styles.tag}>Activity Ledger</span>
              <span className={styles.tag}>API Integration Boundary</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── Quick Navigation Footer ── */}
      <section className={styles.section}>
        <div className={styles.navigationCard}>
          <div>
            <h3>Explore Personal Intelligence</h3>
            <p>Access your overview, configure provider keys, or review repository settings.</p>
          </div>
          <div className={styles.navActions}>
            <Button href="/" variant="primary">
              <span>Personal Intelligence Overview</span>
              <ArrowRight size={14} />
            </Button>
            <Button href="/providers" variant="outline">
              <Cpu size={14} />
              <span>AI Providers</span>
            </Button>
            <Button href="/settings" variant="outline">
              <Lock size={14} />
              <span>Settings & Diagnostics</span>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
