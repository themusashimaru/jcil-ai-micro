/**
 * IMAGE FETCHER UTILITY
 * Fetches images from URLs and returns Buffers for embedding in documents.
 *
 * Used by all document generators (PDF, DOCX, PPTX, Invoice) to embed
 * logos, photos, and other images.
 */

import { logger } from '@/lib/logger';

const log = logger('ImageFetcher');

const FETCH_TIMEOUT = 10_000; // 10 seconds
const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB

/**
 * Fetch an image from a URL and return it as a Buffer.
 * Returns null if the fetch fails (no throw — generators can gracefully skip).
 */
export async function fetchImageBuffer(
  url: string
): Promise<{ buffer: Buffer; mimeType: string } | null> {
  try {
    // Validate URL
    if (!url || typeof url !== 'string') return null;

    // Handle data URLs (base64)
    if (url.startsWith('data:')) {
      const match = url.match(/^data:([^;]+);base64,(.+)$/);
      if (!match) return null;
      return {
        buffer: Buffer.from(match[2], 'base64'),
        mimeType: match[1],
      };
    }

    // Validate it's an HTTP(S) URL
    if (!url.startsWith('http://') && !url.startsWith('https://')) return null;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT);

    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'JCIL-AI/1.0 (Document Generator)',
          Accept: 'image/*',
        },
      });

      if (!response.ok) {
        log.warn('Image fetch failed', { url, status: response.status });
        return null;
      }

      const contentLength = response.headers.get('content-length');
      if (contentLength && parseInt(contentLength) > MAX_IMAGE_SIZE) {
        log.warn('Image too large', { url, size: contentLength });
        return null;
      }

      const contentType = response.headers.get('content-type') || 'image/png';
      const arrayBuffer = await response.arrayBuffer();

      if (arrayBuffer.byteLength > MAX_IMAGE_SIZE) {
        log.warn('Image too large after download', { url, size: arrayBuffer.byteLength });
        return null;
      }

      return {
        buffer: Buffer.from(arrayBuffer),
        mimeType: contentType.split(';')[0].trim(),
      };
    } finally {
      clearTimeout(timeout);
    }
  } catch (error) {
    log.warn('Image fetch error', { url, error: error instanceof Error ? error.message : error });
    return null;
  }
}

/**
 * Determine image dimensions from a buffer (basic check for PNG/JPEG).
 * Returns default dimensions if unable to detect.
 */
export function getImageDimensions(
  buffer: Buffer,
  mimeType: string
): { width: number; height: number } {
  try {
    if (mimeType.includes('png') && buffer.length > 24) {
      // PNG: width at offset 16, height at offset 20 (big-endian 32-bit)
      const width = buffer.readUInt32BE(16);
      const height = buffer.readUInt32BE(20);
      if (width > 0 && width < 20000 && height > 0 && height < 20000) {
        return { width, height };
      }
    }

    if ((mimeType.includes('jpeg') || mimeType.includes('jpg')) && buffer.length > 4) {
      // JPEG: scan for SOF0 marker (0xFF 0xC0) to find dimensions
      for (let i = 0; i < buffer.length - 10; i++) {
        if (buffer[i] === 0xff && buffer[i + 1] === 0xc0) {
          const height = buffer.readUInt16BE(i + 5);
          const width = buffer.readUInt16BE(i + 7);
          if (width > 0 && width < 20000 && height > 0 && height < 20000) {
            return { width, height };
          }
        }
      }
    }
  } catch {
    // Fall through to defaults
  }

  return { width: 400, height: 300 }; // Safe defaults
}
