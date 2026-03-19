import { describe, it, expect } from 'vitest';
import { pressReleaseTool, executePressRelease, isPressReleaseAvailable } from './press-release-tool';

describe('PressReleaseTool', () => {
  describe('tool definition', () => {
    it('should have correct name', () => {
      expect(pressReleaseTool.name).toBe('create_press_release');
    });

    it('should have a description', () => {
      expect(pressReleaseTool.description).toBeTruthy();
    });

    it('should require headline, subheadline, and body_paragraphs', () => {
      expect(pressReleaseTool.parameters.required).toEqual(['headline', 'subheadline', 'body_paragraphs']);
    });
  });

  describe('isPressReleaseAvailable', () => {
    it('should return true', () => {
      expect(isPressReleaseAvailable()).toBe(true);
    });
  });

  describe('executePressRelease', () => {
    it('should create a press release with valid input', async () => {
      const result = await executePressRelease({
        id: 'test-1',
        name: 'create_press_release',
        arguments: {
          headline: 'JCIL AI Launches New Platform',
          subheadline: 'Revolutionary AI-powered educational tools now available',
          body_paragraphs: [
            'JCIL AI today announced the launch of its new educational platform.',
            'The platform provides AI-powered tools for students and educators.',
          ],
        },
      });

      expect(result.isError).toBeFalsy();
      expect(result.toolCallId).toBe('test-1');
      const parsed = JSON.parse(result.content);
      expect(parsed.success).toBe(true);
      expect(parsed.formatted_output).toContain('JCIL AI Launches New Platform');
      expect(parsed.formatted_output).toContain('Revolutionary');
    });

    it('should create an HTML format press release', async () => {
      const result = await executePressRelease({
        id: 'test-2',
        name: 'create_press_release',
        arguments: {
          headline: 'Product Update Released',
          subheadline: 'Version 2.0 includes major improvements',
          body_paragraphs: ['The new version includes performance enhancements.'],
          format: 'html',
        },
      });

      expect(result.isError).toBeFalsy();
      const parsed = JSON.parse(result.content);
      expect(parsed.success).toBe(true);
      expect(parsed.format).toBe('html');
      expect(parsed.formatted_output).toContain('Product Update Released');
    });

    it('should create a markdown format press release', async () => {
      const result = await executePressRelease({
        id: 'test-3',
        name: 'create_press_release',
        arguments: {
          headline: 'Partnership Announcement',
          subheadline: 'Two industry leaders join forces',
          body_paragraphs: ['We are excited to announce a strategic partnership.'],
          format: 'markdown',
        },
      });

      expect(result.isError).toBeFalsy();
      const parsed = JSON.parse(result.content);
      expect(parsed.success).toBe(true);
      expect(parsed.format).toBe('markdown');
      expect(parsed.formatted_output).toContain('Partnership Announcement');
    });

    it('should error when headline is missing', async () => {
      const result = await executePressRelease({
        id: 'test-4',
        name: 'create_press_release',
        arguments: {
          subheadline: 'Test',
          body_paragraphs: ['Body text here.'],
        },
      });

      expect(result.isError).toBe(true);
    });

    it('should error when subheadline is missing', async () => {
      const result = await executePressRelease({
        id: 'test-5',
        name: 'create_press_release',
        arguments: {
          headline: 'Test Headline',
          body_paragraphs: ['Body text here.'],
        },
      });

      expect(result.isError).toBe(true);
    });

    it('should error when body_paragraphs is missing', async () => {
      const result = await executePressRelease({
        id: 'test-6',
        name: 'create_press_release',
        arguments: {
          headline: 'Test Headline',
          subheadline: 'Test Sub',
        },
      });

      expect(result.isError).toBe(true);
    });

    it('should return toolCallId on error', async () => {
      const result = await executePressRelease({
        id: 'err-id',
        name: 'create_press_release',
        arguments: {},
      });

      expect(result.toolCallId).toBe('err-id');
      expect(result.isError).toBe(true);
    });
  });
});
