/**
 * CODE BLOCK COMPONENT
 *
 * Professional code display with:
 * - Line numbers
 * - Syntax highlighting
 * - Diff highlighting (green/red for +/-)
 * - Copy button
 * - Language badge
 */

'use client';

import { useState } from 'react';

/**
 * Escape HTML entities to prevent XSS attacks
 * Must be called BEFORE applying syntax highlighting
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

interface CodeBlockProps {
  code: string;
  language?: string;
  showLineNumbers?: boolean;
  className?: string;
}

// Detect if code is a diff
function isDiffCode(code: string): boolean {
  const lines = code.split('\n');
  return lines.some(line => line.startsWith('+') || line.startsWith('-'));
}

// Basic syntax highlighting for common patterns
function highlightSyntax(line: string, _language?: string): JSX.Element {
  // Don't highlight diff lines - they get special treatment
  if (line.startsWith('+') || line.startsWith('-')) {
    return <>{line}</>;
  }

  // Keywords for common languages
  const keywords = [
    'function', 'const', 'let', 'var', 'return', 'if', 'else', 'for', 'while',
    'class', 'import', 'export', 'from', 'default', 'async', 'await', 'try',
    'catch', 'throw', 'new', 'this', 'super', 'extends', 'implements', 'interface',
    'type', 'enum', 'public', 'private', 'protected', 'static', 'readonly',
    'def', 'print', 'self', 'True', 'False', 'None', 'lambda', 'yield',
  ];

  const types = [
    'string', 'number', 'boolean', 'void', 'null', 'undefined', 'any', 'never',
    'object', 'Array', 'Promise', 'Map', 'Set', 'int', 'float', 'str', 'bool',
  ];

  // SECURITY: Escape HTML entities first to prevent XSS
  // This ensures any <script> or other malicious HTML is displayed as text
  let result = escapeHtml(line);

  // Highlight strings (simple approach)
  result = result.replace(
    /(["'`])(?:(?!\1)[^\\]|\\.)*\1/g,
    '<span class="text-amber-400">$&</span>'
  );

  // Highlight comments
  result = result.replace(
    /(\/\/.*$|#.*$)/gm,
    '<span class="text-gray-500 italic">$1</span>'
  );

  // Highlight numbers
  result = result.replace(
    /\b(\d+\.?\d*)\b/g,
    '<span class="text-purple-400">$1</span>'
  );

  // Highlight keywords
  keywords.forEach(keyword => {
    const regex = new RegExp(`\\b(${keyword})\\b`, 'g');
    result = result.replace(regex, '<span class="text-blue-400 font-medium">$1</span>');
  });

  // Highlight types
  types.forEach(type => {
    const regex = new RegExp(`\\b(${type})\\b`, 'g');
    result = result.replace(regex, '<span class="text-cyan-400">$1</span>');
  });

  return <span dangerouslySetInnerHTML={{ __html: result }} />;
}

// Get line class based on content (for diff)
function getLineClass(line: string): string {
  if (line.startsWith('+')) {
    return 'bg-green-900/30';
  }
  if (line.startsWith('-')) {
    return 'bg-red-900/30';
  }
  return '';
}

// Get line number class
function getLineNumberClass(line: string): string {
  if (line.startsWith('+')) {
    return 'text-green-500';
  }
  if (line.startsWith('-')) {
    return 'text-red-500';
  }
  return 'text-gray-600';
}

export function CodeBlock({
  code,
  language = 'text',
  showLineNumbers = true,
  className = '',
}: CodeBlockProps) {
  const [copied, setCopied] = useState(false);
  const lines = code.split('\n');
  const isDiff = isDiffCode(code);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  // Detect language from code if not provided
  const detectedLanguage = language || (
    isDiff ? 'diff' :
    code.includes('function') || code.includes('const ') ? 'javascript' :
    code.includes('def ') || code.includes('import ') ? 'python' :
    code.includes('SELECT') || code.includes('FROM') ? 'sql' :
    'text'
  );

  return (
    <div className={`relative group rounded-xl overflow-hidden bg-[#1a1a1a] border border-white/10 ${className}`}>
      {/* Header bar */}
      <div className="flex items-center justify-between px-4 py-2 bg-white/5 border-b border-white/10">
        <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">
          {detectedLanguage}
        </span>
        <button
          onClick={handleCopy}
          className="text-xs text-gray-500 hover:text-white transition-colors flex items-center gap-1"
        >
          {copied ? (
            <>
              <svg className="w-3.5 h-3.5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Copied
            </>
          ) : (
            <>
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              Copy
            </>
          )}
        </button>
      </div>

      {/* Code area */}
      <div className="overflow-x-auto">
        <pre className="p-4 font-mono text-sm leading-relaxed">
          <code>
            {lines.map((line, index) => (
              <div
                key={index}
                className={`flex ${getLineClass(line)}`}
              >
                {/* Line number */}
                {showLineNumbers && (
                  <span
                    className={`select-none pr-4 text-right min-w-[3rem] ${getLineNumberClass(line)}`}
                  >
                    {index + 1}
                  </span>
                )}
                {/* Line content */}
                <span className={`flex-1 ${isDiff ? '' : 'text-gray-200'}`}>
                  {isDiff ? (
                    // Diff lines get special coloring
                    <span className={line.startsWith('+') ? 'text-green-400' : line.startsWith('-') ? 'text-red-400' : 'text-gray-400'}>
                      {line}
                    </span>
                  ) : (
                    // Regular code gets syntax highlighting
                    highlightSyntax(line, detectedLanguage)
                  )}
                </span>
              </div>
            ))}
          </code>
        </pre>
      </div>
    </div>
  );
}

/**
 * Parse markdown content and extract code blocks
 */
export function parseCodeBlocks(content: string): Array<{ type: 'text' | 'code'; content: string; language?: string }> {
  const parts: Array<{ type: 'text' | 'code'; content: string; language?: string }> = [];
  const codeBlockRegex = /```(\w*)\n([\s\S]*?)```/g;

  let lastIndex = 0;
  let match;

  while ((match = codeBlockRegex.exec(content)) !== null) {
    // Add text before code block
    if (match.index > lastIndex) {
      const textContent = content.slice(lastIndex, match.index).trim();
      if (textContent) {
        parts.push({ type: 'text', content: textContent });
      }
    }

    // Add code block
    parts.push({
      type: 'code',
      content: match[2].trim(),
      language: match[1] || undefined,
    });

    lastIndex = match.index + match[0].length;
  }

  // Add remaining text
  if (lastIndex < content.length) {
    const textContent = content.slice(lastIndex).trim();
    if (textContent) {
      parts.push({ type: 'text', content: textContent });
    }
  }

  return parts;
}
