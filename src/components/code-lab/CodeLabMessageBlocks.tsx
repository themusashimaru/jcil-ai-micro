'use client';

import { escapeHtml } from '@/lib/sanitize';
import { sanitizeHtml } from '@/lib/sanitize';
import { highlightCode } from './CodeLabMessageSyntax';
import type { ContentBlock } from './CodeLabMessageMarkdown';

interface CodeBlockProps {
  block: ContentBlock;
  blockIndex: number;
  copiedBlock: number | null;
  onCopyCode: (code: string, blockIndex: number) => void;
}

export function CodeBlock({ block, blockIndex, copiedBlock, onCopyCode }: CodeBlockProps) {
  return (
    <div className="code-block">
      <div className="code-header">
        <span className="code-lang">{block.language || 'code'}</span>
        <button className="code-copy" onClick={() => onCopyCode(block.content, blockIndex)}>
          {copiedBlock === blockIndex ? (
            <>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              Copied
            </>
          ) : (
            <>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                />
              </svg>
              Copy
            </>
          )}
        </button>
      </div>
      <pre className="code-content">
        <code
          dangerouslySetInnerHTML={{
            __html: highlightCode(escapeHtml(block.content), block.language),
          }}
        />
      </pre>
      <style jsx>{`
        .code-block {
          margin: 1rem 0;
          border-radius: 8px;
          overflow: hidden;
          border: 1px solid #333;
        }

        .code-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0.5rem 0.75rem;
          background: #1a1a1a;
          border-bottom: 1px solid #333;
        }

        .code-lang {
          font-size: 0.75rem;
          font-weight: 500;
          color: #888;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .code-copy {
          display: inline-flex;
          align-items: center;
          gap: 0.25rem;
          padding: 0.25rem 0.5rem;
          background: transparent;
          border: none;
          font-size: 0.75rem;
          color: #888;
          cursor: pointer;
          border-radius: 4px;
          transition: all 0.2s;
        }

        .code-copy:hover {
          background: #333;
          color: #ffffff;
        }

        .code-copy svg {
          width: 14px;
          height: 14px;
        }

        .code-content {
          margin: 0;
          padding: 1rem;
          background: #0d0d0d;
          overflow-x: auto;
        }

        .code-content code {
          font-family: 'SF Mono', 'Menlo', 'Monaco', 'Consolas', monospace;
          font-size: 0.8125rem;
          line-height: 1.6;
          color: #e2e8f0;
        }

        /* Syntax Highlighting */
        .code-content :global(.token-keyword) {
          color: #c792ea;
        }
        .code-content :global(.token-string) {
          color: #c3e88d;
        }
        .code-content :global(.token-number) {
          color: #f78c6c;
        }
        .code-content :global(.token-comment) {
          color: #676e95;
          font-style: italic;
        }
        .code-content :global(.token-function) {
          color: #82aaff;
        }
        .code-content :global(.token-operator) {
          color: #89ddff;
        }
        .code-content :global(.token-punctuation) {
          color: #89ddff;
        }
        .code-content :global(.token-class) {
          color: #ffcb6b;
        }
        .code-content :global(.token-variable) {
          color: #f07178;
        }
        .code-content :global(.token-type) {
          color: #ffcb6b;
        }
        .code-content :global(.token-property) {
          color: #80cbc4;
        }
        .code-content :global(.token-tag) {
          color: #f07178;
        }
        .code-content :global(.token-attr) {
          color: #c792ea;
        }
        .code-content :global(.token-value) {
          color: #c3e88d;
        }
      `}</style>
    </div>
  );
}

export function TerminalBlock({ block }: { block: ContentBlock }) {
  return (
    <div className="terminal-block">
      <div className="terminal-header">
        <span className="terminal-dots">
          <span />
          <span />
          <span />
        </span>
        <span className="terminal-title">Terminal</span>
      </div>
      <pre className="terminal-content">{block.content}</pre>
      <style jsx>{`
        .terminal-block {
          margin: 1rem 0;
          border-radius: 8px;
          overflow: hidden;
          background: #0d0d0d;
        }

        .terminal-header {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.625rem 0.75rem;
          background: #1a1a1a;
        }

        .terminal-dots {
          display: flex;
          gap: 0.375rem;
        }

        .terminal-dots span {
          width: 10px;
          height: 10px;
          border-radius: 50%;
          background: #444;
        }

        .terminal-dots span:first-child {
          background: #ef4444;
        }
        .terminal-dots span:nth-child(2) {
          background: #f59e0b;
        }
        .terminal-dots span:last-child {
          background: #22c55e;
        }

        .terminal-title {
          font-size: 0.75rem;
          color: #888;
          margin-left: 0.5rem;
        }

        .terminal-content {
          margin: 0;
          padding: 1rem;
          font-family: 'SF Mono', 'Menlo', monospace;
          font-size: 0.8125rem;
          line-height: 1.6;
          color: #22c55e;
          overflow-x: auto;
        }
      `}</style>
    </div>
  );
}

export function TextBlock({ block }: { block: ContentBlock }) {
  return (
    <>
      <div
        className="text-block"
        dangerouslySetInnerHTML={{ __html: sanitizeHtml(block.content) }}
      />
      <style jsx>{`
        .text-block {
          font-size: 0.9375rem;
          margin-bottom: 1rem;
        }

        .text-block :global(p) {
          margin: 0 0 1rem;
        }

        .text-block :global(p:last-child) {
          margin-bottom: 0;
        }

        .text-block :global(strong) {
          font-weight: 600;
          color: #ffffff;
        }

        .text-block :global(code) {
          background: #2a2a2a;
          padding: 0.125rem 0.375rem;
          border-radius: 4px;
          font-family: 'SF Mono', 'Menlo', monospace;
          font-size: 0.875em;
          color: #ffffff;
        }

        .text-block :global(a) {
          color: #7dd3fc;
          text-decoration: none;
        }

        .text-block :global(a:hover) {
          text-decoration: underline;
        }

        .text-block :global(ul),
        .text-block :global(ol) {
          margin: 0 0 1rem;
          padding-left: 1.5rem;
        }

        .text-block :global(li) {
          margin-bottom: 0.375rem;
        }

        .text-block :global(h1),
        .text-block :global(h2),
        .text-block :global(h3) {
          font-weight: 600;
          color: #ffffff;
          margin: 1.5rem 0 0.75rem;
        }

        .text-block :global(h1) {
          font-size: 1.25rem;
        }
        .text-block :global(h2) {
          font-size: 1.125rem;
        }
        .text-block :global(h3) {
          font-size: 1rem;
        }
      `}</style>
    </>
  );
}
