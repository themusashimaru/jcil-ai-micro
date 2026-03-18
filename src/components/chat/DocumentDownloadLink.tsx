'use client';

import type { ReactNode } from 'react';
import { logger } from '@/lib/logger';

const log = logger('DocumentDownloadLink');

/** Decode token from URL to get file info (token is base64url encoded JSON) */
function decodeTokenFromUrl(url: string): { type?: string; filename?: string } {
  try {
    const urlObj = new URL(url, window.location.origin);
    const token = urlObj.searchParams.get('token');
    if (token) {
      const base64 = token.replace(/-/g, '+').replace(/_/g, '/');
      const decoded = JSON.parse(atob(base64));
      return { type: decoded.t, filename: decoded.f };
    }
  } catch (e) {
    log.warn('Failed to decode token', { error: e });
  }
  return {};
}

function getFileInfo(
  tokenType?: string,
  href?: string
): { extension: string; mimeType: string } {
  const fileType = tokenType?.toLowerCase();

  if (fileType === 'pdf' || href?.includes('.pdf')) {
    return { extension: '.pdf', mimeType: 'application/pdf' };
  }
  if (fileType === 'docx' || href?.includes('.docx')) {
    return {
      extension: '.docx',
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    };
  }
  if (fileType === 'xlsx' || href?.includes('.xlsx')) {
    return {
      extension: '.xlsx',
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    };
  }
  return { extension: '.pdf', mimeType: 'application/pdf' };
}

function getFilename(
  tokenInfo: { type?: string; filename?: string },
  href: string,
  children: ReactNode
): string {
  if (tokenInfo.filename) return tokenInfo.filename;

  const { extension } = getFileInfo(tokenInfo.type, href);
  const urlPath = href?.split('/').pop()?.split('?')[0];
  if (urlPath && urlPath.includes('.')) return urlPath;

  const childText =
    typeof children === 'string'
      ? children
      : Array.isArray(children)
        ? children.join('')
        : 'document';
  const safeName =
    String(childText)
      .replace(/[^a-z0-9]/gi, '_')
      .toLowerCase() || 'document';
  return safeName + extension;
}

interface DocumentDownloadLinkProps {
  href: string;
  children: ReactNode;
}

export function DocumentDownloadLink({ href, children }: DocumentDownloadLinkProps) {
  const tokenInfo = decodeTokenFromUrl(href);
  const isMobile =
    typeof navigator !== 'undefined' && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

  const handleDownload = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!href) {
      log.error('No href for download');
      return;
    }

    const filename = getFilename(tokenInfo, href, children);
    const { mimeType } = getFileInfo(tokenInfo.type, href);

    try {
      const response = await fetch(href, { credentials: 'include' });

      if (!response.ok) {
        log.error('Download response not ok', {
          status: response.status,
          statusText: response.statusText,
        });
        window.open(href, '_blank', 'noopener,noreferrer');
        return;
      }

      const blob = await response.blob();

      if (isMobile && navigator.share && navigator.canShare) {
        const file = new File([blob], filename, { type: mimeType });
        const shareData = { files: [file] };

        if (navigator.canShare(shareData)) {
          await navigator.share(shareData);
          return;
        }
      }

      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = filename;
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();

      setTimeout(() => {
        document.body.removeChild(link);
        window.URL.revokeObjectURL(blobUrl);
      }, 100);
    } catch (error) {
      log.error('Download error', error as Error);
      try {
        window.open(href, '_blank', 'noopener,noreferrer');
      } catch (openError) {
        log.error('Could not open window', openError as Error);
        alert('Download failed. Please try generating the document again.');
      }
    }
  };

  return (
    <button
      onClick={handleDownload}
      className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md underline cursor-pointer hover:opacity-80 active:scale-95 transition-transform text-primary"
    >
      <svg
        className="h-4 w-4 flex-shrink-0"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
        />
      </svg>
      <span>{children}</span>
    </button>
  );
}
