'use client';

/**
 * CODE LAB THEME PROVIDER
 *
 * Provides theme context for the entire Code Lab application.
 * Features:
 * - Light/Dark mode toggle
 * - System preference detection
 * - Persistent preference in localStorage
 * - Smooth theme transitions
 */

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';

type Theme = 'light' | 'dark' | 'system';
type ResolvedTheme = 'light' | 'dark';

interface ThemeContextValue {
  theme: Theme;
  resolvedTheme: ResolvedTheme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

const STORAGE_KEY = 'code-lab-theme';

export function CodeLabThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('system');
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>('light');
  const [mounted, setMounted] = useState(false);

  // Get system preference
  const getSystemTheme = useCallback((): ResolvedTheme => {
    if (typeof window === 'undefined') return 'light';
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }, []);

  // Resolve theme based on setting
  const resolveTheme = useCallback((t: Theme): ResolvedTheme => {
    if (t === 'system') {
      return getSystemTheme();
    }
    return t;
  }, [getSystemTheme]);

  // Initialize theme from localStorage or system
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY) as Theme | null;
    if (stored && ['light', 'dark', 'system'].includes(stored)) {
      setThemeState(stored);
      setResolvedTheme(resolveTheme(stored));
    } else {
      setResolvedTheme(getSystemTheme());
    }
    setMounted(true);
  }, [getSystemTheme, resolveTheme]);

  // Listen for system theme changes
  useEffect(() => {
    if (theme !== 'system') return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => {
      setResolvedTheme(e.matches ? 'dark' : 'light');
    };

    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, [theme]);

  // Apply theme to document
  useEffect(() => {
    if (!mounted) return;

    const root = document.documentElement;
    root.classList.remove('theme-light', 'theme-dark');
    root.classList.add(`theme-${resolvedTheme}`);
    root.style.colorScheme = resolvedTheme;
  }, [resolvedTheme, mounted]);

  // Set theme with persistence
  const setTheme = useCallback((newTheme: Theme) => {
    setThemeState(newTheme);
    setResolvedTheme(resolveTheme(newTheme));
    localStorage.setItem(STORAGE_KEY, newTheme);
  }, [resolveTheme]);

  // Toggle between light and dark
  const toggleTheme = useCallback(() => {
    const newTheme = resolvedTheme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
  }, [resolvedTheme, setTheme]);

  // Prevent flash of wrong theme
  if (!mounted) {
    return (
      <div style={{ visibility: 'hidden' }}>
        {children}
      </div>
    );
  }

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme, toggleTheme }}>
      {children}
      <style jsx global>{`
        /* Theme transition */
        :root {
          transition: background-color 0.3s ease, color 0.3s ease;
        }

        /* Light theme (default) */
        :root,
        :root.theme-light {
          --cl-bg-primary: #ffffff;
          --cl-bg-secondary: #f9fafb;
          --cl-bg-tertiary: #f3f4f6;
          --cl-bg-input: #f8fafc;
          --cl-bg-hover: #f3f4f6;
          --cl-bg-selected: #e0e7ff;
          --cl-bg-code: #1e1e1e;

          --cl-border-primary: #e5e7eb;
          --cl-border-secondary: #d1d5db;

          --cl-text-primary: #1a1f36;
          --cl-text-secondary: #4b5563;
          --cl-text-tertiary: #6b7280;
          --cl-text-muted: #9ca3af;

          --cl-accent-primary: #6366f1;
          --cl-accent-secondary: #818cf8;
          --cl-accent-bg: #eef2ff;

          --cl-success: #22c55e;
          --cl-warning: #f59e0b;
          --cl-error: #ef4444;
          --cl-info: #3b82f6;

          --cl-shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.05);
          --cl-shadow-md: 0 4px 6px rgba(0, 0, 0, 0.1);
          --cl-shadow-lg: 0 10px 15px rgba(0, 0, 0, 0.1);
          --cl-shadow-xl: 0 20px 25px rgba(0, 0, 0, 0.15);
        }

        /* Dark theme */
        :root.theme-dark {
          --cl-bg-primary: #0f0f0f;
          --cl-bg-secondary: #171717;
          --cl-bg-tertiary: #262626;
          --cl-bg-input: #1a1a1a;
          --cl-bg-hover: #2a2a2a;
          --cl-bg-selected: #3730a3;
          --cl-bg-code: #0d0d0d;

          --cl-border-primary: #2a2a2a;
          --cl-border-secondary: #404040;

          --cl-text-primary: #fafafa;
          --cl-text-secondary: #a3a3a3;
          --cl-text-tertiary: #737373;
          --cl-text-muted: #525252;

          --cl-accent-primary: #818cf8;
          --cl-accent-secondary: #a5b4fc;
          --cl-accent-bg: #1e1b4b;

          --cl-success: #4ade80;
          --cl-warning: #fbbf24;
          --cl-error: #f87171;
          --cl-info: #60a5fa;

          --cl-shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.3);
          --cl-shadow-md: 0 4px 6px rgba(0, 0, 0, 0.4);
          --cl-shadow-lg: 0 10px 15px rgba(0, 0, 0, 0.5);
          --cl-shadow-xl: 0 20px 25px rgba(0, 0, 0, 0.6);
        }
      `}</style>
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a CodeLabThemeProvider');
  }
  return context;
}
