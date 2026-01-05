'use client';

/**
 * CODE LAB MESSAGE
 *
 * Renders individual messages in the thread:
 * - AI responses: Flow naturally, no bubble - like reading documentation
 * - User messages: Subtle container to distinguish input
 * - Code blocks: Syntax highlighted with copy button
 * - Terminal output: Professional monospace styling
 */

import { useState, useMemo } from 'react';
import type { CodeLabMessage as MessageType } from './types';

interface CodeLabMessageProps {
  message: MessageType;
  isLast: boolean;
}

export function CodeLabMessage({ message, isLast: _isLast }: CodeLabMessageProps) {
  const [copiedBlock, setCopiedBlock] = useState<number | null>(null);

  const isUser = message.role === 'user';
  const isSystem = message.role === 'system';

  // Parse content for code blocks
  const parsedContent = useMemo(() => {
    return parseMarkdown(message.content);
  }, [message.content]);

  const handleCopyCode = async (code: string, blockIndex: number) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedBlock(blockIndex);
      setTimeout(() => setCopiedBlock(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  if (isSystem) {
    return (
      <div className="message message-system">
        <div className="system-content">{message.content}</div>
        <style jsx>{`
          .message-system {
            padding: 0.75rem 1rem;
            background: #fef3c7;
            border-left: 3px solid #f59e0b;
            border-radius: 0 8px 8px 0;
            margin: 1rem 0;
          }
          .system-content {
            font-size: 0.875rem;
            color: #92400e;
          }
        `}</style>
      </div>
    );
  }

  if (isUser) {
    return (
      <div className="message message-user">
        <div className="user-avatar">
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
          </svg>
        </div>
        <div className="user-content">
          {message.content}
        </div>
        <style jsx>{`
          .message-user {
            display: flex;
            gap: 0.75rem;
            padding: 1rem;
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 12px;
            margin: 1.5rem 0;
          }
          .user-avatar {
            width: 32px;
            height: 32px;
            background: #1a1f36;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            flex-shrink: 0;
          }
          .user-avatar svg {
            width: 18px;
            height: 18px;
            color: white;
          }
          .user-content {
            flex: 1;
            font-size: 0.9375rem;
            line-height: 1.6;
            color: #1a1f36;
            white-space: pre-wrap;
          }
        `}</style>
      </div>
    );
  }

  // Assistant message - flows naturally
  return (
    <div className={`message message-assistant ${message.isStreaming ? 'streaming' : ''}`}>
      {parsedContent.map((block, index) => {
        if (block.type === 'code') {
          return (
            <div key={index} className="code-block">
              <div className="code-header">
                <span className="code-lang">{block.language || 'code'}</span>
                <button
                  className="code-copy"
                  onClick={() => handleCopyCode(block.content, index)}
                >
                  {copiedBlock === index ? (
                    <>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                      Copied
                    </>
                  ) : (
                    <>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                      Copy
                    </>
                  )}
                </button>
              </div>
              <pre className="code-content">
                <code>{block.content}</code>
              </pre>
            </div>
          );
        }

        if (block.type === 'terminal') {
          return (
            <div key={index} className="terminal-block">
              <div className="terminal-header">
                <span className="terminal-dots">
                  <span />
                  <span />
                  <span />
                </span>
                <span className="terminal-title">Terminal</span>
              </div>
              <pre className="terminal-content">{block.content}</pre>
            </div>
          );
        }

        // Regular text
        return (
          <div key={index} className="text-block" dangerouslySetInnerHTML={{ __html: block.content }} />
        );
      })}

      {message.isStreaming && (
        <span className="cursor" />
      )}

      <style jsx>{`
        .message-assistant {
          padding: 0.5rem 0;
          line-height: 1.7;
          color: #1a1f36;
        }

        .message-assistant.streaming {
          opacity: 1;
        }

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
          color: #0f172a;
        }

        .text-block :global(code) {
          background: #f1f5f9;
          padding: 0.125rem 0.375rem;
          border-radius: 4px;
          font-family: 'SF Mono', 'Menlo', monospace;
          font-size: 0.875em;
          color: #6366f1;
        }

        .text-block :global(a) {
          color: #6366f1;
          text-decoration: none;
        }

        .text-block :global(a:hover) {
          text-decoration: underline;
        }

        .text-block :global(ul), .text-block :global(ol) {
          margin: 0 0 1rem;
          padding-left: 1.5rem;
        }

        .text-block :global(li) {
          margin-bottom: 0.375rem;
        }

        .text-block :global(h1), .text-block :global(h2), .text-block :global(h3) {
          font-weight: 600;
          color: #0f172a;
          margin: 1.5rem 0 0.75rem;
        }

        .text-block :global(h1) { font-size: 1.25rem; }
        .text-block :global(h2) { font-size: 1.125rem; }
        .text-block :global(h3) { font-size: 1rem; }

        .code-block {
          margin: 1rem 0;
          border-radius: 8px;
          overflow: hidden;
          border: 1px solid #e2e8f0;
        }

        .code-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0.5rem 0.75rem;
          background: #f8fafc;
          border-bottom: 1px solid #e2e8f0;
        }

        .code-lang {
          font-size: 0.75rem;
          font-weight: 500;
          color: #64748b;
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
          color: #64748b;
          cursor: pointer;
          border-radius: 4px;
          transition: all 0.2s;
        }

        .code-copy:hover {
          background: #e2e8f0;
          color: #1a1f36;
        }

        .code-copy svg {
          width: 14px;
          height: 14px;
        }

        .code-content {
          margin: 0;
          padding: 1rem;
          background: #1e293b;
          overflow-x: auto;
        }

        .code-content code {
          font-family: 'SF Mono', 'Menlo', 'Monaco', 'Consolas', monospace;
          font-size: 0.8125rem;
          line-height: 1.6;
          color: #e2e8f0;
        }

        .terminal-block {
          margin: 1rem 0;
          border-radius: 8px;
          overflow: hidden;
          background: #0f172a;
        }

        .terminal-header {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.625rem 0.75rem;
          background: #1e293b;
        }

        .terminal-dots {
          display: flex;
          gap: 0.375rem;
        }

        .terminal-dots span {
          width: 10px;
          height: 10px;
          border-radius: 50%;
          background: #475569;
        }

        .terminal-dots span:first-child { background: #ef4444; }
        .terminal-dots span:nth-child(2) { background: #f59e0b; }
        .terminal-dots span:last-child { background: #22c55e; }

        .terminal-title {
          font-size: 0.75rem;
          color: #94a3b8;
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

        .cursor {
          display: inline-block;
          width: 8px;
          height: 18px;
          background: #6366f1;
          margin-left: 2px;
          animation: blink 1s infinite;
        }

        @keyframes blink {
          0%, 50% { opacity: 1; }
          51%, 100% { opacity: 0; }
        }
      `}</style>
    </div>
  );
}

// ============================================================================
// MARKDOWN PARSER
// ============================================================================

interface ContentBlock {
  type: 'text' | 'code' | 'terminal';
  content: string;
  language?: string;
}

function parseMarkdown(content: string): ContentBlock[] {
  const blocks: ContentBlock[] = [];
  const codeBlockRegex = /```(\w*)\n([\s\S]*?)```/g;

  let lastIndex = 0;
  let match;

  while ((match = codeBlockRegex.exec(content)) !== null) {
    // Add text before code block
    if (match.index > lastIndex) {
      const textContent = content.slice(lastIndex, match.index).trim();
      if (textContent) {
        blocks.push({
          type: 'text',
          content: formatText(textContent),
        });
      }
    }

    // Determine if it's a terminal block
    const language = match[1].toLowerCase();
    const isTerminal = ['bash', 'sh', 'shell', 'terminal', 'console'].includes(language);

    blocks.push({
      type: isTerminal ? 'terminal' : 'code',
      content: match[2].trim(),
      language: match[1] || undefined,
    });

    lastIndex = match.index + match[0].length;
  }

  // Add remaining text
  if (lastIndex < content.length) {
    const textContent = content.slice(lastIndex).trim();
    if (textContent) {
      blocks.push({
        type: 'text',
        content: formatText(textContent),
      });
    }
  }

  return blocks.length > 0 ? blocks : [{ type: 'text', content: formatText(content) }];
}

function formatText(text: string): string {
  // Convert markdown to HTML
  return text
    // Headers
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    // Bold
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    // Italic
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    // Inline code
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    // Links
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
    // Unordered lists
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>')
    // Ordered lists
    .replace(/^\d+\. (.+)$/gm, '<li>$1</li>')
    // Paragraphs
    .replace(/\n\n/g, '</p><p>')
    .replace(/^(.+)$/gm, (match) => {
      if (match.startsWith('<')) return match;
      return `<p>${match}</p>`;
    })
    // Clean up
    .replace(/<p><\/p>/g, '')
    .replace(/<p>(<[hul])/g, '$1')
    .replace(/(<\/[hul][^>]*>)<\/p>/g, '$1');
}
