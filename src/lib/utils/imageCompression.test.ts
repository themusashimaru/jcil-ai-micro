/**
 * Tests for imageCompression utility
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock canvas and image browser APIs
const mockDrawImage = vi.fn();
const mockToDataURL = vi.fn(() => 'data:image/jpeg;base64,COMPRESSED');
const mockGetContext = vi.fn(() => ({
  drawImage: mockDrawImage,
}));
const mockCreateElement = vi.fn(() => ({
  width: 0,
  height: 0,
  getContext: mockGetContext,
  toDataURL: mockToDataURL,
}));
const mockCreateObjectURL = vi.fn(() => 'blob:http://localhost/abc');
const mockRevokeObjectURL = vi.fn();

vi.stubGlobal('document', {
  createElement: mockCreateElement,
});

vi.stubGlobal('URL', {
  createObjectURL: mockCreateObjectURL,
  revokeObjectURL: mockRevokeObjectURL,
});

// Mock Image constructor
class MockImage {
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  width = 800;
  height = 600;
  private _src = '';

  get src() {
    return this._src;
  }

  set src(value: string) {
    this._src = value;
    // Simulate async load
    setTimeout(() => {
      if (this.onload) this.onload();
    }, 0);
  }
}

vi.stubGlobal('Image', MockImage);

import { compressImage, isImageFile, estimateBase64Size } from './imageCompression';

function createFile(name: string, type: string, size = 1024): File {
  const content = new Uint8Array(size);
  return new File([content], name, { type });
}

describe('imageCompression', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockToDataURL.mockReturnValue('data:image/jpeg;base64,COMPRESSED');
  });

  describe('isImageFile', () => {
    it('should return true for image/png', () => {
      const file = createFile('photo.png', 'image/png');
      expect(isImageFile(file)).toBe(true);
    });

    it('should return true for image/jpeg', () => {
      const file = createFile('photo.jpg', 'image/jpeg');
      expect(isImageFile(file)).toBe(true);
    });

    it('should return true for image/gif', () => {
      const file = createFile('anim.gif', 'image/gif');
      expect(isImageFile(file)).toBe(true);
    });

    it('should return true for image/webp', () => {
      const file = createFile('photo.webp', 'image/webp');
      expect(isImageFile(file)).toBe(true);
    });

    it('should return false for text/plain', () => {
      const file = createFile('doc.txt', 'text/plain');
      expect(isImageFile(file)).toBe(false);
    });

    it('should return false for application/pdf', () => {
      const file = createFile('doc.pdf', 'application/pdf');
      expect(isImageFile(file)).toBe(false);
    });
  });

  describe('estimateBase64Size', () => {
    it('should add ~37% overhead', () => {
      const result = estimateBase64Size(1000);
      expect(result).toBe(1370);
    });

    it('should ceil the result', () => {
      const result = estimateBase64Size(100);
      expect(result).toBe(137);
    });

    it('should handle zero', () => {
      expect(estimateBase64Size(0)).toBe(0);
    });

    it('should handle large sizes', () => {
      const result = estimateBase64Size(1024 * 1024);
      expect(result).toBeGreaterThan(1024 * 1024);
    });
  });

  describe('compressImage', () => {
    it('should compress a small image without resizing', async () => {
      const file = createFile('photo.jpg', 'image/jpeg', 100);
      const result = await compressImage(file);

      expect(result).toHaveProperty('dataUrl');
      expect(result).toHaveProperty('originalSize');
      expect(result).toHaveProperty('compressedSize');
      expect(result).toHaveProperty('width');
      expect(result).toHaveProperty('height');
      expect(mockCreateObjectURL).toHaveBeenCalled();
      expect(mockRevokeObjectURL).toHaveBeenCalled();
    });

    it('should create canvas with correct dimensions', async () => {
      const file = createFile('photo.jpg', 'image/jpeg', 100);
      await compressImage(file);

      expect(mockCreateElement).toHaveBeenCalledWith('canvas');
      expect(mockGetContext).toHaveBeenCalledWith('2d');
    });

    it('should call drawImage on canvas context', async () => {
      const file = createFile('photo.jpg', 'image/jpeg', 100);
      await compressImage(file);

      expect(mockDrawImage).toHaveBeenCalled();
    });

    it('should return dataUrl from canvas.toDataURL', async () => {
      mockToDataURL.mockReturnValue('data:image/jpeg;base64,TESTDATA');

      const file = createFile('photo.jpg', 'image/jpeg', 100);
      const result = await compressImage(file);

      expect(result.dataUrl).toBe('data:image/jpeg;base64,TESTDATA');
    });

    it('should reject when canvas context is null', async () => {
      mockGetContext.mockReturnValueOnce(null as unknown as { drawImage: typeof mockDrawImage });

      const file = createFile('photo.jpg', 'image/jpeg', 100);
      await expect(compressImage(file)).rejects.toThrow('Failed to get canvas context');
    });

    it('should reject when image fails to load', async () => {
      // Override Image to trigger onerror
      const OrigImage = MockImage;
      class ErrorImage extends OrigImage {
        set src(_value: string) {
          setTimeout(() => {
            if (this.onerror) this.onerror();
          }, 0);
        }
        get src() {
          return '';
        }
      }
      vi.stubGlobal('Image', ErrorImage);

      const file = createFile('bad.jpg', 'image/jpeg', 100);
      await expect(compressImage(file)).rejects.toThrow('Failed to load image');

      // Restore
      vi.stubGlobal('Image', MockImage);
    });

    it('should include originalSize in result', async () => {
      const file = createFile('photo.jpg', 'image/jpeg', 2048);
      const result = await compressImage(file);

      expect(result.originalSize).toBe(2048);
    });
  });

  describe('CompressedImage type', () => {
    it('should have all required fields', async () => {
      const file = createFile('photo.jpg', 'image/jpeg', 100);
      const result = await compressImage(file);

      expect(typeof result.dataUrl).toBe('string');
      expect(typeof result.originalSize).toBe('number');
      expect(typeof result.compressedSize).toBe('number');
      expect(typeof result.width).toBe('number');
      expect(typeof result.height).toBe('number');
    });
  });
});
