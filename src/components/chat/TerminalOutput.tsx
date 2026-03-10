'use client';

/**
 * TERMINAL OUTPUT COMPONENT
 *
 * Displays code execution output in a terminal-like format.
 * Similar to Claude Code's terminal output display.
 *
 * Features:
 * - Colored output (green for success, red for errors)
 * - Command display with prompt prefix
 * - Collapsible output for long results
 * - Copy output functionality
 * - ANSI color code parsing (basic)
 */

import { useState } from 'react';

interface TerminalOutputProps {
  /** The command that was executed */
  command?: string;
  /** The output from the command */
  output: string;
  /** Whether the command succeeded */
  success?: boolean;
  /** Error message if failed */
  error?: string;
  /** Title for the output block */
  title?: string;
  /** Whether to show line numbers */
  showLineNumbers?: boolean;
  /** Whether output is initially collapsed */
  defaultCollapsed?: boolean;
  /** Maximum lines before auto-collapsing */
  maxLinesBeforeCollapse?: number;
}

/**
 * Parse basic ANSI color codes into styled spans
 * For now, just strips ANSI codes - can be enhanced for full color support
 */
function parseAnsiColors(text: string): React.ReactNode {
  // Strip ANSI codes for clean display
  // Future enhancement: parse and apply colors via styled spans
  const stripped = text.replace(/\x1b\[[0-9;]*m/g, '');
  return stripped;
}

/**
 * Detect output type for syntax highlighting hints
 */
function detectOutputType(output: string): 'error' | 'success' | 'warning' | 'info' | 'normal' {
  const lowerOutput = output.toLowerCase();

  // Error patterns
  if (
    lowerOutput.includes('error:') ||
    lowerOutput.includes('error [') ||
    lowerOutput.includes('failed') ||
    lowerOutput.includes('exception') ||
    lowerOutput.includes('traceback')
  ) {
    return 'error';
  }

  // Warning patterns
  if (
    lowerOutput.includes('warning:') ||
    lowerOutput.includes('warn:') ||
    lowerOutput.includes('deprecated')
  ) {
    return 'warning';
  }

  // Success patterns
  if (
    lowerOutput.includes('success') ||
    lowerOutput.includes('passed') ||
    lowerOutput.includes('completed') ||
    lowerOutput.includes('✓') ||
    lowerOutput.includes('done')
  ) {
    return 'success';
  }

  return 'normal';
}

export function TerminalOutput({
  command,
  output,
  success = true,
  error,
  title,
  showLineNumbers = false,
  defaultCollapsed = false,
  maxLinesBeforeCollapse = 20,
}: TerminalOutputProps) {
  const lines = output.split('\n');
  const shouldAutoCollapse = lines.length > maxLinesBeforeCollapse;
  const [collapsed, setCollapsed] = useState(defaultCollapsed || shouldAutoCollapse);
  const [copied, setCopied] = useState(false);

  const outputType = error ? 'error' : detectOutputType(output);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(output);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const displayLines = collapsed ? lines.slice(0, 5) : lines;

  return (
    <div
      className={`my-3 rounded-lg overflow-hidden border bg-[#0d1117] ${success ? 'border-[#30363d]' : 'border-[#f85149]'}`}
    >
      {/* Header */}
      <div
        className={`flex items-center justify-between px-3 py-2 border-b border-[#30363d] ${success ? 'bg-[rgba(56,139,253,0.1)]' : 'bg-[rgba(248,81,73,0.1)]'}`}
      >
        <div className="flex items-center gap-2">
          {/* Terminal icon */}
          <svg
            className={`w-4 h-4 ${success ? 'stroke-[#58a6ff]' : 'stroke-[#f85149]'}`}
            viewBox="0 0 24 24"
            fill="none"
            strokeWidth="2"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
          <span className="text-xs font-medium text-gray-400">
            {title || (command ? 'Command Output' : 'Output')}
          </span>
          {outputType === 'error' && (
            <span className="text-xs px-1.5 py-0.5 rounded bg-red-500/20 text-red-400">Error</span>
          )}
          {outputType === 'warning' && (
            <span className="text-xs px-1.5 py-0.5 rounded bg-yellow-500/20 text-yellow-400">
              Warning
            </span>
          )}
          {outputType === 'success' && (
            <span className="text-xs px-1.5 py-0.5 rounded bg-green-500/20 text-green-400">
              Success
            </span>
          )}
        </div>

        <div className="flex items-center gap-1">
          {/* Copy button */}
          <button
            onClick={handleCopy}
            className="p-1.5 rounded hover:bg-white/10 transition-colors"
            title="Copy output"
          >
            {copied ? (
              <svg
                className="w-4 h-4 text-green-400"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg
                className="w-4 h-4 text-gray-400"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
              </svg>
            )}
          </button>

          {/* Collapse toggle */}
          {lines.length > 5 && (
            <button
              onClick={() => setCollapsed(!collapsed)}
              className="p-1.5 rounded hover:bg-white/10 transition-colors text-gray-400"
              title={collapsed ? 'Expand' : 'Collapse'}
            >
              <svg
                className="w-4 h-4 transition-transform"
                style={{ transform: collapsed ? 'rotate(0deg)' : 'rotate(180deg)' }}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Command (if provided) */}
      {command && (
        <div className="px-3 py-2 font-mono text-sm border-b border-[#30363d] bg-[#161b22] flex items-center gap-2">
          <span className="text-green-400">$</span>
          <span className="text-gray-300">{command}</span>
        </div>
      )}

      {/* Output content */}
      <div className="px-3 py-2 overflow-x-auto">
        <pre className="text-sm font-mono leading-relaxed m-0">
          {displayLines.map((line, i) => (
            <div key={i} className="flex">
              {showLineNumbers && (
                <span className="select-none pr-3 text-right min-w-[3ch] text-[#484f58]">
                  {i + 1}
                </span>
              )}
              <span
                style={{
                  color: line.toLowerCase().includes('error')
                    ? '#f85149'
                    : line.toLowerCase().includes('warning')
                      ? '#d29922'
                      : line.toLowerCase().includes('success') ||
                          line.includes('✓') ||
                          line.toLowerCase().includes('passed')
                        ? '#3fb950'
                        : '#c9d1d9',
                }}
              >
                {parseAnsiColors(line) || '\u00A0'}
              </span>
            </div>
          ))}
        </pre>

        {/* Collapsed indicator */}
        {collapsed && lines.length > 5 && (
          <button
            onClick={() => setCollapsed(false)}
            className="mt-2 text-xs text-blue-400 hover:text-blue-300 transition-colors flex items-center gap-1"
          >
            <svg
              className="w-3 h-3"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
            Show {lines.length - 5} more lines
          </button>
        )}
      </div>

      {/* Error message */}
      {error && (
        <div className="px-3 py-2 text-sm border-t bg-[rgba(248,81,73,0.1)] border-[#f85149] text-[#f85149]">
          <strong>Error:</strong> {error}
        </div>
      )}
    </div>
  );
}

/**
 * Code Diff Output Component
 * Displays file changes in a git-diff style format
 */
interface CodeDiffOutputProps {
  filename: string;
  additions?: string[];
  deletions?: string[];
  context?: string[];
}

export function CodeDiffOutput({
  filename,
  additions = [],
  deletions = [],
  context: _context = [],
}: CodeDiffOutputProps) {
  return (
    <div className="my-3 rounded-lg overflow-hidden border bg-[#0d1117] border-[#30363d]">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b bg-[rgba(56,139,253,0.1)] border-[#30363d]">
        <svg
          className="w-4 h-4 text-blue-400"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          />
        </svg>
        <span className="text-sm font-medium text-gray-300">{filename}</span>
        {additions.length > 0 && (
          <span className="text-xs text-green-400">+{additions.length}</span>
        )}
        {deletions.length > 0 && <span className="text-xs text-red-400">-{deletions.length}</span>}
      </div>

      {/* Diff content */}
      <div className="px-3 py-2 font-mono text-sm">
        {deletions.map((line, i) => (
          <div key={`del-${i}`} className="flex bg-[rgba(248,81,73,0.1)]">
            <span className="text-red-400 pr-2">-</span>
            <span className="text-red-300">{line}</span>
          </div>
        ))}
        {additions.map((line, i) => (
          <div key={`add-${i}`} className="flex bg-[rgba(63,185,80,0.1)]">
            <span className="text-green-400 pr-2">+</span>
            <span className="text-green-300">{line}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default TerminalOutput;
