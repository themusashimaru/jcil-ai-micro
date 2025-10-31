// /lib/sanitize.ts

import DOMPurify from 'isomorphic-dompurify';

/**
 * Sanitizes user input to prevent XSS attacks
 * Removes all HTML tags and dangerous content
 */
export function sanitizeInput(input: string): string {
  if (!input || typeof input !== 'string') {
    return '';
  }

  // Configure DOMPurify to be very strict
  const clean = DOMPurify.sanitize(input, {
    ALLOWED_TAGS: [], // No HTML tags allowed
    ALLOWED_ATTR: [], // No attributes allowed
    KEEP_CONTENT: true, // Keep text content
    RETURN_DOM: false,
    RETURN_DOM_FRAGMENT: false,
  });

  // Additional safety: trim and limit length
  return clean.trim();
}

/**
 * Sanitizes HTML content (for cases where you need to preserve some formatting)
 * Only allows safe tags like <b>, <i>, <p>, <br>
 */
export function sanitizeHTML(html: string): string {
  if (!html || typeof html !== 'string') {
    return '';
  }

  const clean = DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'p', 'br', 'ul', 'ol', 'li'],
    ALLOWED_ATTR: [],
    KEEP_CONTENT: true,
  });

  return clean.trim();
}

/**
 * Validates that a string doesn't contain suspicious patterns
 */
export function containsSuspiciousContent(input: string): boolean {
  if (!input || typeof input !== 'string') {
    return false;
  }

  // Check for common attack patterns
  const suspiciousPatterns = [
    /<script/i,
    /javascript:/i,
    /on\w+\s*=/i, // Event handlers like onclick=
    /<iframe/i,
    /<object/i,
    /<embed/i,
    /eval\(/i,
    /expression\(/i,
  ];

  return suspiciousPatterns.some(pattern => pattern.test(input));
}