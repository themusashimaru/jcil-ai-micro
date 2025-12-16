/**
 * MARKDOWN RENDERER COMPONENT
 *
 * PURPOSE:
 * - Render markdown content with proper formatting
 * - Styled for dark glassmorphism theme
 * - Handles headers, bold, italic, lists, code, links
 * - Auto-linkifies plain URLs that aren't in markdown format
 *
 * USAGE:
 * - <MarkdownRenderer content={message.content} />
 */

'use client';

import ReactMarkdown from 'react-markdown';
import type { Components } from 'react-markdown';

interface MarkdownRendererProps {
  content: string;
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
    const isDocumentLink = href && (
      href.includes('/api/documents/') ||
      href.includes('.pdf') ||
      href.includes('.docx') ||
      href.includes('.xlsx')
    );

    if (isDocumentLink) {
      // Force download for documents (prevents opening in system viewer on mobile)
      const handleDownload = async (e: React.MouseEvent) => {
        e.preventDefault();
        if (!href) return;

        try {
          const response = await fetch(href);
          const blob = await response.blob();
          const url = window.URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          // Extract filename from URL or use default
          const filename = href.split('/').pop()?.split('?')[0] || 'download';
          link.download = filename;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          window.URL.revokeObjectURL(url);
        } catch {
          // Fallback: open in new tab
          window.open(href, '_blank');
        }
      };

      return (
        <button
          onClick={handleDownload}
          className="inline-flex items-center gap-1 underline cursor-pointer hover:opacity-80"
          style={{ color: 'var(--primary)' }}
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          {children}
        </button>
      );
    }

    // Regular links open in new tab
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

  // Code blocks - use theme-aware backgrounds
  code: ({ className, children }) => {
    const isInline = !className;
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
    // Block code
    return (
      <code
        className="block p-3 rounded-lg text-sm font-mono overflow-x-auto my-2"
        style={{ backgroundColor: 'var(--glass-bg)', color: 'var(--primary)' }}
      >
        {children}
      </code>
    );
  },
  pre: ({ children }) => (
    <pre className="rounded-lg overflow-x-auto my-2" style={{ backgroundColor: 'var(--glass-bg)' }}>{children}</pre>
  ),

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

export function MarkdownRenderer({ content }: MarkdownRendererProps) {
  // Pre-process content to convert plain URLs to clickable markdown links
  const processedContent = autoLinkifyUrls(content);

  return (
    <div className="markdown-content" style={{ color: 'inherit' }}>
      <ReactMarkdown components={components}>
        {processedContent}
      </ReactMarkdown>
    </div>
  );
}
