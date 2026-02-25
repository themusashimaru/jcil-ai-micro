/**
 * CODE BLOCK WITH ACTIONS
 * =======================
 *
 * Wraps code blocks with action buttons:
 * - Copy: Copy code to clipboard
 * - Test: Run code in Vercel Sandbox
 * - Push: Push to GitHub repository
 *
 * Used by MarkdownRenderer to enhance code blocks
 */

'use client';

import { useState } from 'react';
import { logger } from '@/lib/logger';

const log = logger('CodeBlockWithActions');

interface CodeBlockWithActionsProps {
  code: string;
  language: string;
  onTest?: (code: string, language: string) => Promise<{ success: boolean; output: string }>;
  onPush?: (code: string, language: string) => Promise<void>;
  showTestButton?: boolean;
  showPushButton?: boolean;
  // External state management (for when parent needs to persist state across re-renders)
  externalTesting?: boolean;
  externalTestResult?: { success: boolean; output: string };
}

// Languages that can be tested in Sandbox
const TESTABLE_LANGUAGES = ['javascript', 'js', 'typescript', 'ts', 'python', 'py', 'jsx', 'tsx'];

export function CodeBlockWithActions({
  code,
  language,
  onTest,
  onPush,
  showTestButton = true,
  showPushButton = true,
  externalTesting,
  externalTestResult,
}: CodeBlockWithActionsProps) {
  const [copied, setCopied] = useState(false);
  const [internalTesting, setInternalTesting] = useState(false);
  const [internalTestResult, setInternalTestResult] = useState<{
    success: boolean;
    output: string;
  } | null>(null);

  // Use external state if provided, otherwise use internal state
  const testing = externalTesting ?? internalTesting;
  const testResult = externalTestResult ?? internalTestResult;

  const canTest = TESTABLE_LANGUAGES.includes(language.toLowerCase());
  const displayLanguage = getDisplayLanguage(language);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleTest = async () => {
    log.debug('handleTest called', {
      hasOnTest: !!onTest,
      language,
      codeLength: code.length,
      hasExternalState: externalTesting !== undefined,
    });
    if (!onTest) {
      log.debug('No onTest function provided!');
      return;
    }

    // Only manage internal state if external state is not provided
    const useInternalState = externalTesting === undefined;
    if (useInternalState) {
      setInternalTesting(true);
      setInternalTestResult(null);
    }

    try {
      log.debug('Calling onTest...');
      const result = await onTest(code, language);
      log.debug('onTest result:', result);
      if (useInternalState) {
        setInternalTestResult(result);
      }
    } catch (error) {
      log.error('onTest error', error as Error);
      if (useInternalState) {
        setInternalTestResult({
          success: false,
          output: error instanceof Error ? error.message : 'Test failed',
        });
      }
    } finally {
      if (useInternalState) {
        setInternalTesting(false);
      }
    }
  };

  const handlePush = async () => {
    if (!onPush) return;
    try {
      await onPush(code, language);
    } catch (error) {
      log.error('Push failed', error as Error);
    }
  };

  return (
    <div className="rounded-lg overflow-hidden my-2 bg-glass">
      {/* Header with language and actions */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b bg-blue-500/10 border-theme">
        {/* Language label */}
        <div className="flex items-center gap-2">
          <LanguageIcon language={language} />
          <span className="text-xs font-medium text-text-muted">{displayLanguage}</span>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-1">
          {/* Copy button */}
          <button
            onClick={handleCopy}
            className="p-1.5 rounded hover:bg-white/10 transition-colors"
            aria-label={copied ? 'Code copied' : 'Copy code to clipboard'}
            title="Copy code"
          >
            {copied ? (
              <CheckIcon className="w-4 h-4 text-green-400" />
            ) : (
              <CopyIcon className="w-4 h-4 text-text-muted" />
            )}
          </button>

          {/* Test button */}
          {showTestButton && canTest && onTest && (
            <button
              onClick={() => {
                log.debug('TEST BUTTON CLICKED!');
                handleTest();
              }}
              disabled={testing}
              className="p-1.5 rounded hover:bg-white/10 transition-colors disabled:opacity-50"
              aria-label={testing ? 'Running test in sandbox' : 'Test code in sandbox'}
              title="Test in Sandbox"
            >
              {testing ? (
                <LoadingSpinner className="w-4 h-4" />
              ) : (
                <PlayIcon className="w-4 h-4 text-text-muted" />
              )}
            </button>
          )}

          {/* Push to GitHub button */}
          {showPushButton && onPush && (
            <button
              onClick={handlePush}
              className="p-1.5 rounded hover:bg-white/10 transition-colors"
              aria-label="Push code to GitHub"
              title="Push to GitHub"
            >
              <GitHubIcon className="w-4 h-4 text-text-muted" />
            </button>
          )}
        </div>
      </div>

      {/* Code content */}
      <pre className="p-3 overflow-x-auto">
        <code className="text-sm font-mono text-text-primary">{code}</code>
      </pre>

      {/* Test result */}
      {testResult && (
        <div
          className={`px-3 py-2 border-t border-theme text-xs font-mono ${testResult.success ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}
        >
          <div className="flex items-center gap-2 mb-1">
            {testResult.success ? (
              <CheckIcon className="w-3.5 h-3.5" />
            ) : (
              <XIcon className="w-3.5 h-3.5" />
            )}
            <span className="font-semibold">
              {testResult.success ? 'Test Passed' : 'Test Failed'}
            </span>
          </div>
          <pre className="whitespace-pre-wrap">{testResult.output}</pre>
        </div>
      )}
    </div>
  );
}

// Helper to get display name for language
function getDisplayLanguage(lang: string): string {
  const map: Record<string, string> = {
    js: 'JavaScript',
    javascript: 'JavaScript',
    ts: 'TypeScript',
    typescript: 'TypeScript',
    jsx: 'React JSX',
    tsx: 'React TSX',
    py: 'Python',
    python: 'Python',
    html: 'HTML',
    css: 'CSS',
    json: 'JSON',
    bash: 'Bash',
    sh: 'Shell',
    sql: 'SQL',
    md: 'Markdown',
    markdown: 'Markdown',
  };
  return map[lang.toLowerCase()] || lang.toUpperCase();
}

// Language icon component
function LanguageIcon({ language }: { language: string }) {
  const lang = language.toLowerCase();

  // Python icon
  if (lang === 'python' || lang === 'py') {
    return (
      <svg className="w-4 h-4 text-blue-700" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 0C5.372 0 5.372 2.664 5.372 5.328v2.332h6.75v.778H3.84C1.72 8.438 0 10.5 0 13.5s1.72 5.062 3.84 5.062h2.16v-2.5c0-2.328 2.016-4.406 4.5-4.406h6.75c2.016 0 3.75-1.664 3.75-3.656V5.328C21 2.664 18.984 0 12 0zm-3.375 3.094a1.219 1.219 0 110 2.437 1.219 1.219 0 010-2.437z" />
      </svg>
    );
  }

  // JavaScript/TypeScript icon
  if (['javascript', 'js', 'typescript', 'ts', 'jsx', 'tsx'].includes(lang)) {
    const color = lang.includes('ts') ? '#3178c6' : '#f7df1e';
    return (
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill={color}>
        <path d="M0 0h24v24H0V0zm22.034 18.276c-.175-1.095-.888-2.015-3.003-2.873-.736-.345-1.554-.585-1.797-1.14-.091-.33-.105-.51-.046-.705.15-.646.915-.84 1.515-.66.39.12.75.42.976.9 1.034-.676 1.034-.676 1.755-1.125-.27-.42-.405-.6-.586-.78-.63-.705-1.469-1.065-2.834-1.034l-.705.089c-.676.165-1.32.525-1.71 1.005-1.14 1.291-.811 3.541.569 4.471 1.365 1.02 3.361 1.244 3.616 2.205.24 1.17-.87 1.545-1.966 1.41-.811-.18-1.26-.586-1.755-1.336l-1.83 1.051c.21.48.45.689.81 1.109 1.74 1.756 6.09 1.666 6.871-1.004.029-.09.24-.705.074-1.65l.046.067zm-8.983-7.245h-2.248c0 1.938-.009 3.864-.009 5.805 0 1.232.063 2.363-.138 2.711-.33.689-1.18.601-1.566.48-.396-.196-.597-.466-.83-.855-.063-.105-.11-.196-.127-.196l-1.825 1.125c.305.63.75 1.172 1.324 1.517.855.51 2.004.675 3.207.405.783-.226 1.458-.691 1.811-1.411.51-.93.402-2.07.397-3.346.012-2.054 0-4.109 0-6.179l.004-.056z" />
      </svg>
    );
  }

  // Default code icon
  return (
    <svg className="w-4 h-4 text-text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"
      />
    </svg>
  );
}

// Icons
function CopyIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor">
      <rect x="9" y="9" width="13" height="13" rx="2" strokeWidth={2} />
      <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" strokeWidth={2} />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  );
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

function PlayIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}

function GitHubIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
    </svg>
  );
}

function LoadingSpinner({ className }: { className?: string }) {
  return (
    <svg className={`${className} animate-spin`} viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}

export default CodeBlockWithActions;
