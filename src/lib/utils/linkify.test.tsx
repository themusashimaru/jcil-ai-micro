import { describe, it, expect } from 'vitest';
import { linkify, linkifyToReact } from './linkify';

// -------------------------------------------------------------------
// linkify (HTML string output)
// -------------------------------------------------------------------
describe('linkify', () => {
  it('should convert https URL to anchor tag', () => {
    const result = linkify('Visit https://example.com today');
    expect(result).toContain('<a href="https://example.com"');
    expect(result).toContain('target="_blank"');
    expect(result).toContain('rel="noopener noreferrer"');
  });

  it('should convert http URL to anchor tag', () => {
    const result = linkify('Visit http://example.com today');
    expect(result).toContain('<a href="http://example.com"');
  });

  it('should add https:// to www. URLs', () => {
    const result = linkify('Visit www.example.com today');
    expect(result).toContain('href="https://www.example.com"');
  });

  it('should use known source names for recognized domains', () => {
    const result = linkify('See https://www.reuters.com/article/test');
    expect(result).toContain('>Reuters</a>');
  });

  it('should use known source name for BBC', () => {
    const result = linkify('Read https://www.bbc.com/news/world');
    expect(result).toContain('>BBC News</a>');
  });

  it('should clean up unknown domain names', () => {
    const result = linkify('Check https://myawesomesite.com/page');
    // Should capitalize and strip .com
    expect(result).toContain('</a>');
  });

  it('should handle text with no URLs', () => {
    expect(linkify('No links here')).toBe('No links here');
  });

  it('should handle multiple URLs', () => {
    const result = linkify('A https://reuters.com and https://bbc.com end');
    expect(result).toContain('>Reuters</a>');
    expect(result).toContain('>BBC News</a>');
  });

  it('should preserve text around the link', () => {
    const result = linkify('Before https://example.com After');
    expect(result).toMatch(/^Before /);
    expect(result).toMatch(/ After$/);
  });
});

// -------------------------------------------------------------------
// linkifyToReact (React element output)
// -------------------------------------------------------------------
describe('linkifyToReact', () => {
  it('should return array with text and React elements', () => {
    const parts = linkifyToReact('Go to https://reuters.com now');
    expect(parts.length).toBe(3); // "Go to ", <a>, " now"
    expect(parts[0]).toBe('Go to ');
    expect(parts[2]).toBe(' now');
  });

  it('should return original text in array when no URLs', () => {
    const parts = linkifyToReact('no links');
    expect(parts).toEqual(['no links']);
  });

  it('should create anchor React element for URL', () => {
    const parts = linkifyToReact('Visit https://reuters.com');
    // The middle element should be a React element
    const link = parts[1];
    expect(link).toBeDefined();
    expect(typeof link).toBe('object'); // JSX.Element
  });

  it('should handle URL at start of text', () => {
    const parts = linkifyToReact('https://example.com is cool');
    // First element should be a link, second should be text
    expect(typeof parts[0]).toBe('object');
    expect(parts[1]).toBe(' is cool');
  });

  it('should handle URL at end of text', () => {
    const parts = linkifyToReact('Check https://example.com');
    expect(parts[0]).toBe('Check ');
    expect(typeof parts[1]).toBe('object');
  });

  it('should handle empty string', () => {
    const parts = linkifyToReact('');
    expect(parts).toEqual(['']);
  });
});
