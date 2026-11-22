'use client';

import React, { useEffect, useState } from 'react';
import { BookOpen, Plus, Search, Tag, ExternalLink, RefreshCw, AlertCircle } from 'lucide-react';
import { formatMarkdown } from '@/lib/client/safe-markdown';
import type { KnowledgeItem } from '@/types/personal-intelligence';
import Button from '@/components/ui/Button';
import { errorHandler } from '@/lib/errors';
import styles from './Knowledge.module.css';

export default function KnowledgePage() {
  const [items, setItems] = useState<KnowledgeItem[]>([]);
  const [selectedItem, setSelectedItem] = useState<KnowledgeItem | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // New Note Modal
  const [showModal, setShowModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [newSource, setNewSource] = useState('');
  const [newSourceUrl, setNewSourceUrl] = useState('');
  const [newTags, setNewTags] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchItems = async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const res = await fetch('/api/knowledge');
      if (res.ok) {
        const data = await res.json();
        setItems(data.items || []);
        if (data.items?.length > 0 && !selectedItem) {
          setSelectedItem(data.items[0]);
        }
      } else {
        throw new Error(`HTTP ${res.status}: Failed to load knowledge notes`);
      }
    } catch (err: any) {
      const msg = 'Failed to load knowledge notes';
      setErrorMessage(msg);
      errorHandler.captureError({
        error: err,
        title: 'Knowledge Base Retrieval Failed',
        message: msg,
        category: 'DATABASE',
        source: {
          module: 'Knowledge',
          component: 'Knowledge Explorer',
          operation: 'Fetch Items',
        },
        retryHandler: async () => {
          await fetchItems();
        },
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchItems();
  }, []);

  const handleCreateNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newContent.trim() || saving) return;

    setSaving(true);
    setErrorMessage(null);
    try {
      const tagList = newTags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);

      const res = await fetch('/api/knowledge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newTitle.trim(),
          content: newContent.trim(),
          source: newSource.trim() || undefined,
          sourceUrl: newSourceUrl.trim() || undefined,
          tags: tagList,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to save note');
      }

      const created = await res.json();
      setShowModal(false);
      setNewTitle('');
      setNewContent('');
      setNewSource('');
      setNewSourceUrl('');
      setNewTags('');
      await fetchItems();
      setSelectedItem(created);
    } catch (err: any) {
      const msg = err instanceof Error ? err.message : 'Save failed';
      setErrorMessage(msg);
      errorHandler.captureError({
        error: err,
        title: 'Save Knowledge Note Failed',
        message: msg,
        category: 'DATABASE',
        source: {
          module: 'Knowledge',
          component: 'Note Editor',
          operation: 'Create Note',
        },
      });
    } finally {
      setSaving(false);
    }
  };

  const filteredItems = items.filter(
    (item) =>
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.tags?.some((t) => t.toLowerCase().includes(searchQuery.toLowerCase())),
  );

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Knowledge & References</h1>
          <p className={styles.subtitle}>
            Markdown-first notes, documentation summaries, and references stored in your private
            data repository.
          </p>
        </div>
        <Button onClick={() => setShowModal(true)} variant="primary">
          <Plus size={16} />
          <span>New Note</span>
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
          <p>Loading knowledge references...</p>
        </div>
      ) : (
        <div className={styles.splitLayout}>
          {/* List panel */}
          <div className={styles.listPanel}>
            <div className={styles.searchBox}>
              <Search size={14} className={styles.searchIcon} />
              <input
                type="text"
                placeholder="Search notes and tags..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={styles.searchInput}
              />
            </div>

            {filteredItems.length === 0 ? (
              <div className={styles.emptyList}>
                <BookOpen size={32} className={styles.emptyIcon} />
                <p>No knowledge notes found.</p>
                <Button onClick={() => setShowModal(true)} variant="secondary" size="sm">
                  Create Note
                </Button>
              </div>
            ) : (
              <div className={styles.itemList}>
                {filteredItems.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setSelectedItem(item)}
                    className={`${styles.itemCard} ${
                      selectedItem?.id === item.id ? styles.activeItemCard : ''
                    }`}
                  >
                    <h3 className={styles.itemTitle}>{item.title}</h3>
                    <p className={styles.itemSnippet}>{item.content.slice(0, 90)}...</p>
                    <div className={styles.itemMeta}>
                      {item.tags && item.tags.length > 0 && (
                        <div className={styles.tagPillList}>
                          {item.tags.slice(0, 2).map((t) => (
                            <span key={t} className={styles.tagPill}>
                              #{t}
                            </span>
                          ))}
                        </div>
                      )}
                      <span className={styles.dateLabel}>
                        {new Date(item.updatedAt).toLocaleDateString()}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Reader panel */}
          <div className={styles.readerPanel}>
            {selectedItem ? (
              <div className={styles.readerContent}>
                <div className={styles.readerHeader}>
                  <h2>{selectedItem.title}</h2>
                  <div className={styles.readerMeta}>
                    <span>Updated {new Date(selectedItem.updatedAt).toLocaleDateString()}</span>
                    {selectedItem.source && (
                      <span className={styles.sourceLabel}>
                        Source: {selectedItem.source}
                        {selectedItem.sourceUrl && (
                          <a
                            href={selectedItem.sourceUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={styles.extLink}
                          >
                            <ExternalLink size={12} />
                          </a>
                        )}
                      </span>
                    )}
                  </div>
                  {selectedItem.tags && selectedItem.tags.length > 0 && (
                    <div className={styles.readerTags}>
                      <Tag size={13} />
                      {selectedItem.tags.map((t) => (
                        <span key={t} className={styles.readerTag}>
                          #{t}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div
                  className={styles.readerBody}
                  dangerouslySetInnerHTML={{ __html: formatMarkdown(selectedItem.content) }}
                />
              </div>
            ) : (
              <div className={styles.noNoteSelected}>
                <BookOpen size={48} className={styles.emptyIcon} />
                <h3>No Note Selected</h3>
                <p>Select a note from the left to read or edit its contents.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className={styles.modalOverlay}>
          <form onSubmit={handleCreateNote} className={styles.modalCard}>
            <h3>Create Knowledge Note</h3>
            <p>Save notes, summaries, and references to your personal repository.</p>
            <input
              type="text"
              placeholder="Title (e.g. Overview of Next.js 15 Server Actions)"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              className={styles.modalInput}
              autoFocus
              required
            />
            <textarea
              placeholder="Content (Markdown supported)..."
              value={newContent}
              onChange={(e) => setNewContent(e.target.value)}
              className={styles.modalTextarea}
              rows={8}
              required
            />
            <div className={styles.modalRow}>
              <input
                type="text"
                placeholder="Source (e.g. Next.js Docs)"
                value={newSource}
                onChange={(e) => setNewSource(e.target.value)}
                className={styles.modalInput}
              />
              <input
                type="url"
                placeholder="Source URL (optional)"
                value={newSourceUrl}
                onChange={(e) => setNewSourceUrl(e.target.value)}
                className={styles.modalInput}
              />
            </div>
            <input
              type="text"
              placeholder="Tags (comma-separated, e.g. architecture, nextjs, react)"
              value={newTags}
              onChange={(e) => setNewTags(e.target.value)}
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
                disabled={saving}
                loading={saving}
                variant="primary"
              >
                {saving ? 'Saving...' : 'Save Note'}
              </Button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
