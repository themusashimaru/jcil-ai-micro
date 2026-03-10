/**
 * SLIDE GENERATOR TESTS
 *
 * Tests for src/lib/slides/generator.ts
 * Covers constants, types, system prompts, parsing, formatting,
 * single slide generation, and batch generation.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks (hoisted -- no external variable references inside factories)
// ---------------------------------------------------------------------------

vi.mock('@/lib/connectors/bfl', () => ({
  generateImage: vi.fn(),
  downloadAndStore: vi.fn(),
  enhanceImagePrompt: vi.fn(),
}));

vi.mock('@/lib/connectors/bfl/models', () => ({
  ASPECT_RATIOS: {
    '16:9': { width: 1280, height: 720, label: 'Widescreen' },
    '1:1': { width: 1024, height: 1024, label: 'Square' },
  },
}));

vi.mock('@/lib/logger', () => ({
  logger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  }),
}));

vi.mock('@/lib/supabase/workspace-client', () => ({
  untypedFrom: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Imports (after mocks so they resolve to mocked modules)
// ---------------------------------------------------------------------------

import {
  MAX_SLIDES_PER_REQUEST,
  SLIDE_WIDTH,
  SLIDE_HEIGHT,
  getSlideDesignSystemPrompt,
  parseSlidePrompts,
  formatSlideOutput,
  generateSlideCompletionMetadata,
  generateSingleSlide,
  generateSlides,
  ProgressMessages,
} from './generator';
import type { SlideInput, SlideResult, SlideGenerationOptions } from './generator';
import { generateImage, downloadAndStore, enhanceImagePrompt } from '@/lib/connectors/bfl';
import { untypedFrom } from '@/lib/supabase/workspace-client';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeSlideInput(overrides: Partial<SlideInput> = {}): SlideInput {
  return {
    slideNumber: 1,
    title: 'Test Slide',
    bullets: ['Bullet A', 'Bullet B'],
    prompt: 'A blue gradient background',
    ...overrides,
  };
}

function makeSlideResult(overrides: Partial<SlideResult> = {}): SlideResult {
  return {
    slideNumber: 1,
    title: 'Test Slide',
    bullets: ['Bullet A'],
    imageUrl: 'https://example.com/slide1.png',
    generationId: 'gen-123',
    originalPrompt: 'blue bg',
    seed: 42,
    enhancedPrompt: 'enhanced blue bg',
    ...overrides,
  };
}

function makeOptions(overrides: Partial<SlideGenerationOptions> = {}): SlideGenerationOptions {
  return {
    userId: 'user-1',
    conversationId: 'conv-1',
    serviceClient: {} as SlideGenerationOptions['serviceClient'],
    onProgress: vi.fn(),
    source: 'chat',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('slides/generator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ===== CONSTANTS =====

  describe('constants', () => {
    it('MAX_SLIDES_PER_REQUEST should be 10', () => {
      expect(MAX_SLIDES_PER_REQUEST).toBe(10);
    });

    it('SLIDE_WIDTH should equal the 16:9 aspect ratio width', () => {
      expect(SLIDE_WIDTH).toBe(1280);
    });

    it('SLIDE_HEIGHT should equal the 16:9 aspect ratio height', () => {
      expect(SLIDE_HEIGHT).toBe(720);
    });
  });

  // ===== ProgressMessages =====

  describe('ProgressMessages', () => {
    it('researchStart is empty string', () => {
      expect(ProgressMessages.researchStart).toBe('');
    });

    it('designComplete returns empty string', () => {
      expect(ProgressMessages.designComplete(5)).toBe('');
    });

    it('slideStart returns empty string', () => {
      expect(ProgressMessages.slideStart(1, 'Intro')).toBe('');
    });

    it('slideComplete returns empty string', () => {
      expect(ProgressMessages.slideComplete(1, 'Intro')).toBe('');
    });

    it('slideFailed returns empty string', () => {
      expect(ProgressMessages.slideFailed(2, 'Body')).toBe('');
    });

    it('qcPassed returns empty string', () => {
      expect(ProgressMessages.qcPassed(0.9)).toBe('');
    });

    it('qcFixing returns empty string', () => {
      expect(ProgressMessages.qcFixing(0.4, 3)).toBe('');
    });

    it('regenerateStart returns empty string', () => {
      expect(ProgressMessages.regenerateStart(2)).toBe('');
    });

    it('autoImproved returns empty string', () => {
      expect(ProgressMessages.autoImproved(2)).toBe('');
    });
  });

  // ===== getSlideDesignSystemPrompt =====

  describe('getSlideDesignSystemPrompt', () => {
    it('returns a string containing "presentation designer"', () => {
      const prompt = getSlideDesignSystemPrompt();
      expect(prompt).toContain('presentation designer');
    });

    it('uses default maxSlides of 10 in the prompt', () => {
      const prompt = getSlideDesignSystemPrompt();
      expect(prompt).toContain('max 10');
    });

    it('respects a custom maxSlides value', () => {
      const prompt = getSlideDesignSystemPrompt(5);
      expect(prompt).toContain('max 5');
    });

    it('includes research context when provided', () => {
      const prompt = getSlideDesignSystemPrompt(10, 'Some research data');
      expect(prompt).toContain('Research context for accurate content');
      expect(prompt).toContain('Some research data');
    });

    it('omits research block when context is empty', () => {
      const prompt = getSlideDesignSystemPrompt(10, '');
      expect(prompt).not.toContain('Research context');
    });

    it('contains critical instruction about no text in images', () => {
      const prompt = getSlideDesignSystemPrompt();
      expect(prompt).toContain('CANNOT render text reliably');
    });

    it('mentions 16:9 aspect ratio requirement', () => {
      const prompt = getSlideDesignSystemPrompt();
      expect(prompt).toContain('16:9');
    });
  });

  // ===== parseSlidePrompts =====

  describe('parseSlidePrompts', () => {
    it('parses a valid JSON array of slides', () => {
      const json = JSON.stringify([{ slideNumber: 1, title: 'Intro', prompt: 'bg gradient' }]);
      const result = parseSlidePrompts(json);
      expect(result).toHaveLength(1);
      expect(result[0].title).toBe('Intro');
    });

    it('parses slides with bullets', () => {
      const json = JSON.stringify([
        { slideNumber: 1, title: 'Data', bullets: ['A', 'B'], prompt: 'chart bg' },
      ]);
      const result = parseSlidePrompts(json);
      expect(result[0].bullets).toEqual(['A', 'B']);
    });

    it('strips ```json code fences', () => {
      const json = '```json\n[{"slideNumber":1,"title":"T","prompt":"P"}]\n```';
      const result = parseSlidePrompts(json);
      expect(result).toHaveLength(1);
    });

    it('strips plain ``` code fences', () => {
      const json = '```\n[{"slideNumber":1,"title":"T","prompt":"P"}]\n```';
      const result = parseSlidePrompts(json);
      expect(result).toHaveLength(1);
    });

    it('enforces MAX_SLIDES_PER_REQUEST limit', () => {
      const slides = Array.from({ length: 15 }, (_, i) => ({
        slideNumber: i + 1,
        title: `Slide ${i + 1}`,
        prompt: 'bg',
      }));
      const result = parseSlidePrompts(JSON.stringify(slides));
      expect(result).toHaveLength(MAX_SLIDES_PER_REQUEST);
    });

    it('returns all slides when under the limit', () => {
      const slides = Array.from({ length: 5 }, (_, i) => ({
        slideNumber: i + 1,
        title: `Slide ${i + 1}`,
        prompt: 'bg',
      }));
      const result = parseSlidePrompts(JSON.stringify(slides));
      expect(result).toHaveLength(5);
    });

    it('throws on invalid JSON', () => {
      expect(() => parseSlidePrompts('not json')).toThrow();
    });
  });

  // ===== formatSlideOutput =====

  describe('formatSlideOutput', () => {
    it('includes slide count in header', () => {
      const slides = [makeSlideResult()];
      const output = formatSlideOutput(slides);
      expect(output).toContain('1 Presentation Slide');
    });

    it('pluralizes when multiple slides', () => {
      const slides = [makeSlideResult({ slideNumber: 1 }), makeSlideResult({ slideNumber: 2 })];
      const output = formatSlideOutput(slides);
      expect(output).toContain('2 Presentation Slides');
    });

    it('renders slide title', () => {
      const slides = [makeSlideResult({ title: 'My Title' })];
      const output = formatSlideOutput(slides);
      expect(output).toContain('### Slide 1: My Title');
    });

    it('renders bullet points', () => {
      const slides = [makeSlideResult({ bullets: ['Point 1', 'Point 2'] })];
      const output = formatSlideOutput(slides);
      expect(output).toContain('- Point 1');
      expect(output).toContain('- Point 2');
    });

    it('renders image markdown', () => {
      const slides = [makeSlideResult({ imageUrl: 'https://img.com/s.png' })];
      const output = formatSlideOutput(slides);
      expect(output).toContain('[![Slide 1](https://img.com/s.png)](https://img.com/s.png)');
    });

    it('handles slides without bullets', () => {
      const slides = [makeSlideResult({ bullets: undefined })];
      const output = formatSlideOutput(slides);
      expect(output).not.toContain('- ');
    });
  });

  // ===== generateSlideCompletionMetadata =====

  describe('generateSlideCompletionMetadata', () => {
    it('returns an empty string', () => {
      const result = generateSlideCompletionMetadata([makeSlideResult()]);
      expect(result).toBe('');
    });

    it('returns an empty string with qcResult', () => {
      const result = generateSlideCompletionMetadata(
        [makeSlideResult()],
        { passed: true, overallScore: 0.95, feedback: 'OK', issues: [] },
        0
      );
      expect(result).toBe('');
    });
  });

  // ===== generateSingleSlide =====

  describe('generateSingleSlide', () => {
    let mockInsert: ReturnType<typeof vi.fn>;
    let mockUpdate: ReturnType<typeof vi.fn>;
    let mockEq: ReturnType<typeof vi.fn>;

    beforeEach(() => {
      mockEq = vi.fn().mockResolvedValue({ data: null, error: null });
      mockUpdate = vi.fn().mockReturnValue({ eq: mockEq });
      mockInsert = vi.fn().mockResolvedValue({ data: null, error: null });

      vi.mocked(untypedFrom).mockReturnValue({
        insert: mockInsert,
        update: mockUpdate,
      } as unknown as ReturnType<typeof untypedFrom>);

      vi.mocked(enhanceImagePrompt).mockResolvedValue('enhanced prompt');
      vi.mocked(generateImage).mockResolvedValue({
        id: 'flux-req-1',
        status: 'Ready',
        imageUrl: 'https://flux.com/bg.png',
        seed: 42,
        model: 'flux-2-pro',
        prompt: 'enhanced prompt',
        enhancedPrompt: 'enhanced',
        dimensions: { width: 1280, height: 720 },
        cost: 5,
        completedAt: new Date(),
      });
      vi.mocked(downloadAndStore).mockResolvedValue('https://storage.com/final.png');
    });

    it('returns a SlideResult on success', async () => {
      const slide = makeSlideInput();
      const options = makeOptions();
      const result = await generateSingleSlide(slide, options);

      expect(result).not.toBeNull();
      expect(result!.slideNumber).toBe(1);
      expect(result!.title).toBe('Test Slide');
      expect(result!.imageUrl).toBe('https://storage.com/final.png');
    });

    it('calls enhanceImagePrompt with the slide prompt', async () => {
      const slide = makeSlideInput({ prompt: 'mountains' });
      await generateSingleSlide(slide, makeOptions());
      expect(enhanceImagePrompt).toHaveBeenCalledWith('mountains', {
        type: 'create',
        aspectRatio: '16:9',
      });
    });

    it('creates a generation record in the database', async () => {
      await generateSingleSlide(makeSlideInput(), makeOptions());
      expect(untypedFrom).toHaveBeenCalledWith(expect.anything(), 'generations');
      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: 'user-1',
          type: 'slide',
          model: 'flux-2-pro',
          status: 'processing',
        })
      );
    });

    it('calls generateImage with correct dimensions', async () => {
      await generateSingleSlide(makeSlideInput(), makeOptions());
      expect(generateImage).toHaveBeenCalledWith(
        'enhanced prompt',
        expect.objectContaining({
          model: 'flux-2-pro',
          width: SLIDE_WIDTH,
          height: SLIDE_HEIGHT,
          promptUpsampling: true,
        })
      );
    });

    it('updates the generation record on completion', async () => {
      await generateSingleSlide(makeSlideInput(), makeOptions());
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'completed',
          result_url: 'https://storage.com/final.png',
        })
      );
    });

    it('returns null on error', async () => {
      vi.mocked(enhanceImagePrompt).mockRejectedValue(new Error('API down'));
      const result = await generateSingleSlide(makeSlideInput(), makeOptions());
      expect(result).toBeNull();
    });

    it('includes seed and enhancedPrompt in result', async () => {
      const result = await generateSingleSlide(makeSlideInput(), makeOptions());
      expect(result!.seed).toBe(42);
      expect(result!.enhancedPrompt).toBe('enhanced');
    });

    it('passes conversationId as null when not provided', async () => {
      const opts = makeOptions({ conversationId: undefined });
      await generateSingleSlide(makeSlideInput(), opts);
      expect(mockInsert).toHaveBeenCalledWith(expect.objectContaining({ conversation_id: null }));
    });

    it('records source=button in input_data', async () => {
      const opts = makeOptions({ source: 'button' });
      await generateSingleSlide(makeSlideInput(), opts);
      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          input_data: expect.objectContaining({
            fromButton: true,
            detectedFromChat: false,
          }),
        })
      );
    });
  });

  // ===== generateSlides =====

  describe('generateSlides', () => {
    let mockInsert: ReturnType<typeof vi.fn>;
    let mockUpdate: ReturnType<typeof vi.fn>;
    let mockEq: ReturnType<typeof vi.fn>;

    beforeEach(() => {
      mockEq = vi.fn().mockResolvedValue({ data: null, error: null });
      mockUpdate = vi.fn().mockReturnValue({ eq: mockEq });
      mockInsert = vi.fn().mockResolvedValue({ data: null, error: null });

      vi.mocked(untypedFrom).mockReturnValue({
        insert: mockInsert,
        update: mockUpdate,
      } as unknown as ReturnType<typeof untypedFrom>);

      vi.mocked(enhanceImagePrompt).mockResolvedValue('enhanced');
      vi.mocked(generateImage).mockResolvedValue({
        id: 'flux-req-2',
        status: 'Ready',
        imageUrl: 'https://flux.com/bg.png',
        seed: 1,
        model: 'flux-2-pro',
        prompt: 'enhanced',
        enhancedPrompt: 'enhanced',
        dimensions: { width: 1280, height: 720 },
        cost: 5,
        completedAt: new Date(),
      });
      vi.mocked(downloadAndStore).mockResolvedValue('https://storage.com/final.png');
    });

    it('returns results for all successfully generated slides', async () => {
      const slides = [makeSlideInput({ slideNumber: 1 }), makeSlideInput({ slideNumber: 2 })];
      const results = await generateSlides(slides, makeOptions());
      expect(results).toHaveLength(2);
    });

    it('calls onProgress for each slide', async () => {
      const onProgress = vi.fn();
      const slides = [makeSlideInput({ slideNumber: 1 })];
      await generateSlides(slides, makeOptions({ onProgress }));
      // Should call for start and for complete
      expect(onProgress).toHaveBeenCalledTimes(2);
    });

    it('continues when a slide fails and still returns successes', async () => {
      vi.mocked(enhanceImagePrompt)
        .mockResolvedValueOnce('enhanced')
        .mockRejectedValueOnce(new Error('fail'))
        .mockResolvedValueOnce('enhanced');

      const slides = [
        makeSlideInput({ slideNumber: 1 }),
        makeSlideInput({ slideNumber: 2 }),
        makeSlideInput({ slideNumber: 3 }),
      ];
      const results = await generateSlides(slides, makeOptions());
      expect(results).toHaveLength(2);
    });

    it('returns empty array when all slides fail', async () => {
      vi.mocked(enhanceImagePrompt).mockRejectedValue(new Error('fail'));
      const slides = [makeSlideInput({ slideNumber: 1 })];
      const results = await generateSlides(slides, makeOptions());
      expect(results).toHaveLength(0);
    });
  });
});
