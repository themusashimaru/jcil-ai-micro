/**
 * Tests for General PDF Generator
 *
 * Tests generateGeneralPdf with mocked PDFKit
 */

vi.mock('pdfkit', () => {
  // Minimal EventEmitter replacement to avoid require()
  class SimpleEmitter {
    private _listeners: Record<string, Array<(...args: unknown[]) => void>> = {};
    on(event: string, fn: (...args: unknown[]) => void) {
      (this._listeners[event] ??= []).push(fn);
      return this;
    }
    emit(event: string, ...args: unknown[]) {
      this._listeners[event]?.forEach((fn) => fn(...args));
      return true;
    }
  }

  class MockPDFDocument extends SimpleEmitter {
    page = {
      width: 612,
      height: 792,
    };
    y = 72;

    constructor(public options?: Record<string, unknown>) {
      super();
    }
    font() {
      return this;
    }
    fontSize(size: number) {
      this.y += size;
      return this;
    }
    fillColor() {
      return this;
    }
    strokeColor() {
      return this;
    }
    lineWidth() {
      return this;
    }
    text(_text: string, _x?: number, _y?: number, _opts?: unknown) {
      return this;
    }
    moveDown(n: number = 1) {
      this.y += n * 12;
      return this;
    }
    moveUp(n: number = 1) {
      this.y -= n * 12;
      return this;
    }
    moveTo() {
      return this;
    }
    lineTo() {
      return this;
    }
    stroke() {
      return this;
    }
    rect() {
      return this;
    }
    fill() {
      return this;
    }
    addPage() {
      this.y = 72;
      return this;
    }
    end() {
      this.emit('data', Buffer.from('%PDF-mock'));
      this.emit('end');
    }
  }

  return { default: MockPDFDocument };
});

import { describe, it, expect, vi } from 'vitest';
import { generateGeneralPdf } from './generalPdfGenerator';
import type { GeneralPdfDocument } from './types';

describe('generateGeneralPdf', () => {
  it('should generate a PDF buffer from a basic document', async () => {
    const doc: GeneralPdfDocument = {
      type: 'general_pdf',
      title: 'Test PDF',
      sections: [{ type: 'paragraph', content: { text: 'Hello world' } }],
    };

    const buffer = await generateGeneralPdf(doc);
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(0);
  });

  it('should handle empty sections', async () => {
    const doc: GeneralPdfDocument = {
      type: 'general_pdf',
      title: 'Empty PDF',
      sections: [],
    };

    const buffer = await generateGeneralPdf(doc);
    expect(buffer).toBeInstanceOf(Buffer);
  });

  it('should handle paragraph sections with different styles', async () => {
    const styles = ['title', 'subtitle', 'heading1', 'heading2', 'heading3', 'normal'] as const;
    const doc: GeneralPdfDocument = {
      type: 'general_pdf',
      title: 'Styled PDF',
      sections: styles.map((style) => ({
        type: 'paragraph' as const,
        content: { text: `Style: ${style}`, style },
      })),
    };

    const buffer = await generateGeneralPdf(doc);
    expect(buffer).toBeInstanceOf(Buffer);
  });

  it('should handle table sections', async () => {
    const doc: GeneralPdfDocument = {
      type: 'general_pdf',
      title: 'Table PDF',
      sections: [
        {
          type: 'table',
          content: {
            headers: ['Name', 'Value'],
            rows: [
              ['Item 1', '100'],
              ['Item 2', '200'],
            ],
          },
        },
      ],
    };

    const buffer = await generateGeneralPdf(doc);
    expect(buffer).toBeInstanceOf(Buffer);
  });

  it('should handle table without headers', async () => {
    const doc: GeneralPdfDocument = {
      type: 'general_pdf',
      title: 'No-header Table',
      sections: [
        {
          type: 'table',
          content: {
            rows: [
              ['A', 'B'],
              ['C', 'D'],
            ],
          },
        },
      ],
    };

    const buffer = await generateGeneralPdf(doc);
    expect(buffer).toBeInstanceOf(Buffer);
  });

  it('should handle pageBreak sections', async () => {
    const doc: GeneralPdfDocument = {
      type: 'general_pdf',
      title: 'Paged PDF',
      sections: [
        { type: 'paragraph', content: { text: 'Page 1' } },
        { type: 'pageBreak' },
        { type: 'paragraph', content: { text: 'Page 2' } },
      ],
    };

    const buffer = await generateGeneralPdf(doc);
    expect(buffer).toBeInstanceOf(Buffer);
  });

  it('should handle horizontalRule sections', async () => {
    const doc: GeneralPdfDocument = {
      type: 'general_pdf',
      title: 'HR PDF',
      sections: [
        { type: 'paragraph', content: { text: 'Before' } },
        { type: 'horizontalRule' },
        { type: 'paragraph', content: { text: 'After' } },
      ],
    };

    const buffer = await generateGeneralPdf(doc);
    expect(buffer).toBeInstanceOf(Buffer);
  });

  it('should handle spacer sections', async () => {
    const doc: GeneralPdfDocument = {
      type: 'general_pdf',
      title: 'Spacer PDF',
      sections: [
        { type: 'paragraph', content: { text: 'Before' } },
        { type: 'spacer' },
        { type: 'paragraph', content: { text: 'After' } },
      ],
    };

    const buffer = await generateGeneralPdf(doc);
    expect(buffer).toBeInstanceOf(Buffer);
  });

  it('should use custom format options', async () => {
    const doc: GeneralPdfDocument = {
      type: 'general_pdf',
      title: 'Custom PDF',
      sections: [{ type: 'paragraph', content: { text: 'Custom styled' } }],
      format: {
        fontFamily: 'Times-Roman',
        fontSize: 14,
        margins: { top: 50, bottom: 50, left: 50, right: 50 },
        primaryColor: '#ff0000',
      },
    };

    const buffer = await generateGeneralPdf(doc);
    expect(buffer).toBeInstanceOf(Buffer);
  });

  it('should add footer when footerText is specified', async () => {
    const doc: GeneralPdfDocument = {
      type: 'general_pdf',
      title: 'Footer PDF',
      sections: [{ type: 'paragraph', content: { text: 'Content' } }],
      format: {
        footerText: 'Confidential - Page 1',
      },
    };

    const buffer = await generateGeneralPdf(doc);
    expect(buffer).toBeInstanceOf(Buffer);
  });

  it('should handle paragraphs with bullet levels', async () => {
    const doc: GeneralPdfDocument = {
      type: 'general_pdf',
      title: 'Bullets PDF',
      sections: [
        { type: 'paragraph', content: { text: 'Level 1', bulletLevel: 1 } },
        { type: 'paragraph', content: { text: 'Level 2', bulletLevel: 2 } },
        { type: 'paragraph', content: { text: 'Level 3', bulletLevel: 3 } },
      ],
    };

    const buffer = await generateGeneralPdf(doc);
    expect(buffer).toBeInstanceOf(Buffer);
  });

  it('should handle paragraphs with custom alignment', async () => {
    const doc: GeneralPdfDocument = {
      type: 'general_pdf',
      title: 'Aligned PDF',
      sections: [
        { type: 'paragraph', content: { text: 'Left', alignment: 'left' } },
        { type: 'paragraph', content: { text: 'Center', alignment: 'center' } },
        { type: 'paragraph', content: { text: 'Right', alignment: 'right' } },
        { type: 'paragraph', content: { text: 'Justify', alignment: 'justify' } },
      ],
    };

    const buffer = await generateGeneralPdf(doc);
    expect(buffer).toBeInstanceOf(Buffer);
  });

  it('should handle paragraphs with custom color', async () => {
    const doc: GeneralPdfDocument = {
      type: 'general_pdf',
      title: 'Colored PDF',
      sections: [{ type: 'paragraph', content: { text: 'Red text', color: '#ff0000' } }],
    };

    const buffer = await generateGeneralPdf(doc);
    expect(buffer).toBeInstanceOf(Buffer);
  });

  it('should handle table with custom header style', async () => {
    const doc: GeneralPdfDocument = {
      type: 'general_pdf',
      title: 'Custom Header Table',
      sections: [
        {
          type: 'table',
          content: {
            headers: ['Col1'],
            rows: [['Data']],
            headerStyle: {
              backgroundColor: '#ff0000',
              textColor: '#00ff00',
            },
          },
        },
      ],
    };

    const buffer = await generateGeneralPdf(doc);
    expect(buffer).toBeInstanceOf(Buffer);
  });
});
