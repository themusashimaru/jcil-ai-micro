import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock pptxgenjs
vi.mock('pptxgenjs', () => {
  const mockSlide = {
    addText: vi.fn().mockReturnThis(),
    addShape: vi.fn().mockReturnThis(),
    addImage: vi.fn().mockReturnThis(),
    addTable: vi.fn().mockReturnThis(),
    addChart: vi.fn().mockReturnThis(),
    addNotes: vi.fn().mockReturnThis(),
    background: null,
    transition: null,
  };

  const MockPptxGenJS = vi.fn().mockImplementation(() => ({
    layout: '',
    author: '',
    title: '',
    subject: '',
    ShapeType: { rect: 'rect', line: 'line' },
    ChartType: { bar: 'bar', line: 'line', pie: 'pie', doughnut: 'doughnut', radar: 'radar' },
    addSlide: vi.fn().mockReturnValue(mockSlide),
    write: vi.fn().mockResolvedValue(Buffer.from('fake-pptx-data')),
  }));

  return { default: MockPptxGenJS };
});

import {
  presentationTool,
  executePresentation,
  isPresentationAvailable,
} from './presentation-tool';

describe('PresentationTool', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('tool definition', () => {
    it('should have correct name', () => {
      expect(presentationTool.name).toBe('create_presentation');
    });

    it('should require title and slides', () => {
      expect(presentationTool.parameters.required).toEqual(['title', 'slides']);
    });
  });

  describe('executePresentation', () => {
    it('should create a basic presentation', async () => {
      const result = await executePresentation({
        id: 'test-1',
        name: 'create_presentation',
        arguments: {
          title: 'Test Presentation',
          slides: [
            { layout: 'title', title: 'Welcome' },
            { layout: 'content', title: 'Slide 2', content: 'Some content here' },
          ],
        },
      });

      expect(result.isError).toBe(false);
      const parsed = JSON.parse(result.content);
      expect(parsed.success).toBe(true);
      expect(parsed.slideCount).toBe(2);
      expect(parsed.format).toBe('pptx');
      expect(parsed.data).toBeTruthy();
    });

    it('should handle all slide layouts', async () => {
      const result = await executePresentation({
        id: 'test-2',
        name: 'create_presentation',
        arguments: {
          title: 'Layout Test',
          slides: [
            { layout: 'title', title: 'Title Slide' },
            { layout: 'content', title: 'Content', bullets: ['Point 1', 'Point 2'] },
            {
              layout: 'two_column',
              title: 'Two Col',
              left_content: 'Left',
              right_content: 'Right',
            },
            { layout: 'section_header', title: 'Section', content: 'Subtitle' },
            { layout: 'blank' },
          ],
        },
      });

      expect(result.isError).toBe(false);
      const parsed = JSON.parse(result.content);
      expect(parsed.slideCount).toBe(5);
    });

    it('should handle theme configuration', async () => {
      const result = await executePresentation({
        id: 'test-3',
        name: 'create_presentation',
        arguments: {
          title: 'Themed Presentation',
          theme: { primaryColor: '#FF5722', secondaryColor: '#4CAF50', fontFace: 'Georgia' },
          slides: [{ layout: 'content', title: 'Themed Slide', content: 'Hello' }],
        },
      });

      expect(result.isError).toBe(false);
    });

    it('should reject empty slides', async () => {
      const result = await executePresentation({
        id: 'test-4',
        name: 'create_presentation',
        arguments: { title: 'Test', slides: [] },
      });

      expect(result.isError).toBe(true);
      expect(result.content).toContain('At least one slide');
    });

    it('should reject missing title', async () => {
      const result = await executePresentation({
        id: 'test-5',
        name: 'create_presentation',
        arguments: { slides: [{ layout: 'content' }] },
      });

      expect(result.isError).toBe(true);
    });

    it('should add speaker notes', async () => {
      const result = await executePresentation({
        id: 'test-6',
        name: 'create_presentation',
        arguments: {
          title: 'Notes Test',
          slides: [
            { layout: 'content', title: 'Slide', notes: 'Remember to mention the deadline' },
          ],
        },
      });

      expect(result.isError).toBe(false);
    });

    it('should handle table data in slides', async () => {
      const result = await executePresentation({
        id: 'test-7',
        name: 'create_presentation',
        arguments: {
          title: 'Table Test',
          slides: [
            {
              layout: 'content',
              title: 'Data Table',
              table: {
                headers: ['Name', 'Role', 'Start Date'],
                rows: [
                  ['John', 'Engineer', '2026-01-01'],
                  ['Jane', 'Designer', '2026-02-01'],
                ],
              },
            },
          ],
        },
      });

      expect(result.isError).toBe(false);
    });

    it('should handle chart data in slides', async () => {
      const result = await executePresentation({
        id: 'test-8',
        name: 'create_presentation',
        arguments: {
          title: 'Chart Test',
          slides: [
            {
              layout: 'content',
              title: 'Sales Chart',
              chart: {
                type: 'bar',
                labels: ['Q1', 'Q2', 'Q3', 'Q4'],
                data: [100, 200, 150, 300],
                title: 'Quarterly Revenue',
              },
            },
          ],
        },
      });

      expect(result.isError).toBe(false);
    });
  });

  describe('isPresentationAvailable', () => {
    it('should return true when pptxgenjs is installed', () => {
      expect(isPresentationAvailable()).toBe(true);
    });
  });
});
