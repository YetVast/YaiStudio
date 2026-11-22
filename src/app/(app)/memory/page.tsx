'use client';

import React, { useEffect, useState } from 'react';
import {
  Brain,
  Plus,
  Check,
  X,
  AlertCircle,
  Clock,
  Sparkles,
  ShieldAlert,
  RefreshCw,
} from 'lucide-react';
import type { MemoryRecord, MemoryCandidate, MemoryType } from '@/types/personal-intelligence';
import Button from '@/components/ui/Button';
import { errorHandler } from '@/lib/errors';
import styles from './Memory.module.css';

const CATEGORIES: { id: MemoryType; label: string; desc: string }[] = [
  { id: 'fact', label: 'Facts', desc: 'Core verified truths and background details' },
  { id: 'preference', label: 'Preferences', desc: 'Working styles, tool choices, and guidelines' },
  { id: 'interest', label: 'Interests', desc: 'Focus areas, curiosity topics, and research domains' },
  { id: 'goal', label: 'Goals', desc: 'Strategic priorities, product objectives, and milestones' },
  { id: 'relationship', label: 'Relationships', desc: 'People, organizations, and team contacts' },
  { id: 'decision', label: 'Decisions', desc: 'Architectural, design, and product decisions made' },
];

export default function MemoryPage() {
  const [activeTab, setActiveTab] = useState<MemoryType | 'candidates'>('fact');
  const [records, setRecords] = useState<MemoryRecord[]>([]);
  const [candidates, setCandidates] = useState<MemoryCandidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Add memory modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [newContent, setNewContent] = useState('');
  const [newProvenance, setNewProvenance] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchCategory = async (type: MemoryType) => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const res = await fetch(`/api/memory/${type}`);
      if (res.ok) {
        const data = await res.json();
        setRecords(data.records || []);
      } else {
        throw new Error(`HTTP ${res.status}: Failed to load ${type} records`);
      }
    } catch (err: any) {
      const msg = `Failed to load ${type} records`;
      setErrorMessage(msg);
      errorHandler.captureError({
        error: err,
        title: 'Memory Retrieval Failure',
        message: msg,
        category: 'DATABASE',
        source: {
          module: 'Personal Memory',
          component: 'Memory Explorer',
          operation: `Fetch ${type} records`,
        },
        retryHandler: async () => {
          await fetchCategory(type);
        },
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchCandidates = async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const res = await fetch('/api/memory/candidates');
      if (res.ok) {
        const data = await res.json();
        setCandidates(data.candidates || []);
      } else {
        throw new Error(`HTTP ${res.status}: Failed to load memory candidates`);
      }
    } catch (err: any) {
      const msg = 'Failed to load memory candidates';
      setErrorMessage(msg);
      errorHandler.captureError({
        error: err,
        title: 'Memory Candidates Failure',
        message: msg,
        category: 'DATABASE',
        source: {
          module: 'Personal Memory',
          component: 'Candidate Review',
          operation: 'Fetch Candidates',
        },
        retryHandler: async () => {
          await fetchCandidates();
        },
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'candidates') {
      fetchCandidates();
    } else {
      fetchCategory(activeTab);
    }
  }, [activeTab]);

  const handleAddMemory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newContent.trim() || saving || activeTab === 'candidates') return;

    setSaving(true);
    setErrorMessage(null);
    try {
      const res = await fetch(`/api/memory/${activeTab}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: newContent.trim(),
          provenance: newProvenance.trim() || 'Manual entry',
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to save memory');
      }

      setShowAddModal(false);
      setNewContent('');
      setNewProvenance('');
      await fetchCategory(activeTab);
    } catch (err: any) {
      const msg = err instanceof Error ? err.message : 'Failed to save memory';
      setErrorMessage(msg);
      errorHandler.captureError({
        error: err,
        title: 'Save Memory Record Failed',
        message: msg,
        category: 'DATABASE',
        source: {
          module: 'Personal Memory',
          component: 'Manual Entry Modal',
          operation: `Create ${activeTab} Record`,
        },
      });
    } finally {
      setSaving(false);
    }
  };

  const handleReviewCandidate = async (candidateId: string, decision: 'approved' | 'rejected') => {
    setErrorMessage(null);
    try {
      const res = await fetch(`/api/memory/candidates/${candidateId}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Review failed');
      }

      // Update local state
      setCandidates((prev) =>
        prev.map((c) => (c.id === candidateId ? { ...c, status: decision } : c)),
      );
    } catch (err: any) {
      const msg = err instanceof Error ? err.message : 'Review action failed';
      setErrorMessage(msg);
      errorHandler.captureError({
        error: err,
        title: 'Candidate Review Action Failed',
        message: msg,
        category: 'API',
        source: {
          module: 'Personal Memory',
          component: 'Candidate Review',
          operation: `Review Candidate (${decision})`,
        },
        retryHandler: async () => {
          await handleReviewCandidate(candidateId, decision);
        },
      });
    }
  };

  const pendingCandidatesCount = candidates.filter((c) => c.status === 'pending').length;

  return (
    <div className={styles.container}>
      {/* Page Header */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Personal Memory</h1>
          <p className={styles.subtitle}>
            Durable, structured memories across 6 categories. Controlled approval ensures
            candidates only become permanent memories with your explicit consent.
          </p>
        </div>
        {activeTab !== 'candidates' && (
          <Button onClick={() => setShowAddModal(true)} variant="primary">
            <Plus size={16} />
            <span>Add {activeTab}</span>
          </Button>
        )}
      </div>

      {errorMessage && (
        <div className={styles.errorBanner} role="alert">
          <AlertCircle size={16} />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Tabs */}
      <div className={styles.tabNav}>
        {CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setActiveTab(cat.id)}
            className={`${styles.tabBtn} ${activeTab === cat.id ? styles.activeTabBtn : ''}`}
          >
            <span>{cat.label}</span>
          </button>
        ))}

        <button
          onClick={() => setActiveTab('candidates')}
          className={`${styles.tabBtn} ${styles.candidatesTabBtn} ${
            activeTab === 'candidates' ? styles.activeTabBtn : ''
          }`}
        >
          <Sparkles size={14} />
          <span>Candidates</span>
          {pendingCandidatesCount > 0 && (
            <span className={styles.counterBadge}>{pendingCandidatesCount}</span>
          )}
        </button>
      </div>

      {/* Tab Content */}
      {loading ? (
        <div className={styles.loadingBox}>
          <RefreshCw className={styles.spinner} size={24} />
          <p>Loading personal memory records...</p>
        </div>
      ) : activeTab === 'candidates' ? (
        <div className={styles.candidatesView}>
          <div className={styles.candidatesNotice}>
            <ShieldAlert size={18} className={styles.noticeIcon} />
            <div>
              <strong>Review Mode Active</strong>
              <p>
                Memory candidates are automatically proposed by AI interactions across Yet Vast
                products. Review, approve or reject them below before they become durable memories.
              </p>
            </div>
          </div>

          {candidates.length === 0 ? (
            <div className={styles.emptyBox}>
              <Sparkles size={36} className={styles.emptyIcon} />
              <h3>No memory candidates pending</h3>
              <p>As you converse with YAI, candidate memories will appear here for review.</p>
            </div>
          ) : (
            <div className={styles.candidateList}>
              {candidates.map((cand) => (
                <div key={cand.id} className={styles.candidateCard}>
                  <div className={styles.candidateHeader}>
                    <span className={styles.categoryPill}>{cand.proposedType}</span>
                    <span className={styles.timestamp}>
                      Proposed {new Date(cand.proposedAt).toLocaleDateString()}
                    </span>
                  </div>

                  <p className={styles.candidateText}>{cand.proposedContent}</p>

                  <div className={styles.candidateFooter}>
                    <span
                      className={`${styles.statusBadge} ${
                        cand.status === 'pending'
                          ? styles.statusPending
                          : cand.status === 'approved'
                            ? styles.statusApproved
                            : styles.statusRejected
                      }`}
                    >
                      {cand.status.toUpperCase()}
                    </span>

                    {cand.status === 'pending' && (
                      <div className={styles.reviewActions}>
                        <button
                          onClick={() => handleReviewCandidate(cand.id, 'rejected')}
                          className={styles.rejectBtn}
                          title="Reject candidate"
                        >
                          <X size={14} />
                          <span>Reject</span>
                        </button>
                        <button
                          onClick={() => handleReviewCandidate(cand.id, 'approved')}
                          className={styles.approveBtn}
                          title="Approve candidate"
                        >
                          <Check size={14} />
                          <span>Approve & Save</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className={styles.recordsView}>
          <div className={styles.categoryDesc}>
            {CATEGORIES.find((c) => c.id === activeTab)?.desc}
          </div>

          {records.length === 0 ? (
            <div className={styles.emptyBox}>
              <Brain size={36} className={styles.emptyIcon} />
              <h3>No {activeTab}s recorded yet</h3>
              <p>Add your first entry or approve candidates to build your personal intelligence.</p>
              <Button onClick={() => setShowAddModal(true)} variant="secondary" size="sm">
                <Plus size={14} />
                <span>Add {activeTab}</span>
              </Button>
            </div>
          ) : (
            <div className={styles.recordGrid}>
              {records.map((rec) => (
                <div key={rec.id} className={styles.recordCard}>
                  <p className={styles.recordContent}>{rec.content}</p>
                  <div className={styles.recordFooter}>
                    <span className={styles.provenancePill}>
                      {rec.provenance || 'Manual entry'}
                    </span>
                    <span className={styles.dateLabel}>
                      {new Date(rec.updatedAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Add Memory Modal */}
      {showAddModal && (
        <div className={styles.modalOverlay}>
          <form onSubmit={handleAddMemory} className={styles.modalCard}>
            <h3>Add New {activeTab.toUpperCase()}</h3>
            <p>Enter the memory content to persist in your private repository.</p>
            <textarea
              placeholder={`e.g. ${
                activeTab === 'fact'
                  ? 'Works as principal engineer at Yet Vast Solutions'
                  : activeTab === 'preference'
                    ? 'Prefers CSS Modules over utility styling'
                    : 'Goal or detail...'
              }`}
              value={newContent}
              onChange={(e) => setNewContent(e.target.value)}
              className={styles.modalTextarea}
              rows={4}
              autoFocus
              required
            />
            <input
              type="text"
              placeholder="Source / Provenance (optional, e.g. User Profile)"
              value={newProvenance}
              onChange={(e) => setNewProvenance(e.target.value)}
              className={styles.modalInput}
            />
            <div className={styles.modalActions}>
              <Button
                type="button"
                onClick={() => setShowAddModal(false)}
                variant="outline"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={saving}
                loading={saving}
                variant="primary"
              >
                {saving ? 'Saving...' : 'Save to Repository'}
              </Button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
