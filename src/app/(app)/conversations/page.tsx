'use client';

import React, { useEffect, useState, useRef } from 'react';
import {
  MessageSquare,
  Plus,
  Search,
  Send,
  Cpu,
  Clock,
  Edit2,
  Check,
  X,
  FileText,
  AlertCircle,
  RefreshCw,
  ArrowLeft,
} from 'lucide-react';
import Button from '@/components/ui/Button';
import { StatusBadge, type SyncStatus } from '@/components/ui/StatusBadge';
import { formatMarkdown } from '@/lib/client/safe-markdown';
import type { ConversationIndexEntry, Message, ConversationMeta } from '@/types/personal-intelligence';
import styles from './Conversations.module.css';

export default function ConversationsPage() {
  const [conversations, setConversations] = useState<ConversationIndexEntry[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeMeta, setActiveMeta] = useState<ConversationMeta | null>(null);
  const [metaSha, setMetaSha] = useState<string>('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [markdownTranscript, setMarkdownTranscript] = useState<string | null>(null);
  const [showMarkdown, setShowMarkdown] = useState(false);

  // Mobile view state: when true on mobile, shows conversation view; when false, shows list
  const [showMobileChat, setShowMobileChat] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [inputMessage, setInputMessage] = useState('');
  const [loadingList, setLoadingList] = useState(true);
  const [loadingConversation, setLoadingConversation] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('saved');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Title edit state
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editedTitle, setEditedTitle] = useState('');

  // New conversation modal state
  const [showNewModal, setShowNewModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // 1. Fetch conversations index
  const fetchConversations = async () => {
    setLoadingList(true);
    try {
      const res = await fetch('/api/conversations');
      if (res.ok) {
        const data = await res.json();
        setConversations(data.conversations || []);
        if (data.conversations?.length > 0 && !activeId) {
          selectConversation(data.conversations[0].id, false);
        }
      }
    } catch {
      setErrorMessage('Failed to load conversations index');
    } finally {
      setLoadingList(false);
    }
  };

  useEffect(() => {
    fetchConversations();
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, generating]);

  // 2. Select and load conversation
  const selectConversation = async (id: string, isUserAction = false) => {
    setActiveId(id);
    if (isUserAction) {
      setShowMobileChat(true);
    }
    setLoadingConversation(true);
    setErrorMessage(null);
    setShowMarkdown(false);
    try {
      const res = await fetch(`/api/conversations/${id}`);
      if (res.ok) {
        const data = await res.json();
        setActiveMeta(data.meta);
        setMetaSha(data.metaSha);
        setMessages(data.messages || []);
        setMarkdownTranscript(data.markdown || null);
        setEditedTitle(data.meta.title);
      } else {
        throw new Error('Conversation not found');
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to load conversation');
    } finally {
      setLoadingConversation(false);
    }
  };

  // 3. Create new conversation
  const handleCreate = async () => {
    if (!newTitle.trim()) return;
    setErrorMessage(null);
    try {
      const res = await fetch('/api/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newTitle.trim() }),
      });
      if (res.ok) {
        const created = await res.json();
        setShowNewModal(false);
        setNewTitle('');
        await fetchConversations();
        selectConversation(created.id, true);
        setShowMobileChat(true);
      } else {
        const err = await res.json();
        throw new Error(err.error || 'Failed to create conversation');
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Creation failed');
    }
  };

  // 4. Update title
  const handleSaveTitle = async () => {
    if (!activeId || !editedTitle.trim() || !metaSha) return;
    try {
      const res = await fetch(`/api/conversations/${activeId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: editedTitle.trim(), metaSha }),
      });
      if (res.ok) {
        const updated = await res.json();
        setActiveMeta(updated);
        setIsEditingTitle(false);
        setConversations((prev) =>
          prev.map((c) => (c.id === activeId ? { ...c, title: updated.title } : c)),
        );
      }
    } catch {
      setErrorMessage('Failed to update title');
    }
  };

  // 5. Send message & generate response
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMessage.trim() || !activeId || generating) return;

    const userText = inputMessage.trim();
    setInputMessage('');
    setErrorMessage(null);

    // Optimistic user message
    const tempUserMsg: Message = {
      id: `msg_user_${Date.now()}`,
      sequence: messages.length + 1,
      role: 'user',
      content: userText,
      createdAt: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, tempUserMsg]);
    setSyncStatus('saving');
    setGenerating(true);

    try {
      // Call YAI Generation (handles user message persistence + cloud inference + assistant turn)
      const genRes = await fetch('/api/yai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId: activeId,
          message: userText,
          prompt: userText,
        }),
      });

      const genData = await genRes.json();
      if (!genRes.ok) {
        throw new Error(
          genData.error || 'Failed to generate response. Check AI Provider configuration.',
        );
      }

      // Update state with assistant response
      const assistantMsg = genData.assistantMessage || genData.message;
      if (assistantMsg) {
        setMessages((prev) => [...prev, assistantMsg]);
      }
      setSyncStatus('saved');
    } catch (err) {
      setSyncStatus('error');
      setErrorMessage(
        err instanceof Error
          ? err.message
          : 'Failed to generate response. Check AI Provider configuration.',
      );
    } finally {
      setGenerating(false);
    }
  };

  const filteredConversations = conversations.filter((c) =>
    c.title.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const isChatActiveOnMobile = showMobileChat && !!activeId;

  return (
    <div className={styles.splitLayout}>
      {/* ── Left Panel: Conversation List ── */}
      <aside
        className={`${styles.sidebar} ${isChatActiveOnMobile ? styles.mobileHidden : ''}`}
        aria-label="Conversation list"
      >
        <div className={styles.sidebarHeader}>
          <div className={styles.sidebarTitleRow}>
            <h2>Conversations</h2>
            <Button
              onClick={() => setShowNewModal(true)}
              variant="primary"
              size="sm"
              title="New Conversation"
              aria-label="New Conversation"
            >
              <Plus size={14} />
              <span>New</span>
            </Button>
          </div>

          <div className={styles.searchWrapper}>
            <Search size={14} className={styles.searchIcon} />
            <input
              type="text"
              placeholder="Search conversations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={styles.searchInput}
            />
          </div>
        </div>

        <div className={styles.listContainer}>
          {loadingList ? (
            <div className={styles.listLoading}>
              <RefreshCw className={styles.spinner} size={16} />
              <span>Loading conversations...</span>
            </div>
          ) : filteredConversations.length === 0 ? (
            <div className={styles.emptyList}>
              <p>No conversations found</p>
              <Button
                onClick={() => setShowNewModal(true)}
                variant="secondary"
                size="sm"
              >
                Start new
              </Button>
            </div>
          ) : (
            filteredConversations.map((c) => (
              <button
                key={c.id}
                onClick={() => selectConversation(c.id, true)}
                className={`${styles.convItem} ${c.id === activeId ? styles.activeConvItem : ''}`}
              >
                <div className={styles.convItemRow}>
                  <span className={styles.convItemTitle}>{c.title}</span>
                </div>
                <div className={styles.convItemMeta}>
                  {c.workspaceName ? (
                    <span className={styles.workspacePill}>{c.workspaceName}</span>
                  ) : (
                    <span className={styles.unfiledPill}>Unfiled</span>
                  )}
                  <span className={styles.dateLabel}>
                    {new Date(c.updatedAt).toLocaleDateString()}
                  </span>
                </div>
              </button>
            ))
          )}
        </div>
      </aside>

      {/* ── Right Panel: Active Conversation View ── */}
      <section
        className={`${styles.chatArea} ${!isChatActiveOnMobile ? styles.mobileHidden : ''}`}
        aria-label="Conversation content"
      >
        {activeId && activeMeta ? (
          <>
            {/* Conversation Header */}
            <div className={styles.chatHeader}>
              {/* Requirement 3: Mobile Back to Conversations button */}
              <button
                type="button"
                onClick={() => setShowMobileChat(false)}
                className={styles.mobileBackBtn}
                aria-label="Back to conversations"
              >
                <ArrowLeft size={16} />
                <span>Conversations</span>
              </button>

              <div className={styles.titleArea}>
                {isEditingTitle ? (
                  <div className={styles.titleEditRow}>
                    <input
                      type="text"
                      value={editedTitle}
                      onChange={(e) => setEditedTitle(e.target.value)}
                      className={styles.titleInput}
                      autoFocus
                    />
                    <button onClick={handleSaveTitle} className={styles.iconBtn} aria-label="Save">
                      <Check size={14} />
                    </button>
                    <button
                      onClick={() => setIsEditingTitle(false)}
                      className={styles.iconBtn}
                      aria-label="Cancel"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <div className={styles.titleDisplayRow}>
                    <h1 className={styles.activeTitle}>{activeMeta.title}</h1>
                    <button
                      onClick={() => setIsEditingTitle(true)}
                      className={styles.editBtn}
                      aria-label="Edit Title"
                    >
                      <Edit2 size={12} />
                    </button>
                  </div>
                )}
                <div className={styles.headerMetaRow}>
                  <StatusBadge status={syncStatus} />
                  {activeMeta.model && (
                    <span className={styles.modelMetaBadge}>
                      <Cpu size={11} />
                      <span>{activeMeta.model}</span>
                    </span>
                  )}
                </div>
              </div>

              <div className={styles.headerControls}>
                <button
                  onClick={() => setShowMarkdown(!showMarkdown)}
                  className={`${styles.toggleMdBtn} ${showMarkdown ? styles.toggleMdActive : ''}`}
                  title="Toggle Markdown Transcript view"
                >
                  <FileText size={14} />
                  <span>Transcript</span>
                </button>
              </div>
            </div>

            {/* Error Banner */}
            {errorMessage && (
              <div className={styles.errorBanner} role="alert">
                <AlertCircle size={14} />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Content view (Chat vs Transcript) */}
            {showMarkdown ? (
              <div className={styles.transcriptView}>
                <pre>{markdownTranscript || 'No transcript generated yet.'}</pre>
              </div>
            ) : (
              <div className={styles.messagesContainer}>
                {loadingConversation ? (
                  <div className={styles.messagesLoading}>
                    <RefreshCw className={styles.spinner} size={20} />
                    <span>Loading conversation...</span>
                  </div>
                ) : messages.length === 0 ? (
                  <div className={styles.messagesEmpty}>
                    <MessageSquare size={36} className={styles.emptyIcon} />
                    <h3>This conversation is empty</h3>
                    <p>Send a message below to begin.</p>
                  </div>
                ) : (
                  messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`${styles.messageWrapper} ${
                        msg.role === 'user' ? styles.userWrapper : styles.assistantWrapper
                      }`}
                    >
                      <div className={styles.bubbleHeader}>
                        <span className={styles.senderName}>
                          {msg.role === 'user' ? 'You' : 'YAI Assistant'}
                        </span>
                        <span className={styles.timestamp}>
                          {new Date(msg.createdAt).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                      <div
                        className={styles.bubbleContent}
                        dangerouslySetInnerHTML={{ __html: formatMarkdown(msg.content) }}
                      />
                    </div>
                  ))
                )}
                {generating && (
                  <div className={`${styles.messageWrapper} ${styles.assistantWrapper}`}>
                    <div className={styles.bubbleHeader}>
                      <span className={styles.senderName}>YAI Assistant</span>
                    </div>
                    <div className={styles.generatingIndicator}>
                      <span className={styles.dotPulse} />
                      <span className={styles.dotPulse} />
                      <span className={styles.dotPulse} />
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            )}

            {/* Input Form */}
            <form onSubmit={handleSendMessage} className={styles.inputArea}>
              <textarea
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage(e);
                  }
                }}
                placeholder="Ask YAI or add to your personal context... (Enter to send, Shift+Enter for newline)"
                className={styles.messageTextarea}
                rows={2}
                disabled={generating}
              />
              <button
                type="submit"
                disabled={generating || !inputMessage.trim()}
                className={styles.sendButton}
                aria-label="Send message"
              >
                <Send size={16} />
              </button>
            </form>
          </>
        ) : (
          <div className={styles.noConvSelected}>
            <MessageSquare size={48} className={styles.emptyIcon} />
            <h2>No Conversation Selected</h2>
            <p>Select a conversation from the left or create a new one.</p>
            <Button onClick={() => setShowNewModal(true)} variant="primary">
              <Plus size={16} />
              <span>New Conversation</span>
            </Button>
          </div>
        )}
      </section>

      {/* ── New Conversation Modal ── */}
      {showNewModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalCard}>
            <h3>New Conversation</h3>
            <p>Create a new conversation topic under your Personal Intelligence workspace.</p>
            <input
              type="text"
              placeholder="e.g. Architecture decisions for YAI v0"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              className={styles.modalInput}
              autoFocus
            />
            <div className={styles.modalActions}>
              <Button onClick={() => setShowNewModal(false)} variant="outline">
                Cancel
              </Button>
              <Button onClick={handleCreate} variant="primary">
                Create
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
