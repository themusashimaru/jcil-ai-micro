'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';

type Theme = 'dark' | 'light' | 'ocean' | 'pro';

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  isLoading: boolean;
  isAdmin: boolean;
  availableThemes: Theme[];
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

// All themes available to every user
const ALL_THEMES: Theme[] = ['pro', 'light', 'dark', 'ocean'];

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('pro'); // Default to baby blue/refined for users
  const [isLoading, setIsLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  // Load theme and admin status on mount
  useEffect(() => {
    let isMounted = true;

    const loadThemeAndAdmin = async () => {
      try {
        // Fetch both in parallel with individual error handling
        const [settingsRes, adminRes] = await Promise.allSettled([
          fetch('/api/user/settings'),
          fetch('/api/user/is-admin'),
        ]);

        // Check if component is still mounted
        if (!isMounted) return;

        // Process admin status
        let adminStatus = false;
        if (adminRes.status === 'fulfilled' && adminRes.value.ok) {
          try {
            const adminData = await adminRes.value.json();
            adminStatus = adminData.data?.isAdmin || false;
            if (isMounted) setIsAdmin(adminStatus);
          } catch (parseError) {
            console.error('[Theme] Error parsing admin response:', parseError);
          }
        }

        // Process settings
        if (settingsRes.status === 'fulfilled' && settingsRes.value.ok) {
          try {
            const data = await settingsRes.value.json();
            const savedTheme = data.settings?.theme as Theme;

            if (savedTheme && isMounted) {
              if (ALL_THEMES.includes(savedTheme)) {
                setThemeState(savedTheme);
              }
            }
          } catch (parseError) {
            console.error('[Theme] Error parsing settings response:', parseError);
          }
        }
      } catch (error) {
        console.error('[Theme] Error loading theme:', error);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    loadThemeAndAdmin();

    // Cleanup function to prevent state updates on unmounted component
    return () => {
      isMounted = false;
    };
  }, []);

  // Apply theme to document
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    // Remove all theme classes first
    document.documentElement.classList.remove('light-mode', 'ocean-mode', 'pro-mode');
    // Add appropriate class
    if (theme === 'light') {
      document.documentElement.classList.add('light-mode');
    } else if (theme === 'ocean') {
      document.documentElement.classList.add('ocean-mode');
    } else if (theme === 'pro') {
      document.documentElement.classList.add('pro-mode');
    }
  }, [theme]);

  const availableThemes = ALL_THEMES;

  const setTheme = useCallback(async (newTheme: Theme) => {
    if (!ALL_THEMES.includes(newTheme)) {
      console.warn(`[Theme] Theme "${newTheme}" is not a valid theme`);
      return;
    }

    setThemeState(newTheme);

    // Save to API
    try {
      await fetch('/api/user/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ theme: newTheme }),
      });
    } catch (error) {
      console.error('[Theme] Error saving theme:', error);
    }
  }, []);

  // Cycle through all available themes
  const toggleTheme = useCallback(() => {
    const currentIndex = ALL_THEMES.indexOf(theme);
    const nextIndex = (currentIndex + 1) % ALL_THEMES.length;
    setTheme(ALL_THEMES[nextIndex]);
  }, [theme, setTheme]);

  return (
    <ThemeContext.Provider
      value={{ theme, setTheme, toggleTheme, isLoading, isAdmin, availableThemes }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
