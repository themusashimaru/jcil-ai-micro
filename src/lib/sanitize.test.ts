/**
 * SANITIZATION UTILITY TESTS
 *
 * Critical path tests for XSS prevention
 * These protect against cross-site scripting attacks
 */

import { describe, it, expect } from 'vitest';
import { escapeHtml, sanitizeUrl } from './sanitize';

describe('escapeHtml', () => {
  it('escapes HTML special characters', () => {
    expect(escapeHtml('<script>alert("xss")</script>')).toBe(
      '&lt;script&gt;alert(&quot;xss&quot;)&lt;&#x2F;script&gt;'
    );
  });

  it('escapes ampersands', () => {
    expect(escapeHtml('foo & bar')).toBe('foo &amp; bar');
  });

  it('escapes quotes', () => {
    expect(escapeHtml('value="test"')).toBe('value&#x3D;&quot;test&quot;');
    expect(escapeHtml("value='test'")).toBe("value&#x3D;&#x27;test&#x27;");
  });

  it('escapes backticks (template literals)', () => {
    expect(escapeHtml('`${code}`')).toBe('&#x60;${code}&#x60;');
  });

  it('handles empty strings', () => {
    expect(escapeHtml('')).toBe('');
  });

  it('preserves safe text', () => {
    expect(escapeHtml('Hello World!')).toBe('Hello World!');
    expect(escapeHtml('Numbers: 123')).toBe('Numbers: 123');
  });

  it('neutralizes XSS via event handlers by escaping', () => {
    const malicious = '<img src=x onerror="alert(1)">';
    const escaped = escapeHtml(malicious);
    // Angle brackets are escaped so it can't be parsed as HTML
    expect(escaped).toContain('&lt;img');
    expect(escaped).toContain('&gt;');
    // The string is safe as text, not executable HTML
    expect(escaped).not.toContain('<img');
    expect(escaped).not.toContain('>');
  });

  it('neutralizes XSS via javascript: URLs by escaping', () => {
    const malicious = '<a href="javascript:alert(1)">click</a>';
    const escaped = escapeHtml(malicious);
    // Angle brackets and quotes are escaped
    expect(escaped).toContain('&lt;a');
    expect(escaped).toContain('&quot;');
    // The string is safe as text, not executable HTML
    expect(escaped).not.toContain('<a');
  });
});

describe('sanitizeUrl', () => {
  it('allows http URLs', () => {
    expect(sanitizeUrl('http://example.com')).toBe('http://example.com');
  });

  it('allows https URLs', () => {
    expect(sanitizeUrl('https://example.com/path')).toBe('https://example.com/path');
  });

  it('allows mailto URLs', () => {
    expect(sanitizeUrl('mailto:test@example.com')).toBe('mailto:test@example.com');
  });

  it('allows tel URLs', () => {
    expect(sanitizeUrl('tel:+1234567890')).toBe('tel:+1234567890');
  });

  it('allows relative URLs', () => {
    expect(sanitizeUrl('/page')).toBe('/page');
    expect(sanitizeUrl('./relative')).toBe('./relative');
    expect(sanitizeUrl('#anchor')).toBe('#anchor');
  });

  it('blocks javascript: URLs', () => {
    expect(sanitizeUrl('javascript:alert(1)')).toBe('#');
    expect(sanitizeUrl('JAVASCRIPT:alert(1)')).toBe('#');
    expect(sanitizeUrl('  javascript:alert(1)')).toBe('#');
  });

  it('blocks data: URLs', () => {
    expect(sanitizeUrl('data:text/html,<script>alert(1)</script>')).toBe('#');
  });

  it('blocks vbscript: URLs', () => {
    expect(sanitizeUrl('vbscript:msgbox(1)')).toBe('#');
  });
});
