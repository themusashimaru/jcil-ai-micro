/**
 * OFFLINE INDICATOR COMPONENT
 *
 * PURPOSE:
 * - Shows visual indicator when user is offline
 * - Displays "Read-only mode" banner for cached content
 * - Auto-hides when connection restored
 *
 * BEHAVIOR:
 * - Listens to online/offline events
 * - Shows minimalist banner at top of screen
 * - Yellow/amber color to indicate limited functionality
 * - Smooth fade in/out transitions
 *
 * TODO:
 * - [ ] Add reconnection retry indicator
 * - [ ] Show last sync timestamp
 * - [ ] Add manual sync button
 *
 * TEST PLAN:
 * - Verify appears when network disconnected (DevTools offline mode)
 * - Check disappears when network restored
 * - Test on mobile with actual network toggle
 */

'use client';

import { useEffect, useState } from 'react';

export function OfflineIndicator() {
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    // Check initial state
    setIsOffline(!navigator.onLine);

    // Listen for network changes
    const handleOnline = () => {
      setIsOffline(false);
    };

    const handleOffline = () => {
      setIsOffline(true);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (!isOffline) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-50 animate-slide-down">
      <div className="bg-amber-500/20 backdrop-blur-md border-b border-amber-500/30 px-4 py-2">
        <div className="max-w-7xl mx-auto flex items-center justify-center gap-2 text-sm">
          <svg
            className="w-4 h-4 text-amber-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 2.829a4.978 4.978 0 01-1.414-2.83m-1.414 5.658a9 9 0 01-2.167-9.238m7.824 2.167a1 1 0 111.414 1.414m-1.414-1.414L3 3m8.293 8.293l1.414 1.414"
            />
          </svg>
          <span className="text-amber-100 font-medium">
            You&apos;re offline
          </span>
          <span className="text-amber-200/70">
            • Viewing cached content (read-only)
          </span>
        </div>
      </div>
    </div>
  );
}
