'use client';

/**
 * Async syntax-highlighted code block using Shiki.
 * Falls back to plain monospace text while loading.
 */

import { useState, useEffect, memo } from 'react';
import { highlightCode } from '@/lib/highlighting/shiki-highlighter';

interface HighlightedCodeProps {
  code: string;
  language: string;
  className?: string;
}

export const HighlightedCode = memo(function HighlightedCode({
  code,
  language,
  className = '',
}: HighlightedCodeProps) {
  const [html, setHtml] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    highlightCode(code, language).then((result) => {
      if (!cancelled) setHtml(result);
    });
    return () => {
      cancelled = true;
    };
  }, [code, language]);

  if (!html) {
    // Fallback: plain monospace while Shiki loads
    return (
      <code className={`text-sm font-mono text-text-primary whitespace-pre-wrap ${className}`}>
        {code}
      </code>
    );
  }

  return (
    <div
      className={`shiki-wrapper text-sm [&_pre]:!bg-transparent [&_pre]:!m-0 [&_pre]:!p-0 [&_code]:!text-sm ${className}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
});
