/**
 * Image Compression Utility
 *
 * Compresses images on the client side to reduce payload size
 * and avoid HTTP 413 errors when uploading to the API.
 *
 * Target: Keep compressed images under ~700KB base64 (~500KB raw)
 * Vercel has a hard 4.5MB request limit, so we need to be aggressive.
 */

export interface CompressedImage {
  dataUrl: string;
  originalSize: number;
  compressedSize: number;
  width: number;
  height: number;
}

// Maximum dimensions for uploaded images (aggressive for mobile uploads)
const MAX_DIMENSION = 1200;

// Target maximum size for compressed image (in bytes)
// 500KB raw = ~700KB base64, leaving room for message text and history
const TARGET_MAX_SIZE = 500 * 1024;

// JPEG quality settings (0.0 to 1.0) - more aggressive
const QUALITY_HIGH = 0.7;
const QUALITY_MEDIUM = 0.5;
const QUALITY_LOW = 0.3;
const QUALITY_MINIMUM = 0.2;

/**
 * Compress an image file to reduce its size
 * @param file - The image file to compress
 * @returns Promise resolving to compressed image data URL
 */
export async function compressImage(file: File): Promise<CompressedImage> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      reject(new Error('Failed to get canvas context'));
      return;
    }

    // Create object URL to load the image
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      // Clean up object URL
      URL.revokeObjectURL(objectUrl);

      const originalSize = file.size;

      // Calculate new dimensions while maintaining aspect ratio
      let width = img.width;
      let height = img.height;

      if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
        if (width > height) {
          height = Math.round((height / width) * MAX_DIMENSION);
          width = MAX_DIMENSION;
        } else {
          width = Math.round((width / height) * MAX_DIMENSION);
          height = MAX_DIMENSION;
        }
      }

      canvas.width = width;
      canvas.height = height;

      // Draw image to canvas
      ctx.drawImage(img, 0, 0, width, height);

      // Try different quality levels to get under target size
      let quality = QUALITY_HIGH;
      let dataUrl = canvas.toDataURL('image/jpeg', quality);
      let compressedSize = Math.round((dataUrl.length * 3) / 4); // Approximate raw size from base64

      // Progressively reduce quality until under target
      const qualities = [QUALITY_MEDIUM, QUALITY_LOW, QUALITY_MINIMUM];
      for (const q of qualities) {
        if (compressedSize <= TARGET_MAX_SIZE) break;
        quality = q;
        dataUrl = canvas.toDataURL('image/jpeg', quality);
        compressedSize = Math.round((dataUrl.length * 3) / 4);
      }

      // If still too large after all quality reductions, reduce dimensions
      if (compressedSize > TARGET_MAX_SIZE) {
        const scaleFactor = Math.sqrt(TARGET_MAX_SIZE / compressedSize) * 0.9; // 10% extra margin
        width = Math.round(width * scaleFactor);
        height = Math.round(height * scaleFactor);

        canvas.width = width;
        canvas.height = height;
        ctx.drawImage(img, 0, 0, width, height);

        dataUrl = canvas.toDataURL('image/jpeg', QUALITY_LOW);
        compressedSize = Math.round((dataUrl.length * 3) / 4);
      }

      // Log compression results for debugging
      // eslint-disable-next-line no-console
      console.log('[ImageCompression] Compressed image:', {
        originalSize: `${(originalSize / 1024).toFixed(1)}KB`,
        compressedSize: `${(compressedSize / 1024).toFixed(1)}KB`,
        reduction: `${((1 - compressedSize / originalSize) * 100).toFixed(1)}%`,
        dimensions: `${width}x${height}`,
        quality,
      });

      resolve({
        dataUrl,
        originalSize,
        compressedSize,
        width,
        height,
      });
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Failed to load image'));
    };

    img.src = objectUrl;
  });
}

/**
 * Check if a file is an image
 */
export function isImageFile(file: File): boolean {
  return file.type.startsWith('image/');
}

/**
 * Get estimated base64 size from raw size
 */
export function estimateBase64Size(rawSize: number): number {
  return Math.ceil(rawSize * 1.37); // Base64 adds ~37% overhead
}
