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
import './code-lab-theme-provider.css';

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
  const resolveTheme = useCallback(
    (t: Theme): ResolvedTheme => {
      if (t === 'system') {
        return getSystemTheme();
      }
      return t;
    },
    [getSystemTheme]
  );

  // Initialize theme from localStorage or system
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY) as Theme | null;
      if (stored && ['light', 'dark', 'system'].includes(stored)) {
        setThemeState(stored);
        setResolvedTheme(resolveTheme(stored));
      } else {
        setResolvedTheme(getSystemTheme());
      }
    } catch {
      // localStorage may be unavailable in private browsing
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
  const setTheme = useCallback(
    (newTheme: Theme) => {
      setThemeState(newTheme);
      setResolvedTheme(resolveTheme(newTheme));
      try {
        localStorage.setItem(STORAGE_KEY, newTheme);
      } catch {
        // localStorage may be unavailable in private browsing
      }
    },
    [resolveTheme]
  );

  // Toggle between light and dark
  const toggleTheme = useCallback(() => {
    const newTheme = resolvedTheme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
  }, [resolvedTheme, setTheme]);

  // Prevent flash of wrong theme
  if (!mounted) {
    return <div className="invisible">{children}</div>;
  }

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme, toggleTheme }}>
      {children}
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
