/**
 * SLIDES INDEX BARREL EXPORT TESTS
 *
 * Tests for src/lib/slides/index.ts
 * Verifies that all public exports are accessible through the barrel export.
 */

import { describe, it, expect } from 'vitest';
import { vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks (hoisted)
// ---------------------------------------------------------------------------

vi.mock('sharp', () => {
  const mockSharp = vi.fn(() => ({
    stats: vi.fn().mockResolvedValue({ dominant: { r: 50, g: 50, b: 50 } }),
    resize: vi.fn().mockReturnThis(),
    composite: vi.fn().mockReturnThis(),
    png: vi.fn().mockReturnThis(),
    toBuffer: vi.fn().mockResolvedValue(Buffer.from('fake')),
  }));
  return { default: mockSharp };
});

vi.mock('@/lib/connectors/bfl', () => ({
  generateImage: vi.fn(),
  downloadAndStore: vi.fn(),
  enhanceImagePrompt: vi.fn(),
}));

vi.mock('@/lib/connectors/bfl/models', () => ({
  ASPECT_RATIOS: {
    '16:9': { width: 1280, height: 720, label: 'Widescreen' },
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
// Imports
// ---------------------------------------------------------------------------

import * as slidesIndex from './index';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('slides/index barrel exports', () => {
  // From text-overlay.ts
  it('exports overlayTextOnSlide', () => {
    expect(slidesIndex.overlayTextOnSlide).toBeDefined();
    expect(typeof slidesIndex.overlayTextOnSlide).toBe('function');
  });

  it('exports overlayTextOnSlideBuffer', () => {
    expect(slidesIndex.overlayTextOnSlideBuffer).toBeDefined();
    expect(typeof slidesIndex.overlayTextOnSlideBuffer).toBe('function');
  });

  it('exports areFontsLoaded', () => {
    expect(slidesIndex.areFontsLoaded).toBeDefined();
    expect(typeof slidesIndex.areFontsLoaded).toBe('function');
  });

  it('exports getFontInfo', () => {
    expect(slidesIndex.getFontInfo).toBeDefined();
    expect(typeof slidesIndex.getFontInfo).toBe('function');
  });

  // From generator.ts - constants
  it('exports MAX_SLIDES_PER_REQUEST', () => {
    expect(slidesIndex.MAX_SLIDES_PER_REQUEST).toBe(10);
  });

  it('exports SLIDE_WIDTH', () => {
    expect(typeof slidesIndex.SLIDE_WIDTH).toBe('number');
  });

  it('exports SLIDE_HEIGHT', () => {
    expect(typeof slidesIndex.SLIDE_HEIGHT).toBe('number');
  });

  // From generator.ts - functions
  it('exports generateSingleSlide', () => {
    expect(typeof slidesIndex.generateSingleSlide).toBe('function');
  });

  it('exports generateSlides', () => {
    expect(typeof slidesIndex.generateSlides).toBe('function');
  });

  it('exports getSlideDesignSystemPrompt', () => {
    expect(typeof slidesIndex.getSlideDesignSystemPrompt).toBe('function');
  });

  it('exports parseSlidePrompts', () => {
    expect(typeof slidesIndex.parseSlidePrompts).toBe('function');
  });

  it('exports formatSlideOutput', () => {
    expect(typeof slidesIndex.formatSlideOutput).toBe('function');
  });

  it('exports generateSlideCompletionMetadata', () => {
    expect(typeof slidesIndex.generateSlideCompletionMetadata).toBe('function');
  });

  it('exports ProgressMessages', () => {
    expect(slidesIndex.ProgressMessages).toBeDefined();
    expect(typeof slidesIndex.ProgressMessages.slideStart).toBe('function');
  });
});
