/**
 * CODE BLOCK COMPONENT
 *
 * Terminal-style code display with:
 * - Line numbers
 * - Syntax highlighting (basic)
 * - Diff highlighting (green/red for +/-)
 * - Copy button
 * - Language badge
 */

'use client';

import { useState } from 'react';

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
function highlightSyntax(line: string, language?: string): JSX.Element {
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

  let result = line;

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
    result = result.replace(regex, '<span class="text-pink-400 font-semibold">$1</span>');
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
    return 'bg-green-900/40 text-green-300';
  }
  if (line.startsWith('-')) {
    return 'bg-red-900/40 text-red-300';
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
    <div className={`relative group rounded-lg overflow-hidden bg-[#0a0a0a] border border-green-900/30 ${className}`}>
      {/* Header bar */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-[#111] border-b border-green-900/30">
        <span className="text-xs font-mono text-green-500 uppercase tracking-wider">
          {detectedLanguage}
        </span>
        <button
          onClick={handleCopy}
          className="text-xs text-gray-500 hover:text-green-400 transition-colors font-mono"
        >
          {copied ? '✓ Copied' : 'Copy'}
        </button>
      </div>

      {/* Code area */}
      <div className="overflow-x-auto">
        <pre className="p-3 font-mono text-sm leading-relaxed">
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
                <span className={`flex-1 ${isDiff ? '' : 'text-gray-300'}`}>
                  {isDiff ? (
                    // Diff lines get special coloring
                    <span className={line.startsWith('+') ? 'text-green-300' : line.startsWith('-') ? 'text-red-300' : 'text-gray-400'}>
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
