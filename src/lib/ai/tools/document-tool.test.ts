import { describe, it, expect } from 'vitest';
import { executeDocument, isDocumentAvailable, documentTool } from './document-tool';

function makeCall(args: Record<string, unknown>) {
  return { id: 'test', name: 'create_document', arguments: args };
}

// -------------------------------------------------------------------
// Metadata
// -------------------------------------------------------------------
describe('documentTool metadata', () => {
  it('should have correct name', () => {
    expect(documentTool.name).toBe('create_document');
  });

  it('should require format, title, content', () => {
    expect(documentTool.parameters.required).toContain('format');
    expect(documentTool.parameters.required).toContain('title');
    expect(documentTool.parameters.required).toContain('content');
  });
});

describe('isDocumentAvailable', () => {
  it('should return true', () => {
    expect(isDocumentAvailable()).toBe(true);
  });
});

// -------------------------------------------------------------------
// TXT generation
// -------------------------------------------------------------------
describe('executeDocument - txt', () => {
  it('should generate a TXT document', async () => {
    const res = await executeDocument(
      makeCall({ format: 'txt', title: 'Test Doc', content: 'Hello world' })
    );
    expect(res.isError).toBeFalsy();
    expect(res.content).toContain('Test Doc');
    expect(res.content).toContain('TXT');
    expect(res.content).toContain('Test_Doc.txt');
    // Should contain data URL with base64
    expect(res.content).toContain('data:text/plain;base64,');
  });

  it('should include author in TXT', async () => {
    const res = await executeDocument(
      makeCall({ format: 'txt', title: 'My Report', content: 'Body text', author: 'Alice' })
    );
    expect(res.isError).toBeFalsy();
    // Decode the base64 content to verify author
    const match = res.content.match(/base64,([A-Za-z0-9+/=]+)/);
    expect(match).toBeTruthy();
    const decoded = Buffer.from(match![1], 'base64').toString('utf-8');
    expect(decoded).toContain('By Alice');
  });

  it('should handle sections in TXT', async () => {
    const res = await executeDocument(
      makeCall({
        format: 'txt',
        title: 'Sections Test',
        content: '',
        sections: [
          { heading: 'Intro', body: 'Introduction text' },
          { heading: 'Body', body: 'Main body' },
        ],
      })
    );
    expect(res.isError).toBeFalsy();
    const match = res.content.match(/base64,([A-Za-z0-9+/=]+)/);
    const decoded = Buffer.from(match![1], 'base64').toString('utf-8');
    expect(decoded).toContain('Intro');
    expect(decoded).toContain('Introduction text');
    expect(decoded).toContain('Body');
    expect(decoded).toContain('Main body');
  });

  it('should strip markdown in TXT', async () => {
    const res = await executeDocument(
      makeCall({ format: 'txt', title: 'MD Test', content: '# Heading\n**bold** and *italic*' })
    );
    const match = res.content.match(/base64,([A-Za-z0-9+/=]+)/);
    const decoded = Buffer.from(match![1], 'base64').toString('utf-8');
    expect(decoded).toContain('Heading');
    expect(decoded).toContain('bold and italic');
    expect(decoded).not.toContain('**');
    expect(decoded).not.toContain('# ');
  });
});

// -------------------------------------------------------------------
// PDF generation
// -------------------------------------------------------------------
describe('executeDocument - pdf', () => {
  it('should generate a PDF document', async () => {
    const res = await executeDocument(
      makeCall({ format: 'pdf', title: 'PDF Test', content: 'Hello PDF' })
    );
    expect(res.isError).toBeFalsy();
    expect(res.content).toContain('PDF Test');
    expect(res.content).toContain('PDF');
    expect(res.content).toContain('data:application/pdf;base64,');
  });

  it('should generate PDF with sections', async () => {
    const res = await executeDocument(
      makeCall({
        format: 'pdf',
        title: 'Report',
        content: '',
        sections: [{ heading: 'Summary', body: 'This is a summary.' }],
      })
    );
    expect(res.isError).toBeFalsy();
    expect(res.content).toContain('Report');
  });

  it('should generate PDF with markdown content', async () => {
    const res = await executeDocument(
      makeCall({
        format: 'pdf',
        title: 'MD PDF',
        content: '# Chapter 1\n## Section A\n- Item 1\n- Item 2\n\nParagraph text here.',
      })
    );
    expect(res.isError).toBeFalsy();
  });
});

// -------------------------------------------------------------------
// DOCX generation
// -------------------------------------------------------------------
describe('executeDocument - docx', () => {
  it('should generate a DOCX document', async () => {
    const res = await executeDocument(
      makeCall({ format: 'docx', title: 'DOCX Test', content: 'Hello DOCX' })
    );
    expect(res.isError).toBeFalsy();
    expect(res.content).toContain('DOCX Test');
    expect(res.content).toContain('DOCX');
    expect(res.content).toContain('data:application/vnd.openxmlformats');
  });

  it('should generate DOCX with author', async () => {
    const res = await executeDocument(
      makeCall({ format: 'docx', title: 'Auth Doc', content: 'Content', author: 'Bob' })
    );
    expect(res.isError).toBeFalsy();
    expect(res.content).toContain('Auth Doc');
  });

  it('should generate DOCX with sections', async () => {
    const res = await executeDocument(
      makeCall({
        format: 'docx',
        title: 'Sections',
        content: '',
        sections: [{ heading: 'Part 1', body: 'First part' }, { body: 'Part without heading' }],
      })
    );
    expect(res.isError).toBeFalsy();
  });
});

// -------------------------------------------------------------------
// Error handling
// -------------------------------------------------------------------
describe('executeDocument - errors', () => {
  it('should error with invalid format', async () => {
    const res = await executeDocument(makeCall({ format: 'html', title: 'Test', content: 'Body' }));
    expect(res.isError).toBe(true);
    expect(res.content).toContain('Invalid format');
  });

  it('should error without format', async () => {
    const res = await executeDocument(makeCall({ title: 'Test', content: 'Body' }));
    expect(res.isError).toBe(true);
  });

  it('should error without title', async () => {
    const res = await executeDocument(makeCall({ format: 'txt', content: 'Body' }));
    expect(res.isError).toBe(true);
    expect(res.content).toContain('title');
  });

  it('should error without content and sections', async () => {
    const res = await executeDocument(makeCall({ format: 'txt', title: 'Test' }));
    expect(res.isError).toBe(true);
    expect(res.content).toContain('content');
  });

  it('should error for wrong tool name', async () => {
    const res = await executeDocument({
      id: 'test',
      name: 'wrong_tool',
      arguments: { format: 'txt', title: 'T', content: 'C' },
    });
    expect(res.isError).toBe(true);
    expect(res.content).toContain('Unknown tool');
  });

  it('should return toolCallId', async () => {
    const res = await executeDocument({
      id: 'my-id',
      name: 'create_document',
      arguments: { format: 'txt', title: 'Test', content: 'Body' },
    });
    expect(res.toolCallId).toBe('my-id');
  });

  it('should handle string arguments (JSON)', async () => {
    const res = await executeDocument({
      id: 'test',
      name: 'create_document',
      arguments: JSON.stringify({ format: 'txt', title: 'From String', content: 'Body' }),
    });
    expect(res.isError).toBeFalsy();
    expect(res.content).toContain('From String');
  });
});
