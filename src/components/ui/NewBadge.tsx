'use client';

/**
 * NEW FEATURE BADGE
 *
 * Subtle pulsing "NEW" badge for highlighting new features.
 * Uses localStorage to track whether the user has dismissed it
 * (by clicking/expanding the parent section).
 *
 * The badge pulses gently a few times then settles to a static state.
 * Once dismissed via onDismiss or storageKey click, it never shows again.
 */

import { useState, useEffect } from 'react';

interface NewBadgeProps {
  /** Unique key for localStorage persistence (e.g. "new-scheduled-tasks") */
  storageKey: string;
}

export function NewBadge({ storageKey }: NewBadgeProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      const dismissed = localStorage.getItem(`badge-dismissed:${storageKey}`);
      if (!dismissed) {
        setVisible(true);
      }
    } catch {
      // localStorage unavailable, don't show badge
    }
  }, [storageKey]);

  if (!visible) return null;

  return <span className="new-feature-badge">NEW</span>;
}

/** Call this to permanently dismiss a badge by its storageKey */
export function dismissNewBadge(storageKey: string): void {
  try {
    localStorage.setItem(`badge-dismissed:${storageKey}`, '1');
  } catch {
    // localStorage unavailable
  }
}
