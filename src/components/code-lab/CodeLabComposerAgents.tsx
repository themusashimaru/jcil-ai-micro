/** Agents dropdown menu for CodeLab composer */

'use client';

import { useRef, useEffect } from 'react';

interface CodeLabComposerAgentsProps {
  isOpen: boolean;
  onToggle: () => void;
  onClose: () => void;
  activeAgent?: 'research' | 'strategy' | 'deep-research' | null;
  onAgentSelect: (agent: 'research' | 'strategy' | 'deep-research') => Promise<void> | void;
  disabled?: boolean;
  isStreaming: boolean;
  strategyLoading?: boolean;
  deepResearchLoading?: boolean;
}

export function CodeLabComposerAgents({
  isOpen,
  onToggle,
  onClose,
  activeAgent,
  onAgentSelect,
  disabled,
  isStreaming,
  strategyLoading,
  deepResearchLoading,
}: CodeLabComposerAgentsProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  return (
    <div className="agents-menu-container" ref={ref}>
      <button
        className={`composer-btn agents ${activeAgent ? 'active' : ''}`}
        onClick={onToggle}
        disabled={disabled || isStreaming}
        title="AI Agents"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 2a4 4 0 0 1 4 4v2a4 4 0 1 1-8 0V6a4 4 0 0 1 4-4z" />
          <path d="M16 14H8a4 4 0 0 0-4 4v2h16v-2a4 4 0 0 0-4-4z" />
        </svg>
        <span className="btn-label">Agents</span>
        {activeAgent && <span className="active-indicator" />}
      </button>

      {isOpen && (
        <div className="agents-dropdown">
          <button
            className={`agent-option ${activeAgent === 'deep-research' ? 'selected' : ''}`}
            onClick={() => {
              onAgentSelect('deep-research');
              onClose();
            }}
            disabled={deepResearchLoading}
          >
            <div className="agent-icon deep-research">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.35-4.35" />
                <path d="M11 8v6M8 11h6" />
              </svg>
            </div>
            <div className="agent-info">
              <span className="agent-name">Deep Research</span>
              <span className="agent-desc">Multi-source web research with synthesis</span>
            </div>
            {deepResearchLoading && <span className="loading-spinner" />}
          </button>

          <button
            className={`agent-option ${activeAgent === 'strategy' ? 'selected' : ''}`}
            onClick={() => {
              onAgentSelect('strategy');
              onClose();
            }}
            disabled={strategyLoading}
          >
            <div className="agent-icon strategy">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 2a4 4 0 0 1 4 4c0 1.1-.9 2-2 2h-4c-1.1 0-2-.9-2-2a4 4 0 0 1 4-4z" />
                <path d="M12 8v4" />
                <path d="M10 18c-.55 0-1 .45-1 1s.45 1 1 1 1-.45 1-1-.45-1-1-1z" />
                <path d="M14 18c-.55 0-1 .45-1 1s.45 1 1 1 1-.45 1-1-.45-1-1-1z" />
                <path d="M12 12c-2 0-4 2-4 4v2h8v-2c0-2-2-4-4-4z" />
              </svg>
            </div>
            <div className="agent-info">
              <span className="agent-name">Deep Strategy</span>
              <span className="agent-desc">Extended thinking for complex planning</span>
            </div>
            {strategyLoading && <span className="loading-spinner" />}
          </button>

          <button
            className={`agent-option ${activeAgent === 'research' ? 'selected' : ''}`}
            onClick={() => {
              onAgentSelect('research');
              onClose();
            }}
          >
            <div className="agent-icon research">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.35-4.35" />
              </svg>
            </div>
            <div className="agent-info">
              <span className="agent-name">Research</span>
              <span className="agent-desc">Quick web search with AI summary</span>
            </div>
          </button>
        </div>
      )}
    </div>
  );
}
