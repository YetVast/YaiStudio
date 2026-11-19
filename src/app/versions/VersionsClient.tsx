'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import {
  GitCommit,
  GitBranch,
  Calendar,
  User,
  Search,
  ChevronDown,
  ChevronUp,
  Copy,
  Check,
  FileCode,
  ShieldCheck,
  Moon,
  Sun,
  Layers,
  Sparkles,
  ArrowRight,
  ExternalLink,
} from 'lucide-react';
import { useTheme } from '@/components/providers/ThemeProvider';
import type {
  ApplicationVersionEntry,
  ChangeType,
  VersionHistoryManifest,
} from '@/lib/versions/types';
import styles from './Versions.module.css';

interface VersionsClientProps {
  manifest: VersionHistoryManifest;
}

export default function VersionsClient({ manifest }: VersionsClientProps) {
  const { theme, toggleTheme } = useTheme();

  // Search & filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedMajor, setSelectedMajor] = useState<number | 'all'>('all');

  // Expanded cards state: default top (latest) card expanded
  const [expandedShas, setExpandedShas] = useState<Set<string>>(() => {
    const initial = new Set<string>();
    if (manifest.versions.length > 0) {
      initial.add(manifest.versions[0].commitHash);
    }
    return initial;
  });

  // Copied feedback state
  const [copiedSha, setCopiedSha] = useState<string | null>(null);

  const handleCopySha = (sha: string) => {
    navigator.clipboard.writeText(sha).then(() => {
      setCopiedSha(sha);
      setTimeout(() => setCopiedSha(null), 2000);
    });
  };

  const toggleExpand = (sha: string) => {
    setExpandedShas((prev) => {
      const next = new Set(prev);
      if (next.has(sha)) {
        next.delete(sha);
      } else {
        next.add(sha);
      }
      return next;
    });
  };

  const toggleAll = () => {
    if (expandedShas.size === manifest.versions.length) {
      setExpandedShas(new Set());
    } else {
      setExpandedShas(new Set(manifest.versions.map((v) => v.commitHash)));
    }
  };

  // Derive unique categories present in the manifest
  const availableCategories = useMemo(() => {
    const cats = new Set<ChangeType>();
    for (const v of manifest.versions) {
      for (const c of v.changeType) {
        cats.add(c);
      }
    }
    return Array.from(cats);
  }, [manifest.versions]);

  // Derive unique major versions
  const availableMajors = useMemo(() => {
    const majors = new Set<number>();
    for (const v of manifest.versions) {
      majors.add(v.major);
    }
    return Array.from(majors).sort((a, b) => b - a);
  }, [manifest.versions]);

  // Filtered versions list
  const filteredVersions = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();

    return manifest.versions.filter((entry) => {
      // Major version filter
      if (selectedMajor !== 'all' && entry.major !== selectedMajor) {
        return false;
      }

      // Category filter
      if (selectedCategory !== 'all' && !entry.changeType.includes(selectedCategory as ChangeType)) {
        return false;
      }

      // Query filter
      if (q) {
        const matchesVersion = entry.version.toLowerCase().includes(q);
        const matchesSubject = entry.subject.toLowerCase().includes(q);
        const matchesDesc = entry.description.toLowerCase().includes(q);
        const matchesSha =
          entry.shortCommitHash.toLowerCase().includes(q) || entry.commitHash.toLowerCase().includes(q);
        const matchesAuthor = entry.authorName.toLowerCase().includes(q);
        const matchesFiles = entry.changedFiles.some((f) => f.toLowerCase().includes(q));

        return (
          matchesVersion ||
          matchesSubject ||
          matchesDesc ||
          matchesSha ||
          matchesAuthor ||
          matchesFiles
        );
      }

      return true;
    });
  }, [manifest.versions, selectedMajor, selectedCategory, searchQuery]);

  const formatDate = (isoString: string) => {
    try {
      const date = new Date(isoString);
      return new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }).format(date);
    } catch {
      return isoString;
    }
  };

  return (
    <div className={styles.pageRoot}>
      {/* ── Top Header Navigation ── */}
      <header className={styles.topNav}>
        <div className={styles.topNavInner}>
          <Link href="/" className={styles.brandGroup} title="YAI Studio">
            <span className={styles.brandWordmark}>
              <span className={styles.brandAccent}>YAI</span> Studio
            </span>
            <span className={styles.navBadge}>/versions</span>
          </Link>

          <div className={styles.navActions}>
            <button
              className={styles.iconBtn}
              onClick={toggleTheme}
              aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
              title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
            >
              {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
            </button>

            <Link href="/" className={styles.appLink}>
              <span>Launch Studio</span>
              <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      </header>

      {/* ── Hero / Overview Section ── */}
      <section className={styles.heroSection}>
        <div className={styles.heroContent}>
          <div className={styles.heroPill}>
            <GitBranch size={13} aria-hidden="true" />
            <span>Application Version History</span>
          </div>

          <h1 className={styles.heroTitle}>Engineering Release Ledger</h1>

          <p className={styles.heroDescription}>
            Every Git commit corresponds to an application version under the <code>vX.Y</code>{' '}
            convention. This transparent ledger records all changes, architectural milestones, and
            verifications directly from the repository commit lineage.
          </p>

          {/* Key Stats Grid */}
          <div className={styles.statsGrid}>
            <div className={styles.statCard}>
              <span className={styles.statLabel}>Current Version</span>
              <div className={styles.statValue}>
                <span className={styles.activeVersionPill}>{manifest.currentVersion}</span>
              </div>
              <span className={styles.statDetail}>Latest commit release</span>
            </div>

            <div className={styles.statCard}>
              <span className={styles.statLabel}>Tracked Commits</span>
              <div className={styles.statValue}>{manifest.totalVersions}</div>
              <span className={styles.statDetail}>Total application versions</span>
            </div>

            <div className={styles.statCard}>
              <span className={styles.statLabel}>Initial Baseline</span>
              <div className={styles.statValue}>
                <code>{manifest.baseline.version}</code>
              </div>
              <span className={styles.statDetail}>
                Commit <code>{manifest.baseline.shortCommitHash}</code>
              </span>
            </div>

            <div className={styles.statCard}>
              <span className={styles.statLabel}>Active Major</span>
              <div className={styles.statValue}>Major {manifest.currentMajor}</div>
              <span className={styles.statDetail}>Developer-controlled series</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── Main Content Area ── */}
      <main className={styles.mainContainer}>
        {/* Controls & Filter Bar */}
        <section className={styles.controlsBar} aria-label="Version history filters">
          <div className={styles.searchRow}>
            <div className={styles.searchInputWrapper}>
              <Search size={15} className={styles.searchIcon} aria-hidden="true" />
              <input
                type="text"
                className={styles.searchInput}
                placeholder="Search by version (v0.6), hash (cfada5e), keyword, or file..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                aria-label="Search version history"
              />
            </div>

            <button
              className={styles.toggleAllBtn}
              onClick={toggleAll}
              title="Expand or collapse all commit details"
            >
              {expandedShas.size === manifest.versions.length ? (
                <>
                  <ChevronUp size={14} />
                  <span>Collapse All</span>
                </>
              ) : (
                <>
                  <ChevronDown size={14} />
                  <span>Expand All</span>
                </>
              )}
            </button>
          </div>

          {/* Filter Chips */}
          <div className={styles.filterChipsRow}>
            <span className={styles.filterLabel}>Category:</span>
            <button
              className={`${styles.chip}${selectedCategory === 'all' ? ` ${styles.chipActive}` : ''}`}
              onClick={() => setSelectedCategory('all')}
            >
              All ({manifest.totalVersions})
            </button>
            {availableCategories.map((cat) => (
              <button
                key={cat}
                className={`${styles.chip}${selectedCategory === cat ? ` ${styles.chipActive}` : ''}`}
                onClick={() => setSelectedCategory(cat)}
              >
                {cat.charAt(0).toUpperCase() + cat.slice(1)}
              </button>
            ))}

            {availableMajors.length > 1 && (
              <>
                <span className={styles.filterLabel} style={{ marginLeft: 16 }}>
                  Major:
                </span>
                <button
                  className={`${styles.chip}${selectedMajor === 'all' ? ` ${styles.chipActive}` : ''}`}
                  onClick={() => setSelectedMajor('all')}
                >
                  All Majors
                </button>
                {availableMajors.map((m) => (
                  <button
                    key={m}
                    className={`${styles.chip}${selectedMajor === m ? ` ${styles.chipActive}` : ''}`}
                    onClick={() => setSelectedMajor(m)}
                  >
                    Major {m}
                  </button>
                ))}
              </>
            )}
          </div>
        </section>

        {/* Timeline / Version Cards List */}
        <div className={styles.timeline}>
          {filteredVersions.length === 0 ? (
            <div className={styles.emptyState}>
              <div className={styles.emptyTitle}>No matching versions found</div>
              <p className={styles.emptyText}>
                No commits match &ldquo;{searchQuery}&rdquo; under the selected category filters.
              </p>
            </div>
          ) : (
            filteredVersions.map((entry, index) => {
              const isExpanded = expandedShas.has(entry.commitHash);
              const isLatest = index === 0 && selectedCategory === 'all' && selectedMajor === 'all' && !searchQuery;

              return (
                <React.Fragment key={entry.commitHash}>
                  {/* Major Version Boundary Marker */}
                  {entry.isMajorVersionStart && (
                    <div className={styles.majorBoundary}>
                      <div className={styles.majorBoundaryTitle}>
                        <Layers size={16} />
                        <span>Major Version {entry.major} Milestone Boundary</span>
                      </div>
                      <div className={styles.majorBoundaryDesc}>
                        Developer-authorized major milestone sequence beginning at {entry.version}.
                      </div>
                    </div>
                  )}

                  <article
                    className={`${styles.versionCard}${entry.isBaseline ? ` ${styles.baselineCard}` : ''}`}
                  >
                    {/* Clickable Card Header */}
                    <div
                      className={styles.cardHeader}
                      onClick={() => toggleExpand(entry.commitHash)}
                      role="button"
                      tabIndex={0}
                      aria-expanded={isExpanded}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          toggleExpand(entry.commitHash);
                        }
                      }}
                    >
                      <div className={styles.cardTopRow}>
                        <div className={styles.versionBadgeGroup}>
                          <span className={styles.versionNumber}>{entry.version}</span>
                          {entry.isBaseline && <span className={styles.baselineTag}>Baseline</span>}
                          {isLatest && <span className={styles.latestTag}>Latest</span>}
                        </div>

                        <div className={styles.metaGroup}>
                          <span className={styles.metaItem}>
                            <Calendar size={13} aria-hidden="true" />
                            <time dateTime={entry.committedAt}>{formatDate(entry.committedAt)}</time>
                          </span>

                          <span className={styles.metaItem}>
                            <User size={13} aria-hidden="true" />
                            <span>{entry.authorName}</span>
                          </span>

                          <button
                            type="button"
                            className={styles.commitShaBtn}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCopySha(entry.commitHash);
                            }}
                            title="Copy full commit SHA"
                          >
                            <GitCommit size={11} aria-hidden="true" />
                            <span>{entry.shortCommitHash}</span>
                            {copiedSha === entry.commitHash ? (
                              <Check size={11} color="var(--color-success)" />
                            ) : (
                              <Copy size={11} />
                            )}
                          </button>
                        </div>
                      </div>

                      <h2 className={styles.commitSubject}>{entry.subject}</h2>

                      <div className={styles.cardBottomRow}>
                        <div className={styles.categoriesGroup}>
                          {entry.changeType.map((ct) => (
                            <span key={ct} className={styles.categoryBadge}>
                              {ct}
                            </span>
                          ))}
                        </div>

                        <div className={styles.statsPillGroup}>
                          <span>
                            {entry.filesChanged} {entry.filesChanged === 1 ? 'file' : 'files'}
                          </span>
                          {entry.insertions > 0 && (
                            <span className={styles.insertions}>+{entry.insertions.toLocaleString()}</span>
                          )}
                          {entry.deletions > 0 && (
                            <span className={styles.deletions}>-{entry.deletions.toLocaleString()}</span>
                          )}
                          <span className={styles.expandTrigger}>
                            {isExpanded ? (
                              <>
                                <span>Hide details</span>
                                <ChevronUp size={14} />
                              </>
                            ) : (
                              <>
                                <span>View details</span>
                                <ChevronDown size={14} />
                              </>
                            )}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Expandable Details Area */}
                    {isExpanded && (
                      <div className={styles.expandedBody}>
                        {/* Description Box */}
                        <div>
                          <div className={styles.sectionHeading}>
                            <Sparkles size={14} />
                            <span>Commit Description</span>
                          </div>
                          <div
                            className={`${styles.descriptionBox}${
                              !entry.hasExtendedDescription ? ` ${styles.fallbackDescription}` : ''
                            }`}
                          >
                            {entry.description}
                          </div>
                        </div>

                        {/* Changed Files List */}
                        {entry.changedFiles && entry.changedFiles.length > 0 && (
                          <div>
                            <div className={styles.sectionHeading}>
                              <FileCode size={14} />
                              <span>Changed Files ({entry.changedFiles.length})</span>
                            </div>
                            <div className={styles.filesContainer}>
                              <ul className={styles.fileList}>
                                {entry.fileStats && entry.fileStats.length > 0
                                  ? entry.fileStats.map((stat) => (
                                      <li key={stat.path} className={styles.fileItem}>
                                        <span className={styles.filePath}>{stat.path}</span>
                                        <span className={styles.fileStatNums}>
                                          {stat.insertions > 0 && (
                                            <span className={styles.insertions}>+{stat.insertions}</span>
                                          )}
                                          {stat.deletions > 0 && (
                                            <span className={styles.deletions}>-{stat.deletions}</span>
                                          )}
                                        </span>
                                      </li>
                                    ))
                                  : entry.changedFiles.map((file) => (
                                      <li key={file} className={styles.fileItem}>
                                        <span className={styles.filePath}>{file}</span>
                                      </li>
                                    ))}
                              </ul>
                            </div>
                          </div>
                        )}

                        {/* Verification & Metadata */}
                        <div className={styles.metadataGrid}>
                          <div className={styles.metaCol}>
                            <span className={styles.metaKey}>Full Commit SHA</span>
                            <span className={styles.metaVal}>{entry.commitHash}</span>
                          </div>
                          <div className={styles.metaCol}>
                            <span className={styles.metaKey}>Author Date</span>
                            <span className={styles.metaVal}>{entry.authoredAt}</span>
                          </div>
                          <div className={styles.metaCol}>
                            <span className={styles.metaKey}>Committer Date</span>
                            <span className={styles.metaVal}>{entry.committedAt}</span>
                          </div>
                          <div className={styles.metaCol}>
                            <span className={styles.metaKey}>Integrity Assurance</span>
                            <span className={styles.metaVal}>
                              Build-time Git verified commit
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                  </article>
                </React.Fragment>
              );
            })
          )}
        </div>
      </main>

      {/* ── Footer ── */}
      <footer className={styles.pageFooter}>
        <div className={styles.footerContent}>
          <div>
            <strong>YAI Studio</strong> — Yet Vast Solutions Personal Intelligence Platform
          </div>
          <div className={styles.footerLinks}>
            <Link href="/" className={styles.footerLink}>
              Overview
            </Link>
            <Link href="/about" className={styles.footerLink}>
              About
            </Link>
            <Link href="/sign-in" className={styles.footerLink}>
              Sign In
            </Link>
            <a
              href="https://auth.yetvast.com"
              target="_blank"
              rel="noopener noreferrer"
              className={styles.footerLink}
            >
              <span>Yet Vast Auth</span>
              <ExternalLink size={11} style={{ marginLeft: 3 }} />
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
