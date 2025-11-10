/**
 * NOTIFICATION BELL COMPONENT
 *
 * PURPOSE:
 * - Bell icon with unread badge count
 * - Toggles notification inbox on click
 * - Shows pulse animation when new notifications arrive
 * - Mobile-responsive positioning
 *
 * BEHAVIOR:
 * - Badge shows unread count (max 99+)
 * - Pulse animation on new notifications
 * - Click toggles inbox panel
 * - Red dot for unread, gray when all read
 *
 * TODO:
 * - [ ] Add sound notification on new message
 * - [ ] Add desktop notification permission request
 * - [ ] Add keyboard shortcut (Alt+N)
 *
 * TEST PLAN:
 * - Verify badge count updates when notifications change
 * - Check pulse animation appears on new notifications
 * - Test click toggles inbox panel
 * - Verify mobile responsive layout
 */

'use client';

import { useState, useEffect } from 'react';

interface NotificationBellProps {
  unreadCount: number;
  onClick: () => void;
  isOpen: boolean;
}

export function NotificationBell({ unreadCount, onClick, isOpen }: NotificationBellProps) {
  const [showPulse, setShowPulse] = useState(false);
  const [prevCount, setPrevCount] = useState(unreadCount);

  useEffect(() => {
    // Trigger pulse animation when count increases
    if (unreadCount > prevCount) {
      setShowPulse(true);
      setTimeout(() => setShowPulse(false), 2000);
    }
    setPrevCount(unreadCount);
  }, [unreadCount, prevCount]);

  const displayCount = unreadCount > 99 ? '99+' : unreadCount.toString();

  return (
    <button
      onClick={onClick}
      className={`relative p-2 rounded-lg transition-all ${
        isOpen
          ? 'bg-white/20 text-white'
          : 'hover:bg-white/10 text-white/70 hover:text-white'
      }`}
      aria-label={`Notifications ${unreadCount > 0 ? `(${unreadCount} unread)` : ''}`}
      aria-expanded={isOpen}
    >
      {/* Bell Icon */}
      <svg
        className={`w-6 h-6 transition-transform ${isOpen ? 'scale-110' : ''} ${
          showPulse ? 'animate-pulse' : ''
        }`}
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
        />
      </svg>

      {/* Badge */}
      {unreadCount > 0 && (
        <span
          className={`absolute -top-1 -right-1 flex items-center justify-center min-w-[20px] h-5 px-1.5 text-xs font-bold text-white bg-red-500 rounded-full ${
            showPulse ? 'animate-pulse' : ''
          }`}
          aria-label={`${unreadCount} unread notifications`}
        >
          {displayCount}
        </span>
      )}

      {/* Pulse Ring Animation */}
      {showPulse && (
        <span className="absolute -top-1 -right-1 flex h-5 w-5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
        </span>
      )}
    </button>
  );
}
