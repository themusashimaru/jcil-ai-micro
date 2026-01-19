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
  const setTheme = useCallback(
    (newTheme: Theme) => {
      setThemeState(newTheme);
      setResolvedTheme(resolveTheme(newTheme));
      localStorage.setItem(STORAGE_KEY, newTheme);
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
    return <div style={{ visibility: 'hidden' }}>{children}</div>;
  }

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme, toggleTheme }}>
      {children}
      <style jsx global>{`
        /* Theme transition */
        :root {
          transition:
            background-color 0.3s ease,
            color 0.3s ease;
        }

        /* Light theme (default) - Navy blue professional style */
        :root,
        :root.theme-light {
          --cl-bg-primary: #ffffff;
          --cl-bg-secondary: #f9fafb;
          --cl-bg-tertiary: #f3f4f6;
          --cl-bg-input: #f8fafc;
          --cl-bg-hover: #f3f4f6;
          --cl-bg-selected: #e8eef5;
          --cl-bg-code: #1e1e1e;

          --cl-border-primary: #e5e7eb;
          --cl-border-secondary: #d1d5db;

          --cl-text-primary: #1a1f36;
          --cl-text-secondary: #374151;
          --cl-text-tertiary: #4b5563;
          --cl-text-muted: #6b7280;

          /* Navy blue accents - professional, trustworthy */
          --cl-accent-primary: #1e3a5f;
          --cl-accent-secondary: #2d4a6f;
          --cl-accent-bg: #eef3f8;

          --cl-success: #22c55e;
          --cl-warning: #f59e0b;
          --cl-error: #ef4444;
          --cl-info: #3b82f6;
          --cl-critical: #dc2626;

          /* Extended semantic colors */
          --cl-purple: #8b5cf6;
          --cl-cyan: #06b6d4;
          --cl-pink: #ec4899;
          --cl-gray: #6b7280;
          --cl-orange: #f38020;
          --cl-teal: #00ad9f;

          /* Terminal colors */
          --cl-terminal-prompt: #3fb950;
          --cl-terminal-success: #3fb950;

          /* Model colors */
          --cl-model-opus: #a855f7;
          --cl-model-sonnet: #3b82f6;
          --cl-model-haiku: #22c55e;

          /* Agent colors */
          --cl-agent-workspace: #22c55e;
          --cl-agent-workspace-bg: #dcfce7;
          --cl-agent-standard: #1e3a5f;
          --cl-agent-standard-bg: #e8eef5;
          --cl-agent-code: #2d4a6f;
          --cl-agent-code-bg: #eef3f8;

          --cl-shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.05);
          --cl-shadow-md: 0 4px 6px rgba(0, 0, 0, 0.1);
          --cl-shadow-lg: 0 10px 15px rgba(0, 0, 0, 0.1);
          --cl-shadow-xl: 0 20px 25px rgba(0, 0, 0, 0.15);
        }

        /* Dark theme - Navy-inspired professional dark */
        :root.theme-dark {
          --cl-bg-primary: #0f1419;
          --cl-bg-secondary: #161b22;
          --cl-bg-tertiary: #21262d;
          --cl-bg-input: #161b22;
          --cl-bg-hover: #262c36;
          --cl-bg-selected: #1e3a5f;
          --cl-bg-code: #0d1117;

          --cl-border-primary: #30363d;
          --cl-border-secondary: #484f58;

          --cl-text-primary: #e6edf3;
          --cl-text-secondary: #b1bac4;
          --cl-text-tertiary: #8b949e;
          --cl-text-muted: #7d8590;

          /* Navy blue accents - lighter for dark mode visibility */
          --cl-accent-primary: #5b8dc9;
          --cl-accent-secondary: #79a3d6;
          --cl-accent-bg: #152238;

          --cl-success: #4ade80;
          --cl-warning: #fbbf24;
          --cl-error: #f87171;
          --cl-info: #60a5fa;
          --cl-critical: #ef4444;

          /* Extended semantic colors */
          --cl-purple: #a78bfa;
          --cl-cyan: #22d3ee;
          --cl-pink: #f472b6;
          --cl-gray: #9ca3af;
          --cl-orange: #fb923c;
          --cl-teal: #2dd4bf;

          /* Terminal colors */
          --cl-terminal-prompt: #4ade80;
          --cl-terminal-success: #4ade80;

          /* Model colors */
          --cl-model-opus: #c084fc;
          --cl-model-sonnet: #60a5fa;
          --cl-model-haiku: #4ade80;

          /* Agent colors */
          --cl-agent-workspace: #4ade80;
          --cl-agent-workspace-bg: #14532d;
          --cl-agent-standard: #5b8dc9;
          --cl-agent-standard-bg: #152238;
          --cl-agent-code: #79a3d6;
          --cl-agent-code-bg: #1a2744;

          --cl-shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.3);
          --cl-shadow-md: 0 4px 6px rgba(0, 0, 0, 0.4);
          --cl-shadow-lg: 0 10px 15px rgba(0, 0, 0, 0.5);
          --cl-shadow-xl: 0 20px 25px rgba(0, 0, 0, 0.6);
        }

        /* Pro Mode - Charcoal with baby blue accents (matches main app) */
        :root.pro-mode {
          --cl-bg-primary: #2f2f2f;
          --cl-bg-secondary: #3a3a3a;
          --cl-bg-tertiary: #454545;
          --cl-bg-input: #1a1a1a;
          --cl-bg-hover: #404040;
          --cl-bg-selected: #4a4a4a;
          --cl-bg-code: #1a1a1a;

          --cl-border-primary: rgba(255, 255, 255, 0.1);
          --cl-border-secondary: rgba(255, 255, 255, 0.15);

          --cl-text-primary: #ffffff;
          --cl-text-secondary: #c4c4c4;
          --cl-text-tertiary: #a8a8a8;
          --cl-text-muted: #888888;

          /* Baby blue accents - matches main app pro mode */
          --cl-accent-primary: #7de8ff;
          --cl-accent-secondary: #9ef0ff;
          --cl-accent-bg: rgba(125, 232, 255, 0.15);

          --cl-success: #4ade80;
          --cl-warning: #fbbf24;
          --cl-error: #f87171;
          --cl-info: #60a5fa;
          --cl-critical: #ef4444;

          /* Extended semantic colors */
          --cl-purple: #a78bfa;
          --cl-cyan: #7de8ff;
          --cl-pink: #f472b6;
          --cl-gray: #9ca3af;
          --cl-orange: #fb923c;
          --cl-teal: #2dd4bf;

          /* Terminal colors */
          --cl-terminal-prompt: #7de8ff;
          --cl-terminal-success: #4ade80;

          /* Model colors */
          --cl-model-opus: #c084fc;
          --cl-model-sonnet: #7de8ff;
          --cl-model-haiku: #4ade80;

          /* Agent colors */
          --cl-agent-workspace: #4ade80;
          --cl-agent-workspace-bg: rgba(74, 222, 128, 0.15);
          --cl-agent-standard: #7de8ff;
          --cl-agent-standard-bg: rgba(125, 232, 255, 0.15);
          --cl-agent-code: #9ef0ff;
          --cl-agent-code-bg: rgba(158, 240, 255, 0.15);

          --cl-shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.2);
          --cl-shadow-md: 0 4px 6px rgba(0, 0, 0, 0.3);
          --cl-shadow-lg: 0 10px 15px rgba(0, 0, 0, 0.4);
          --cl-shadow-xl: 0 20px 25px rgba(0, 0, 0, 0.5);
        }

        /* Ocean Mode - Deep navy with cyan accents (matches main app) */
        :root.ocean-mode {
          --cl-bg-primary: #030810;
          --cl-bg-secondary: #081020;
          --cl-bg-tertiary: #0d1a30;
          --cl-bg-input: #030810;
          --cl-bg-hover: #0f1a2a;
          --cl-bg-selected: #152238;
          --cl-bg-code: #030810;

          --cl-border-primary: rgba(77, 200, 255, 0.15);
          --cl-border-secondary: rgba(77, 200, 255, 0.2);

          --cl-text-primary: #e8f4ff;
          --cl-text-secondary: #8ab4d8;
          --cl-text-tertiary: #6a94b8;
          --cl-text-muted: #5a7a9a;

          /* Cyan accents - matches main app ocean mode */
          --cl-accent-primary: #4dc8ff;
          --cl-accent-secondary: #6dd8ff;
          --cl-accent-bg: rgba(77, 200, 255, 0.12);

          --cl-success: #4ade80;
          --cl-warning: #fbbf24;
          --cl-error: #f87171;
          --cl-info: #60a5fa;
          --cl-critical: #ef4444;

          /* Extended semantic colors */
          --cl-purple: #a78bfa;
          --cl-cyan: #4dc8ff;
          --cl-pink: #f472b6;
          --cl-gray: #8ab4d8;
          --cl-orange: #fb923c;
          --cl-teal: #2dd4bf;

          /* Terminal colors */
          --cl-terminal-prompt: #4dc8ff;
          --cl-terminal-success: #4ade80;

          /* Model colors */
          --cl-model-opus: #c084fc;
          --cl-model-sonnet: #4dc8ff;
          --cl-model-haiku: #4ade80;

          /* Agent colors */
          --cl-agent-workspace: #4ade80;
          --cl-agent-workspace-bg: rgba(74, 222, 128, 0.15);
          --cl-agent-standard: #4dc8ff;
          --cl-agent-standard-bg: rgba(77, 200, 255, 0.12);
          --cl-agent-code: #6dd8ff;
          --cl-agent-code-bg: rgba(109, 216, 255, 0.12);

          --cl-shadow-sm: 0 1px 2px rgba(0, 10, 30, 0.3);
          --cl-shadow-md: 0 4px 6px rgba(0, 10, 30, 0.4);
          --cl-shadow-lg: 0 10px 15px rgba(0, 10, 30, 0.5);
          --cl-shadow-xl: 0 20px 25px rgba(0, 10, 30, 0.6);
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
