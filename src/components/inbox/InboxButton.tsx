/**
 * INBOX BUTTON COMPONENT
 *
 * PURPOSE:
 * - Displays inbox icon with unread count badge
 * - Opens UserInbox modal on click
 * - Polls for new message count
 */

'use client';

import { useState, useEffect } from 'react';
import UserInbox from './UserInbox';

export default function InboxButton() {
  const [isOpen, setIsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  // Fetch unread count on mount and periodically
  useEffect(() => {
    const fetchUnreadCount = async () => {
      try {
        const response = await fetch('/api/user/messages');
        if (response.ok) {
          const data = await response.json();
          setUnreadCount(data.counts?.unread || 0);
        }
      } catch (error) {
        console.error('Error fetching unread count:', error);
      }
    };

    fetchUnreadCount();

    // Poll every 60 seconds for new messages
    const interval = setInterval(fetchUnreadCount, 60000);

    return () => clearInterval(interval);
  }, []);

  // Refresh count when modal closes
  const handleClose = () => {
    setIsOpen(false);
    // Refetch count after a short delay
    setTimeout(async () => {
      try {
        const response = await fetch('/api/user/messages');
        if (response.ok) {
          const data = await response.json();
          setUnreadCount(data.counts?.unread || 0);
        }
      } catch (error) {
        console.error('Error fetching unread count:', error);
      }
    }, 500);
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="relative p-2 rounded-lg transition hover:opacity-80"
        style={{ backgroundColor: 'var(--primary-hover)' }}
        title="Inbox"
      >
        <svg
          className="w-5 h-5"
          style={{ color: 'var(--text-primary)' }}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
          />
        </svg>

        {/* Unread Badge */}
        {unreadCount > 0 && (
          <span
            className="absolute -top-1 -right-1 min-w-[18px] h-[18px] flex items-center justify-center text-xs font-bold rounded-full px-1"
            style={{
              backgroundColor: '#ef4444',
              color: '#ffffff',
            }}
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      <UserInbox isOpen={isOpen} onClose={handleClose} />
    </>
  );
}
