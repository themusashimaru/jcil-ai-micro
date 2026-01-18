'use client';

/**
 * CODE LAB THINKING BLOCK
 *
 * Renders Claude's extended thinking in a beautiful collapsible block.
 * Provides visibility into Claude's reasoning process.
 *
 * @version 1.0.0
 */

import { useState, useMemo } from 'react';

interface CodeLabThinkingBlockProps {
  content: string;
  isStreaming?: boolean;
  defaultExpanded?: boolean;
}

const BrainIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
    />
  </svg>
);

const ChevronIcon = ({ expanded }: { expanded: boolean }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    width="14"
    height="14"
    style={{
      transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)',
      transition: 'transform 0.15s ease',
    }}
  >
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
  </svg>
);

export function CodeLabThinkingBlock({
  content,
  isStreaming = false,
  defaultExpanded = false,
}: CodeLabThinkingBlockProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  // Calculate thinking stats
  const stats = useMemo(() => {
    const words = content.split(/\s+/).filter((w) => w.length > 0).length;
    const lines = content.split('\n').length;
    return { words, lines };
  }, [content]);

  // Truncate content for preview
  const preview = useMemo(() => {
    const firstLine = content.split('\n')[0] || '';
    return firstLine.length > 80 ? firstLine.substring(0, 80) + '...' : firstLine;
  }, [content]);

  return (
    <div
      className={`thinking-block ${expanded ? 'expanded' : ''} ${isStreaming ? 'streaming' : ''}`}
    >
      <button className="thinking-header" onClick={() => setExpanded(!expanded)}>
        <div className="thinking-title">
          <ChevronIcon expanded={expanded} />
          <BrainIcon />
          <span>Claude&apos;s Thinking</span>
          {isStreaming && <span className="streaming-badge">Thinking...</span>}
        </div>
        <div className="thinking-meta">
          <span>{stats.words} words</span>
          <span>{stats.lines} lines</span>
        </div>
      </button>

      {!expanded && <div className="thinking-preview">{preview || 'Analyzing the problem...'}</div>}

      {expanded && (
        <div className="thinking-content">
          <pre>{content}</pre>
        </div>
      )}

      <style jsx>{`
        .thinking-block {
          margin: 0.75rem 0;
          background: linear-gradient(135deg, rgba(139, 92, 246, 0.05), rgba(59, 130, 246, 0.05));
          border: 1px solid rgba(139, 92, 246, 0.2);
          border-radius: 12px;
          overflow: hidden;
          transition: all 0.2s ease;
        }

        .thinking-block.streaming {
          border-color: rgba(139, 92, 246, 0.4);
          box-shadow: 0 0 20px rgba(139, 92, 246, 0.1);
        }

        .thinking-header {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0.75rem 1rem;
          background: none;
          border: none;
          cursor: pointer;
          text-align: left;
          transition: background 0.15s ease;
        }

        .thinking-header:hover {
          background: rgba(139, 92, 246, 0.05);
        }

        .thinking-title {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-size: 0.875rem;
          font-weight: 600;
          color: #7c3aed;
        }

        .streaming-badge {
          font-size: 0.6875rem;
          font-weight: 500;
          padding: 0.125rem 0.5rem;
          background: rgba(139, 92, 246, 0.15);
          color: #7c3aed;
          border-radius: 9999px;
          animation: pulse 1.5s infinite;
        }

        @keyframes pulse {
          0%,
          100% {
            opacity: 1;
          }
          50% {
            opacity: 0.5;
          }
        }

        .thinking-meta {
          display: flex;
          gap: 0.75rem;
          font-size: 0.75rem;
          color: #6b7280;
        }

        .thinking-preview {
          padding: 0 1rem 0.75rem;
          font-size: 0.8125rem;
          color: #6b7280;
          font-style: italic;
        }

        .thinking-content {
          padding: 0 1rem 1rem;
          border-top: 1px solid rgba(139, 92, 246, 0.1);
          background: rgba(255, 255, 255, 0.5);
        }

        .thinking-content pre {
          margin: 0;
          padding: 0.75rem;
          background: rgba(0, 0, 0, 0.02);
          border-radius: 8px;
          font-size: 0.8125rem;
          line-height: 1.6;
          color: #374151;
          white-space: pre-wrap;
          word-break: break-word;
          font-family: 'SF Mono', 'Fira Code', monospace;
          max-height: 400px;
          overflow-y: auto;
        }

        /* Dark mode */
        @media (prefers-color-scheme: dark) {
          .thinking-block {
            background: linear-gradient(135deg, rgba(139, 92, 246, 0.1), rgba(59, 130, 246, 0.1));
            border-color: rgba(139, 92, 246, 0.3);
          }

          .thinking-content pre {
            background: rgba(0, 0, 0, 0.2);
            color: #e5e7eb;
          }
        }
      `}</style>
    </div>
  );
}

/**
 * Parse content and extract thinking blocks
 */
export function parseThinkingBlocks(content: string): {
  thinking: string | null;
  output: string;
  isThinkingComplete: boolean;
} {
  const thinkingStart = '<!--THINKING_START-->';
  const thinkingEnd = '<!--THINKING_END-->';

  const startIndex = content.indexOf(thinkingStart);
  if (startIndex === -1) {
    return { thinking: null, output: content, isThinkingComplete: true };
  }

  const endIndex = content.indexOf(thinkingEnd);
  const isThinkingComplete = endIndex !== -1;

  // Extract thinking content
  const thinkingStartAfter = startIndex + thinkingStart.length;
  const thinkingContent = isThinkingComplete
    ? content.substring(thinkingStartAfter, endIndex).trim()
    : content.substring(thinkingStartAfter).trim();

  // Extract output (everything after thinking end, or empty if still thinking)
  const output = isThinkingComplete ? content.substring(endIndex + thinkingEnd.length).trim() : '';

  return {
    thinking: thinkingContent || null,
    output,
    isThinkingComplete,
  };
}

export default CodeLabThinkingBlock;
