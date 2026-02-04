'use client';

/**
 * DEEP STRATEGY BUTTON
 *
 * Button to launch the Deep Strategy Agent (available to all users).
 * Glows when active to indicate ongoing strategy execution.
 */

import { Brain } from 'lucide-react';

interface DeepStrategyButtonProps {
  onClick: () => void;
  isActive?: boolean;
  disabled?: boolean;
}

export function DeepStrategyButton({
  onClick,
  isActive = false,
  disabled = false,
}: DeepStrategyButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`
        relative flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg
        text-sm font-medium
        transition-all duration-300
        ${
          isActive
            ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-lg shadow-purple-500/40'
            : 'bg-transparent hover:bg-purple-600/20 text-purple-400 hover:text-purple-300'
        }
        disabled:opacity-50 disabled:cursor-not-allowed
      `}
      title={isActive ? 'Strategy in progress...' : 'Launch Deep Strategy Agent'}
    >
      {/* Animated glow ring when active */}
      {isActive && (
        <span className="absolute inset-0 rounded-lg bg-gradient-to-r from-purple-500 to-indigo-500 opacity-50 blur-md animate-pulse" />
      )}

      <Brain className={`w-4 h-4 relative z-10 ${isActive ? 'animate-pulse' : ''}`} />
      <span className="relative z-10 hidden md:inline">
        {isActive ? 'Strategy Active' : 'Strategy'}
      </span>

      {/* Active indicator dot */}
      {isActive && (
        <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-green-400 rounded-full animate-pulse border border-black" />
      )}
    </button>
  );
}
