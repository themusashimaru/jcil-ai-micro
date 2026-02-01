/**
 * MARKDOWN RENDERER COMPONENT
 *
 * PURPOSE:
 * - Render markdown content with proper formatting
 * - Styled for dark glassmorphism theme
 * - Handles headers, bold, italic, lists, code, links
 * - Auto-linkifies plain URLs that aren't in markdown format
 * - Code blocks with Test/Push actions (Vercel Sandbox + GitHub)
 *
 * USAGE:
 * - <MarkdownRenderer content={message.content} />
 */

'use client';

import { useState, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import type { Components } from 'react-markdown';
import { CodeBlockWithActions } from './CodeBlockWithActions';
import { TerminalOutput } from './TerminalOutput';
import { useCodeExecutionOptional } from '@/contexts/CodeExecutionContext';
import { logger } from '@/lib/logger';

const log = logger('MarkdownRenderer');

interface MarkdownRendererProps {
  content: string;
  /** Enable code execution actions (Test/Push buttons) */
  enableCodeActions?: boolean;
  /** Callback when test result is received */
  onTestResult?: (result: { success: boolean; output: string }) => void;
}

/**
 * Convert plain URLs to markdown links
 * Only converts URLs that aren't already in markdown link format [text](url)
 */
function autoLinkifyUrls(text: string): string {
  // Regex to match URLs that are NOT already in markdown link format
  // Negative lookbehind (?<!\]\() ensures we don't match URLs already in [text](url) format
  // Negative lookbehind (?<!\() ensures we don't match URLs in (url) format
  const urlRegex = /(?<!\]\()(?<!\()(https?:\/\/[^\s<>)\]"']+)/gi;

  return text.replace(urlRegex, (url) => {
    // Extract domain for display
    let displayText = url;
    try {
      const urlObj = new URL(url);
      displayText = urlObj.hostname.replace('www.', '');
    } catch {
      // Keep original URL if parsing fails
    }
    return `[${displayText}](${url})`;
  });
}

// Custom components - inherit colors from parent for theme support
const components: Components = {
  // Headers - inherit color from parent
  h1: ({ children }) => (
    <h1 className="text-xl font-bold mt-4 mb-2 first:mt-0" style={{ color: 'inherit' }}>{children}</h1>
  ),
  h2: ({ children }) => (
    <h2 className="text-lg font-bold mt-3 mb-2 first:mt-0" style={{ color: 'inherit' }}>{children}</h2>
  ),
  h3: ({ children }) => (
    <h3 className="text-base font-semibold mt-3 mb-1 first:mt-0" style={{ color: 'inherit' }}>{children}</h3>
  ),
  h4: ({ children }) => (
    <h4 className="text-sm font-semibold mt-2 mb-1 first:mt-0" style={{ color: 'inherit' }}>{children}</h4>
  ),

  // Paragraphs
  p: ({ children }) => (
    <p className="mb-2 last:mb-0 leading-relaxed" style={{ color: 'inherit' }}>{children}</p>
  ),

  // Bold and italic - inherit color
  strong: ({ children }) => (
    <strong className="font-semibold" style={{ color: 'inherit' }}>{children}</strong>
  ),
  em: ({ children }) => (
    <em className="italic" style={{ color: 'inherit' }}>{children}</em>
  ),

  // Lists - inherit color
  ul: ({ children }) => (
    <ul className="list-disc list-inside mb-2 space-y-1 ml-2" style={{ color: 'inherit' }}>{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="list-decimal list-inside mb-2 space-y-1 ml-2" style={{ color: 'inherit' }}>{children}</ol>
  ),
  li: ({ children }) => (
    <li style={{ color: 'inherit' }}>{children}</li>
  ),

  // Links - use primary color
  // For document downloads (PDF, DOCX, XLSX), force download instead of opening
  a: ({ href, children }) => {
    // Debug: log all links
    log.debug('Link rendered: href=' + href + ', isDoc=' + (href && (href.includes('/api/documents/') || href.includes('.pdf'))));

    // SAFETY: If href is empty or invalid, render as plain text (prevents navigation crash)
    if (!href || href === '' || href === '#') {
      log.warn('Empty or invalid href detected, rendering as text');
      return <span style={{ color: 'var(--primary)' }}>{children}</span>;
    }

    const isDocumentLink = href && (
      href.includes('/api/documents/') ||
      href.includes('.pdf') ||
      href.includes('.docx') ||
      href.includes('.xlsx')
    );

    if (isDocumentLink) {
      // Decode token from URL to get file info (token is base64url encoded JSON)
      const decodeTokenFromUrl = (url: string): { type?: string; filename?: string } => {
        try {
          const urlObj = new URL(url, window.location.origin);
          const token = urlObj.searchParams.get('token');
          if (token) {
            // Base64url decode: replace URL-safe chars and decode
            const base64 = token.replace(/-/g, '+').replace(/_/g, '/');
            const decoded = JSON.parse(atob(base64));
            log.debug('Decoded token:', decoded);
            return { type: decoded.t, filename: decoded.f };
          }
        } catch (e) {
          log.warn('Failed to decode token', { error: e });
        }
        return {};
      };

      // Parse token once
      const tokenInfo = decodeTokenFromUrl(href);

      // Determine file type and MIME type from decoded token
      const getFileInfo = (): { extension: string; mimeType: string } => {
        const fileType = tokenInfo.type?.toLowerCase();

        if (fileType === 'pdf' || href.includes('.pdf')) {
          return { extension: '.pdf', mimeType: 'application/pdf' };
        }
        if (fileType === 'docx' || href.includes('.docx')) {
          return { extension: '.docx', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' };
        }
        if (fileType === 'xlsx' || href.includes('.xlsx')) {
          return { extension: '.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' };
        }
        // Default based on URL patterns as fallback
        return { extension: '.pdf', mimeType: 'application/pdf' };
      };

      // Extract filename from decoded token or fallback to URL/children
      const getFilename = (): string => {
        // Use filename from decoded token if available
        if (tokenInfo.filename) {
          return tokenInfo.filename;
        }

        const { extension } = getFileInfo();
        // Try to get filename from URL path
        const urlPath = href?.split('/').pop()?.split('?')[0];
        if (urlPath && urlPath.includes('.')) return urlPath;

        // Use children text as filename base
        const childText = typeof children === 'string' ? children :
          (Array.isArray(children) ? children.join('') : 'document');
        const safeName = String(childText).replace(/[^a-z0-9]/gi, '_').toLowerCase() || 'document';
        return safeName + extension;
      };

      // Check if mobile (iOS or Android)
      const isMobile = typeof navigator !== 'undefined' &&
        /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

      // Download handler - uses Web Share API on mobile for better experience
      const handleDownload = async (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();

        if (!href) {
          log.error('No href for download');
          return;
        }

        const filename = getFilename();
        const { mimeType } = getFileInfo();

        log.debug('Starting download:', { href, filename, mimeType, tokenInfo });

        try {
          // Fetch the file first
          const response = await fetch(href, { credentials: 'include' });

          if (!response.ok) {
            log.error('Download response not ok', { status: response.status, statusText: response.statusText });
            // Try opening in new tab as fallback
            window.open(href, '_blank', 'noopener,noreferrer');
            return;
          }

          const blob = await response.blob();
          log.debug('Blob received', { size: blob.size });

          // On mobile with Web Share API support, use native share (Save to Files)
          if (isMobile && navigator.share && navigator.canShare) {
            const file = new File([blob], filename, { type: mimeType });
            const shareData = { files: [file] };

            if (navigator.canShare(shareData)) {
              await navigator.share(shareData);
              return;
            }
          }

          // Desktop or fallback: Create blob URL and trigger download
          const blobUrl = window.URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = blobUrl;
          link.download = filename;
          link.style.display = 'none';
          document.body.appendChild(link);
          link.click();

          // Cleanup
          setTimeout(() => {
            document.body.removeChild(link);
            window.URL.revokeObjectURL(blobUrl);
          }, 100);
        } catch (error) {
          log.error('Download error', error as Error);
          // Ultimate fallback - open in new tab (don't throw!)
          try {
            window.open(href, '_blank', 'noopener,noreferrer');
          } catch (openError) {
            log.error('Could not open window', openError as Error);
            // Show user-friendly message
            alert('Download failed. Please try generating the document again.');
          }
        }
      };

      log.debug('Rendering download BUTTON for', { href });

      return (
        <button
          onClick={handleDownload}
          className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md underline cursor-pointer hover:opacity-80 active:scale-95 transition-transform"
          style={{ color: 'var(--primary)' }}
        >
          <svg className="h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          <span>{children}</span>
        </button>
      );
    }

    // Regular links open in new tab
    log.debug('Rendering regular LINK (not document) for', { href });

    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="underline break-all cursor-pointer hover:opacity-80"
        style={{ color: 'var(--primary)', pointerEvents: 'auto' }}
      >
        {children}
      </a>
    );
  },

  // Code blocks - use theme-aware backgrounds with language headers
  code: ({ className, children }) => {
    const isInline = !className;

    // Extract language from className (e.g., "language-python" -> "python")
    const language = className?.replace('language-', '') || '';
    const isPython = language === 'python';

    if (isInline) {
      return (
        <code
          className="px-1.5 py-0.5 rounded text-sm font-mono"
          style={{ backgroundColor: 'var(--glass-bg)', color: 'var(--primary)' }}
        >
          {children}
        </code>
      );
    }

    // Block code with language header for Python
    if (isPython) {
      return (
        <div className="rounded-lg overflow-hidden my-2" style={{ backgroundColor: 'var(--glass-bg)' }}>
          <div
            className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium border-b"
            style={{
              backgroundColor: 'rgba(59, 130, 246, 0.1)',
              borderColor: 'var(--border)',
              color: 'var(--text-muted)'
            }}
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0C5.372 0 5.372 2.664 5.372 5.328v2.332h6.75v.778H3.84C1.72 8.438 0 10.5 0 13.5s1.72 5.062 3.84 5.062h2.16v-2.5c0-2.328 2.016-4.406 4.5-4.406h6.75c2.016 0 3.75-1.664 3.75-3.656V5.328C21 2.664 18.984 0 12 0zm-3.375 3.094a1.219 1.219 0 110 2.437 1.219 1.219 0 010-2.437z"/>
              <path d="M18.628 8.438v2.5c0 2.328-2.016 4.406-4.5 4.406H7.378c-2.016 0-3.75 1.664-3.75 3.656v2.672c0 2.664 2.016 5.328 8.372 5.328 6.628 0 6.628-2.664 6.628-5.328v-2.332h-6.75v-.778h9.282c2.12 0 3.84-2.062 3.84-5.062s-1.72-5.062-3.84-5.062h-2.532zm-3.253 10.468a1.219 1.219 0 110 2.437 1.219 1.219 0 010-2.437z"/>
            </svg>
            <span>Python</span>
          </div>
          <code
            className="block p-3 text-sm font-mono overflow-x-auto"
            style={{ color: 'var(--text-primary)' }}
          >
            {children}
          </code>
        </div>
      );
    }

    // Regular block code
    return (
      <code
        className="block p-3 rounded-lg text-sm font-mono overflow-x-auto my-2"
        style={{ backgroundColor: 'var(--glass-bg)', color: 'var(--text-primary)' }}
      >
        {children}
      </code>
    );
  },
  pre: ({ children }) => {
    // Check if the child is our custom Python block (which handles its own wrapper)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const childType = (children as any)?.type?.name;
    if (childType === 'code') {
      // Let the code component handle its own styling
      return <>{children}</>;
    }
    return (
      <pre className="rounded-lg overflow-x-auto my-2" style={{ backgroundColor: 'var(--glass-bg)' }}>{children}</pre>
    );
  },

  // Blockquotes - inherit text color
  blockquote: ({ children }) => (
    <blockquote
      className="border-l-4 pl-4 py-1 my-2 italic rounded-r"
      style={{ borderColor: 'var(--primary)', backgroundColor: 'var(--glass-bg)', color: 'inherit' }}
    >
      {children}
    </blockquote>
  ),

  // Horizontal rule
  hr: () => (
    <hr className="my-4" style={{ borderColor: 'var(--border)' }} />
  ),

  // Tables - theme-aware
  table: ({ children }) => (
    <div className="overflow-x-auto my-2">
      <table className="min-w-full border-collapse">{children}</table>
    </div>
  ),
  thead: ({ children }) => (
    <thead style={{ backgroundColor: 'var(--glass-bg)' }}>{children}</thead>
  ),
  tbody: ({ children }) => (
    <tbody style={{ color: 'inherit' }}>{children}</tbody>
  ),
  tr: ({ children }) => (
    <tr style={{ borderBottom: '1px solid var(--border)' }}>{children}</tr>
  ),
  th: ({ children }) => (
    <th className="px-3 py-2 text-left text-sm font-semibold" style={{ color: 'inherit' }}>{children}</th>
  ),
  td: ({ children }) => (
    <td className="px-3 py-2 text-sm" style={{ color: 'inherit' }}>{children}</td>
  ),
};

/**
 * Filter out internal checkpoint state markers from content
 * These are used for resume functionality and shouldn't be visible to users
 */
function filterInternalMarkers(text: string): string {
  // Remove checkpoint state: [c:BASE64_STATE]
  return text.replace(/\[c:[A-Za-z0-9+/=]+\]/g, '');
}

export function MarkdownRenderer({
  content,
  enableCodeActions = false,
  onTestResult
}: MarkdownRendererProps) {
  // Get code execution context (optional - gracefully handle if not in provider)
  const codeExecution = useCodeExecutionOptional();

  // Store test results by code hash to persist across re-renders
  const [testResults, setTestResults] = useState<Map<string, { success: boolean; output: string; testing: boolean }>>(new Map());

  // Pre-process content:
  // 1. Filter out internal markers (checkpoint state, etc.)
  // 2. Convert plain URLs to clickable markdown links
  const filteredContent = filterInternalMarkers(content);
  const processedContent = autoLinkifyUrls(filteredContent);

  // Generate a stable hash for code content
  const getCodeHash = useCallback((code: string) => {
    return code.slice(0, 100) + '_' + code.length;
  }, []);

  // Create components with code action handlers
  const componentsWithActions: Components = {
    ...components,
    // Override code block rendering when actions are enabled
    code: ({ className, children }) => {
      const isInline = !className;
      const language = className?.replace('language-', '') || '';
      const codeContent = String(children).replace(/\n$/, '');

      // Inline code - simple styling
      if (isInline) {
        return (
          <code
            className="px-1.5 py-0.5 rounded text-sm font-mono"
            style={{ backgroundColor: 'var(--glass-bg)', color: 'var(--primary)' }}
          >
            {children}
          </code>
        );
      }

      // Check if this is terminal/shell output - render with TerminalOutput component
      const isTerminalOutput = ['bash', 'sh', 'shell', 'console', 'terminal', 'output', 'log'].includes(language.toLowerCase());
      if (isTerminalOutput) {
        // Detect if it looks like an error or success
        const hasError = codeContent.toLowerCase().includes('error') ||
                        codeContent.toLowerCase().includes('failed') ||
                        codeContent.toLowerCase().includes('exception');
        return (
          <TerminalOutput
            output={codeContent}
            success={!hasError}
            title={language === 'output' ? 'Output' : language === 'log' ? 'Log' : 'Terminal'}
          />
        );
      }

      // Block code - use CodeBlockWithActions when enabled
      log.debug('Code block render:', { enableCodeActions, hasCodeExecution: !!codeExecution, language });
      if (enableCodeActions && codeExecution) {
        const codeHash = getCodeHash(codeContent);
        const testState = testResults.get(codeHash);
        log.debug('Rendering CodeBlockWithActions:', { codeHash, testState });

        return (
          <CodeBlockWithActions
            key={codeHash}
            code={codeContent}
            language={language}
            showTestButton={true}
            showPushButton={codeExecution.githubConnected}
            // Pass test state from parent
            externalTesting={testState?.testing}
            externalTestResult={testState && !testState.testing ? { success: testState.success, output: testState.output } : undefined}
            onTest={async (code, lang) => {
              log.debug('onTest called:', { lang, codeLength: code.length, codeHash });

              // Set testing state
              setTestResults(prev => {
                const next = new Map(prev);
                next.set(codeHash, { success: false, output: '', testing: true });
                return next;
              });

              try {
                const result = await codeExecution.testCode(code, lang);
                log.debug('testCode result', { result });
                const output = result.outputs.map(o => o.stdout || o.stderr).join('\n') || result.error || '';

                // Store result
                setTestResults(prev => {
                  const next = new Map(prev);
                  next.set(codeHash, { success: result.success, output, testing: false });
                  return next;
                });

                if (onTestResult) {
                  onTestResult({ success: result.success, output });
                }
                return { success: result.success, output };
              } catch (error) {
                const errorMsg = error instanceof Error ? error.message : 'Test failed';
                setTestResults(prev => {
                  const next = new Map(prev);
                  next.set(codeHash, { success: false, output: errorMsg, testing: false });
                  return next;
                });
                return { success: false, output: errorMsg };
              }
            }}
            onPush={async (code, lang) => {
              // Determine filename from language
              const ext = getExtensionForLanguage(lang);
              const filename = `code${ext}`;

              if (!codeExecution.selectedRepo) {
                codeExecution.setShowRepoSelector(true);
                return;
              }

              await codeExecution.pushToGitHub(code, filename);
            }}
          />
        );
      }

      // Default block code rendering (no actions)
      return (
        <div className="rounded-lg overflow-hidden my-2" style={{ backgroundColor: 'var(--glass-bg)' }}>
          {language && (
            <div
              className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium border-b"
              style={{
                backgroundColor: 'rgba(59, 130, 246, 0.1)',
                borderColor: 'var(--border)',
                color: 'var(--text-muted)'
              }}
            >
              <span>{getDisplayLanguage(language)}</span>
            </div>
          )}
          <code
            className="block p-3 text-sm font-mono overflow-x-auto"
            style={{ color: 'var(--text-primary)' }}
          >
            {children}
          </code>
        </div>
      );
    },
  };

  return (
    <div className="markdown-content" style={{ color: 'inherit' }}>
      <ReactMarkdown components={componentsWithActions}>
        {processedContent}
      </ReactMarkdown>
    </div>
  );
}

// Helper to get file extension from language
function getExtensionForLanguage(lang: string): string {
  const map: Record<string, string> = {
    javascript: '.js',
    js: '.js',
    typescript: '.ts',
    ts: '.ts',
    jsx: '.jsx',
    tsx: '.tsx',
    python: '.py',
    py: '.py',
    html: '.html',
    css: '.css',
    json: '.json',
    bash: '.sh',
    sh: '.sh',
    sql: '.sql',
  };
  return map[lang.toLowerCase()] || '.txt';
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
  };
  return map[lang.toLowerCase()] || lang.toUpperCase();
}
