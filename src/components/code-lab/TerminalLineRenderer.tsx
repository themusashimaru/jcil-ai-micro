'use client';

/**
 * TerminalLineRenderer
 *
 * Renders a single terminal line with ANSI color support,
 * timestamps, search highlighting, and streaming cursor.
 */

import React, { useMemo } from 'react';
import { parseANSI } from './terminalAnsiParser';
import type { TerminalLine } from './terminalAnsiParser';

// ============================================================================
// TYPES
// ============================================================================

export interface TerminalLineRendererProps {
  line: TerminalLine;
  showTimestamp: boolean;
  searchHighlight?: string;
  isSearchMatch?: boolean;
  isCurrentMatch?: boolean;
}

// ============================================================================
// COMPONENT
// ============================================================================

export const TerminalLineRenderer = React.memo(function TerminalLineRenderer({
  line,
  showTimestamp,
  searchHighlight,
  isSearchMatch,
  isCurrentMatch,
}: TerminalLineRendererProps) {
  const segments = useMemo(() => parseANSI(line.content), [line.content]);

  const typeClasses: Record<TerminalLine['type'], string> = {
    command: 'line-command',
    stdout: 'line-stdout',
    stderr: 'line-stderr',
    info: 'line-info',
    success: 'line-success',
    error: 'line-error',
    system: 'line-system',
  };

  const highlightText = (text: string, query: string): React.ReactNode => {
    if (!query) return text;
    const parts = text.split(new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'));
    return parts.map((part, i) =>
      part.toLowerCase() === query.toLowerCase() ? (
        <mark key={i} className="search-highlight">
          {part}
        </mark>
      ) : (
        part
      )
    );
  };

  return (
    <div
      className={`terminal-line ${typeClasses[line.type]} ${line.isStreaming ? 'streaming' : ''} ${isSearchMatch ? 'search-match' : ''} ${isCurrentMatch ? 'current-match' : ''}`}
      role="row"
    >
      {showTimestamp && (
        <span className="line-timestamp" role="cell">
          {line.timestamp.toLocaleTimeString('en-US', { hour12: false })}
        </span>
      )}
      {line.type === 'command' && (
        <span className="line-prompt" role="cell">
          ❯
        </span>
      )}
      <span className="line-content" role="cell">
        {segments.map((segment, i) => (
          <span key={i} style={segment.style}>
            {searchHighlight ? highlightText(segment.text, searchHighlight) : segment.text}
          </span>
        ))}
      </span>
      {line.isStreaming && <span className="streaming-cursor">▋</span>}
    </div>
  );
});
