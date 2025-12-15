'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';

type Theme = 'dark' | 'light' | 'ocean';

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  isLoading: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('dark');
  const [isLoading, setIsLoading] = useState(true);

  // Load theme from API on mount
  useEffect(() => {
    const loadTheme = async () => {
      try {
        const response = await fetch('/api/user/settings');
        if (response.ok) {
          const data = await response.json();
          if (data.settings?.theme) {
            setThemeState(data.settings.theme);
          }
        }
      } catch (error) {
        console.error('[Theme] Error loading theme:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadTheme();
  }, []);

  // Apply theme to document
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    // Remove all theme classes first
    document.documentElement.classList.remove('light-mode', 'ocean-mode');
    // Add appropriate class
    if (theme === 'light') {
      document.documentElement.classList.add('light-mode');
    } else if (theme === 'ocean') {
      document.documentElement.classList.add('ocean-mode');
    }
  }, [theme]);

  const setTheme = useCallback(async (newTheme: Theme) => {
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

  // Cycle: dark → light → ocean → dark
  const toggleTheme = useCallback(() => {
    const nextTheme = theme === 'dark' ? 'light' : theme === 'light' ? 'ocean' : 'dark';
    setTheme(nextTheme);
  }, [theme, setTheme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme, isLoading }}>
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
