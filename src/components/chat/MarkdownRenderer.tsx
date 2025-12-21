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
    // Debug: log all links
    console.log('[MarkdownRenderer] Link rendered: href=' + href + ', isDoc=' + (href && (href.includes('/api/documents/') || href.includes('.pdf'))));

    // SAFETY: If href is empty or invalid, render as plain text (prevents navigation crash)
    if (!href || href === '' || href === '#') {
      console.warn('[MarkdownRenderer] Empty or invalid href detected, rendering as text');
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
            console.log('[MarkdownRenderer] Decoded token:', decoded);
            return { type: decoded.t, filename: decoded.f };
          }
        } catch (e) {
          console.warn('[MarkdownRenderer] Failed to decode token:', e);
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
          console.error('[MarkdownRenderer] No href for download');
          return;
        }

        const filename = getFilename();
        const { mimeType } = getFileInfo();

        console.log('[MarkdownRenderer] Starting download:', { href, filename, mimeType, tokenInfo });

        try {
          // Fetch the file first
          const response = await fetch(href, { credentials: 'include' });

          if (!response.ok) {
            console.error('[MarkdownRenderer] Download response not ok:', response.status, response.statusText);
            // Try opening in new tab as fallback
            window.open(href, '_blank', 'noopener,noreferrer');
            return;
          }

          const blob = await response.blob();
          console.log('[MarkdownRenderer] Blob received:', blob.size, 'bytes');

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
          console.error('[MarkdownRenderer] Download error:', error);
          // Ultimate fallback - open in new tab (don't throw!)
          try {
            window.open(href, '_blank', 'noopener,noreferrer');
          } catch (openError) {
            console.error('[MarkdownRenderer] Could not open window:', openError);
            // Show user-friendly message
            alert('Download failed. Please try generating the document again.');
          }
        }
      };

      console.log('[MarkdownRenderer] Rendering download BUTTON for:', href);

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
    console.log('[MarkdownRenderer] Rendering regular LINK (not document) for:', href);

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
