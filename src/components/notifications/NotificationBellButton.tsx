'use client';

import React from 'react';
import { Bell } from 'lucide-react';
import { useErrorNotification } from '@/components/providers/ErrorNotificationProvider';
import styles from './NotificationBellButton.module.css';

export default function NotificationBellButton() {
  const { unreadCount, isNotificationCenterOpen, toggleNotificationCenter } = useErrorNotification();

  const title = unreadCount > 0
    ? `${unreadCount} unread notification${unreadCount > 1 ? 's' : ''}`
    : 'Notifications';

  return (
    <button
      type="button"
      className={`${styles.button}${isNotificationCenterOpen ? ` ${styles.buttonActive}` : ''}`}
      onClick={toggleNotificationCenter}
      aria-label={title}
      aria-expanded={isNotificationCenterOpen}
      title={title}
    >
      <Bell size={16} className={styles.bellIcon} />
      {unreadCount > 0 && (
        <span className={styles.badge} aria-hidden="true">
          {unreadCount > 9 ? '9+' : unreadCount}
        </span>
      )}
    </button>
  );
}
