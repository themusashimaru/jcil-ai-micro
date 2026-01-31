/**
 * BFL IMAGE STORAGE
 *
 * Handles downloading temporary BFL image URLs and storing them
 * permanently in Supabase Storage. BFL images expire in 10 minutes,
 * so this must be called immediately after generation.
 */

import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { logger } from '@/lib/logger';
import { BFLError } from './types';

const log = logger('BFLStorage');

// Storage bucket for generated images
const STORAGE_BUCKET = 'generations';

// Supported image formats
type ImageFormat = 'png' | 'jpeg' | 'webp';

const MIME_TYPES: Record<ImageFormat, string> = {
  png: 'image/png',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
};

/**
 * Download image from BFL temporary URL and store in Supabase
 *
 * @param imageUrl - Temporary BFL image URL (expires in 10 minutes)
 * @param userId - User who owns this generation
 * @param generationId - Unique generation identifier
 * @param format - Image format (default: png)
 * @returns Permanent Supabase Storage URL
 */
export async function downloadAndStore(
  imageUrl: string,
  userId: string,
  generationId: string,
  format: ImageFormat = 'png'
): Promise<string> {
  log.info('Downloading BFL image', { generationId, userId });

  // Download the image from BFL
  const response = await fetch(imageUrl);
  if (!response.ok) {
    throw new BFLError(
      `Failed to download image: ${response.status} ${response.statusText}`,
      'DOWNLOAD_FAILED',
      response.status
    );
  }

  const imageBuffer = await response.arrayBuffer();
  const imageBytes = new Uint8Array(imageBuffer);

  log.info('Image downloaded', {
    generationId,
    sizeBytes: imageBytes.length,
  });

  // Build storage path: generations/{userId}/{generationId}.{format}
  const storagePath = `${userId}/${generationId}.${format}`;

  // Upload to Supabase Storage
  const supabase = createServiceRoleClient();

  const { data, error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(storagePath, imageBytes, {
      contentType: MIME_TYPES[format],
      upsert: false, // Don't overwrite existing files
    });

  if (error) {
    log.error('Failed to upload to storage', {
      generationId,
      error: error.message,
    });
    throw new BFLError(`Failed to store image: ${error.message}`, 'STORAGE_FAILED');
  }

  // Get public URL for the stored image
  const { data: urlData } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(data.path);

  log.info('Image stored successfully', {
    generationId,
    path: data.path,
  });

  return urlData.publicUrl;
}

/**
 * Store a buffer directly to Supabase Storage
 *
 * @param buffer - Image buffer (e.g., from canvas rendering)
 * @param userId - User who owns this generation
 * @param generationId - Unique generation identifier
 * @param format - Image format (default: png)
 * @returns Permanent Supabase Storage URL
 */
export async function storeBuffer(
  buffer: Buffer | Uint8Array,
  userId: string,
  generationId: string,
  format: ImageFormat = 'png'
): Promise<string> {
  log.info('Storing buffer to storage', { generationId, userId, sizeBytes: buffer.length });

  const bytes = buffer instanceof Buffer ? new Uint8Array(buffer) : buffer;
  const storagePath = `${userId}/${generationId}.${format}`;

  const supabase = createServiceRoleClient();

  const { data, error } = await supabase.storage.from(STORAGE_BUCKET).upload(storagePath, bytes, {
    contentType: MIME_TYPES[format],
    upsert: false,
  });

  if (error) {
    log.error('Failed to upload buffer to storage', {
      generationId,
      error: error.message,
    });
    throw new BFLError(`Failed to store image: ${error.message}`, 'STORAGE_FAILED');
  }

  const { data: urlData } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(data.path);

  log.info('Buffer stored successfully', {
    generationId,
    path: data.path,
  });

  return urlData.publicUrl;
}

/**
 * Store a base64-encoded image directly to Supabase
 *
 * @param base64Data - Base64-encoded image data (with or without data URL prefix)
 * @param userId - User who owns this generation
 * @param generationId - Unique generation identifier
 * @param format - Image format (default: png)
 * @returns Permanent Supabase Storage URL
 */
export async function storeBase64Image(
  base64Data: string,
  userId: string,
  generationId: string,
  format: ImageFormat = 'png'
): Promise<string> {
  // Strip data URL prefix if present
  const base64Clean = base64Data.replace(/^data:[^;]+;base64,/, '');

  // Convert base64 to Uint8Array
  const binaryString = atob(base64Clean);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  // Build storage path
  const storagePath = `${userId}/${generationId}.${format}`;

  const supabase = createServiceRoleClient();

  const { data, error } = await supabase.storage.from(STORAGE_BUCKET).upload(storagePath, bytes, {
    contentType: MIME_TYPES[format],
    upsert: false,
  });

  if (error) {
    throw new BFLError(`Failed to store image: ${error.message}`, 'STORAGE_FAILED');
  }

  const { data: urlData } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(data.path);

  return urlData.publicUrl;
}

/**
 * Delete a stored generation
 *
 * @param userId - User who owns the generation
 * @param generationId - Generation identifier
 * @param format - Image format
 */
export async function deleteGeneration(
  userId: string,
  generationId: string,
  format: ImageFormat = 'png'
): Promise<void> {
  const storagePath = `${userId}/${generationId}.${format}`;

  const supabase = createServiceRoleClient();

  const { error } = await supabase.storage.from(STORAGE_BUCKET).remove([storagePath]);

  if (error) {
    log.warn('Failed to delete generation', {
      generationId,
      error: error.message,
    });
  }
}

/**
 * Get a signed URL for temporary access to a private generation
 *
 * @param userId - User who owns the generation
 * @param generationId - Generation identifier
 * @param format - Image format
 * @param expiresIn - URL expiration in seconds (default: 1 hour)
 * @returns Signed URL
 */
export async function getSignedUrl(
  userId: string,
  generationId: string,
  format: ImageFormat = 'png',
  expiresIn: number = 3600
): Promise<string> {
  const storagePath = `${userId}/${generationId}.${format}`;

  const supabase = createServiceRoleClient();

  const { data, error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .createSignedUrl(storagePath, expiresIn);

  if (error) {
    throw new BFLError(`Failed to create signed URL: ${error.message}`, 'SIGNED_URL_FAILED');
  }

  return data.signedUrl;
}

/**
 * Check if a generation exists in storage
 */
export async function generationExists(
  userId: string,
  generationId: string,
  format: ImageFormat = 'png'
): Promise<boolean> {
  const supabase = createServiceRoleClient();

  const { data, error } = await supabase.storage.from(STORAGE_BUCKET).list(userId, {
    search: `${generationId}.${format}`,
  });

  if (error) {
    log.warn('Failed to check generation existence', { error: error.message });
    return false;
  }

  return data.length > 0;
}

/**
 * List all generations for a user
 */
export async function listUserGenerations(
  userId: string,
  options: {
    limit?: number;
    offset?: number;
    sortBy?: { column: string; order: 'asc' | 'desc' };
  } = {}
): Promise<{ name: string; created_at: string }[]> {
  const supabase = createServiceRoleClient();

  const { data, error } = await supabase.storage.from(STORAGE_BUCKET).list(userId, {
    limit: options.limit ?? 100,
    offset: options.offset ?? 0,
    sortBy: options.sortBy ?? { column: 'created_at', order: 'desc' },
  });

  if (error) {
    throw new BFLError(`Failed to list generations: ${error.message}`, 'LIST_FAILED');
  }

  return data.map((file) => ({
    name: file.name,
    created_at: file.created_at || new Date().toISOString(),
  }));
}
