'use client';

import React, { useEffect, useState } from 'react';
import { Folder, Plus, ChevronRight, MessageSquare, AlertCircle, RefreshCw } from 'lucide-react';
import Button from '@/components/ui/Button';
import type { WorkspaceData, ConversationIndexEntry } from '@/types/personal-intelligence';
import { errorHandler } from '@/lib/errors';
import styles from './Workspaces.module.css';

export default function WorkspacesPage() {
  const [workspaces, setWorkspaces] = useState<WorkspaceData[]>([]);
  const [conversations, setConversations] = useState<ConversationIndexEntry[]>([]);
  const [selectedWorkspace, setSelectedWorkspace] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // New workspace modal
  const [showModal, setShowModal] = useState(false);
  const [newWorkspaceName, setNewWorkspaceName] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [creating, setCreating] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const [wsRes, convRes] = await Promise.all([
        fetch('/api/workspaces'),
        fetch('/api/conversations'),
      ]);

      if (wsRes.ok) {
        const wsData = await wsRes.json();
        setWorkspaces(wsData.workspaces || []);
        if (wsData.workspaces?.length > 0 && !selectedWorkspace) {
          setSelectedWorkspace(wsData.workspaces[0].name);
        }
      }
      if (convRes.ok) {
        const convData = await convRes.json();
        setConversations(convData.conversations || []);
      }
    } catch (err: any) {
      const msg = 'Failed to load workspaces';
      setErrorMessage(msg);
      errorHandler.captureError({
        error: err,
        title: 'Workspaces Retrieval Failed',
        message: msg,
        category: 'DATABASE',
        source: {
          module: 'Workspaces',
          component: 'Workspace Explorer',
          operation: 'Fetch Workspaces',
        },
        retryHandler: async () => {
          await fetchData();
        },
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreateWorkspace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWorkspaceName.trim() || creating) return;

    setCreating(true);
    setErrorMessage(null);
    try {
      const res = await fetch('/api/workspaces', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newWorkspaceName.trim(),
          description: newDescription.trim() || undefined,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to create workspace');
      }

      setShowModal(false);
      setNewWorkspaceName('');
      setNewDescription('');
      await fetchData();
    } catch (err: any) {
      const msg = err instanceof Error ? err.message : 'Creation failed';
      setErrorMessage(msg);
      errorHandler.captureError({
        error: err,
        title: 'Create Workspace Failed',
        message: msg,
        category: 'DATABASE',
        source: {
          module: 'Workspaces',
          component: 'New Workspace Modal',
          operation: 'Create Workspace',
        },
      });
    } finally {
      setCreating(false);
    }
  };

  const activeWsConversations = conversations.filter(
    (c) => c.workspaceName?.toLowerCase() === selectedWorkspace?.toLowerCase(),
  );

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Workspaces & Hierarchy</h1>
          <p className={styles.subtitle}>
            Organize conversations and knowledge into nested workspaces stored directly in your repository.
          </p>
        </div>
        <Button onClick={() => setShowModal(true)} variant="primary">
          <Plus size={16} />
          <span>New Workspace</span>
        </Button>
      </div>

      {errorMessage && (
        <div className={styles.errorBanner} role="alert">
          <AlertCircle size={16} />
          <span>{errorMessage}</span>
        </div>
      )}

      {loading ? (
        <div className={styles.loadingBox}>
          <RefreshCw className={styles.spinner} size={24} />
          <p>Loading workspaces from repository...</p>
        </div>
      ) : (
        <div className={styles.contentGrid}>
          {/* Workspace Folders List */}
          <div className={styles.panel}>
            <div className={styles.panelHeader}>
              <Folder size={16} />
              <h2>Workspaces ({workspaces.length})</h2>
            </div>

            {workspaces.length === 0 ? (
              <div className={styles.emptyPanel}>
                <p>No custom workspaces created yet.</p>
                <p className={styles.emptySub}>All new conversations are currently Unfiled.</p>
                <Button onClick={() => setShowModal(true)} variant="secondary" size="sm">
                  Create your first workspace
                </Button>
              </div>
            ) : (
              <div className={styles.workspaceList}>
                {workspaces.map((ws) => {
                  const count = conversations.filter(
                    (c) => c.workspaceName?.toLowerCase() === ws.name.toLowerCase(),
                  ).length;

                  return (
                    <button
                      key={ws.id}
                      onClick={() => setSelectedWorkspace(ws.name)}
                      className={`${styles.wsItem} ${
                        selectedWorkspace === ws.name ? styles.activeWsItem : ''
                      }`}
                    >
                      <div className={styles.wsItemLeft}>
                        <Folder size={16} className={styles.wsIcon} />
                        <div className={styles.wsInfo}>
                          <span className={styles.wsName}>{ws.name}</span>
                          {ws.description && (
                            <span className={styles.wsDesc}>{ws.description}</span>
                          )}
                        </div>
                      </div>
                      <div className={styles.wsItemRight}>
                        <span className={styles.countBadge}>{count} convos</span>
                        <ChevronRight size={14} />
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Conversations in selected workspace */}
          <div className={styles.panel}>
            <div className={styles.panelHeader}>
              <MessageSquare size={16} />
              <h2>
                Conversations in {selectedWorkspace ? `"${selectedWorkspace}"` : 'Workspace'}
              </h2>
            </div>

            {activeWsConversations.length === 0 ? (
              <div className={styles.emptyPanel}>
                <p>No conversations in this workspace.</p>
                <p className={styles.emptySub}>
                  When starting a new conversation, select this workspace to group related topics.
                </p>
              </div>
            ) : (
              <div className={styles.convoList}>
                {activeWsConversations.map((c) => (
                  <div key={c.id} className={styles.convoItem}>
                    <div className={styles.convoTitle}>{c.title}</div>
                    <div className={styles.convoDate}>
                      Updated {new Date(c.updatedAt).toLocaleDateString()}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className={styles.modalOverlay}>
          <form onSubmit={handleCreateWorkspace} className={styles.modalCard}>
            <h3>Create New Workspace</h3>
            <p>Enter a folder name for your new workspace.</p>
            <input
              type="text"
              placeholder="e.g. System Architecture"
              value={newWorkspaceName}
              onChange={(e) => setNewWorkspaceName(e.target.value)}
              className={styles.modalInput}
              autoFocus
              required
            />
            <input
              type="text"
              placeholder="Optional description"
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              className={styles.modalInput}
            />
            <div className={styles.modalActions}>
              <Button
                type="button"
                onClick={() => setShowModal(false)}
                variant="outline"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={creating}
                loading={creating}
                variant="primary"
              >
                {creating ? 'Creating...' : 'Create Workspace'}
              </Button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
