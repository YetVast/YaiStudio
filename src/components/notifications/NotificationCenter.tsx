'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Info,
  CheckCheck,
  Trash2,
  X,
  ExternalLink,
  RotateCcw,
  Eye,
  EyeOff,
  BellOff,
} from 'lucide-react';
import { useErrorNotification } from '@/components/providers/ErrorNotificationProvider';
import type { AppNotification, NotificationCategory } from '@/lib/errors/types';
import styles from './NotificationCenter.module.css';

type FilterCategory = 'ALL' | NotificationCategory;

function formatRelativeTime(isoStr: string): string {
  try {
    const date = new Date(isoStr);
    const now = new Date();
    const diffSec = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffSec < 10) return 'Just now';
    if (diffSec < 60) return `${diffSec}s ago`;
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  } catch {
    return isoStr;
  }
}

export default function NotificationCenter() {
  const {
    notifications,
    unreadCount,
    isNotificationCenterOpen,
    closeNotificationCenter,
    markAsRead,
    markAsUnread,
    markAllAsRead,
    clearNotification,
    clearAllNotifications,
    openErrorModal,
    retryError,
  } = useErrorNotification();

  const [activeFilter, setActiveFilter] = useState<FilterCategory>('ALL');
  const panelRef = useRef<HTMLDivElement>(null);

  // Close on Outside Click
  useEffect(() => {
    if (!isNotificationCenterOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (panelRef.current && !panelRef.current.contains(target) && !target.closest('button[aria-label*="notification" i]')) {
        closeNotificationCenter();
      }
    };

    window.addEventListener('mousedown', handleClickOutside);
    return () => window.removeEventListener('mousedown', handleClickOutside);
  }, [isNotificationCenterOpen, closeNotificationCenter]);

  // Close on Escape Key
  useEffect(() => {
    if (!isNotificationCenterOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeNotificationCenter();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isNotificationCenterOpen, closeNotificationCenter]);

  if (!isNotificationCenterOpen) return null;

  const filteredNotifications = notifications.filter((n) => {
    if (activeFilter === 'ALL') return true;
    return n.category === activeFilter;
  });

  const getCategoryIcon = (category: NotificationCategory) => {
    switch (category) {
      case 'ERROR':
        return <AlertCircle size={16} style={{ color: 'var(--color-destructive)' }} />;
      case 'WARNING':
        return <AlertTriangle size={16} style={{ color: 'var(--color-warning)' }} />;
      case 'SUCCESS':
        return <CheckCircle2 size={16} style={{ color: 'var(--color-success)' }} />;
      case 'INFO':
      default:
        return <Info size={16} style={{ color: 'var(--color-primary)' }} />;
    }
  };

  return (
    <div
      ref={panelRef}
      className={styles.panel}
      role="region"
      aria-label="Notification Center"
    >
      {/* ─── Header ────────────────────────────────────────── */}
      <div className={styles.header}>
        <div className={styles.titleGroup}>
          <h3 className={styles.title}>Notifications</h3>
          <span
            className={`${styles.headerBadge}${
              unreadCount > 0 ? ` ${styles.headerBadgeUnread}` : ''
            }`}
          >
            {unreadCount} unread
          </span>
        </div>

        <div className={styles.headerActions}>
          {unreadCount > 0 && (
            <button
              type="button"
              className={styles.actionBtn}
              onClick={markAllAsRead}
              title="Mark all notifications as read"
            >
              <CheckCheck size={12} style={{ display: 'inline', marginRight: 3 }} />
              Mark all read
            </button>
          )}
          {notifications.length > 0 && (
            <button
              type="button"
              className={styles.actionBtn}
              onClick={clearAllNotifications}
              title="Clear all notifications"
            >
              <Trash2 size={12} style={{ display: 'inline', marginRight: 3 }} />
              Clear all
            </button>
          )}
          <button
            type="button"
            className={styles.actionBtn}
            onClick={closeNotificationCenter}
            aria-label="Close notification panel"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* ─── Filter Bar ────────────────────────────────────── */}
      <div className={styles.filterBar}>
        {(['ALL', 'ERROR', 'WARNING', 'SUCCESS', 'INFO'] as FilterCategory[]).map((cat) => {
          const count = cat === 'ALL'
            ? notifications.length
            : notifications.filter((n) => n.category === cat).length;
          return (
            <button
              key={cat}
              type="button"
              className={`${styles.filterTab}${activeFilter === cat ? ` ${styles.filterTabActive}` : ''}`}
              onClick={() => setActiveFilter(cat)}
            >
              {cat} {count > 0 && `(${count})`}
            </button>
          );
        })}
      </div>

      {/* ─── Notification List ─────────────────────────────── */}
      <div className={styles.list}>
        {filteredNotifications.length === 0 ? (
          <div className={styles.emptyState}>
            <BellOff size={28} className={styles.emptyIcon} />
            <p style={{ margin: 0, fontWeight: 500 }}>No notifications</p>
            <p style={{ margin: '4px 0 0', fontSize: '0.75rem' }}>
              {activeFilter === 'ALL'
                ? 'All systems nominal. Error and task events will appear here.'
                : `No ${activeFilter.toLowerCase()} notifications recorded.`}
            </p>
          </div>
        ) : (
          filteredNotifications.map((n) => {
            const isError = n.category === 'ERROR' && Boolean(n.relatedErrorId);

            return (
              <div
                key={n.id}
                className={`${styles.card}${!n.read ? ` ${styles.cardUnread}` : ''}`}
              >
                <div className={styles.cardIconCol}>{getCategoryIcon(n.category)}</div>

                <div className={styles.cardBody}>
                  <div className={styles.cardTopRow}>
                    <h4 className={styles.cardTitle}>{n.title}</h4>
                    <span className={styles.cardTime}>{formatRelativeTime(n.timestamp)}</span>
                  </div>

                  <div className={styles.cardMetaRow}>
                    <span className={styles.sourceBadge}>{n.source.module}</span>
                    {n.source.operation && (
                      <span className={styles.sourceBadge}>{n.source.operation}</span>
                    )}
                  </div>

                  <p className={styles.cardDesc}>{n.description}</p>

                  <div className={styles.cardActionRow}>
                    {isError && (
                      <button
                        type="button"
                        className={styles.inspectBtn}
                        onClick={() => {
                          closeNotificationCenter();
                          if (n.relatedErrorId) {
                            openErrorModal(n.relatedErrorId);
                          }
                        }}
                      >
                        <span>Inspect Error Details</span>
                        <ExternalLink size={11} />
                      </button>
                    )}

                    {n.retryAvailable && n.relatedErrorId && (
                      <button
                        type="button"
                        className={styles.inspectBtn}
                        onClick={async () => {
                          if (n.relatedErrorId) {
                            await retryError(n.relatedErrorId);
                          }
                        }}
                      >
                        <RotateCcw size={11} />
                        <span>Retry</span>
                      </button>
                    )}

                    <div className={styles.cardControls}>
                      <button
                        type="button"
                        className={styles.cardIconBtn}
                        onClick={() => (n.read ? markAsUnread(n.id) : markAsRead(n.id))}
                        title={n.read ? 'Mark as unread' : 'Mark as read'}
                        aria-label={n.read ? 'Mark as unread' : 'Mark as read'}
                      >
                        {n.read ? <EyeOff size={13} /> : <Eye size={13} />}
                      </button>
                      <button
                        type="button"
                        className={styles.cardIconBtn}
                        onClick={() => clearNotification(n.id)}
                        title="Dismiss notification"
                        aria-label="Dismiss notification"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
