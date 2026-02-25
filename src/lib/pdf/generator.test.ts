/**
 * PDF GENERATOR TESTS
 *
 * Tests for PDF generation utility functions:
 * - removeHelperText (internal via stripMarkdown)
 * - stripMarkdown (internal via generateMessagePDF)
 * - wrapText (internal via generateMessagePDF)
 * - extractTitle (internal via generateMessagePDF)
 * - generateMessagePDF (exported)
 *
 * Since the internal functions are not exported, we test them
 * indirectly through generateMessagePDF and also test the jsPDF mock.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ============================================================================
// MOCKS — All defined INSIDE factories (hoisting-safe)
// ============================================================================

vi.mock('jspdf', () => {
  const mockSave = vi.fn();
  const mockText = vi.fn();
  const mockSetFont = vi.fn();
  const mockSetFontSize = vi.fn();
  const mockSetTextColor = vi.fn();
  const mockAddPage = vi.fn();
  const mockGetTextWidth = vi.fn(() => 50);

  return {
    jsPDF: vi.fn(() => ({
      internal: {
        pageSize: {
          getWidth: () => 210,
          getHeight: () => 297,
        },
      },
      save: mockSave,
      text: mockText,
      setFont: mockSetFont,
      setFontSize: mockSetFontSize,
      setTextColor: mockSetTextColor,
      addPage: mockAddPage,
      getTextWidth: mockGetTextWidth,
    })),
  };
});

// ============================================================================
// TESTS
// ============================================================================

describe('generateMessagePDF', () => {
  let generateMessagePDF: typeof import('./generator').generateMessagePDF;

  beforeEach(async () => {
    vi.clearAllMocks();
    const mod = await import('./generator');
    generateMessagePDF = mod.generateMessagePDF;
  });

  it('should be a function', () => {
    expect(typeof generateMessagePDF).toBe('function');
  });

  it('should generate a PDF for a simple message', async () => {
    const message = {
      id: 'msg-1',
      role: 'assistant' as const,
      content: 'Hello, this is a test document.',
      timestamp: new Date(),
    };

    await generateMessagePDF(message);

    const { jsPDF } = await import('jspdf');
    const mockInstance = vi.mocked(jsPDF).mock.results[0]?.value;
    expect(mockInstance.save).toHaveBeenCalled();
  });

  it('should create an A4 PDF document', async () => {
    const message = {
      id: 'msg-2',
      role: 'assistant' as const,
      content: 'Test content',
      timestamp: new Date(),
    };

    await generateMessagePDF(message);

    const { jsPDF } = await import('jspdf');
    expect(jsPDF).toHaveBeenCalledWith({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });
  });

  it('should set professional font styling', async () => {
    const message = {
      id: 'msg-3',
      role: 'assistant' as const,
      content: 'Professional document',
      timestamp: new Date(),
    };

    await generateMessagePDF(message);

    const { jsPDF } = await import('jspdf');
    const mockInstance = vi.mocked(jsPDF).mock.results[0]?.value;
    expect(mockInstance.setFont).toHaveBeenCalledWith('helvetica', 'normal');
    expect(mockInstance.setFontSize).toHaveBeenCalledWith(11);
    expect(mockInstance.setTextColor).toHaveBeenCalledWith(30, 30, 30);
  });

  it('should strip markdown bold formatting from content', async () => {
    const message = {
      id: 'msg-4',
      role: 'assistant' as const,
      content: '**Bold text** here',
      timestamp: new Date(),
    };

    await generateMessagePDF(message);

    const { jsPDF } = await import('jspdf');
    const mockInstance = vi.mocked(jsPDF).mock.results[0]?.value;
    const textCalls = mockInstance.text.mock.calls;
    const allText = textCalls.map((c: unknown[]) => c[0]).join(' ');
    expect(allText).toContain('Bold text');
    expect(allText).not.toContain('**');
  });

  it('should strip markdown italic formatting', async () => {
    const message = {
      id: 'msg-5',
      role: 'assistant' as const,
      content: '*italic text* here',
      timestamp: new Date(),
    };

    await generateMessagePDF(message);

    const { jsPDF } = await import('jspdf');
    const mockInstance = vi.mocked(jsPDF).mock.results[0]?.value;
    const textCalls = mockInstance.text.mock.calls;
    const allText = textCalls.map((c: unknown[]) => c[0]).join(' ');
    expect(allText).toContain('italic text');
  });

  it('should strip markdown header markers', async () => {
    const message = {
      id: 'msg-6',
      role: 'assistant' as const,
      content: '# Header One\n## Header Two',
      timestamp: new Date(),
    };

    await generateMessagePDF(message);

    const { jsPDF } = await import('jspdf');
    const mockInstance = vi.mocked(jsPDF).mock.results[0]?.value;
    const textCalls = mockInstance.text.mock.calls;
    const allText = textCalls.map((c: unknown[]) => c[0]).join(' ');
    expect(allText).toContain('Header One');
    expect(allText).not.toContain('# ');
  });

  it('should strip inline code backticks', async () => {
    const message = {
      id: 'msg-7',
      role: 'assistant' as const,
      content: 'Use `console.log` for debugging',
      timestamp: new Date(),
    };

    await generateMessagePDF(message);

    const { jsPDF } = await import('jspdf');
    const mockInstance = vi.mocked(jsPDF).mock.results[0]?.value;
    const textCalls = mockInstance.text.mock.calls;
    const allText = textCalls.map((c: unknown[]) => c[0]).join(' ');
    expect(allText).toContain('console.log');
    expect(allText).not.toContain('`');
  });

  it('should remove helper text like "Let me know if"', async () => {
    const message = {
      id: 'msg-8',
      role: 'assistant' as const,
      content: 'Here is your document content.\n\nLet me know if you need changes.',
      timestamp: new Date(),
    };

    await generateMessagePDF(message);

    const { jsPDF } = await import('jspdf');
    const mockInstance = vi.mocked(jsPDF).mock.results[0]?.value;
    const textCalls = mockInstance.text.mock.calls;
    const allText = textCalls.map((c: unknown[]) => c[0]).join(' ');
    expect(allText).not.toContain('Let me know if');
  });

  it('should remove "Feel free to" helper text', async () => {
    const message = {
      id: 'msg-9',
      role: 'assistant' as const,
      content: 'Document content here.\n\nFeel free to modify as needed.',
      timestamp: new Date(),
    };

    await generateMessagePDF(message);

    const { jsPDF } = await import('jspdf');
    const mockInstance = vi.mocked(jsPDF).mock.results[0]?.value;
    const textCalls = mockInstance.text.mock.calls;
    const allText = textCalls.map((c: unknown[]) => c[0]).join(' ');
    expect(allText).not.toContain('Feel free to');
  });

  it('should remove "Would you like me to" helper text', async () => {
    const message = {
      id: 'msg-10',
      role: 'assistant' as const,
      content: 'Here is your resume.\n\nWould you like me to adjust anything?',
      timestamp: new Date(),
    };

    await generateMessagePDF(message);

    const { jsPDF } = await import('jspdf');
    const mockInstance = vi.mocked(jsPDF).mock.results[0]?.value;
    const textCalls = mockInstance.text.mock.calls;
    const allText = textCalls.map((c: unknown[]) => c[0]).join(' ');
    expect(allText).not.toContain('Would you like me to');
  });

  it('should generate filename with title from markdown header', async () => {
    const message = {
      id: 'msg-11',
      role: 'assistant' as const,
      content: '# My Resume\n\nJohn Doe\nSoftware Engineer',
      timestamp: new Date(),
    };

    await generateMessagePDF(message);

    const { jsPDF } = await import('jspdf');
    const mockInstance = vi.mocked(jsPDF).mock.results[0]?.value;
    const saveCall = mockInstance.save.mock.calls[0][0] as string;
    expect(saveCall).toContain('my-resume');
    expect(saveCall).toMatch(/\.pdf$/);
  });

  it('should generate filename with date stamp', async () => {
    const message = {
      id: 'msg-12',
      role: 'assistant' as const,
      content: '# Report',
      timestamp: new Date(),
    };

    await generateMessagePDF(message);

    const { jsPDF } = await import('jspdf');
    const mockInstance = vi.mocked(jsPDF).mock.results[0]?.value;
    const saveCall = mockInstance.save.mock.calls[0][0] as string;
    // Should contain ISO date like 2026-02-25
    expect(saveCall).toMatch(/\d{4}-\d{2}-\d{2}\.pdf$/);
  });

  it('should extract title from Cover Letter keyword', async () => {
    const message = {
      id: 'msg-13',
      role: 'assistant' as const,
      content: 'Cover Letter for Software Position\n\nDear Hiring Manager,',
      timestamp: new Date(),
    };

    await generateMessagePDF(message);

    const { jsPDF } = await import('jspdf');
    const mockInstance = vi.mocked(jsPDF).mock.results[0]?.value;
    const saveCall = mockInstance.save.mock.calls[0][0] as string;
    expect(saveCall).toContain('cover-letter');
  });

  it('should extract title from Resume keyword', async () => {
    const message = {
      id: 'msg-14',
      role: 'assistant' as const,
      content: 'Resume\n\nJohn Doe',
      timestamp: new Date(),
    };

    await generateMessagePDF(message);

    const { jsPDF } = await import('jspdf');
    const mockInstance = vi.mocked(jsPDF).mock.results[0]?.value;
    const saveCall = mockInstance.save.mock.calls[0][0] as string;
    expect(saveCall).toContain('resume');
  });

  it('should fallback to first line for title when no patterns match', async () => {
    const message = {
      id: 'msg-15',
      role: 'assistant' as const,
      content: 'Some random content without a clear title.\nSecond line.',
      timestamp: new Date(),
    };

    await generateMessagePDF(message);

    const { jsPDF } = await import('jspdf');
    const mockInstance = vi.mocked(jsPDF).mock.results[0]?.value;
    const saveCall = mockInstance.save.mock.calls[0][0] as string;
    expect(saveCall).toMatch(/\.pdf$/);
    expect(saveCall.length).toBeGreaterThan(5);
  });

  it('should strip markdown links but keep text', async () => {
    const message = {
      id: 'msg-16',
      role: 'assistant' as const,
      content: 'Check out [this link](https://example.com) for more.',
      timestamp: new Date(),
    };

    await generateMessagePDF(message);

    const { jsPDF } = await import('jspdf');
    const mockInstance = vi.mocked(jsPDF).mock.results[0]?.value;
    const textCalls = mockInstance.text.mock.calls;
    const allText = textCalls.map((c: unknown[]) => c[0]).join(' ');
    expect(allText).toContain('this link');
    expect(allText).not.toContain('https://example.com');
  });

  it('should handle code blocks by keeping content', async () => {
    const message = {
      id: 'msg-17',
      role: 'assistant' as const,
      content: '```javascript\nconsole.log("hello")\n```',
      timestamp: new Date(),
    };

    await generateMessagePDF(message);

    const { jsPDF } = await import('jspdf');
    const mockInstance = vi.mocked(jsPDF).mock.results[0]?.value;
    const textCalls = mockInstance.text.mock.calls;
    const allText = textCalls.map((c: unknown[]) => c[0]).join(' ');
    expect(allText).toContain('console.log');
    expect(allText).not.toContain('```');
  });

  it('should convert bullet points to bullet character', async () => {
    const message = {
      id: 'msg-18',
      role: 'assistant' as const,
      content: '- Item one\n- Item two\n- Item three',
      timestamp: new Date(),
    };

    await generateMessagePDF(message);

    const { jsPDF } = await import('jspdf');
    const mockInstance = vi.mocked(jsPDF).mock.results[0]?.value;
    expect(mockInstance.text).toHaveBeenCalled();
  });

  it('should strip blockquote markers', async () => {
    const message = {
      id: 'msg-19',
      role: 'assistant' as const,
      content: '> This is a quote\n> Second line of quote',
      timestamp: new Date(),
    };

    await generateMessagePDF(message);

    const { jsPDF } = await import('jspdf');
    const mockInstance = vi.mocked(jsPDF).mock.results[0]?.value;
    const textCalls = mockInstance.text.mock.calls;
    const allText = textCalls.map((c: unknown[]) => c[0]).join(' ');
    expect(allText).toContain('This is a quote');
    expect(allText).not.toContain('> ');
  });

  it('should handle empty content', async () => {
    const message = {
      id: 'msg-20',
      role: 'assistant' as const,
      content: '',
      timestamp: new Date(),
    };

    await generateMessagePDF(message);

    const { jsPDF } = await import('jspdf');
    const mockInstance = vi.mocked(jsPDF).mock.results[0]?.value;
    expect(mockInstance.save).toHaveBeenCalled();
  });

  it('should remove "I hope this helps" helper text', async () => {
    const message = {
      id: 'msg-21',
      role: 'assistant' as const,
      content: 'Main content here.\n\nI hope this helps with your project.',
      timestamp: new Date(),
    };

    await generateMessagePDF(message);

    const { jsPDF } = await import('jspdf');
    const mockInstance = vi.mocked(jsPDF).mock.results[0]?.value;
    const textCalls = mockInstance.text.mock.calls;
    const allText = textCalls.map((c: unknown[]) => c[0]).join(' ');
    expect(allText).not.toContain('I hope this helps');
  });

  it('should remove "Is there anything else" helper text', async () => {
    const message = {
      id: 'msg-22',
      role: 'assistant' as const,
      content: 'Document body.\n\nIs there anything else you need?',
      timestamp: new Date(),
    };

    await generateMessagePDF(message);

    const { jsPDF } = await import('jspdf');
    const mockInstance = vi.mocked(jsPDF).mock.results[0]?.value;
    const textCalls = mockInstance.text.mock.calls;
    const allText = textCalls.map((c: unknown[]) => c[0]).join(' ');
    expect(allText).not.toContain('Is there anything else');
  });

  it('should handle multiline content with proper text calls', async () => {
    const message = {
      id: 'msg-23',
      role: 'assistant' as const,
      content: 'Line one\n\nLine two\n\nLine three',
      timestamp: new Date(),
    };

    await generateMessagePDF(message);

    const { jsPDF } = await import('jspdf');
    const mockInstance = vi.mocked(jsPDF).mock.results[0]?.value;
    // Each line or wrapped segment produces a text call
    expect(mockInstance.text.mock.calls.length).toBeGreaterThanOrEqual(3);
  });

  it('should strip underscore formatting', async () => {
    const message = {
      id: 'msg-24',
      role: 'assistant' as const,
      content: '__bold text__ and _italic text_ here',
      timestamp: new Date(),
    };

    await generateMessagePDF(message);

    const { jsPDF } = await import('jspdf');
    const mockInstance = vi.mocked(jsPDF).mock.results[0]?.value;
    const textCalls = mockInstance.text.mock.calls;
    const allText = textCalls.map((c: unknown[]) => c[0]).join(' ');
    expect(allText).toContain('bold text');
    expect(allText).toContain('italic text');
  });

  it('should use bold font for header-like lines (all caps)', async () => {
    const message = {
      id: 'msg-25',
      role: 'assistant' as const,
      content: 'EXPERIENCE\nSoftware Engineer at Acme Corp',
      timestamp: new Date(),
    };

    await generateMessagePDF(message);

    const { jsPDF } = await import('jspdf');
    const mockInstance = vi.mocked(jsPDF).mock.results[0]?.value;
    // Should set bold for the EXPERIENCE line
    expect(mockInstance.setFont).toHaveBeenCalledWith('helvetica', 'bold');
    expect(mockInstance.setFontSize).toHaveBeenCalledWith(12);
  });
});
