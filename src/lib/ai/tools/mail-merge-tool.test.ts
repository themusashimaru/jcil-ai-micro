import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock jszip
vi.mock('jszip', () => {
  const mockZip = {
    file: vi.fn().mockReturnThis(),
    generateAsync: vi.fn().mockResolvedValue(Buffer.from('fake-zip')),
  };
  return { default: vi.fn().mockImplementation(() => mockZip) };
});

// Mock pdfkit
vi.mock('pdfkit', () => {
  const mockDoc = {
    pipe: vi.fn().mockReturnThis(),
    fontSize: vi.fn().mockReturnThis(),
    font: vi.fn().mockReturnThis(),
    text: vi.fn().mockReturnThis(),
    moveDown: vi.fn().mockReturnThis(),
    addPage: vi.fn().mockReturnThis(),
    end: vi.fn(function (this: { _endCallback?: () => void }) {
      if (this._endCallback) this._endCallback();
    }),
  };

  return {
    default: vi.fn().mockImplementation(() => {
      // Simulate stream behavior
      setTimeout(() => {
        // The stream 'end' event fires
      }, 0);
      return mockDoc;
    }),
  };
});

import { mailMergeTool, executeMailMerge, isMailMergeAvailable } from './mail-merge-tool';

describe('MailMergeTool', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('tool definition', () => {
    it('should have correct name', () => {
      expect(mailMergeTool.name).toBe('mail_merge');
    });

    it('should require template and data', () => {
      expect(mailMergeTool.parameters.required).toEqual(['template', 'data']);
    });
  });

  describe('executeMailMerge', () => {
    it('should generate text documents from template', async () => {
      const result = await executeMailMerge({
        id: 'test-1',
        name: 'mail_merge',
        arguments: {
          template: 'Dear {{name}},\n\nWelcome to {{company}}!',
          data: [
            { name: 'Alice', company: 'Acme Corp' },
            { name: 'Bob', company: 'Widget Inc' },
          ],
          output_format: 'txt',
        },
      });

      expect(result.isError).toBe(false);
      const parsed = JSON.parse(result.content);
      expect(parsed.success).toBe(true);
      expect(parsed.documentCount).toBe(2);
    });

    it('should handle conditional templates', async () => {
      const result = await executeMailMerge({
        id: 'test-2',
        name: 'mail_merge',
        arguments: {
          template:
            'Hi {{name}}! {{#if premium}}Premium member!{{/if}}{{#unless premium}}Free user{{/unless}}',
          data: [
            { name: 'Alice', premium: true },
            { name: 'Bob', premium: false },
          ],
          output_format: 'txt',
        },
      });

      expect(result.isError).toBe(false);
    });

    it('should handle format specifiers', async () => {
      const result = await executeMailMerge({
        id: 'test-3',
        name: 'mail_merge',
        arguments: {
          template: 'Total: {{amount:currency}} | Name: {{name:uppercase}}',
          data: [{ name: 'alice', amount: 1234.56 }],
          output_format: 'txt',
        },
      });

      expect(result.isError).toBe(false);
    });

    it('should generate custom filenames', async () => {
      const result = await executeMailMerge({
        id: 'test-4',
        name: 'mail_merge',
        arguments: {
          template: 'Hello {{name}}',
          data: [{ name: 'Alice' }, { name: 'Bob' }],
          output_format: 'txt',
          filename_template: 'letter_{{name}}',
        },
      });

      expect(result.isError).toBe(false);
    });

    it('should reject empty data', async () => {
      const result = await executeMailMerge({
        id: 'test-5',
        name: 'mail_merge',
        arguments: { template: 'Hello', data: [] },
      });

      expect(result.isError).toBe(true);
    });

    it('should reject missing template', async () => {
      const result = await executeMailMerge({
        id: 'test-6',
        name: 'mail_merge',
        arguments: { data: [{ name: 'Test' }] },
      });

      expect(result.isError).toBe(true);
    });

    it('should handle each loops', async () => {
      const result = await executeMailMerge({
        id: 'test-7',
        name: 'mail_merge',
        arguments: {
          template: 'Items: {{#each items}}{{item}}, {{/each}}',
          data: [{ items: ['Apple', 'Banana', 'Cherry'] }],
          output_format: 'txt',
        },
      });

      expect(result.isError).toBe(false);
    });
  });

  describe('isMailMergeAvailable', () => {
    it('should return true', () => {
      expect(isMailMergeAvailable()).toBe(true);
    });
  });
});
