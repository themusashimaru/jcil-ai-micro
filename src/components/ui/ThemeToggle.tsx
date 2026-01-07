'use client';

import { useTheme } from '@/contexts/ThemeContext';

interface ThemeToggleProps {
  className?: string;
}

/**
 * Theme toggle button for switching between dark, light, and ocean modes.
 * Available to all authenticated users.
 */
export function ThemeToggle({ className = '' }: ThemeToggleProps) {
  const { theme, toggleTheme, isLoading } = useTheme();

  // Get next theme name for aria-label (pro is displayed as "refined")
  const nextTheme = theme === 'dark' ? 'light' : theme === 'light' ? 'ocean' : theme === 'ocean' ? 'refined' : 'dark';

  return (
    <button
      onClick={toggleTheme}
      disabled={isLoading}
      className={`rounded-lg p-1.5 transition-opacity hover:opacity-70 ${className}`}
      style={{ color: 'var(--text-primary)' }}
      aria-label={`Switch to ${nextTheme} mode`}
      title={`Switch to ${nextTheme} mode`}
    >
      {theme === 'dark' ? (
        // Moon icon - currently dark, will switch to light
        <svg
          className="h-4 w-4 md:h-5 md:w-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          strokeWidth={2}
        >
          <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
        </svg>
      ) : theme === 'light' ? (
        // Sun icon - currently light, will switch to ocean
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
      ) : theme === 'ocean' ? (
        // Wave icon - currently ocean, will switch to pro
        <svg
          className="h-4 w-4 md:h-5 md:w-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          strokeWidth={2}
        >
          <path d="M2 12c2-2 4-3 6-3s4 1 6 3 4 3 6 3 4-1 6-3" />
          <path d="M2 17c2-2 4-3 6-3s4 1 6 3 4 3 6 3 4-1 6-3" />
          <path d="M2 7c2-2 4-3 6-3s4 1 6 3 4 3 6 3 4-1 6-3" />
        </svg>
      ) : (
        // Sparkle icon - currently pro (Refined), will switch to dark
        <svg
          className="h-4 w-4 md:h-5 md:w-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          strokeWidth={2}
        >
          <path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3z" />
          <path d="M19 14l.9 2.7 2.7.9-2.7.9-.9 2.7-.9-2.7-2.7-.9 2.7-.9.9-2.7z" />
          <path d="M5 17l.6 1.8 1.8.6-1.8.6-.6 1.8-.6-1.8-1.8-.6 1.8-.6.6-1.8z" />
        </svg>
      )}
    </button>
  );
}
