'use client';

import { useTheme, Theme } from '@/contexts/ThemeContext';
import { useState, useEffect } from 'react';

interface ThemeToggleProps {
  className?: string;
}

/**
 * Theme toggle button for switching between themes.
 * - Regular users: Toggle between dark and light
 * - Admin users: Cycle through dark, light, and ocean (experimental)
 */
export function ThemeToggle({ className = '' }: ThemeToggleProps) {
  const { theme, cycleTheme, isLoading } = useTheme();
  const [isAdmin, setIsAdmin] = useState(false);
  const [checkingAdmin, setCheckingAdmin] = useState(true);

  // Check if user is admin on mount (for ocean mode access)
  useEffect(() => {
    const checkAdminStatus = async () => {
      try {
        const response = await fetch('/api/user/is-admin');
        if (response.ok) {
          const data = await response.json();
          setIsAdmin(data.isAdmin === true);
        }
      } catch (error) {
        console.error('[ThemeToggle] Error checking admin status:', error);
      } finally {
        setCheckingAdmin(false);
      }
    };

    checkAdminStatus();
  }, []);

  // Determine available themes based on admin status
  // Order: dark → light → ocean (ocean is admin-only)
  const availableThemes: Theme[] = isAdmin
    ? ['dark', 'light', 'ocean']
    : ['dark', 'light'];

  // Get the icon and label for current theme
  const getThemeIcon = () => {
    switch (theme) {
      case 'light':
        return (
          // Sun icon - switch to ocean (for admin) or dark
          <svg
            className="h-4 w-4 md:h-5 md:w-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            strokeWidth={2}
          >
            <circle cx="12" cy="12" r="5" />
            <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
          </svg>
        );
      case 'ocean':
        return (
          // Wave icon - switch to dark
          <svg
            className="h-4 w-4 md:h-5 md:w-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            strokeWidth={2}
          >
            <path d="M2 12c1.5-2 3.5-3 6-3s4.5 1 6 3c1.5 2 3.5 3 6 3" />
            <path d="M2 17c1.5-2 3.5-3 6-3s4.5 1 6 3c1.5 2 3.5 3 6 3" />
            <path d="M2 7c1.5-2 3.5-3 6-3s4.5 1 6 3c1.5 2 3.5 3 6 3" />
          </svg>
        );
      default: // dark
        return (
          // Moon icon - switch to light
          <svg
            className="h-4 w-4 md:h-5 md:w-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            strokeWidth={2}
          >
            <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
          </svg>
        );
    }
  };

  const getNextTheme = (): string => {
    const currentIndex = availableThemes.indexOf(theme);
    const nextIndex = (currentIndex + 1) % availableThemes.length;
    return availableThemes[nextIndex];
  };

  // Don't show while checking admin status
  if (checkingAdmin) {
    return null;
  }

  return (
    <button
      onClick={() => cycleTheme(availableThemes)}
      disabled={isLoading}
      className={`rounded-lg p-1.5 transition-opacity hover:opacity-70 ${className}`}
      style={{ color: 'var(--text-primary)' }}
      aria-label={`Switch to ${getNextTheme()} mode`}
      title={`Switch to ${getNextTheme()} mode${theme === 'ocean' ? ' (Ocean - Admin Preview)' : ''}`}
    >
      {getThemeIcon()}
    </button>
  );
}
