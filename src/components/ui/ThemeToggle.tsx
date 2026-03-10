'use client';

import { useTheme } from '@/contexts/ThemeContext';

interface ThemeToggleProps {
  className?: string;
}

/**
 * Theme toggle button for switching between themes.
 * All users: pro → light → dark → ocean → pro
 */
export function ThemeToggle({ className = '' }: ThemeToggleProps) {
  const { theme, toggleTheme, isLoading } = useTheme();

  // Get next theme name for aria-label
  const getNextTheme = () => {
    const themes = ['pro', 'light', 'dark', 'editorial', 'ocean'];
    const currentIndex = themes.indexOf(theme);
    const nextIndex = (currentIndex + 1) % themes.length;
    const next = themes[nextIndex];
    // Display names
    if (next === 'pro') return 'Refined';
    if (next === 'ocean') return 'Ocean';
    if (next === 'dark') return 'Dark';
    if (next === 'editorial') return 'Editorial';
    return next.charAt(0).toUpperCase() + next.slice(1);
  };

  const nextTheme = getNextTheme();

  return (
    <button
      onClick={toggleTheme}
      disabled={isLoading}
      className={`rounded-lg p-1.5 transition-opacity hover:opacity-70 text-text-primary ${className}`}
      aria-label={`Switch to ${nextTheme} mode`}
      title={`Switch to ${nextTheme} mode`}
    >
      {theme === 'editorial' ? (
        // Broadcast/signal icon - editorial landing page theme
        <svg
          className="h-4 w-4 md:h-5 md:w-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          strokeWidth={2}
        >
          <path d="M4.9 19.1C1 15.2 1 8.8 4.9 4.9" />
          <path d="M7.8 16.2c-2.3-2.3-2.3-6.1 0-8.4" />
          <path d="M16.2 7.8c2.3 2.3 2.3 6.1 0 8.4" />
          <path d="M19.1 4.9C23 8.8 23 15.1 19.1 19" />
          <circle cx="12" cy="12" r="2" />
        </svg>
      ) : theme === 'dark' ? (
        // Moon icon - dark mode
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
        // Sun icon - currently light
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
        // Wave icon - currently ocean
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
        // Leaf icon - currently pro (Refined)
        <svg
          className="h-4 w-4 md:h-5 md:w-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          strokeWidth={2}
        >
          <path d="M5 21c.5-4.5 2.5-8 7-10" />
          <path d="M9 18c6.218 0 10-3.782 10-10V3h-5c-6.218 0-10 3.782-10 10v5h5z" />
        </svg>
      )}
    </button>
  );
}
