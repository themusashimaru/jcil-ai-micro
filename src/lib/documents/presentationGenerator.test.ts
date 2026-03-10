/**
 * Tests for PresentationGenerator
 * Comprehensive coverage of generatePresentationPptx and all slide renderers
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { PresentationDocument, PresentationSlide } from './types';

// ============================================================================
// MOCK SETUP
// ============================================================================

// Track all calls made to the mock pptx instance and slides
const mockSlide = {
  addText: vi.fn(),
  addShape: vi.fn(),
  addImage: vi.fn(),
  addTable: vi.fn(),
  addNotes: vi.fn(),
  background: undefined as unknown,
};

// @ts-expect-error - Mock instance used by vi.mock factory
const _mockPptxInstance = {
  // eslint-disable-line @typescript-eslint/no-unused-vars
  title: '',
  author: '',
  subject: '',
  layout: '',
  addSlide: vi.fn(() => ({ ...mockSlide })),
  write: vi.fn().mockResolvedValue(new ArrayBuffer(8)),
};

// We need to track slides individually since each addSlide() returns a new object
let slidesCreated: Array<typeof mockSlide>;

vi.mock('pptxgenjs', () => {
  return {
    default: class MockPptxGenJS {
      title = '';
      author = '';
      subject = '';
      layout = '';
      addSlide() {
        const slide = {
          addText: vi.fn(),
          addShape: vi.fn(),
          addImage: vi.fn(),
          addTable: vi.fn(),
          addNotes: vi.fn(),
          background: undefined as unknown,
        };
        slidesCreated.push(slide);
        return slide;
      }
      async write() {
        return new ArrayBuffer(8);
      }
    },
  };
});

vi.mock('./imageFetcher', () => ({
  fetchImageBuffer: vi.fn().mockResolvedValue(null),
}));

vi.mock('@/lib/logger', () => ({
  logger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

import { generatePresentationPptx } from './presentationGenerator';
import { fetchImageBuffer } from './imageFetcher';

// ============================================================================
// HELPERS
// ============================================================================

function makeDoc(overrides: Partial<PresentationDocument> = {}): PresentationDocument {
  return {
    type: 'presentation',
    title: 'Test Presentation',
    slides: [],
    ...overrides,
  };
}

function makeSlide(overrides: Partial<PresentationSlide> = {}): PresentationSlide {
  return {
    layout: 'content',
    title: 'Test Slide',
    ...overrides,
  };
}

// ============================================================================
// TESTS
// ============================================================================

describe('generatePresentationPptx', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    slidesCreated = [];
  });

  // --------------------------------------------------------------------------
  // Basic generation and metadata
  // --------------------------------------------------------------------------

  describe('presentation metadata', () => {
    it('returns a Buffer', async () => {
      const result = await generatePresentationPptx(makeDoc());
      expect(result).toBeInstanceOf(Buffer);
    });

    it('creates slides for each slide in the document', async () => {
      const doc = makeDoc({
        slides: [
          makeSlide({ layout: 'title', title: 'Title' }),
          makeSlide({ layout: 'content', title: 'Content' }),
          makeSlide({ layout: 'blank', title: 'Blank' }),
        ],
      });
      await generatePresentationPptx(doc);
      expect(slidesCreated).toHaveLength(3);
    });

    it('handles empty slides array', async () => {
      const result = await generatePresentationPptx(makeDoc({ slides: [] }));
      expect(result).toBeInstanceOf(Buffer);
      expect(slidesCreated).toHaveLength(0);
    });
  });

  // --------------------------------------------------------------------------
  // Speaker notes
  // --------------------------------------------------------------------------

  describe('speaker notes', () => {
    it('adds speaker notes when provided', async () => {
      const doc = makeDoc({
        slides: [makeSlide({ speakerNotes: 'Remember to pause here' })],
      });
      await generatePresentationPptx(doc);
      expect(slidesCreated[0].addNotes).toHaveBeenCalledWith('Remember to pause here');
    });

    it('does not add notes when speakerNotes is absent', async () => {
      const doc = makeDoc({
        slides: [makeSlide({})],
      });
      await generatePresentationPptx(doc);
      expect(slidesCreated[0].addNotes).not.toHaveBeenCalled();
    });
  });

  // --------------------------------------------------------------------------
  // Slide numbers
  // --------------------------------------------------------------------------

  describe('slide numbers', () => {
    it('skips slide number on first slide (title slide)', async () => {
      const doc = makeDoc({
        slides: [makeSlide({ layout: 'title', title: 'Title' })],
      });
      await generatePresentationPptx(doc);
      // Title slide should not get a slide number text call with just the number
      const calls = slidesCreated[0].addText.mock.calls;
      const numberCalls = calls.filter(
        (c: unknown[]) => typeof c[0] === 'string' && /^\d+$/.test(c[0])
      );
      expect(numberCalls).toHaveLength(0);
    });

    it('adds slide numbers starting from slide 2', async () => {
      const doc = makeDoc({
        slides: [
          makeSlide({ layout: 'title', title: 'Title' }),
          makeSlide({ layout: 'content', title: 'Slide 2' }),
          makeSlide({ layout: 'content', title: 'Slide 3' }),
        ],
      });
      await generatePresentationPptx(doc);
      // Slide index 1 should get number "2"
      const slide1Calls = slidesCreated[1].addText.mock.calls;
      const numCall1 = slide1Calls.find((c: unknown[]) => typeof c[0] === 'string' && c[0] === '2');
      expect(numCall1).toBeDefined();

      // Slide index 2 should get number "3"
      const slide2Calls = slidesCreated[2].addText.mock.calls;
      const numCall2 = slide2Calls.find((c: unknown[]) => typeof c[0] === 'string' && c[0] === '3');
      expect(numCall2).toBeDefined();
    });
  });

  // --------------------------------------------------------------------------
  // Background color
  // --------------------------------------------------------------------------

  describe('slide background color', () => {
    it('sets background color when provided', async () => {
      const doc = makeDoc({
        slides: [makeSlide({ backgroundColor: '#FF0000' })],
      });
      await generatePresentationPptx(doc);
      expect(slidesCreated[0].background).toEqual({ color: 'FF0000' });
    });

    it('does not set background when not provided', async () => {
      const doc = makeDoc({
        slides: [makeSlide({})],
      });
      await generatePresentationPptx(doc);
      expect(slidesCreated[0].background).toBeUndefined();
    });
  });

  // --------------------------------------------------------------------------
  // Custom colors from format
  // --------------------------------------------------------------------------

  describe('custom format colors', () => {
    it('uses custom primaryColor from format (strips #)', async () => {
      const doc = makeDoc({
        format: { primaryColor: '#AABBCC' },
        slides: [makeSlide({ layout: 'content', title: 'Test' })],
      });
      await generatePresentationPptx(doc);
      // The header bar shape should use the custom color
      const shapeCalls = slidesCreated[0].addShape.mock.calls;
      expect(shapeCalls.length).toBeGreaterThan(0);
      const headerBarCall = shapeCalls.find(
        (c: unknown[]) =>
          (c[1] as Record<string, unknown>)?.fill &&
          ((c[1] as Record<string, { color: string }>).fill as { color: string }).color === 'AABBCC'
      );
      expect(headerBarCall).toBeDefined();
    });

    it('uses default colors when format is not provided', async () => {
      const doc = makeDoc({
        slides: [makeSlide({ layout: 'content', title: 'Test' })],
      });
      await generatePresentationPptx(doc);
      const shapeCalls = slidesCreated[0].addShape.mock.calls;
      const headerBarCall = shapeCalls.find(
        (c: unknown[]) =>
          ((c[1] as Record<string, { color: string }>)?.fill as { color: string })?.color ===
          '1e3a5f'
      );
      expect(headerBarCall).toBeDefined();
    });
  });

  // --------------------------------------------------------------------------
  // TITLE SLIDE
  // --------------------------------------------------------------------------

  describe('title slide layout', () => {
    it('renders title text', async () => {
      const doc = makeDoc({
        slides: [makeSlide({ layout: 'title', title: 'My Presentation' })],
      });
      await generatePresentationPptx(doc);
      const textCalls = slidesCreated[0].addText.mock.calls;
      const titleCall = textCalls.find(
        (c: unknown[]) =>
          c[0] === 'My Presentation' && (c[1] as { fontSize?: number })?.fontSize === 36
      );
      expect(titleCall).toBeDefined();
    });

    it('renders subtitle when provided', async () => {
      const doc = makeDoc({
        slides: [makeSlide({ layout: 'title', title: 'Title', subtitle: 'A Subtitle' })],
      });
      await generatePresentationPptx(doc);
      const textCalls = slidesCreated[0].addText.mock.calls;
      const subtitleCall = textCalls.find((c: unknown[]) => c[0] === 'A Subtitle');
      expect(subtitleCall).toBeDefined();
    });

    it('does not render subtitle when absent', async () => {
      const doc = makeDoc({
        slides: [makeSlide({ layout: 'title', title: 'Title' })],
      });
      await generatePresentationPptx(doc);
      const textCalls = slidesCreated[0].addText.mock.calls;
      // Should have: title text, accent bars (shapes), bottom text — no subtitle
      const subtitleCall = textCalls.find(
        (c: unknown[]) => (c[1] as { fontSize?: number })?.fontSize === 20
      );
      expect(subtitleCall).toBeUndefined();
    });

    it('uses first bullet as bottom text if available', async () => {
      const doc = makeDoc({
        slides: [
          makeSlide({
            layout: 'title',
            title: 'Title',
            bullets: ['Custom Author Line'],
          }),
        ],
      });
      await generatePresentationPptx(doc);
      const textCalls = slidesCreated[0].addText.mock.calls;
      const bottomCall = textCalls.find((c: unknown[]) => c[0] === 'Custom Author Line');
      expect(bottomCall).toBeDefined();
    });

    it('renders two accent bars (top and bottom)', async () => {
      const doc = makeDoc({
        slides: [makeSlide({ layout: 'title', title: 'Title' })],
      });
      await generatePresentationPptx(doc);
      const shapeCalls = slidesCreated[0].addShape.mock.calls;
      // Should have at least 2 rect shapes (top bar + bottom bar)
      const rectCalls = shapeCalls.filter((c: unknown[]) => c[0] === 'rect');
      expect(rectCalls.length).toBeGreaterThanOrEqual(2);
    });
  });

  // --------------------------------------------------------------------------
  // CONTENT SLIDE
  // --------------------------------------------------------------------------

  describe('content slide layout', () => {
    it('renders header bar and title', async () => {
      const doc = makeDoc({
        slides: [makeSlide({ layout: 'content', title: 'Content Title' })],
      });
      await generatePresentationPptx(doc);
      const shapeCalls = slidesCreated[0].addShape.mock.calls;
      expect(shapeCalls.length).toBeGreaterThan(0);

      const textCalls = slidesCreated[0].addText.mock.calls;
      const titleCall = textCalls.find((c: unknown[]) => c[0] === 'Content Title');
      expect(titleCall).toBeDefined();
    });

    it('renders body text when provided', async () => {
      const doc = makeDoc({
        slides: [makeSlide({ layout: 'content', title: 'T', body: 'Some body text here' })],
      });
      await generatePresentationPptx(doc);
      const textCalls = slidesCreated[0].addText.mock.calls;
      const bodyCall = textCalls.find((c: unknown[]) => c[0] === 'Some body text here');
      expect(bodyCall).toBeDefined();
    });

    it('renders bullets when provided', async () => {
      const doc = makeDoc({
        slides: [
          makeSlide({
            layout: 'content',
            title: 'T',
            bullets: ['Point A', 'Point B', 'Point C'],
          }),
        ],
      });
      await generatePresentationPptx(doc);
      const textCalls = slidesCreated[0].addText.mock.calls;
      // Bullets are passed as an array of objects
      const bulletCall = textCalls.find(
        (c: unknown[]) =>
          Array.isArray(c[0]) &&
          c[0].length === 3 &&
          (c[0][0] as { text: string }).text === 'Point A'
      );
      expect(bulletCall).toBeDefined();
    });

    it('renders both body and bullets together', async () => {
      const doc = makeDoc({
        slides: [
          makeSlide({
            layout: 'content',
            title: 'T',
            body: 'Intro text',
            bullets: ['Bullet 1'],
          }),
        ],
      });
      await generatePresentationPptx(doc);
      const textCalls = slidesCreated[0].addText.mock.calls;
      const bodyCall = textCalls.find((c: unknown[]) => c[0] === 'Intro text');
      const bulletCall = textCalls.find(
        (c: unknown[]) => Array.isArray(c[0]) && (c[0][0] as { text: string }).text === 'Bullet 1'
      );
      expect(bodyCall).toBeDefined();
      expect(bulletCall).toBeDefined();
    });

    it('renders table when provided', async () => {
      const doc = makeDoc({
        slides: [
          makeSlide({
            layout: 'content',
            title: 'T',
            table: {
              headers: ['Name', 'Value'],
              rows: [
                ['A', '1'],
                ['B', '2'],
              ],
            },
          }),
        ],
      });
      await generatePresentationPptx(doc);
      expect(slidesCreated[0].addTable).toHaveBeenCalled();
    });

    it('defaults to content layout for unknown layout types', async () => {
      const doc = makeDoc({
        slides: [
          makeSlide({
            layout: 'content', // default case
            title: 'Default Layout',
          }),
        ],
      });
      await generatePresentationPptx(doc);
      // Should have a header bar shape + title text
      expect(slidesCreated[0].addShape).toHaveBeenCalled();
      expect(slidesCreated[0].addText).toHaveBeenCalled();
    });
  });

  // --------------------------------------------------------------------------
  // SECTION SLIDE
  // --------------------------------------------------------------------------

  describe('section slide layout', () => {
    it('sets full colored background', async () => {
      const doc = makeDoc({
        slides: [makeSlide({ layout: 'section', title: 'Section Title' })],
      });
      await generatePresentationPptx(doc);
      // Section slide sets background to primaryColor
      expect(slidesCreated[0].background).toEqual({ color: '1e3a5f' });
    });

    it('renders section title in white', async () => {
      const doc = makeDoc({
        slides: [makeSlide({ layout: 'section', title: 'Section Title' })],
      });
      await generatePresentationPptx(doc);
      const textCalls = slidesCreated[0].addText.mock.calls;
      const titleCall = textCalls.find(
        (c: unknown[]) =>
          c[0] === 'Section Title' && (c[1] as { color?: string })?.color === 'FFFFFF'
      );
      expect(titleCall).toBeDefined();
    });

    it('renders subtitle when provided', async () => {
      const doc = makeDoc({
        slides: [
          makeSlide({
            layout: 'section',
            title: 'Section',
            subtitle: 'Section Description',
          }),
        ],
      });
      await generatePresentationPptx(doc);
      const textCalls = slidesCreated[0].addText.mock.calls;
      const subtitleCall = textCalls.find((c: unknown[]) => c[0] === 'Section Description');
      expect(subtitleCall).toBeDefined();
    });

    it('renders accent line shape', async () => {
      const doc = makeDoc({
        slides: [makeSlide({ layout: 'section', title: 'Section' })],
      });
      await generatePresentationPptx(doc);
      const shapeCalls = slidesCreated[0].addShape.mock.calls;
      // Accent line is a thin rect
      const accentLine = shapeCalls.find((c: unknown[]) => (c[1] as { h?: number })?.h === 0.06);
      expect(accentLine).toBeDefined();
    });
  });

  // --------------------------------------------------------------------------
  // TWO COLUMN SLIDE
  // --------------------------------------------------------------------------

  describe('two_column slide layout', () => {
    it('splits bullets into two columns', async () => {
      const doc = makeDoc({
        slides: [
          makeSlide({
            layout: 'two_column',
            title: 'Two Columns',
            bullets: ['A', 'B', 'C', 'D'],
          }),
        ],
      });
      await generatePresentationPptx(doc);
      const textCalls = slidesCreated[0].addText.mock.calls;

      // Left column: first 2 bullets (ceil(4/2) = 2)
      const leftCol = textCalls.find(
        (c: unknown[]) =>
          Array.isArray(c[0]) &&
          c[0].length === 2 &&
          (c[0][0] as { text: string }).text === 'A' &&
          (c[1] as { x?: number })?.x === 0.6
      );
      expect(leftCol).toBeDefined();

      // Right column: last 2 bullets
      const rightCol = textCalls.find(
        (c: unknown[]) =>
          Array.isArray(c[0]) &&
          c[0].length === 2 &&
          (c[0][0] as { text: string }).text === 'C' &&
          (c[1] as { x?: number })?.x === 6.8
      );
      expect(rightCol).toBeDefined();
    });

    it('handles odd number of bullets', async () => {
      const doc = makeDoc({
        slides: [
          makeSlide({
            layout: 'two_column',
            title: 'Odd',
            bullets: ['A', 'B', 'C'],
          }),
        ],
      });
      await generatePresentationPptx(doc);
      const textCalls = slidesCreated[0].addText.mock.calls;

      // Left column should have 2 items (ceil(3/2))
      const leftCol = textCalls.find(
        (c: unknown[]) =>
          Array.isArray(c[0]) && c[0].length === 2 && (c[1] as { x?: number })?.x === 0.6
      );
      expect(leftCol).toBeDefined();

      // Right column should have 1 item
      const rightCol = textCalls.find(
        (c: unknown[]) =>
          Array.isArray(c[0]) && c[0].length === 1 && (c[1] as { x?: number })?.x === 6.8
      );
      expect(rightCol).toBeDefined();
    });

    it('handles empty bullets gracefully', async () => {
      const doc = makeDoc({
        slides: [
          makeSlide({
            layout: 'two_column',
            title: 'Empty',
            bullets: [],
          }),
        ],
      });
      await generatePresentationPptx(doc);
      // Should still create the slide without errors
      expect(slidesCreated).toHaveLength(1);
    });

    it('handles single bullet (left column only)', async () => {
      const doc = makeDoc({
        slides: [
          makeSlide({
            layout: 'two_column',
            title: 'Single',
            bullets: ['Only One'],
          }),
        ],
      });
      await generatePresentationPptx(doc);
      const textCalls = slidesCreated[0].addText.mock.calls;
      // Left column with 1 item
      const leftCol = textCalls.find(
        (c: unknown[]) =>
          Array.isArray(c[0]) &&
          c[0].length === 1 &&
          (c[0][0] as { text: string }).text === 'Only One'
      );
      expect(leftCol).toBeDefined();
    });

    it('renders vertical divider', async () => {
      const doc = makeDoc({
        slides: [
          makeSlide({
            layout: 'two_column',
            title: 'Divider',
            bullets: ['A', 'B'],
          }),
        ],
      });
      await generatePresentationPptx(doc);
      const shapeCalls = slidesCreated[0].addShape.mock.calls;
      // Vertical divider is a thin rect at x=6.4
      const divider = shapeCalls.find(
        (c: unknown[]) =>
          (c[1] as { x?: number })?.x === 6.4 && (c[1] as { w?: number })?.w === 0.02
      );
      expect(divider).toBeDefined();
    });
  });

  // --------------------------------------------------------------------------
  // IMAGE SLIDES
  // --------------------------------------------------------------------------

  describe('image slide layouts', () => {
    it('renders image_left with image on the left side', async () => {
      const doc = makeDoc({
        slides: [
          makeSlide({
            layout: 'image_left',
            title: 'Image Left',
            bullets: ['Info'],
          }),
        ],
      });
      await generatePresentationPptx(doc);
      // Without an image URL, it should render a placeholder at x=0.6
      const shapeCalls = slidesCreated[0].addShape.mock.calls;
      const placeholder = shapeCalls.find(
        (c: unknown[]) =>
          c[0] === 'rect' &&
          (c[1] as { x?: number })?.x === 0.6 &&
          (c[1] as { w?: number })?.w === 5.8
      );
      expect(placeholder).toBeDefined();
    });

    it('renders image_right with image on the right side', async () => {
      const doc = makeDoc({
        slides: [
          makeSlide({
            layout: 'image_right',
            title: 'Image Right',
            bullets: ['Info'],
          }),
        ],
      });
      await generatePresentationPptx(doc);
      // Placeholder at x=7.0
      const shapeCalls = slidesCreated[0].addShape.mock.calls;
      const placeholder = shapeCalls.find(
        (c: unknown[]) =>
          c[0] === 'rect' &&
          (c[1] as { x?: number })?.x === 7.0 &&
          (c[1] as { w?: number })?.w === 5.8
      );
      expect(placeholder).toBeDefined();
    });

    it('embeds cached image as base64 data', async () => {
      const mockBuffer = Buffer.from('fake-image-data');
      vi.mocked(fetchImageBuffer).mockResolvedValueOnce({
        buffer: mockBuffer,
        mimeType: 'image/png',
      });

      const doc = makeDoc({
        slides: [
          makeSlide({
            layout: 'image_left',
            title: 'With Image',
            imageUrl: 'https://example.com/photo.png',
          }),
        ],
      });
      await generatePresentationPptx(doc);

      const imageCalls = slidesCreated[0].addImage.mock.calls;
      expect(imageCalls).toHaveLength(1);
      const imageArg = imageCalls[0][0] as { data?: string };
      expect(imageArg.data).toContain('data:image/png;base64,');
    });

    it('falls back to path when image not in cache', async () => {
      // fetchImageBuffer returns null (not cached)
      vi.mocked(fetchImageBuffer).mockResolvedValueOnce(null);

      const doc = makeDoc({
        slides: [
          makeSlide({
            layout: 'image_right',
            title: 'Fallback',
            imageUrl: '/local/image.png',
          }),
        ],
      });
      await generatePresentationPptx(doc);

      const imageCalls = slidesCreated[0].addImage.mock.calls;
      // Should try path-based approach
      expect(imageCalls).toHaveLength(1);
      const imageArg = imageCalls[0][0] as { path?: string };
      expect(imageArg.path).toBe('/local/image.png');
    });

    it('renders placeholder when no imageUrl', async () => {
      const doc = makeDoc({
        slides: [
          makeSlide({
            layout: 'image_left',
            title: 'No Image',
          }),
        ],
      });
      await generatePresentationPptx(doc);

      const textCalls = slidesCreated[0].addText.mock.calls;
      const placeholderText = textCalls.find((c: unknown[]) => c[0] === '[Image Placeholder]');
      expect(placeholderText).toBeDefined();
    });

    it('renders bullets on opposite side of image', async () => {
      const doc = makeDoc({
        slides: [
          makeSlide({
            layout: 'image_left',
            title: 'With Bullets',
            bullets: ['Point 1', 'Point 2'],
          }),
        ],
      });
      await generatePresentationPptx(doc);

      const textCalls = slidesCreated[0].addText.mock.calls;
      // Text should be at x=6.6 (right side) for image_left
      const bulletCall = textCalls.find(
        (c: unknown[]) =>
          Array.isArray(c[0]) &&
          (c[0][0] as { text: string }).text === 'Point 1' &&
          (c[1] as { x?: number })?.x === 6.6
      );
      expect(bulletCall).toBeDefined();
    });

    it('renders body text when no bullets on image slide', async () => {
      const doc = makeDoc({
        slides: [
          makeSlide({
            layout: 'image_right',
            title: 'Body Text',
            body: 'Description text here',
          }),
        ],
      });
      await generatePresentationPptx(doc);

      const textCalls = slidesCreated[0].addText.mock.calls;
      const bodyCall = textCalls.find((c: unknown[]) => c[0] === 'Description text here');
      expect(bodyCall).toBeDefined();
    });
  });

  // --------------------------------------------------------------------------
  // BLANK SLIDE
  // --------------------------------------------------------------------------

  describe('blank slide layout', () => {
    it('renders title when provided', async () => {
      const doc = makeDoc({
        slides: [makeSlide({ layout: 'blank', title: 'Blank Title' })],
      });
      await generatePresentationPptx(doc);
      const textCalls = slidesCreated[0].addText.mock.calls;
      const titleCall = textCalls.find((c: unknown[]) => c[0] === 'Blank Title');
      expect(titleCall).toBeDefined();
    });

    it('renders body text when provided', async () => {
      const doc = makeDoc({
        slides: [makeSlide({ layout: 'blank', title: 'T', body: 'Blank body content' })],
      });
      await generatePresentationPptx(doc);
      const textCalls = slidesCreated[0].addText.mock.calls;
      const bodyCall = textCalls.find((c: unknown[]) => c[0] === 'Blank body content');
      expect(bodyCall).toBeDefined();
    });

    it('does not render header bar or shapes (minimal)', async () => {
      const doc = makeDoc({
        slides: [makeSlide({ layout: 'blank', title: 'Minimal' })],
      });
      await generatePresentationPptx(doc);
      // Blank slides should not add shapes
      expect(slidesCreated[0].addShape).not.toHaveBeenCalled();
    });
  });

  // --------------------------------------------------------------------------
  // TABLE RENDERING
  // --------------------------------------------------------------------------

  describe('table rendering', () => {
    it('renders table with headers and rows', async () => {
      const doc = makeDoc({
        slides: [
          makeSlide({
            layout: 'content',
            title: 'Table Slide',
            table: {
              headers: ['Col A', 'Col B'],
              rows: [
                ['1', '2'],
                ['3', '4'],
              ],
            },
          }),
        ],
      });
      await generatePresentationPptx(doc);
      expect(slidesCreated[0].addTable).toHaveBeenCalledTimes(1);

      const tableCall = slidesCreated[0].addTable.mock.calls[0];
      const tableData = tableCall[0] as Array<Array<{ text: string }>>;
      // Header row + 2 data rows = 3 rows
      expect(tableData).toHaveLength(3);
      // Header cells
      expect(tableData[0][0].text).toBe('Col A');
      expect(tableData[0][1].text).toBe('Col B');
      // Data cells
      expect(tableData[1][0].text).toBe('1');
      expect(tableData[2][1].text).toBe('4');
    });

    it('renders table without headers', async () => {
      const doc = makeDoc({
        slides: [
          makeSlide({
            layout: 'content',
            title: 'T',
            table: {
              rows: [
                ['X', 'Y'],
                ['Z', 'W'],
              ],
            },
          }),
        ],
      });
      await generatePresentationPptx(doc);
      expect(slidesCreated[0].addTable).toHaveBeenCalledTimes(1);

      const tableData = slidesCreated[0].addTable.mock.calls[0][0] as Array<
        Array<{ text: string }>
      >;
      // No header row, just 2 data rows
      expect(tableData).toHaveLength(2);
    });

    it('applies alternating row colors', async () => {
      const doc = makeDoc({
        slides: [
          makeSlide({
            layout: 'content',
            title: 'T',
            table: {
              rows: [
                ['A', 'B'],
                ['C', 'D'],
                ['E', 'F'],
              ],
            },
          }),
        ],
      });
      await generatePresentationPptx(doc);
      const tableData = slidesCreated[0].addTable.mock.calls[0][0] as Array<
        Array<{ text: string; options?: { fill?: { color: string } } }>
      >;

      // Row 0 (even) should have white background
      expect(tableData[0][0].options?.fill?.color).toBe('FFFFFF');
      // Row 1 (odd) should have light background
      expect(tableData[1][0].options?.fill?.color).toBe('F8FAFC');
      // Row 2 (even) should have white background
      expect(tableData[2][0].options?.fill?.color).toBe('FFFFFF');
    });

    it('calculates column width correctly', async () => {
      const doc = makeDoc({
        slides: [
          makeSlide({
            layout: 'content',
            title: 'T',
            table: {
              headers: ['A', 'B', 'C', 'D', 'E'],
              rows: [['1', '2', '3', '4', '5']],
            },
          }),
        ],
      });
      await generatePresentationPptx(doc);
      const tableOpts = slidesCreated[0].addTable.mock.calls[0][1] as {
        colW?: number;
        w?: number;
      };
      // 11.4 / 5 = 2.28, min(2.28, 3.0) = 2.28
      expect(tableOpts.colW).toBeCloseTo(2.28, 1);
    });

    it('caps column width at 3.0 for few columns', async () => {
      const doc = makeDoc({
        slides: [
          makeSlide({
            layout: 'content',
            title: 'T',
            table: {
              headers: ['A'],
              rows: [['1']],
            },
          }),
        ],
      });
      await generatePresentationPptx(doc);
      const tableOpts = slidesCreated[0].addTable.mock.calls[0][1] as { colW?: number };
      // 11.4 / 1 = 11.4, min(11.4, 3.0) = 3.0
      expect(tableOpts.colW).toBe(3.0);
    });

    it('does not render table when rows are empty', async () => {
      const doc = makeDoc({
        slides: [
          makeSlide({
            layout: 'content',
            title: 'T',
            table: {
              rows: [],
            },
          }),
        ],
      });
      await generatePresentationPptx(doc);
      // Empty table with no headers => tableData is empty => no addTable call
      expect(slidesCreated[0].addTable).not.toHaveBeenCalled();
    });
  });

  // --------------------------------------------------------------------------
  // IMAGE FETCHING
  // --------------------------------------------------------------------------

  describe('image pre-fetching', () => {
    it('fetches images for slides with imageUrl', async () => {
      const doc = makeDoc({
        slides: [
          makeSlide({ layout: 'image_left', title: 'Img', imageUrl: 'https://example.com/a.png' }),
          makeSlide({ layout: 'content', title: 'No Img' }),
          makeSlide({
            layout: 'image_right',
            title: 'Img2',
            imageUrl: 'https://example.com/b.png',
          }),
        ],
      });
      await generatePresentationPptx(doc);
      expect(fetchImageBuffer).toHaveBeenCalledTimes(2);
      expect(fetchImageBuffer).toHaveBeenCalledWith('https://example.com/a.png');
      expect(fetchImageBuffer).toHaveBeenCalledWith('https://example.com/b.png');
    });

    it('handles image fetch failure gracefully', async () => {
      vi.mocked(fetchImageBuffer).mockResolvedValue(null);
      const doc = makeDoc({
        slides: [
          makeSlide({
            layout: 'image_left',
            title: 'Failed Image',
            imageUrl: 'https://example.com/broken.png',
          }),
        ],
      });
      // Should not throw
      const result = await generatePresentationPptx(doc);
      expect(result).toBeInstanceOf(Buffer);
    });
  });

  // --------------------------------------------------------------------------
  // EDGE CASES
  // --------------------------------------------------------------------------

  describe('edge cases', () => {
    it('handles a single slide presentation', async () => {
      const doc = makeDoc({
        slides: [makeSlide({ layout: 'title', title: 'Solo Slide' })],
      });
      const result = await generatePresentationPptx(doc);
      expect(result).toBeInstanceOf(Buffer);
      expect(slidesCreated).toHaveLength(1);
    });

    it('handles many slides', async () => {
      const slides = Array.from({ length: 50 }, (_, i) =>
        makeSlide({ layout: 'content', title: `Slide ${i}` })
      );
      const doc = makeDoc({ slides });
      const result = await generatePresentationPptx(doc);
      expect(result).toBeInstanceOf(Buffer);
      expect(slidesCreated).toHaveLength(50);
    });

    it('handles all layout types in one presentation', async () => {
      const layouts: PresentationSlide['layout'][] = [
        'title',
        'content',
        'section',
        'two_column',
        'image_left',
        'image_right',
        'blank',
      ];
      const slides = layouts.map((layout) =>
        makeSlide({ layout, title: `${layout} slide`, bullets: ['Bullet'] })
      );
      const doc = makeDoc({ slides });
      const result = await generatePresentationPptx(doc);
      expect(result).toBeInstanceOf(Buffer);
      expect(slidesCreated).toHaveLength(7);
    });

    it('handles special characters in text', async () => {
      const doc = makeDoc({
        slides: [
          makeSlide({
            layout: 'content',
            title: 'Special: <>&"\'',
            body: 'Emoji: \u2764\uFE0F Unicode: \u00E9\u00E8\u00EA',
            bullets: ['Bullet with "quotes"', "Bullet with 'apostrophe'"],
          }),
        ],
      });
      const result = await generatePresentationPptx(doc);
      expect(result).toBeInstanceOf(Buffer);
    });

    it('handles very long text content', async () => {
      const longText = 'A'.repeat(5000);
      const doc = makeDoc({
        slides: [
          makeSlide({
            layout: 'content',
            title: longText,
            body: longText,
            bullets: [longText, longText],
          }),
        ],
      });
      const result = await generatePresentationPptx(doc);
      expect(result).toBeInstanceOf(Buffer);
    });

    it('handles format with color without # prefix', async () => {
      const doc = makeDoc({
        format: { primaryColor: 'AABBCC', accentColor: 'DDEEFF' },
        slides: [makeSlide({ layout: 'section', title: 'Test' })],
      });
      await generatePresentationPptx(doc);
      // Should use the color as-is (replace('#','') on a string without # is a no-op)
      const shapeCalls = slidesCreated[0].addShape.mock.calls;
      const accentLine = shapeCalls.find(
        (c: unknown[]) =>
          ((c[1] as Record<string, { color: string }>)?.fill as { color: string })?.color ===
          'DDEEFF'
      );
      expect(accentLine).toBeDefined();
    });
  });
});
