/**
 * Tests for Word document generator
 *
 * Tests generateWordDocx and createLetterTemplate functions
 */

vi.mock('docx', () => {
  const mockPacker = {
    toBuffer: vi.fn().mockResolvedValue(Buffer.from('PK-mock-docx')),
  };

  class MockDocument {
    constructor(public options: Record<string, unknown>) {}
  }
  class MockParagraph {
    constructor(public options: Record<string, unknown>) {}
  }
  class MockTextRun {
    constructor(public options: Record<string, unknown>) {}
  }
  class MockTable {
    constructor(public options: Record<string, unknown>) {}
  }
  class MockTableRow {
    constructor(public options: Record<string, unknown>) {}
  }
  class MockTableCell {
    constructor(public options: Record<string, unknown>) {}
  }
  class MockPageBreak {}
  class MockHeader {
    constructor(public options: Record<string, unknown>) {}
  }
  class MockFooter {
    constructor(public options: Record<string, unknown>) {}
  }

  return {
    Document: MockDocument,
    Paragraph: MockParagraph,
    TextRun: MockTextRun,
    HeadingLevel: {
      HEADING_1: 'HEADING_1',
      HEADING_2: 'HEADING_2',
      HEADING_3: 'HEADING_3',
    },
    AlignmentType: {
      CENTER: 'CENTER',
      LEFT: 'LEFT',
      RIGHT: 'RIGHT',
      JUSTIFIED: 'JUSTIFIED',
    },
    Table: MockTable,
    TableRow: MockTableRow,
    TableCell: MockTableCell,
    WidthType: { PERCENTAGE: 'PERCENTAGE' },
    BorderStyle: { SINGLE: 'SINGLE' },
    Packer: mockPacker,
    PageBreak: MockPageBreak,
    Header: MockHeader,
    Footer: MockFooter,
  };
});

import { describe, it, expect, vi } from 'vitest';
import { generateWordDocx, createLetterTemplate } from './documentGenerator';
import type { WordDocument } from './types';

describe('generateWordDocx', () => {
  it('should generate a buffer from a basic document', async () => {
    const doc: WordDocument = {
      type: 'document',
      title: 'Test Document',
      sections: [{ type: 'paragraph', content: { text: 'Hello world' } }],
    };

    const buffer = await generateWordDocx(doc);
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(0);
  });

  it('should handle document with no sections', async () => {
    const doc: WordDocument = {
      type: 'document',
      title: 'Empty Doc',
      sections: [],
    };

    const buffer = await generateWordDocx(doc);
    expect(buffer).toBeInstanceOf(Buffer);
  });

  it('should handle paragraph sections with different styles', async () => {
    const styles = ['title', 'subtitle', 'heading1', 'heading2', 'heading3', 'normal'] as const;
    const doc: WordDocument = {
      type: 'document',
      title: 'Styled Doc',
      sections: styles.map((style) => ({
        type: 'paragraph' as const,
        content: { text: `Style: ${style}`, style },
      })),
    };

    const buffer = await generateWordDocx(doc);
    expect(buffer).toBeInstanceOf(Buffer);
  });

  it('should handle table sections', async () => {
    const doc: WordDocument = {
      type: 'document',
      title: 'Table Doc',
      sections: [
        {
          type: 'table',
          content: {
            headers: ['Name', 'Age'],
            rows: [
              ['Alice', '30'],
              ['Bob', '25'],
            ],
          },
        },
      ],
    };

    const buffer = await generateWordDocx(doc);
    expect(buffer).toBeInstanceOf(Buffer);
  });

  it('should handle table with custom header style', async () => {
    const doc: WordDocument = {
      type: 'document',
      title: 'Custom Table',
      sections: [
        {
          type: 'table',
          content: {
            headers: ['Col1'],
            rows: [['Data']],
            headerStyle: { bold: false, backgroundColor: '#ff0000' },
          },
        },
      ],
    };

    const buffer = await generateWordDocx(doc);
    expect(buffer).toBeInstanceOf(Buffer);
  });

  it('should handle pageBreak sections', async () => {
    const doc: WordDocument = {
      type: 'document',
      title: 'Paged Doc',
      sections: [
        { type: 'paragraph', content: { text: 'Page 1' } },
        { type: 'pageBreak' },
        { type: 'paragraph', content: { text: 'Page 2' } },
      ],
    };

    const buffer = await generateWordDocx(doc);
    expect(buffer).toBeInstanceOf(Buffer);
  });

  it('should handle horizontalRule sections', async () => {
    const doc: WordDocument = {
      type: 'document',
      title: 'HR Doc',
      sections: [
        { type: 'paragraph', content: { text: 'Before' } },
        { type: 'horizontalRule' },
        { type: 'paragraph', content: { text: 'After' } },
      ],
    };

    const buffer = await generateWordDocx(doc);
    expect(buffer).toBeInstanceOf(Buffer);
  });

  it('should use custom font and size from format', async () => {
    const doc: WordDocument = {
      type: 'document',
      title: 'Custom Format',
      sections: [{ type: 'paragraph', content: { text: 'Custom' } }],
      format: {
        fontFamily: 'Arial',
        fontSize: 14,
      },
    };

    const buffer = await generateWordDocx(doc);
    expect(buffer).toBeInstanceOf(Buffer);
  });

  it('should include header and footer when specified', async () => {
    const doc: WordDocument = {
      type: 'document',
      title: 'Headers Doc',
      sections: [{ type: 'paragraph', content: { text: 'Content' } }],
      format: {
        headerText: 'Confidential',
        footerText: 'Page Footer',
      },
    };

    const buffer = await generateWordDocx(doc);
    expect(buffer).toBeInstanceOf(Buffer);
  });

  it('should handle custom margins', async () => {
    const doc: WordDocument = {
      type: 'document',
      title: 'Margins Doc',
      sections: [{ type: 'paragraph', content: { text: 'Content' } }],
      format: {
        margins: { top: 720, bottom: 720, left: 1440, right: 1440 },
      },
    };

    const buffer = await generateWordDocx(doc);
    expect(buffer).toBeInstanceOf(Buffer);
  });

  it('should handle paragraph alignment options', async () => {
    const alignments = ['left', 'center', 'right', 'justify'] as const;
    const doc: WordDocument = {
      type: 'document',
      title: 'Aligned Doc',
      sections: alignments.map((alignment) => ({
        type: 'paragraph' as const,
        content: { text: `Alignment: ${alignment}`, alignment },
      })),
    };

    const buffer = await generateWordDocx(doc);
    expect(buffer).toBeInstanceOf(Buffer);
  });

  it('should handle paragraphs with bullet levels', async () => {
    const doc: WordDocument = {
      type: 'document',
      title: 'Bullets Doc',
      sections: [
        { type: 'paragraph', content: { text: 'Level 1', bulletLevel: 1 } },
        { type: 'paragraph', content: { text: 'Level 2', bulletLevel: 2 } },
      ],
    };

    const buffer = await generateWordDocx(doc);
    expect(buffer).toBeInstanceOf(Buffer);
  });

  it('should handle bold and italic paragraphs', async () => {
    const doc: WordDocument = {
      type: 'document',
      title: 'Formatted Doc',
      sections: [
        { type: 'paragraph', content: { text: 'Bold', bold: true } },
        { type: 'paragraph', content: { text: 'Italic', italic: true } },
        { type: 'paragraph', content: { text: 'Both', bold: true, italic: true } },
      ],
    };

    const buffer = await generateWordDocx(doc);
    expect(buffer).toBeInstanceOf(Buffer);
  });
});

describe('createLetterTemplate', () => {
  it('should create a letter document with all fields', () => {
    const letter = createLetterTemplate(
      'John Doe',
      ['123 Main St', 'New York, NY 10001'],
      'Jane Smith',
      ['456 Oak Ave', 'Boston, MA 02101'],
      'February 25, 2026',
      'Job Application',
      ['I am writing to apply for the position.', 'Thank you for your consideration.'],
      'Sincerely'
    );

    expect(letter.type).toBe('document');
    expect(letter.title).toBe('Letter - Job Application');
    expect(letter.sections.length).toBeGreaterThan(0);
    expect(letter.format?.fontFamily).toBe('Times New Roman');
    expect(letter.format?.fontSize).toBe(12);
  });

  it('should use default closing when not specified', () => {
    const letter = createLetterTemplate(
      'John Doe',
      ['123 Main St'],
      'Jane Smith',
      ['456 Oak Ave'],
      'Feb 2026',
      'Test Subject',
      ['Paragraph one.']
    );

    const closingSection = letter.sections.find(
      (s) =>
        s.content && 'text' in s.content && (s.content as { text: string }).text === 'Sincerely,'
    );
    expect(closingSection).toBeDefined();
  });

  it('should include sender name at the end', () => {
    const letter = createLetterTemplate(
      'Alice Johnson',
      ['1 Address'],
      'Bob',
      ['2 Address'],
      'Jan 2026',
      'Test',
      ['Body.']
    );

    const lastSection = letter.sections[letter.sections.length - 1];
    expect(lastSection.content).toBeDefined();
    expect((lastSection.content as { text: string }).text).toBe('Alice Johnson');
  });

  it('should include the subject line prefixed with "Re:"', () => {
    const letter = createLetterTemplate(
      'Sender',
      [],
      'Recipient',
      [],
      'Jan 2026',
      'Important Matter',
      ['Body text.']
    );

    const subjectSection = letter.sections.find(
      (s) =>
        s.content && 'text' in s.content && (s.content as { text: string }).text.startsWith('Re:')
    );
    expect(subjectSection).toBeDefined();
    expect((subjectSection!.content as { text: string }).text).toBe('Re: Important Matter');
  });

  it('should include body paragraphs with justify alignment', () => {
    const letter = createLetterTemplate('Sender', [], 'Recipient', [], 'Jan 2026', 'Subject', [
      'First paragraph.',
      'Second paragraph.',
    ]);

    const bodyParagraphs = letter.sections.filter(
      (s) =>
        s.content &&
        'alignment' in s.content &&
        (s.content as { alignment: string }).alignment === 'justify'
    );
    expect(bodyParagraphs).toHaveLength(2);
  });

  it('should include multiple sender address lines', () => {
    const senderAddress = ['Line 1', 'Line 2', 'Line 3'];
    const letter = createLetterTemplate(
      'Sender',
      senderAddress,
      'Recipient',
      [],
      'Jan 2026',
      'Subject',
      ['Body.']
    );

    // First N sections should be the sender address lines
    for (let i = 0; i < senderAddress.length; i++) {
      expect((letter.sections[i].content as { text: string }).text).toBe(senderAddress[i]);
    }
  });
});
