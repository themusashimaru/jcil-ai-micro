'use client';

/**
 * CODE LAB THEME TOGGLE
 *
 * A beautiful toggle button for switching between Pro Mode (dark) and Light Mode.
 * Features:
 * - Animated sun/moon icons with Pro Mode star
 * - Integrates with global theme context
 * - Accessible
 */

import { useTheme } from '@/contexts/ThemeContext';

interface CodeLabThemeToggleProps {
  className?: string;
  showLabel?: boolean;
}

export function CodeLabThemeToggle({ className = '', showLabel = false }: CodeLabThemeToggleProps) {
  const { theme, toggleTheme } = useTheme();

  // Pro mode is the dark/professional theme, light is light mode
  const isDark = theme === 'pro' || theme === 'dark' || theme === 'ocean';

  const themeLabel =
    theme === 'pro'
      ? 'Pro'
      : theme === 'light'
        ? 'Light'
        : theme.charAt(0).toUpperCase() + theme.slice(1);

  return (
    <button
      className={`theme-toggle ${className}`}
      onClick={toggleTheme}
      aria-label={`Current theme: ${themeLabel}. Click to cycle themes.`}
      title={`${themeLabel} Mode - Click to switch`}
    >
      <div className="toggle-track">
        <div className={`toggle-thumb ${isDark ? 'dark' : 'light'}`}>
          {/* Sun icon */}
          <svg
            className={`icon sun ${isDark ? 'hidden' : 'visible'}`}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <circle cx="12" cy="12" r="5" />
            <line x1="12" y1="1" x2="12" y2="3" />
            <line x1="12" y1="21" x2="12" y2="23" />
            <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
            <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
            <line x1="1" y1="12" x2="3" y2="12" />
            <line x1="21" y1="12" x2="23" y2="12" />
            <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
            <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
          </svg>

          {/* Moon icon */}
          <svg
            className={`icon moon ${isDark ? 'visible' : 'hidden'}`}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
          </svg>
        </div>
      </div>

      {showLabel && <span className="toggle-label">{themeLabel}</span>}

      <style jsx>{`
        .theme-toggle {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.375rem;
          background: transparent;
          border: none;
          cursor: pointer;
          border-radius: 9999px;
          transition: background 0.15s;
        }

        .theme-toggle:hover {
          background: var(--cl-bg-hover, #f3f4f6);
        }

        .toggle-track {
          width: 44px;
          height: 24px;
          background: var(--cl-bg-tertiary, #f3f4f6);
          border-radius: 9999px;
          position: relative;
          transition: background 0.3s;
        }

        .toggle-thumb {
          position: absolute;
          top: 2px;
          width: 20px;
          height: 20px;
          background: white;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.15);
          transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .toggle-thumb.light {
          transform: translateX(2px);
          background: #fff;
        }

        .toggle-thumb.dark {
          transform: translateX(22px);
          background: #1e1b4b;
        }

        .icon {
          width: 14px;
          height: 14px;
          transition:
            opacity 0.15s,
            transform 0.3s;
        }

        .icon.visible {
          opacity: 1;
          transform: rotate(0deg);
        }

        .icon.hidden {
          opacity: 0;
          position: absolute;
          transform: rotate(-90deg);
        }

        .icon.sun {
          color: #f59e0b;
        }

        .icon.moon {
          color: #fbbf24;
        }

        .toggle-label {
          font-size: 0.8125rem;
          font-weight: 500;
          color: var(--cl-text-secondary, #4b5563);
        }

        /* Compact version */
        .theme-toggle.compact {
          padding: 0.25rem;
        }

        .theme-toggle.compact .toggle-track {
          width: 36px;
          height: 20px;
        }

        .theme-toggle.compact .toggle-thumb {
          width: 16px;
          height: 16px;
        }

        .theme-toggle.compact .toggle-thumb.dark {
          transform: translateX(18px);
        }

        .theme-toggle.compact .icon {
          width: 12px;
          height: 12px;
        }
      `}</style>
    </button>
  );
}
