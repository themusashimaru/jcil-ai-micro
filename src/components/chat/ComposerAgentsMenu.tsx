/** Agents dropdown menu for ChatComposer */

'use client';

import { useRef, useEffect, type RefObject } from 'react';
import type { ToolMode } from './ChatComposer';

type AgentType =
  | 'research'
  | 'strategy'
  | 'deep-research'
  | 'quick-research'
  | 'quick-strategy'
  | 'deep-writer'
  | 'quick-writer';

interface ComposerAgentsMenuProps {
  isOpen: boolean;
  onToggle: () => void;
  onClose: () => void;
  activeAgent?: AgentType | null;
  onAgentSelect: (agent: AgentType) => Promise<void> | void;
  toolMode: ToolMode;
  onClearToolMode: () => void;
  isStreaming: boolean;
  disabled?: boolean;
  strategyLoading?: boolean;
  deepResearchLoading?: boolean;
  deepWriterLoading?: boolean;
  quickWriterLoading?: boolean;
  buttonRef: RefObject<HTMLButtonElement | null>;
}

const CheckIcon = () => (
  <svg
    className="w-4 h-4 ml-auto"
    style={{ color: 'var(--text-muted)' }}
    fill="currentColor"
    viewBox="0 0 24 24"
  >
    <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
  </svg>
);

export function ComposerAgentsMenu({
  isOpen,
  onToggle,
  onClose,
  activeAgent,
  onAgentSelect,
  toolMode,
  onClearToolMode,
  isStreaming,
  disabled,
  strategyLoading,
  deepResearchLoading,
  deepWriterLoading,
  quickWriterLoading,
}: ComposerAgentsMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (isOpen && !buttonRef.current?.contains(target) && !menuRef.current?.contains(target)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onClose]);

  const isAgentActive =
    toolMode === 'research' || activeAgent === 'strategy' || activeAgent === 'deep-research';

  const buttonLabel =
    strategyLoading || deepResearchLoading
      ? 'Starting...'
      : toolMode === 'research'
        ? 'Research'
        : activeAgent === 'strategy'
          ? 'Strategy'
          : activeAgent === 'deep-research'
            ? 'Deep Research'
            : 'Agents';

  const agents: {
    id: AgentType;
    label: string;
    loadingLabel?: string;
    loading?: boolean;
  }[] = [
    { id: 'quick-research', label: 'Research Agent' },
    {
      id: 'quick-writer',
      label: 'Writer Agent',
      loadingLabel: 'Starting...',
      loading: quickWriterLoading,
    },
    { id: 'quick-strategy', label: 'Strategy Agent' },
    { id: 'strategy', label: 'Deep Strategy Agent' },
    { id: 'deep-research', label: 'Deep Research Agent' },
    {
      id: 'deep-writer',
      label: 'Deep Writer Agent',
      loadingLabel: 'Starting...',
      loading: deepWriterLoading,
    },
  ];

  return (
    <div className="relative flex items-center">
      <button
        ref={buttonRef}
        onClick={onToggle}
        disabled={isStreaming || disabled}
        className="disabled:opacity-50 flex items-center gap-1 transition-all text-xs hover:opacity-80"
        style={{ color: isAgentActive ? '#c4b5fd' : 'var(--text-primary)' }}
        title="Select an AI Agent"
      >
        <span>{buttonLabel}</span>
        {(strategyLoading || deepResearchLoading) && (
          <span className="w-1.5 h-1.5 bg-yellow-400 rounded-full animate-pulse" />
        )}
        {!strategyLoading && !deepResearchLoading && isAgentActive && (
          <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
        )}
        <svg
          className={`w-3 h-3 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div
          ref={menuRef}
          className="absolute bottom-full left-0 mb-2 w-64 rounded-xl shadow-xl overflow-hidden z-50"
          style={{ backgroundColor: 'var(--surface-elevated)', border: '1px solid var(--border)' }}
        >
          <div className="p-2" style={{ borderBottom: '1px solid var(--border)' }}>
            <p className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
              Select an Agent
            </p>
          </div>
          <div className="p-1">
            {/* Exit agent mode */}
            {isAgentActive && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (activeAgent === 'strategy') onAgentSelect('strategy');
                  if (activeAgent === 'deep-research') onAgentSelect('deep-research');
                  onClearToolMode();
                  onClose();
                }}
                className="w-full flex items-center gap-2 p-2 rounded-lg transition-colors mb-1"
                style={{ color: 'var(--text-secondary)' }}
              >
                <p className="text-sm font-medium">Exit Agent Mode</p>
              </button>
            )}

            {agents.map((agent) => (
              <button
                key={agent.id}
                onClick={async (e) => {
                  e.stopPropagation();
                  onClose();
                  await onAgentSelect(agent.id);
                }}
                disabled={agent.loading}
                className="w-full flex items-center gap-2 p-2 rounded-lg transition-colors"
                style={{
                  backgroundColor: activeAgent === agent.id ? 'var(--glass-bg)' : 'transparent',
                  color: activeAgent === agent.id ? 'var(--text-primary)' : 'var(--text-secondary)',
                }}
              >
                <p className="text-sm font-medium">
                  {agent.loading ? agent.loadingLabel : agent.label}
                </p>
                {activeAgent === agent.id && <CheckIcon />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
