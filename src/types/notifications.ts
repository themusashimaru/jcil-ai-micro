/**
 * NOTIFICATION TYPES
 *
 * PURPOSE:
 * - Type definitions for in-app notification system
 * - Supports various notification types (system, user, admin)
 * - Thread-based conversation view
 *
 * NOTIFICATION CATEGORIES:
 * - system: Platform updates, maintenance, features
 * - user: User actions, mentions, shares
 * - admin: Admin broadcasts, announcements
 * - billing: Subscription, usage limits, payments
 * - feature: New features, beta access
 *
 * TODO:
 * - [ ] Add webhook integration for external notifications
 * - [ ] Add push notification support (FCM/APNS)
 * - [ ] Add notification preferences/settings
 */

export type NotificationType = 'system' | 'user' | 'admin' | 'billing' | 'feature';

export type NotificationPriority = 'low' | 'normal' | 'high' | 'urgent';

export interface Notification {
  id: string;
  type: NotificationType;
  priority: NotificationPriority;
  title: string;
  body: string;
  threadId?: string; // Group related notifications
  isRead: boolean;
  createdAt: Date;
  readAt?: Date;
  actionUrl?: string; // Optional CTA link
  actionLabel?: string; // Optional CTA text
  metadata?: Record<string, unknown>; // Flexible data storage
}

export interface NotificationThread {
  id: string;
  title: string;
  type: NotificationType;
  notifications: Notification[];
  unreadCount: number;
  lastNotificationAt: Date;
  isPinned: boolean;
}

export interface NotificationStats {
  total: number;
  unread: number;
  byType: Record<NotificationType, number>;
}

export interface NotificationFilter {
  type?: NotificationType;
  isRead?: boolean;
  priority?: NotificationPriority;
  threadId?: string;
}
