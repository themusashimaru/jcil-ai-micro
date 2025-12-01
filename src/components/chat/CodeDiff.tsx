'use client';

import { useMemo } from 'react';

interface CodeLine {
  number: number;
  content: string;
  type: 'unchanged' | 'added' | 'removed' | 'context';
}

interface CodeDiffProps {
  filename: string;
  language?: string;
  oldCode?: string;
  newCode?: string;
  code?: string; // For displaying single code block
  showLineNumbers?: boolean;
  maxHeight?: string;
}

// Simple syntax highlighting for common patterns
function highlightSyntax(line: string, language?: string): JSX.Element {
  // Keywords for different languages
  const keywords = {
    js: /\b(const|let|var|function|return|if|else|for|while|class|import|export|from|async|await|try|catch|throw|new|this|typeof|instanceof)\b/g,
    ts: /\b(const|let|var|function|return|if|else|for|while|class|import|export|from|async|await|try|catch|throw|new|this|typeof|instanceof|interface|type|enum|implements|extends|public|private|protected)\b/g,
    py: /\b(def|class|if|elif|else|for|while|return|import|from|as|try|except|raise|with|lambda|yield|async|await|True|False|None)\b/g,
    sql: /\b(SELECT|FROM|WHERE|AND|OR|INSERT|INTO|VALUES|UPDATE|SET|DELETE|CREATE|TABLE|ALTER|DROP|INDEX|JOIN|LEFT|RIGHT|INNER|OUTER|ON|GROUP|BY|ORDER|LIMIT|OFFSET|AS|DISTINCT|COUNT|SUM|AVG|MAX|MIN)\b/gi,
  };

  const lang = language?.toLowerCase() || 'js';
  const keywordRegex = keywords[lang as keyof typeof keywords] || keywords.js;

  // Split line into parts and highlight
  const parts: JSX.Element[] = [];
  let lastIndex = 0;
  let match;
  let key = 0;

  // Clone regex to reset lastIndex
  const regex = new RegExp(keywordRegex.source, keywordRegex.flags);

  while ((match = regex.exec(line)) !== null) {
    // Add text before match
    if (match.index > lastIndex) {
      parts.push(
        <span key={key++} className="text-gray-300">
          {line.slice(lastIndex, match.index)}
        </span>
      );
    }
    // Add keyword
    parts.push(
      <span key={key++} className="text-purple-400 font-medium">
        {match[0]}
      </span>
    );
    lastIndex = match.index + match[0].length;
  }

  // Add remaining text
  if (lastIndex < line.length) {
    // Check for strings
    const remaining = line.slice(lastIndex);
    const stringParts = remaining.split(/("[^"]*"|'[^']*'|`[^`]*`)/);

    stringParts.forEach((part) => {
      if (part.match(/^["'`]/)) {
        parts.push(
          <span key={key++} className="text-green-400">
            {part}
          </span>
        );
      } else if (part.match(/\/\/.*/)) {
        // Comments
        parts.push(
          <span key={key++} className="text-gray-500 italic">
            {part}
          </span>
        );
      } else if (part.match(/\b\d+\b/)) {
        // Numbers
        const numParts = part.split(/(\b\d+\b)/);
        numParts.forEach((np) => {
          if (np.match(/^\d+$/)) {
            parts.push(
              <span key={key++} className="text-orange-400">
                {np}
              </span>
            );
          } else {
            parts.push(
              <span key={key++} className="text-gray-300">
                {np}
              </span>
            );
          }
        });
      } else {
        parts.push(
          <span key={key++} className="text-gray-300">
            {part}
          </span>
        );
      }
    });
  }

  return <>{parts.length > 0 ? parts : <span className="text-gray-300">{line}</span>}</>;
}

// Compute diff between old and new code
function computeDiff(oldCode: string, newCode: string): CodeLine[] {
  const oldLines = oldCode.split('\n');
  const newLines = newCode.split('\n');
  const result: CodeLine[] = [];

  let oldIndex = 0;
  let newIndex = 0;
  let lineNumber = 1;

  while (oldIndex < oldLines.length || newIndex < newLines.length) {
    const oldLine = oldLines[oldIndex];
    const newLine = newLines[newIndex];

    if (oldLine === newLine) {
      // Unchanged
      result.push({ number: lineNumber++, content: newLine || '', type: 'unchanged' });
      oldIndex++;
      newIndex++;
    } else if (oldLine !== undefined && !newLines.includes(oldLine)) {
      // Line was removed
      result.push({ number: lineNumber, content: oldLine, type: 'removed' });
      oldIndex++;
    } else if (newLine !== undefined && !oldLines.includes(newLine)) {
      // Line was added
      result.push({ number: lineNumber++, content: newLine, type: 'added' });
      newIndex++;
    } else {
      // Line was modified - show as remove + add
      if (oldLine !== undefined) {
        result.push({ number: lineNumber, content: oldLine, type: 'removed' });
        oldIndex++;
      }
      if (newLine !== undefined) {
        result.push({ number: lineNumber++, content: newLine, type: 'added' });
        newIndex++;
      }
    }
  }

  return result;
}

export function CodeDiff({
  filename,
  language,
  oldCode,
  newCode,
  code,
  showLineNumbers = true,
  maxHeight = '400px',
}: CodeDiffProps) {
  // Determine if this is a diff or single code display
  const isDiff = oldCode !== undefined && newCode !== undefined;

  const lines = useMemo(() => {
    if (isDiff) {
      return computeDiff(oldCode!, newCode!);
    } else if (code) {
      return code.split('\n').map((content, i) => ({
        number: i + 1,
        content,
        type: 'unchanged' as const,
      }));
    }
    return [];
  }, [isDiff, oldCode, newCode, code]);

  // Detect language from filename
  const detectedLanguage = useMemo(() => {
    if (language) return language;
    const ext = filename.split('.').pop()?.toLowerCase();
    const langMap: Record<string, string> = {
      js: 'js',
      jsx: 'js',
      ts: 'ts',
      tsx: 'ts',
      py: 'py',
      sql: 'sql',
      json: 'json',
      md: 'md',
      css: 'css',
      html: 'html',
    };
    return langMap[ext || ''] || 'js';
  }, [filename, language]);

  const getLineBackground = (type: CodeLine['type']) => {
    switch (type) {
      case 'added':
        return 'bg-green-500/20 border-l-2 border-green-500';
      case 'removed':
        return 'bg-red-500/20 border-l-2 border-red-500';
      case 'context':
        return 'bg-blue-500/10 border-l-2 border-blue-500';
      default:
        return 'bg-transparent';
    }
  };

  const getLinePrefix = (type: CodeLine['type']) => {
    switch (type) {
      case 'added':
        return <span className="text-green-400 font-bold mr-2">+</span>;
      case 'removed':
        return <span className="text-red-400 font-bold mr-2">-</span>;
      default:
        return <span className="text-transparent mr-2"> </span>;
    }
  };

  return (
    <div className="rounded-lg overflow-hidden border border-white/10 bg-zinc-900/80 my-3">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-zinc-800/50 border-b border-white/10">
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <span className="text-sm text-gray-300 font-mono">{filename}</span>
        </div>
        {isDiff && (
          <div className="flex items-center gap-3 text-xs">
            <span className="text-green-400">
              +{lines.filter(l => l.type === 'added').length}
            </span>
            <span className="text-red-400">
              -{lines.filter(l => l.type === 'removed').length}
            </span>
          </div>
        )}
      </div>

      {/* Code */}
      <div
        className="overflow-auto font-mono text-sm"
        style={{ maxHeight }}
      >
        <table className="w-full border-collapse">
          <tbody>
            {lines.map((line, index) => (
              <tr
                key={index}
                className={`${getLineBackground(line.type)} hover:bg-white/5 transition-colors`}
              >
                {showLineNumbers && (
                  <td className="px-3 py-0.5 text-right text-gray-500 select-none border-r border-white/5 w-12">
                    {line.type !== 'removed' ? line.number : ''}
                  </td>
                )}
                <td className="px-3 py-0.5 whitespace-pre">
                  {isDiff && getLinePrefix(line.type)}
                  {highlightSyntax(line.content, detectedLanguage)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Component for showing step-by-step progress
interface ProgressStep {
  id: string;
  label: string;
  status: 'pending' | 'running' | 'completed' | 'error';
  detail?: string;
}

interface WorkProgressProps {
  steps: ProgressStep[];
  title?: string;
}

export function WorkProgress({ steps, title }: WorkProgressProps) {
  return (
    <div className="rounded-lg border border-white/10 bg-zinc-900/50 p-4 my-3">
      {title && (
        <div className="flex items-center gap-2 mb-3 text-sm font-medium text-white">
          <svg className="w-4 h-4 text-blue-400 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          {title}
        </div>
      )}
      <div className="space-y-2">
        {steps.map((step) => (
          <div key={step.id} className="flex items-start gap-3">
            {/* Status indicator */}
            <div className="mt-0.5">
              {step.status === 'pending' && (
                <div className="w-4 h-4 rounded-full border-2 border-gray-600" />
              )}
              {step.status === 'running' && (
                <div className="w-4 h-4 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
              )}
              {step.status === 'completed' && (
                <div className="w-4 h-4 rounded-full bg-green-500 flex items-center justify-center">
                  <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              )}
              {step.status === 'error' && (
                <div className="w-4 h-4 rounded-full bg-red-500 flex items-center justify-center">
                  <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </div>
              )}
            </div>

            {/* Step content */}
            <div className="flex-1 min-w-0">
              <div className={`text-sm ${
                step.status === 'completed' ? 'text-gray-400' :
                step.status === 'running' ? 'text-white' :
                step.status === 'error' ? 'text-red-400' :
                'text-gray-500'
              }`}>
                {step.label}
              </div>
              {step.detail && (
                <div className="text-xs text-gray-500 mt-0.5 font-mono truncate">
                  {step.detail}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
