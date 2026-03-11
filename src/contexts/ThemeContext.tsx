'use client';

import React, { createContext, useContext } from 'react';

type Theme = 'dark' | 'light' | 'ocean' | 'pro' | 'editorial';

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  isLoading: boolean;
  isAdmin: boolean;
  availableThemes: Theme[];
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Single theme — dark with orange accents. No switching.
  const value: ThemeContextType = {
    theme: 'dark' as Theme,
    setTheme: () => {},
    toggleTheme: () => {},
    isLoading: false,
    isAdmin: false,
    availableThemes: ['dark'] as Theme[],
  };

  return (
    <ThemeContext.Provider value={value}>
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
