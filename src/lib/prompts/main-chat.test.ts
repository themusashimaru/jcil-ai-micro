import { describe, it, expect } from 'vitest';
import { getCurrentDateFormatted, getMainChatSystemPrompt } from './main-chat';

// -------------------------------------------------------------------
// getCurrentDateFormatted
// -------------------------------------------------------------------
describe('getCurrentDateFormatted', () => {
  it('should return a non-empty string', () => {
    const result = getCurrentDateFormatted();
    expect(result.length).toBeGreaterThan(0);
  });

  it('should contain the current year', () => {
    const result = getCurrentDateFormatted();
    expect(result).toContain(new Date().getFullYear().toString());
  });

  it('should contain a weekday name', () => {
    const result = getCurrentDateFormatted();
    const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    expect(weekdays.some((d) => result.includes(d))).toBe(true);
  });

  it('should contain a month name', () => {
    const result = getCurrentDateFormatted();
    const months = [
      'January',
      'February',
      'March',
      'April',
      'May',
      'June',
      'July',
      'August',
      'September',
      'October',
      'November',
      'December',
    ];
    expect(months.some((m) => result.includes(m))).toBe(true);
  });
});

// -------------------------------------------------------------------
// getMainChatSystemPrompt
// -------------------------------------------------------------------
describe('getMainChatSystemPrompt', () => {
  it('should include JCIL AI identity', () => {
    const prompt = getMainChatSystemPrompt();
    expect(prompt).toContain('JCIL AI');
  });

  it('should include the date', () => {
    const prompt = getMainChatSystemPrompt('Monday, February 24, 2026');
    expect(prompt).toContain('Monday, February 24, 2026');
  });

  it('should use current date by default', () => {
    const prompt = getMainChatSystemPrompt();
    expect(prompt).toContain("TODAY'S DATE");
    expect(prompt).toContain(new Date().getFullYear().toString());
  });

  it('should include capabilities section', () => {
    const prompt = getMainChatSystemPrompt();
    expect(prompt).toContain('CAPABILITIES');
    expect(prompt).toContain('Web search');
    expect(prompt).toContain('Code review');
  });

  it('should include document generation info', () => {
    const prompt = getMainChatSystemPrompt();
    expect(prompt).toContain('DOCUMENT GENERATION');
    expect(prompt).toContain('Excel');
    expect(prompt).toContain('Word');
    expect(prompt).toContain('PDF');
  });

  it('should include core values', () => {
    const prompt = getMainChatSystemPrompt();
    expect(prompt).toContain('CORE VALUES');
    expect(prompt).toContain('accurate');
  });

  it('should include response guidelines', () => {
    const prompt = getMainChatSystemPrompt();
    expect(prompt).toContain('RESPONSE GUIDELINES');
    expect(prompt).toContain('Markdown');
  });

  it('should append memory context when provided', () => {
    const prompt = getMainChatSystemPrompt('today', 'MEMORY: Use TypeScript');
    expect(prompt).toContain('MEMORY: Use TypeScript');
  });

  it('should not append memory when not provided', () => {
    const prompt = getMainChatSystemPrompt('today');
    // Should end with the base prompt, no extra newlines
    expect(prompt).toContain('CORE VALUES');
    expect(prompt).not.toContain('undefined');
  });
});

// -------------------------------------------------------------------
// estimateBase64Size (from imageCompression)
// -------------------------------------------------------------------
// Note: imageCompression.ts uses browser APIs (Image, canvas, document)
// so we only test the pure utility function
describe('estimateBase64Size', () => {
  it('should be importable and calculate overhead', async () => {
    const { estimateBase64Size } = await import('../utils/imageCompression');
    // 1000 raw bytes = ~1370 base64 bytes
    expect(estimateBase64Size(1000)).toBeGreaterThan(1000);
    expect(estimateBase64Size(1000)).toBeLessThan(1500);
  });

  it('should return 0 for 0 bytes', async () => {
    const { estimateBase64Size } = await import('../utils/imageCompression');
    expect(estimateBase64Size(0)).toBe(0);
  });
});
