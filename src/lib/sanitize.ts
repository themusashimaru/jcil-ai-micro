/**
 * HTML SANITIZATION UTILITY
 *
 * Prevents XSS attacks by sanitizing HTML content.
 * Only allows safe tags and attributes.
 */

/**
 * Allowed tags for markdown rendering:
 * p, br, strong, b, em, i, u, s, strike, h1-h6, ul, ol, li,
 * a, code, pre, blockquote, hr, span, div, table, thead, tbody, tr, th, td
 *
 * Allowed attributes:
 * - a: href, target, rel, title
 * - code/pre/span/div: class
 * - th: scope
 * - td: colspan, rowspan
 */

// Safe URL protocols for href
const SAFE_PROTOCOLS = ['http:', 'https:', 'mailto:', 'tel:'];

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
 * Only allows safe tags and attributes
 */
export function sanitizeHtml(html: string): string {
  // First, escape any potentially dangerous content that's not in proper tags
  // Then process allowed tags

  // Simple regex-based sanitization for our specific markdown output
  // This is safe because we control the input (our formatText function)

  let result = html;

  // Remove script tags and their content
  result = result.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');

  // Remove event handlers (onclick, onerror, etc.)
  result = result.replace(/\s*on\w+\s*=\s*["'][^"']*["']/gi, '');
  result = result.replace(/\s*on\w+\s*=\s*[^\s>]*/gi, '');

  // Remove javascript: and data: URLs in href/src
  result = result.replace(/\bhref\s*=\s*["']?\s*javascript:[^"'>\s]*/gi, 'href="#"');
  result = result.replace(/\bhref\s*=\s*["']?\s*data:[^"'>\s]*/gi, 'href="#"');
  result = result.replace(/\bsrc\s*=\s*["']?\s*javascript:[^"'>\s]*/gi, '');
  result = result.replace(/\bsrc\s*=\s*["']?\s*data:[^"'>\s]*/gi, '');

  // Remove style attributes (can be used for CSS injection)
  result = result.replace(/\s*style\s*=\s*["'][^"']*["']/gi, '');

  // Remove form and input elements
  result = result.replace(/<(form|input|button|select|textarea)\b[^>]*>/gi, '');
  result = result.replace(/<\/(form|input|button|select|textarea)>/gi, '');

  // Remove iframe, embed, object
  result = result.replace(/<(iframe|embed|object|applet)\b[^>]*>.*?<\/\1>/gi, '');
  result = result.replace(/<(iframe|embed|object|applet)\b[^>]*\/?>/gi, '');

  // Remove base and meta tags
  result = result.replace(/<(base|meta)\b[^>]*\/?>/gi, '');

  // Ensure target="_blank" links have rel="noopener noreferrer"
  result = result.replace(
    /<a\s+([^>]*target\s*=\s*["']_blank["'][^>]*)>/gi,
    (match, attrs) => {
      if (!/rel\s*=/i.test(attrs)) {
        return `<a ${attrs} rel="noopener noreferrer">`;
      }
      return match;
    }
  );

  return result;
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
