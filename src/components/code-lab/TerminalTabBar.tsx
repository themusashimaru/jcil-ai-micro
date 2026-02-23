'use client';

/**
 * TerminalTabBar
 *
 * Renders the tab bar for multiple terminal sessions.
 * Supports tab selection, closing, and creating new tabs.
 */

import React from 'react';
import type { TerminalTab } from './terminalAnsiParser';

// ============================================================================
// TYPES
// ============================================================================

export type { TerminalTab };

export interface TerminalTabBarProps {
  tabs: TerminalTab[];
  activeTabId: string;
  onTabSelect: (id: string) => void;
  onTabClose: (id: string) => void;
  onNewTab: () => void;
}

// ============================================================================
// COMPONENT
// ============================================================================

export const TerminalTabBar = React.memo(function TerminalTabBar({
  tabs,
  activeTabId,
  onTabSelect,
  onTabClose,
  onNewTab,
}: TerminalTabBarProps) {
  return (
    <div className="terminal-tab-bar" role="tablist" aria-label="Terminal tabs">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          role="tab"
          aria-selected={tab.id === activeTabId}
          aria-controls={`terminal-panel-${tab.id}`}
          className={`terminal-tab ${tab.id === activeTabId ? 'active' : ''}`}
          onClick={() => onTabSelect(tab.id)}
        >
          <span className={`tab-indicator ${tab.isRunning ? 'running' : 'idle'}`} />
          <span className="tab-name">{tab.name}</span>
          {tabs.length > 1 && (
            <button
              className="tab-close"
              onClick={(e) => {
                e.stopPropagation();
                onTabClose(tab.id);
              }}
              aria-label={`Close ${tab.name}`}
              tabIndex={-1}
            >
              ×
            </button>
          )}
        </button>
      ))}
      <button
        className="terminal-new-tab"
        onClick={onNewTab}
        aria-label="New terminal"
        title="New terminal (Ctrl+Shift+T)"
      >
        +
      </button>
    </div>
  );
});
