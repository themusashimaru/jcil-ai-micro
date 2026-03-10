// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { executeExif, isExifAvailable, exifTool } from './exif-tool';

function makeCall(args: Record<string, unknown>) {
  return { id: 'test', name: 'image_metadata', arguments: args };
}

// Create a minimal 1x1 JPEG (no EXIF data) for testing parse paths
// This is the smallest valid JPEG: SOI + APP0 + SOF + SOS + EOI
const MINIMAL_JPEG_B64 =
  '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/xAAUAQEAAAAAAAAAAAAAAAAAAAAA/8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAwDAQACEQMRAD8AKwA//9k=';

// -------------------------------------------------------------------
// Metadata
// -------------------------------------------------------------------
describe('exifTool metadata', () => {
  it('should have correct name', () => {
    expect(exifTool.name).toBe('image_metadata');
  });

  it('should require image_data', () => {
    expect(exifTool.parameters.required).toContain('image_data');
  });
});

describe('isExifAvailable', () => {
  it('should return true', () => {
    expect(isExifAvailable()).toBe(true);
  });
});

// -------------------------------------------------------------------
// Basic extraction (no EXIF in minimal JPEG)
// -------------------------------------------------------------------
describe('executeExif - basic', () => {
  it('should parse image without metadata', async () => {
    const res = await executeExif(makeCall({ image_data: MINIMAL_JPEG_B64 }));
    const result = JSON.parse(res.content);
    // Minimal JPEG has no EXIF, so should report no metadata
    expect(result.has_metadata === false || result.warning).toBeTruthy();
  });

  it('should accept extract parameter', async () => {
    const res = await executeExif(
      makeCall({ image_data: MINIMAL_JPEG_B64, extract: ['camera', 'gps'] })
    );
    expect(res.isError).toBeFalsy();
  });

  it('should accept include_thumbnail parameter', async () => {
    const res = await executeExif(
      makeCall({ image_data: MINIMAL_JPEG_B64, include_thumbnail: true })
    );
    expect(res.isError).toBeFalsy();
  });
});

// -------------------------------------------------------------------
// Error handling
// -------------------------------------------------------------------
describe('executeExif - errors', () => {
  it('should error without image_data', async () => {
    const res = await executeExif(makeCall({}));
    expect(res.isError).toBe(true);
  });

  it('should handle invalid image data gracefully', async () => {
    const res = await executeExif(makeCall({ image_data: 'not-valid-base64-image' }));
    // Should either return error or no-metadata result, not crash
    expect(res.content).toBeDefined();
  });

  it('should return toolCallId', async () => {
    const res = await executeExif({
      id: 'my-id',
      name: 'image_metadata',
      arguments: { image_data: MINIMAL_JPEG_B64 },
    });
    expect(res.toolCallId).toBe('my-id');
  });
});
