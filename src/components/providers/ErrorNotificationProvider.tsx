'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import {
  NotificationStore,
  ErrorRegistry,
  RetryManager,
  errorHandler,
  type AppNotification,
  type ApplicationError,
} from '@/lib/errors';
import ErrorModal from '@/components/errors/ErrorModal';
import NotificationCenter from '@/components/notifications/NotificationCenter';

interface ErrorNotificationContextValue {
  notifications: AppNotification[];
  unreadCount: number;
  isNotificationCenterOpen: boolean;
  toggleNotificationCenter: () => void;
  closeNotificationCenter: () => void;
  activeErrorModal: ApplicationError | null;
  openErrorModal: (errorOrId: ApplicationError | string) => Promise<void>;
  closeErrorModal: () => void;
  markAsRead: (id: string) => Promise<void>;
  markAsUnread: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  clearNotification: (id: string) => Promise<void>;
  clearAllNotifications: () => Promise<void>;
  retryError: (errorId: string) => Promise<boolean>;
  isRetrying: boolean;
}

const ErrorNotificationContext = createContext<ErrorNotificationContextValue | null>(null);

export function ErrorNotificationProvider({ children }: { children: React.ReactNode }) {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [isNotificationCenterOpen, setIsNotificationCenterOpen] = useState(false);
  const [activeErrorModal, setActiveErrorModal] = useState<ApplicationError | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);

  // Sync notifications from NotificationStore
  const refreshNotifications = useCallback(async () => {
    try {
      const list = await NotificationStore.getNotifications();
      setNotifications(list);
      const unread = list.filter((n) => !n.read).length;
      setUnreadCount(unread);
    } catch (err) {
      console.warn('[ErrorNotificationProvider] Failed to refresh notifications:', err);
    }
  }, []);

  useEffect(() => {
    refreshNotifications();
    const unsubscribeStore = NotificationStore.subscribe(refreshNotifications);
    return unsubscribeStore;
  }, [refreshNotifications]);

  // Sync Modal State from ErrorHandler
  useEffect(() => {
    const unsubscribeModal = errorHandler.subscribeToModal((error) => {
      setActiveErrorModal(error);
    });
    return unsubscribeModal;
  }, []);

  // Sync Retry State from RetryManager
  useEffect(() => {
    const unsubscribeRetry = RetryManager.subscribe(() => {
      setIsRetrying(RetryManager.isAnyRetrying());
      // Refresh current modal error if open
      if (activeErrorModal) {
        ErrorRegistry.getError(activeErrorModal.id).then((fresh) => {
          if (fresh) setActiveErrorModal(fresh);
        });
      }
    });
    return unsubscribeRetry;
  }, [activeErrorModal]);

  // Global Unhandled Errors Listener
  useEffect(() => {
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      console.error('[Global Handler] Unhandled promise rejection:', event.reason);
      errorHandler.captureError({
        error: event.reason,
        title: 'Unhandled Promise Rejection',
        source: {
          module: 'Application Runtime',
          component: 'Global Error Boundary',
          operation: 'Async Operation',
        },
        category: 'RUNTIME',
        showModal: false, // Notification-only so it doesn't jarringly block the user
      });
    };

    const handleWindowError = (event: ErrorEvent) => {
      console.error('[Global Handler] Uncaught window error:', event.error || event.message);
      errorHandler.captureError({
        error: event.error || event.message,
        title: 'Runtime Error',
        source: {
          module: 'Application Runtime',
          component: 'Browser Runtime',
          operation: event.filename ? `${event.filename}:${event.lineno}` : 'Window Execution',
        },
        category: 'RUNTIME',
        showModal: false,
      });
    };

    window.addEventListener('unhandledrejection', handleUnhandledRejection);
    window.addEventListener('error', handleWindowError);

    return () => {
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
      window.removeEventListener('error', handleWindowError);
    };
  }, []);

  const toggleNotificationCenter = useCallback(() => {
    setIsNotificationCenterOpen((v) => !v);
  }, []);

  const closeNotificationCenter = useCallback(() => {
    setIsNotificationCenterOpen(false);
  }, []);

  const openErrorModal = useCallback(async (errorOrId: ApplicationError | string) => {
    await errorHandler.openErrorModal(errorOrId);
  }, []);

  const closeErrorModal = useCallback(() => {
    errorHandler.closeErrorModal();
  }, []);

  const markAsRead = useCallback(async (id: string) => {
    await NotificationStore.markAsRead(id);
  }, []);

  const markAsUnread = useCallback(async (id: string) => {
    await NotificationStore.markAsUnread(id);
  }, []);

  const markAllAsRead = useCallback(async () => {
    await NotificationStore.markAllAsRead();
  }, []);

  const clearNotification = useCallback(async (id: string) => {
    await NotificationStore.clearNotification(id);
  }, []);

  const clearAllNotifications = useCallback(async () => {
    await NotificationStore.clearAllNotifications();
  }, []);

  const retryError = useCallback(async (errorId: string) => {
    setIsRetrying(true);
    try {
      const success = await RetryManager.executeRetry(errorId);
      if (success) {
        await NotificationStore.updateByErrorId(errorId, (n) => ({
          ...n,
          title: `[Resolved] ${n.title}`,
          executionStatus: 'SUCCEEDED',
          retryAvailable: false,
        }));
      }
      return success;
    } finally {
      setIsRetrying(false);
      // Refresh modal
      const fresh = await ErrorRegistry.getError(errorId);
      if (fresh) setActiveErrorModal(fresh);
    }
  }, []);

  const value = useMemo(
    () => ({
      notifications,
      unreadCount,
      isNotificationCenterOpen,
      toggleNotificationCenter,
      closeNotificationCenter,
      activeErrorModal,
      openErrorModal,
      closeErrorModal,
      markAsRead,
      markAsUnread,
      markAllAsRead,
      clearNotification,
      clearAllNotifications,
      retryError,
      isRetrying,
    }),
    [
      notifications,
      unreadCount,
      isNotificationCenterOpen,
      toggleNotificationCenter,
      closeNotificationCenter,
      activeErrorModal,
      openErrorModal,
      closeErrorModal,
      markAsRead,
      markAsUnread,
      markAllAsRead,
      clearNotification,
      clearAllNotifications,
      retryError,
      isRetrying,
    ]
  );

  return (
    <ErrorNotificationContext.Provider value={value}>
      {children}
      <NotificationCenter />
      <ErrorModal />
    </ErrorNotificationContext.Provider>
  );
}

export function useErrorNotification(): ErrorNotificationContextValue {
  const context = useContext(ErrorNotificationContext);
  if (!context) {
    throw new Error('useErrorNotification must be used within an ErrorNotificationProvider');
  }
  return context;
}
