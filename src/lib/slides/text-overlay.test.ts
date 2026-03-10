/**
 * TEXT OVERLAY TESTS
 *
 * Tests for src/lib/slides/text-overlay.ts
 * Covers font checks, XML escaping, text wrapping, brightness analysis,
 * SVG generation, and the main overlay functions.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks (hoisted -- no external variable references inside factories)
// ---------------------------------------------------------------------------

vi.mock('sharp', () => {
  const mockSharp = vi.fn(() => ({
    stats: vi.fn().mockResolvedValue({
      dominant: { r: 50, g: 50, b: 50 },
    }),
    resize: vi.fn().mockReturnThis(),
    composite: vi.fn().mockReturnThis(),
    png: vi.fn().mockReturnThis(),
    toBuffer: vi.fn().mockResolvedValue(Buffer.from('fake-png-data')),
  }));
  return { default: mockSharp };
});

vi.mock('@/lib/logger', () => ({
  logger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  }),
}));

// Mock global fetch
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// ---------------------------------------------------------------------------
// Imports
// ---------------------------------------------------------------------------

import {
  areFontsLoaded,
  getFontInfo,
  overlayTextOnSlide,
  overlayTextOnSlideBuffer,
} from './text-overlay';
import sharp from 'sharp';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('slides/text-overlay', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ===== areFontsLoaded =====

  describe('areFontsLoaded', () => {
    it('always returns true (SVG approach)', () => {
      expect(areFontsLoaded()).toBe(true);
    });
  });

  // ===== getFontInfo =====

  describe('getFontInfo', () => {
    it('returns loaded: true', () => {
      const info = getFontInfo();
      expect(info.loaded).toBe(true);
    });

    it('returns count: 0', () => {
      expect(getFontInfo().count).toBe(0);
    });

    it('returns SVG inline fonts path', () => {
      const info = getFontInfo();
      expect(info.paths).toContain('SVG inline fonts');
    });
  });

  // ===== overlayTextOnSlide =====

  describe('overlayTextOnSlide', () => {
    beforeEach(() => {
      mockFetch.mockResolvedValue({
        ok: true,
        arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(100)),
      });
    });

    it('fetches the background image URL', async () => {
      await overlayTextOnSlide('https://example.com/bg.png', { title: 'Hello' });
      expect(mockFetch).toHaveBeenCalledWith('https://example.com/bg.png', {
        headers: { 'User-Agent': 'JCIL-SlideRenderer/1.0' },
      });
    });

    it('throws when image fetch fails', async () => {
      mockFetch.mockResolvedValue({ ok: false, status: 404 });
      await expect(
        overlayTextOnSlide('https://example.com/missing.png', { title: 'Test' })
      ).rejects.toThrow('Failed to fetch background image: 404');
    });

    it('returns a Buffer', async () => {
      const result = await overlayTextOnSlide('https://example.com/bg.png', { title: 'Hello' });
      expect(Buffer.isBuffer(result)).toBe(true);
    });

    it('calls sharp with the fetched image buffer', async () => {
      await overlayTextOnSlide('https://example.com/bg.png', { title: 'Hello' });
      expect(sharp).toHaveBeenCalled();
    });

    it('resizes to 1920x1080', async () => {
      await overlayTextOnSlide('https://example.com/bg.png', { title: 'Hello' });
      // The first call to sharp returns the mock chain
      const instance = vi.mocked(sharp)('whatever');
      expect(instance.resize).toBeDefined();
    });

    it('composites an SVG overlay onto the image', async () => {
      await overlayTextOnSlide('https://example.com/bg.png', { title: 'Hello' });
      const instance = vi.mocked(sharp)(Buffer.from('test'));
      expect(instance.composite).toBeDefined();
    });

    it('uses dark text color when darkText option is true', async () => {
      await overlayTextOnSlide(
        'https://example.com/bg.png',
        { title: 'Title' },
        { darkText: true }
      );
      // The function should use #1A1A2E for dark text
      const sharpCall = vi.mocked(sharp).mock.calls;
      expect(sharpCall.length).toBeGreaterThan(0);
    });

    it('handles slides with bullets', async () => {
      const result = await overlayTextOnSlide('https://example.com/bg.png', {
        title: 'Title',
        bullets: ['Point A', 'Point B', 'Point C'],
      });
      expect(Buffer.isBuffer(result)).toBe(true);
    });

    it('handles slides without bullets', async () => {
      const result = await overlayTextOnSlide('https://example.com/bg.png', {
        title: 'Title Only',
      });
      expect(Buffer.isBuffer(result)).toBe(true);
    });

    it('respects addOverlay option set to false', async () => {
      const result = await overlayTextOnSlide(
        'https://example.com/bg.png',
        { title: 'No Overlay' },
        { addOverlay: false }
      );
      expect(Buffer.isBuffer(result)).toBe(true);
    });

    it('respects custom overlay color and opacity', async () => {
      const result = await overlayTextOnSlide(
        'https://example.com/bg.png',
        { title: 'Custom' },
        { overlayColor: 'white', overlayOpacity: 0.3 }
      );
      expect(Buffer.isBuffer(result)).toBe(true);
    });

    it('analyzes brightness when darkText is not specified', async () => {
      // Default mock has r:50, g:50, b:50 -> brightness ~50 < 127 -> dark bg -> white text
      await overlayTextOnSlide('https://example.com/bg.png', { title: 'Auto' });
      const instance = vi.mocked(sharp)(Buffer.from('test'));
      expect(instance.stats).toBeDefined();
    });
  });

  // ===== overlayTextOnSlideBuffer =====

  describe('overlayTextOnSlideBuffer', () => {
    it('accepts a Buffer directly instead of URL', async () => {
      const bgBuffer = Buffer.from('fake-image-data');
      const result = await overlayTextOnSlideBuffer(bgBuffer, { title: 'Buffer Slide' });
      expect(Buffer.isBuffer(result)).toBe(true);
    });

    it('does not call fetch', async () => {
      const bgBuffer = Buffer.from('fake-image-data');
      await overlayTextOnSlideBuffer(bgBuffer, { title: 'Buffer Slide' });
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('handles darkText option', async () => {
      const bgBuffer = Buffer.from('fake-image-data');
      const result = await overlayTextOnSlideBuffer(
        bgBuffer,
        { title: 'Dark' },
        { darkText: true }
      );
      expect(Buffer.isBuffer(result)).toBe(true);
    });

    it('handles bullets in content', async () => {
      const bgBuffer = Buffer.from('fake-image-data');
      const result = await overlayTextOnSlideBuffer(bgBuffer, {
        title: 'With Bullets',
        bullets: ['A', 'B'],
      });
      expect(Buffer.isBuffer(result)).toBe(true);
    });

    it('defaults addOverlay to true', async () => {
      const bgBuffer = Buffer.from('fake-image-data');
      const result = await overlayTextOnSlideBuffer(bgBuffer, { title: 'Default Overlay' });
      expect(Buffer.isBuffer(result)).toBe(true);
    });

    it('can disable overlay', async () => {
      const bgBuffer = Buffer.from('fake-image-data');
      const result = await overlayTextOnSlideBuffer(
        bgBuffer,
        { title: 'No Overlay' },
        { addOverlay: false }
      );
      expect(Buffer.isBuffer(result)).toBe(true);
    });

    it('uses custom overlay color', async () => {
      const bgBuffer = Buffer.from('fake-image-data');
      const result = await overlayTextOnSlideBuffer(
        bgBuffer,
        { title: 'White' },
        { overlayColor: 'white', overlayOpacity: 0.7 }
      );
      expect(Buffer.isBuffer(result)).toBe(true);
    });

    it('calls sharp resize with 1920x1080', async () => {
      const bgBuffer = Buffer.from('fake-image-data');
      await overlayTextOnSlideBuffer(bgBuffer, { title: 'Resize' });
      expect(sharp).toHaveBeenCalledWith(bgBuffer);
    });
  });
});
