/**
 * NOTIFICATION PROVIDER COMPONENT
 *
 * PURPOSE:
 * - Manages notification state (mock data for now)
 * - Provides NotificationBell and NotificationInbox
 * - Handles mark as read, delete, and navigation
 * - Ready to integrate with real API
 *
 * BEHAVIOR:
 * - Loads mock notifications on mount
 * - Updates unread count in real-time
 * - Persists read state to localStorage
 * - Auto-refreshes every 30 seconds (when API ready)
 *
 * TODO:
 * - [ ] Replace mock data with API calls
 * - [ ] Add WebSocket for real-time notifications
 * - [ ] Add notification sound preferences
 * - [ ] Add desktop push notifications
 *
 * TEST PLAN:
 * - Verify bell shows correct unread count
 * - Test clicking bell opens inbox
 * - Verify mark as read updates count
 * - Test delete removes notification
 * - Check filtering works correctly
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { NotificationBell } from './NotificationBell';
import { NotificationInbox } from './NotificationInbox';
import type { Notification } from '@/types/notifications';

// Mock data for development
const MOCK_NOTIFICATIONS: Notification[] = [
  {
    id: '1',
    type: 'system',
    priority: 'normal',
    title: 'Welcome to Delta-2!',
    body: 'Your account is ready. Start chatting with AI assistants and explore advanced tools.',
    isRead: false,
    createdAt: new Date(Date.now() - 5 * 60000), // 5 minutes ago
    actionLabel: 'Get Started',
    actionUrl: '/chat',
  },
  {
    id: '2',
    type: 'feature',
    priority: 'high',
    title: 'New Feature: Image Generation',
    body: 'Generate stunning images with AI. Try the new Image Generator tool now!',
    isRead: false,
    createdAt: new Date(Date.now() - 30 * 60000), // 30 minutes ago
    actionLabel: 'Try Now',
    actionUrl: '/tools/image',
  },
  {
    id: '3',
    type: 'billing',
    priority: 'urgent',
    title: 'Subscription Expiring Soon',
    body: 'Your Pro subscription expires in 3 days. Renew now to avoid service interruption.',
    isRead: false,
    createdAt: new Date(Date.now() - 2 * 3600000), // 2 hours ago
    actionLabel: 'Renew Subscription',
    actionUrl: '/settings',
  },
  {
    id: '4',
    type: 'admin',
    priority: 'normal',
    title: 'Scheduled Maintenance',
    body: 'System maintenance scheduled for Sunday 2AM-4AM EST. Brief service interruption expected.',
    isRead: true,
    createdAt: new Date(Date.now() - 24 * 3600000), // 1 day ago
    readAt: new Date(Date.now() - 23 * 3600000),
  },
  {
    id: '5',
    type: 'user',
    priority: 'low',
    title: 'Profile Update',
    body: 'Your profile has been successfully updated with new preferences.',
    isRead: true,
    createdAt: new Date(Date.now() - 2 * 24 * 3600000), // 2 days ago
    readAt: new Date(Date.now() - 2 * 24 * 3600000),
  },
];

export function NotificationProvider() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isInboxOpen, setIsInboxOpen] = useState(false);

  // Load notifications on mount (mock data for now)
  useEffect(() => {
    // TODO: Replace with API call
    setNotifications(MOCK_NOTIFICATIONS);

    // Load read state from localStorage
    const savedReadStates = localStorage.getItem('notification-read-states');
    if (savedReadStates) {
      const readStates = JSON.parse(savedReadStates) as Record<string, boolean>;
      setNotifications((prev) =>
        prev.map((n) => ({
          ...n,
          isRead: readStates[n.id] ?? n.isRead,
        }))
      );
    }
  }, []);

  // Calculate unread count
  const unreadCount = notifications.filter((n) => !n.isRead).length;

  // Mark as read
  const handleMarkAsRead = useCallback((id: string) => {
    setNotifications((prev) =>
      prev.map((n) =>
        n.id === id
          ? { ...n, isRead: !n.isRead, readAt: !n.isRead ? new Date() : undefined }
          : n
      )
    );

    // Persist to localStorage
    const readStates = notifications.reduce((acc, n) => {
      acc[n.id] = n.id === id ? !n.isRead : n.isRead;
      return acc;
    }, {} as Record<string, boolean>);
    localStorage.setItem('notification-read-states', JSON.stringify(readStates));

    // TODO: Call API to mark as read
  }, [notifications]);

  // Mark all as read
  const handleMarkAllAsRead = useCallback(() => {
    setNotifications((prev) =>
      prev.map((n) => ({ ...n, isRead: true, readAt: new Date() }))
    );

    // Persist to localStorage
    const readStates = notifications.reduce((acc, n) => {
      acc[n.id] = true;
      return acc;
    }, {} as Record<string, boolean>);
    localStorage.setItem('notification-read-states', JSON.stringify(readStates));

    // TODO: Call API to mark all as read
  }, [notifications]);

  // Delete notification
  const handleDelete = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));

    // TODO: Call API to delete notification
  }, []);

  // Handle notification click
  const handleNotificationClick = useCallback((notification: Notification) => {
    // If there's an action URL, navigate to it using Next.js router
    if (notification.actionUrl) {
      router.push(notification.actionUrl);
    }

    // Close inbox
    setIsInboxOpen(false);
  }, [router]);

  return (
    <>
      <NotificationBell
        unreadCount={unreadCount}
        onClick={() => setIsInboxOpen(!isInboxOpen)}
        isOpen={isInboxOpen}
      />

      <NotificationInbox
        notifications={notifications}
        isOpen={isInboxOpen}
        onClose={() => setIsInboxOpen(false)}
        onMarkAsRead={handleMarkAsRead}
        onMarkAllAsRead={handleMarkAllAsRead}
        onDelete={handleDelete}
        onNotificationClick={handleNotificationClick}
      />
    </>
  );
}
