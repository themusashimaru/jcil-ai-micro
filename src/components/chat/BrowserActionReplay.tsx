'use client';

/**
 * BROWSER ACTION REPLAY
 *
 * Shows a timeline of browser actions the AI performed (navigate, click, scroll,
 * screenshot, extract content) so users can follow what happened.
 */

import { useState } from 'react';

export interface BrowserAction {
  action: string; // 'navigate' | 'click' | 'scroll' | 'screenshot' | 'extract' | 'type' | 'press_key'
  target?: string; // URL, selector, or description
  detail?: string; // Additional info (page title, content snippet)
  timestamp?: number; // Relative ms from start
}

export interface BrowserReplayData {
  actions: BrowserAction[];
  totalDuration?: number; // ms
  url?: string; // Starting URL
}

interface BrowserActionReplayProps {
  data: BrowserReplayData;
}

const ACTION_CONFIG: Record<string, { icon: string; label: string; color: string }> = {
  navigate: { icon: '🌐', label: 'Navigated to', color: 'text-blue-400' },
  click: { icon: '👆', label: 'Clicked', color: 'text-amber-400' },
  scroll: { icon: '📜', label: 'Scrolled', color: 'text-gray-400' },
  screenshot: { icon: '📸', label: 'Captured screenshot', color: 'text-emerald-400' },
  extract: { icon: '📄', label: 'Extracted content', color: 'text-purple-400' },
  type: { icon: '⌨️', label: 'Typed', color: 'text-cyan-400' },
  press_key: { icon: '🔑', label: 'Pressed key', color: 'text-orange-400' },
  links: { icon: '🔗', label: 'Extracted links', color: 'text-indigo-400' },
};

function getActionConfig(action: string): { icon: string; label: string; color: string } {
  return ACTION_CONFIG[action] || { icon: '🔧', label: action, color: 'text-gray-400' };
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

export default function BrowserActionReplay({ data }: BrowserActionReplayProps) {
  const [expanded, setExpanded] = useState(data.actions.length <= 5);

  const visibleActions = expanded ? data.actions : data.actions.slice(0, 3);
  const hiddenCount = data.actions.length - 3;

  return (
    <div className="my-3 rounded-xl overflow-hidden bg-zinc-900 border border-zinc-700 max-w-[500px]">
      {/* Header */}
      <div className="px-4 py-2.5 flex items-center gap-2.5 bg-zinc-800 border-b border-zinc-700">
        <span className="text-sm">{'🔄'}</span>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-white text-sm">Browser Actions</div>
          <div className="text-xs text-gray-400">
            {data.actions.length} action{data.actions.length !== 1 ? 's' : ''}
            {data.totalDuration ? ` · ${formatDuration(data.totalDuration)}` : ''}
          </div>
        </div>
        {data.url && (
          <a
            href={data.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-gray-500 hover:text-gray-300 truncate max-w-[120px]"
          >
            {new URL(data.url).hostname}
          </a>
        )}
      </div>

      {/* Timeline */}
      <div className="p-3 space-y-0">
        {visibleActions.map((action, i) => {
          const config = getActionConfig(action.action);
          const isLast = i === visibleActions.length - 1 && (expanded || data.actions.length <= 3);

          return (
            <div key={`action-${i}`} className="flex items-start gap-3">
              {/* Timeline connector */}
              <div className="flex flex-col items-center">
                <div className="flex items-center justify-center w-5 h-5 mt-0.5 text-sm">
                  {config.icon}
                </div>
                {!isLast && <div className="w-px h-5 bg-zinc-700" />}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0 pb-1">
                <div className={`text-sm ${config.color}`}>
                  <span className="font-medium">{config.label}</span>
                  {action.target && (
                    <span className="text-gray-400 ml-1 truncate">
                      {action.action === 'navigate' ? (
                        <span className="text-blue-300/70">{action.target}</span>
                      ) : (
                        action.target
                      )}
                    </span>
                  )}
                </div>
                {action.detail && (
                  <div className="text-xs text-gray-500 truncate mt-0.5">{action.detail}</div>
                )}
                {action.timestamp !== undefined && (
                  <div className="text-xs text-gray-600 mt-0.5">
                    +{formatDuration(action.timestamp)}
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {/* Show more / less */}
        {data.actions.length > 3 && (
          <button
            className="w-full text-center text-xs text-gray-500 hover:text-gray-300 py-1.5 transition-colors"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded
              ? 'Show less'
              : `Show ${hiddenCount} more action${hiddenCount !== 1 ? 's' : ''}`}
          </button>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// PARSING HELPERS
// ============================================================================

/**
 * Parse a browser-actions code block from markdown.
 * Format: ```browser-actions\n{JSON}\n```
 */
export function parseBrowserActions(block: string): BrowserReplayData | null {
  try {
    const match = block.match(/```browser-actions\n([\s\S]*?)\n```/);
    if (!match) return null;
    const data = JSON.parse(match[1]);
    if (!data.actions || !Array.isArray(data.actions)) return null;
    return data as BrowserReplayData;
  } catch {
    return null;
  }
}
