/**
 * NOTIFICATION INBOX COMPONENT
 *
 * PURPOSE:
 * - Displays list of all notifications
 * - Filters by type (all, system, user, admin, billing, feature)
 * - Group by threads for related notifications
 * - Mark as read/unread functionality
 * - Delete notifications
 *
 * BEHAVIOR:
 * - Slide-in panel from right side
 * - Filter tabs at top
 * - List view with timestamps
 * - Click notification to expand thread
 * - Swipe to delete on mobile
 * - Pull to refresh
 *
 * TODO:
 * - [ ] Add infinite scroll for older notifications
 * - [ ] Add search functionality
 * - [ ] Add bulk actions (mark all read, delete all)
 * - [ ] Add notification preferences link
 *
 * TEST PLAN:
 * - Verify notifications display correctly
 * - Test filter tabs work properly
 * - Check mark as read/unread functionality
 * - Verify delete removes notification
 * - Test mobile swipe gestures
 */

'use client';

import { useState, useMemo } from 'react';
import type { Notification, NotificationType } from '@/types/notifications';

interface NotificationInboxProps {
  notifications: Notification[];
  isOpen: boolean;
  onClose: () => void;
  onMarkAsRead: (id: string) => void;
  onMarkAllAsRead: () => void;
  onDelete: (id: string) => void;
  onNotificationClick: (notification: Notification) => void;
}

const FILTER_OPTIONS: Array<{ value: NotificationType | 'all'; label: string; icon: string }> = [
  { value: 'all', label: 'All', icon: '📬' },
  { value: 'system', label: 'System', icon: '⚙️' },
  { value: 'user', label: 'User', icon: '👤' },
  { value: 'admin', label: 'Admin', icon: '👨‍💼' },
  { value: 'billing', label: 'Billing', icon: '💳' },
  { value: 'feature', label: 'Features', icon: '✨' },
];

export function NotificationInbox({
  notifications,
  isOpen,
  onClose,
  onMarkAsRead,
  onMarkAllAsRead,
  onDelete,
  onNotificationClick,
}: NotificationInboxProps) {
  const [activeFilter, setActiveFilter] = useState<NotificationType | 'all'>('all');

  // Filter notifications
  const filteredNotifications = useMemo(() => {
    if (activeFilter === 'all') return notifications;
    return notifications.filter((n) => n.type === activeFilter);
  }, [notifications, activeFilter]);

  // Calculate unread count
  const unreadCount = useMemo(() => {
    return filteredNotifications.filter((n) => !n.isRead).length;
  }, [filteredNotifications]);

  const formatTimestamp = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return 'border-l-red-500';
      case 'high':
        return 'border-l-orange-500';
      case 'normal':
        return 'border-l-blue-500';
      case 'low':
        return 'border-l-gray-500';
      default:
        return 'border-l-gray-500';
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[999] animate-fade-in"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div className="fixed top-0 right-0 h-screen w-full md:w-[480px] bg-black border-l border-white/10 z-[1000] flex flex-col animate-slide-in-right shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-6 border-b border-white/10">
          <h2 className="text-lg sm:text-xl font-semibold text-white">Notifications</h2>
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <button
                onClick={onMarkAllAsRead}
                className="px-3 py-1.5 text-sm text-blue-400 hover:text-blue-300 transition-colors"
              >
                Mark all read
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors"
              aria-label="Close notifications"
            >
              <svg className="w-5 h-5 text-white/70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="flex flex-nowrap gap-2 p-3 sm:p-4 overflow-x-auto border-b border-white/10 no-scrollbar">
          {FILTER_OPTIONS.map((option) => {
            const count = option.value === 'all'
              ? notifications.length
              : notifications.filter((n) => n.type === option.value).length;

            return (
              <button
                key={option.value}
                onClick={() => setActiveFilter(option.value)}
                className={`flex flex-shrink-0 items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                  activeFilter === option.value
                    ? 'bg-white/20 text-white'
                    : 'bg-white/5 text-white/60 hover:bg-white/10 hover:text-white/80'
                }`}
              >
                <span>{option.icon}</span>
                <span>{option.label}</span>
                {count > 0 && (
                  <span className="ml-1 px-1.5 py-0.5 text-xs bg-white/20 rounded-full">
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Notifications List */}
        <div className="flex-1 overflow-y-auto">
          {filteredNotifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-white/50">
              <svg className="w-16 h-16 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
                />
              </svg>
              <p className="text-lg font-medium">No notifications</p>
              <p className="text-sm mt-1">You&apos;re all caught up!</p>
            </div>
          ) : (
            <div className="divide-y divide-white/5">
              {filteredNotifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`relative flex gap-3 p-4 sm:p-5 cursor-pointer transition-colors border-l-4 ${getPriorityColor(
                    notification.priority
                  )} ${
                    notification.isRead
                      ? 'bg-transparent hover:bg-white/5'
                      : 'bg-blue-500/10 hover:bg-blue-500/20'
                  }`}
                  onClick={() => {
                    if (!notification.isRead) {
                      onMarkAsRead(notification.id);
                    }
                    onNotificationClick(notification);
                  }}
                >
                  {/* Unread Indicator */}
                  {!notification.isRead && (
                    <div className="flex-shrink-0 w-2 h-2 mt-2 bg-blue-500 rounded-full" />
                  )}

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <h3 className={`text-sm sm:text-base font-semibold ${notification.isRead ? 'text-white/70' : 'text-white'}`}>
                        {notification.title}
                      </h3>
                      <span className="flex-shrink-0 text-xs sm:text-sm text-white/50">
                        {formatTimestamp(notification.createdAt)}
                      </span>
                    </div>
                    <p className={`text-sm sm:text-base ${notification.isRead ? 'text-white/50' : 'text-white/70'}`}>
                      {notification.body}
                    </p>
                    {notification.actionLabel && (
                      <button className="mt-2 text-sm text-blue-400 hover:text-blue-300 font-medium">
                        {notification.actionLabel} →
                      </button>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex-shrink-0 flex items-start gap-1">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onMarkAsRead(notification.id);
                      }}
                      className="p-1 hover:bg-white/10 rounded transition-colors"
                      aria-label={notification.isRead ? 'Mark as unread' : 'Mark as read'}
                    >
                      <svg className="w-4 h-4 text-white/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        {notification.isRead ? (
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 19v-8.93a2 2 0 01.89-1.664l7-4.666a2 2 0 012.22 0l7 4.666A2 2 0 0121 10.07V19M3 19a2 2 0 002 2h14a2 2 0 002-2M3 19l6.75-4.5M21 19l-6.75-4.5M3 10l6.75 4.5M21 10l-6.75 4.5m0 0l-1.14.76a2 2 0 01-2.22 0l-1.14-.76" />
                        ) : (
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        )}
                      </svg>
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDelete(notification.id);
                      }}
                      className="p-1 hover:bg-white/10 rounded transition-colors"
                      aria-label="Delete notification"
                    >
                      <svg className="w-4 h-4 text-white/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                        />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <style jsx>{`
        .animate-fade-in {
          animation: fadeIn 0.2s ease-out;
        }

        .animate-slide-in-right {
          animation: slideInRight 0.3s ease-out;
        }

        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        @keyframes slideInRight {
          from {
            transform: translateX(100%);
          }
          to {
            transform: translateX(0);
          }
        }

        .no-scrollbar::-webkit-scrollbar {
          display: none;
        }

        .no-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </>
  );
}
