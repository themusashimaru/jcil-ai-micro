'use client';

import { useRef, useEffect, useMemo } from 'react';

interface ThinkingBlockProps {
  content: string;
  expanded: boolean;
  isStreaming?: boolean;
  onToggle: () => void;
}

export function ThinkingBlock({ content, expanded, isStreaming, onToggle }: ThinkingBlockProps) {
  const thinkingRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom of thinking content while streaming
  useEffect(() => {
    if (expanded && isStreaming && thinkingRef.current) {
      thinkingRef.current.scrollTop = thinkingRef.current.scrollHeight;
    }
  }, [expanded, isStreaming, content]);

  // Clean thinking content: strip residual tags, normalize whitespace,
  // and deduplicate consecutive identical paragraphs (streaming artifact)
  const cleanedContent = useMemo(() => {
    const stripped = content
      .replace(/<\/?thinking>/g, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim();

    const paragraphs = stripped.split(/\n\n+/);
    const deduped: string[] = [];
    for (const p of paragraphs) {
      if (deduped.length === 0 || deduped[deduped.length - 1] !== p) {
        deduped.push(p);
      }
    }
    return deduped.join('\n\n');
  }, [content]);

  return (
    <div
      className="mb-3 rounded-lg text-xs border border-theme"
      style={{ background: 'var(--bg-tertiary)' }}
    >
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-2 px-3 py-2 text-left text-text-secondary"
        aria-expanded={expanded}
      >
        <span
          className="inline-block transition-transform duration-150"
          style={{ transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)' }}
        >
          {expanded ? '▼' : '▶'}
        </span>
        <span>Thinking</span>
        {isStreaming && <span className="inline-block ml-1 text-primary animate-pulse">...</span>}
      </button>
      {expanded && (
        <div
          ref={thinkingRef}
          className="px-3 pb-3 border-t border-theme overflow-y-auto"
          style={{ color: 'var(--text-secondary)', maxHeight: '200px' }}
        >
          <div className="whitespace-pre-wrap">{cleanedContent}</div>
          {isStreaming && (
            <span className="inline-block ml-0.5 text-primary animate-[blink_1s_step-end_infinite]">
              ▋
            </span>
          )}
        </div>
      )}
    </div>
  );
}
