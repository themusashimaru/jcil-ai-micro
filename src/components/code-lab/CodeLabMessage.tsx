'use client';

/**
 * CODE LAB MESSAGE
 *
 * Renders individual messages in the thread:
 * - AI responses: Flow naturally, no bubble - like reading documentation
 * - User messages: Subtle container to distinguish input
 * - Code blocks: Syntax highlighted with copy button
 * - Terminal output: Professional monospace styling
 * - Agent type indicators: Show which mode is active
 *
 * SECURITY: Uses sanitizeHtml to prevent XSS attacks
 */

import { useState, useMemo } from 'react';
import type { CodeLabMessage as MessageType } from './types';
import { COPY_FEEDBACK_DURATION_MS } from './types';
import { sanitizeHtml, escapeHtml, sanitizeUrl } from '@/lib/sanitize';
import { CodeLabThinkingBlock, parseThinkingBlocks } from './CodeLabThinkingBlock';

interface CodeLabMessageProps {
  message: MessageType;
  isLast: boolean;
}

// Agent type configuration
interface AgentType {
  name: string;
  icon: string;
  color: string;
  bgColor: string;
}

const AGENT_TYPES: Record<string, AgentType> = {
  workspace: {
    name: 'Workspace Agent',
    icon: '>',
    color: 'var(--cl-agent-workspace)',
    bgColor: 'var(--cl-agent-workspace-bg)',
  },
  standard: {
    name: 'AI Assistant',
    icon: '',
    color: 'var(--cl-agent-standard)',
    bgColor: 'var(--cl-agent-standard-bg)',
  },
  code: {
    name: 'Code Generator',
    icon: '',
    color: 'var(--cl-agent-code)',
    bgColor: 'var(--cl-agent-code-bg)',
  },
};

// Model display names for showing which model generated the response
const MODEL_DISPLAY_NAMES: Record<string, string> = {
  // Claude models
  'claude-sonnet-4-20250514': 'Sonnet 4',
  'claude-opus-4-6-20260205': 'Opus 4.6',
  'claude-haiku-4-5-20251001': 'Haiku 4.5',
  'claude-sonnet-4-20250514-thinking': 'Sonnet 4 (Thinking)',
  'claude-opus-4-6-20260205-thinking': 'Opus 4.6 (Thinking)',
  // OpenAI models
  'gpt-5.2': 'GPT-5.2',
  // xAI Grok models
  'grok-4-1-fast-reasoning': 'Grok 4.1 Fast (R)',
  'grok-code-fast-1': 'Grok Code Fast',
  // DeepSeek models
  'deepseek-reasoner': 'DeepSeek Reasoner',
  // Google Gemini models
  'gemini-3-pro-preview': 'Gemini 3 Pro',
  'gemini-3-flash-preview': 'Gemini 3 Flash',
};

export function CodeLabMessage({ message, isLast: _isLast }: CodeLabMessageProps) {
  const [copiedBlock, setCopiedBlock] = useState<number | null>(null);

  const isUser = message.role === 'user';
  const isSystem = message.role === 'system';

  // Detect agent type from message metadata or content patterns
  const agentType = useMemo(() => {
    if (isUser || isSystem) return null;
    // Check for workspace agent patterns in content
    if (
      message.content?.includes('`> ') ||
      message.content?.includes('`Running ') ||
      message.content?.includes('execute_shell') ||
      message.content?.includes('/workspace')
    ) {
      return AGENT_TYPES.workspace;
    }
    // Get model name from modelId if available
    const modelName = message.modelId ? MODEL_DISPLAY_NAMES[message.modelId] : null;
    return {
      ...AGENT_TYPES.standard,
      name: modelName || AGENT_TYPES.standard.name,
    };
  }, [message.content, message.modelId, isUser, isSystem]);

  // Extract thinking blocks from content (Claude Code parity)
  const { thinking, output, isThinkingComplete } = useMemo(() => {
    if (isUser || isSystem) {
      return { thinking: null, output: message.content, isThinkingComplete: true };
    }
    return parseThinkingBlocks(message.content);
  }, [message.content, isUser, isSystem]);

  // Parse the output content for code blocks (after thinking extraction)
  const parsedContent = useMemo(() => {
    return parseMarkdown(output);
  }, [output]);

  const handleCopyCode = async (code: string, blockIndex: number) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedBlock(blockIndex);
      setTimeout(() => setCopiedBlock(null), COPY_FEEDBACK_DURATION_MS);
    } catch (err) {
      // Client-side only - browser console for user debugging
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
        <div className="user-content">{message.content}</div>
        <style jsx>{`
          .message-user {
            display: flex;
            gap: 0.75rem;
            padding: 1rem;
            background: #000000;
            border: 1px solid #333;
            border-radius: 12px;
            margin: 1.5rem 0;
          }
          .user-avatar {
            width: 32px;
            height: 32px;
            background: #333;
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
            color: #ffffff;
            white-space: pre-wrap;
          }
        `}</style>
      </div>
    );
  }

  // Assistant message - flows naturally
  return (
    <div className={`message message-assistant ${message.isStreaming ? 'streaming' : ''}`}>
      {/* Agent Type Indicator */}
      {agentType && (
        <div
          className="agent-indicator"
          style={{ color: agentType.color, background: agentType.bgColor }}
        >
          <span className="agent-icon">{agentType.icon}</span>
          <span className="agent-name">{agentType.name}</span>
        </div>
      )}

      {/* Claude's Extended Thinking (Claude Code parity) */}
      {thinking && (
        <CodeLabThinkingBlock
          content={thinking}
          isStreaming={!isThinkingComplete && message.isStreaming}
          defaultExpanded={false}
        />
      )}

      {parsedContent.map((block, index) => {
        // Generate stable key from block type and content prefix
        const blockKey = `${block.type}-${index}-${block.content.slice(0, 20).replace(/\s/g, '')}`;
        if (block.type === 'code') {
          return (
            <div key={blockKey} className="code-block">
              <div className="code-header">
                <span className="code-lang">{block.language || 'code'}</span>
                <button className="code-copy" onClick={() => handleCopyCode(block.content, index)}>
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
            </div>
          );
        }

        if (block.type === 'terminal') {
          return (
            <div key={blockKey} className="terminal-block">
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

        // Regular text - SANITIZED to prevent XSS
        return (
          <div
            key={blockKey}
            className="text-block"
            dangerouslySetInnerHTML={{ __html: sanitizeHtml(block.content) }}
          />
        );
      })}

      {message.isStreaming && <span className="cursor" />}

      <style jsx>{`
        .message-assistant {
          padding: 0.5rem 0;
          line-height: 1.7;
          color: #ffffff;
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

        .cursor {
          display: inline-block;
          width: 8px;
          height: 18px;
          background: #ffffff;
          margin-left: 2px;
          animation: blink 1s infinite;
        }

        @keyframes blink {
          0%,
          50% {
            opacity: 1;
          }
          51%,
          100% {
            opacity: 0;
          }
        }

        /* Agent Type Indicator */
        .agent-indicator {
          display: inline-flex;
          align-items: center;
          gap: 0.375rem;
          padding: 0.25rem 0.625rem;
          border-radius: 12px;
          font-size: 0.6875rem;
          font-weight: 500;
          margin-bottom: 0.75rem;
          text-transform: uppercase;
          letter-spacing: 0.025em;
          background: #1a1a1a !important;
          color: #ffffff !important;
        }

        .agent-icon {
          font-family: 'SF Mono', 'Menlo', monospace;
          font-weight: 700;
        }

        .agent-name {
          opacity: 0.9;
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
  // SECURITY FIX: Convert markdown to HTML with URL sanitization
  return (
    text
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
      // Links - SECURITY FIX: Sanitize URLs to prevent javascript: and data: protocols
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, linkText, url) => {
        const safeUrl = sanitizeUrl(url);
        return `<a href="${safeUrl}" target="_blank" rel="noopener noreferrer">${escapeHtml(linkText)}</a>`;
      })
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
      .replace(/(<\/[hul][^>]*>)<\/p>/g, '$1')
  );
}

// ============================================================================
// SYNTAX HIGHLIGHTING
// ============================================================================

/**
 * Simple syntax highlighting without external dependencies
 * Provides basic highlighting for common languages
 */
function highlightCode(code: string, language?: string): string {
  if (!language) return code;

  const lang = language.toLowerCase();

  // Language-specific keywords
  const keywordPatterns: Record<string, RegExp> = {
    typescript:
      /\b(const|let|var|function|return|if|else|for|while|class|extends|implements|import|export|from|async|await|try|catch|throw|new|typeof|instanceof|interface|type|enum|public|private|protected|static|readonly|as|is|keyof|infer|never|unknown|any|void|null|undefined|true|false)\b/g,
    javascript:
      /\b(const|let|var|function|return|if|else|for|while|class|extends|import|export|from|async|await|try|catch|throw|new|typeof|instanceof|true|false|null|undefined)\b/g,
    python:
      /\b(def|class|return|if|elif|else|for|while|import|from|as|try|except|finally|raise|with|yield|lambda|pass|break|continue|and|or|not|in|is|True|False|None|self|async|await)\b/g,
    rust: /\b(fn|let|mut|const|struct|enum|impl|trait|pub|use|mod|match|if|else|for|while|loop|return|break|continue|async|await|self|Self|true|false|None|Some|Ok|Err)\b/g,
    go: /\b(func|var|const|type|struct|interface|package|import|return|if|else|for|range|switch|case|default|break|continue|go|chan|select|defer|map|make|new|true|false|nil)\b/g,
    java: /\b(public|private|protected|class|interface|extends|implements|static|final|void|int|long|double|float|boolean|String|return|if|else|for|while|try|catch|throw|new|import|package|true|false|null|this|super)\b/g,
    css: /\b(color|background|border|margin|padding|display|position|width|height|font|text|flex|grid|align|justify|transform|transition|animation|hover|focus|active)\b/g,
    html: /\b(div|span|p|a|img|ul|ol|li|h[1-6]|header|footer|nav|section|article|main|form|input|button|table|tr|td|th|head|body|html|script|style|link|meta)\b/g,
    sql: /\b(SELECT|FROM|WHERE|JOIN|LEFT|RIGHT|INNER|OUTER|ON|AND|OR|NOT|INSERT|INTO|VALUES|UPDATE|SET|DELETE|CREATE|TABLE|DROP|ALTER|INDEX|PRIMARY|KEY|FOREIGN|REFERENCES|ORDER|BY|ASC|DESC|LIMIT|OFFSET|GROUP|HAVING|DISTINCT|COUNT|SUM|AVG|MAX|MIN|NULL|AS)\b/gi,
    json: /"[^"]+"\s*:/g,
  };

  // Get patterns for the language or fall back to typescript patterns
  const langPatterns = keywordPatterns[lang] || keywordPatterns.typescript;

  let result = code;

  // Apply highlighting in order of specificity

  // Comments (single line and multi-line)
  result = result.replace(/(\/\/[^\n]*)/g, '<span class="token-comment">$1</span>');
  result = result.replace(/(\/\*[\s\S]*?\*\/)/g, '<span class="token-comment">$1</span>');
  result = result.replace(/(#[^\n]*)/g, '<span class="token-comment">$1</span>');

  // Strings (double and single quoted)
  result = result.replace(/(&quot;[^&]*&quot;|"[^"]*")/g, '<span class="token-string">$1</span>');
  result = result.replace(/('(?:[^'\\]|\\.)*')/g, '<span class="token-string">$1</span>');
  result = result.replace(/(`(?:[^`\\]|\\.)*`)/g, '<span class="token-string">$1</span>');

  // Numbers
  result = result.replace(/\b(\d+\.?\d*)\b/g, '<span class="token-number">$1</span>');

  // Keywords (apply last to not affect already highlighted content)
  if (langPatterns) {
    result = result.replace(langPatterns, '<span class="token-keyword">$&</span>');
  }

  // Function calls
  result = result.replace(/\b([a-zA-Z_]\w*)\s*(?=\()/g, '<span class="token-function">$1</span>');

  // Types (capitalized words, common in TS/Java)
  if (['typescript', 'javascript', 'java', 'rust'].includes(lang)) {
    result = result.replace(/\b([A-Z][a-zA-Z0-9]*)\b/g, '<span class="token-type">$1</span>');
  }

  // Operators
  result = result.replace(/([+\-*/%=<>!&|^~?:])/g, '<span class="token-operator">$1</span>');

  return result;
}
