/**
 * HTML SANITIZATION UTILITY
 *
 * Prevents XSS attacks by sanitizing HTML content.
 * Uses DOMPurify for robust, production-grade sanitization.
 */

import DOMPurify from 'dompurify';

// Safe URL protocols for href
const SAFE_PROTOCOLS = ['http:', 'https:', 'mailto:', 'tel:'];

// DOMPurify configuration for markdown content
const DOMPURIFY_CONFIG = {
  // Allowed tags for markdown rendering
  ALLOWED_TAGS: [
    'p', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'strike',
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'ul', 'ol', 'li',
    'a', 'code', 'pre', 'blockquote', 'hr',
    'span', 'div',
    'table', 'thead', 'tbody', 'tr', 'th', 'td',
    'img', 'sup', 'sub',
  ],
  // Allowed attributes
  ALLOWED_ATTR: [
    'href', 'target', 'rel', 'title',
    'class', 'id',
    'scope', 'colspan', 'rowspan',
    'src', 'alt', 'width', 'height',
  ],
  // Force target="_blank" links to have rel="noopener noreferrer"
  ADD_ATTR: ['target'],
  // Return string instead of TrustedHTML
  RETURN_TRUSTED_TYPE: false,
};

/**
 * Escape HTML special characters
 */
export function escapeHtml(text: string): string {
  const escapeMap: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;',
    '/': '&#x2F;',
    '`': '&#x60;',
    '=': '&#x3D;',
  };

  return text.replace(/[&<>"'`=/]/g, char => escapeMap[char] || char);
}

/**
 * Check if a URL is safe (no javascript: or data: protocols)
 */
function isSafeUrl(url: string): boolean {
  try {
    const parsed = new URL(url, 'https://example.com');
    return SAFE_PROTOCOLS.includes(parsed.protocol);
  } catch {
    // Relative URLs are safe
    return url.startsWith('/') || url.startsWith('#') || url.startsWith('./');
  }
}

/**
 * Sanitize HTML content to prevent XSS
 * Uses DOMPurify for robust protection against all XSS vectors
 */
export function sanitizeHtml(html: string): string {
  // Use DOMPurify for production-grade sanitization
  const clean = DOMPurify.sanitize(html, DOMPURIFY_CONFIG) as string;

  // Add rel="noopener noreferrer" to target="_blank" links
  return clean.replace(
    /<a\s+([^>]*target\s*=\s*["']_blank["'][^>]*)>/gi,
    (match: string, attrs: string) => {
      if (!/rel\s*=/i.test(attrs)) {
        return `<a ${attrs} rel="noopener noreferrer">`;
      }
      return match;
    }
  );
}

/**
 * Convert plain text to safe HTML (escapes everything)
 */
export function textToSafeHtml(text: string): string {
  return escapeHtml(text)
    .replace(/\n/g, '<br>')
    .replace(/  /g, '&nbsp;&nbsp;');
}

/**
 * Sanitize and validate a URL
 */
export function sanitizeUrl(url: string): string {
  if (!isSafeUrl(url)) {
    return '#';
  }
  return url;
}
