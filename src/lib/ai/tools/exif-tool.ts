/**
 * EXIF/IMAGE METADATA TOOL
 *
 * Extract metadata from images using exifr.
 * Runs entirely locally - no external API costs.
 *
 * Extracts:
 * - Camera settings (aperture, shutter, ISO)
 * - GPS coordinates
 * - Date/time taken
 * - Camera/lens info
 * - Thumbnail extraction
 *
 * Created: 2026-01-31
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// Lazy-loaded exifr
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let exifr: any = null;

async function initExifr(): Promise<boolean> {
  if (exifr) return true;
  try {
    const mod = await import('exifr');
    exifr = mod.default || mod;
    return true;
  } catch {
    return false;
  }
}

// ============================================================================
// TOOL DEFINITION
// ============================================================================

export const exifTool: UnifiedTool = {
  name: 'image_metadata',
  description: `Extract metadata (EXIF, IPTC, XMP) from images.

Extracts:
- Camera information (make, model, lens)
- Photo settings (aperture, shutter speed, ISO, focal length)
- GPS coordinates (latitude, longitude, altitude)
- Date and time (taken, modified)
- Image dimensions and orientation
- Copyright and author info
- Thumbnail (if embedded)

Supported formats: JPEG, TIFF, PNG, HEIC, AVIF, WebP

Use cases:
- Get photo location for mapping
- Analyze camera settings
- Extract creation date
- Get image dimensions
- Find camera/lens used`,
  parameters: {
    type: 'object',
    properties: {
      image_data: {
        type: 'string',
        description: 'Base64 encoded image data',
      },
      extract: {
        type: 'array',
        items: { type: 'string' },
        description:
          'What metadata to extract. Options: all, gps, camera, settings, dates, thumbnail, icc, iptc, xmp. Default: all basic info',
      },
      include_thumbnail: {
        type: 'boolean',
        description: 'Include embedded thumbnail as base64 (default: false)',
      },
    },
    required: ['image_data'],
  },
};

// ============================================================================
// AVAILABILITY CHECK
// ============================================================================

export function isExifAvailable(): boolean {
  return true;
}

// ============================================================================
// EXECUTOR
// ============================================================================

export async function executeExif(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const args = toolCall.arguments as {
    image_data: string;
    extract?: string[];
    include_thumbnail?: boolean;
  };

  if (!args.image_data) {
    return {
      toolCallId: toolCall.id,
      content: JSON.stringify({ error: 'Image data is required' }),
      isError: true,
    };
  }

  try {
    const initialized = await initExifr();
    if (!initialized) {
      return {
        toolCallId: toolCall.id,
        content: JSON.stringify({ error: 'Failed to initialize exifr' }),
        isError: true,
      };
    }

    const imageBuffer = Buffer.from(args.image_data, 'base64');
    const extractTypes = args.extract || ['all'];

    const result: Record<string, unknown> = {};

    // Parse full EXIF data
    const fullData = await exifr.parse(imageBuffer, {
      tiff: true,
      exif: true,
      gps: true,
      iptc: true,
      xmp: true,
      icc: extractTypes.includes('icc') || extractTypes.includes('all'),
    });

    if (!fullData) {
      return {
        toolCallId: toolCall.id,
        content: JSON.stringify({
          warning: 'No metadata found in image',
          has_metadata: false,
        }),
        isError: false,
      };
    }

    // Extract requested data types
    if (extractTypes.includes('all') || extractTypes.includes('camera')) {
      result.camera = {
        make: fullData.Make,
        model: fullData.Model,
        lens_make: fullData.LensMake,
        lens_model: fullData.LensModel,
        software: fullData.Software,
      };
    }

    if (extractTypes.includes('all') || extractTypes.includes('settings')) {
      result.settings = {
        aperture: fullData.FNumber ? `f/${fullData.FNumber}` : null,
        shutter_speed: fullData.ExposureTime
          ? fullData.ExposureTime < 1
            ? `1/${Math.round(1 / fullData.ExposureTime)}s`
            : `${fullData.ExposureTime}s`
          : null,
        iso: fullData.ISO,
        focal_length: fullData.FocalLength ? `${fullData.FocalLength}mm` : null,
        focal_length_35mm: fullData.FocalLengthIn35mmFormat
          ? `${fullData.FocalLengthIn35mmFormat}mm`
          : null,
        exposure_compensation: fullData.ExposureCompensation,
        flash: fullData.Flash,
        metering_mode: fullData.MeteringMode,
        white_balance: fullData.WhiteBalance,
      };
    }

    if (extractTypes.includes('all') || extractTypes.includes('gps')) {
      if (fullData.latitude !== undefined && fullData.longitude !== undefined) {
        result.gps = {
          latitude: fullData.latitude,
          longitude: fullData.longitude,
          altitude: fullData.GPSAltitude,
          altitude_ref: fullData.GPSAltitudeRef,
          speed: fullData.GPSSpeed,
          direction: fullData.GPSImgDirection,
          maps_url: `https://www.google.com/maps?q=${fullData.latitude},${fullData.longitude}`,
        };
      } else {
        result.gps = null;
      }
    }

    if (extractTypes.includes('all') || extractTypes.includes('dates')) {
      result.dates = {
        taken: fullData.DateTimeOriginal?.toISOString() || fullData.CreateDate?.toISOString(),
        digitized: fullData.DateTimeDigitized?.toISOString(),
        modified: fullData.ModifyDate?.toISOString(),
      };
    }

    // Basic image info
    result.image = {
      width: fullData.ImageWidth || fullData.ExifImageWidth,
      height: fullData.ImageHeight || fullData.ExifImageHeight,
      orientation: fullData.Orientation,
      color_space: fullData.ColorSpace,
      bit_depth: fullData.BitsPerSample,
    };

    // Copyright/Author
    if (fullData.Copyright || fullData.Artist || fullData.Author) {
      result.attribution = {
        copyright: fullData.Copyright,
        artist: fullData.Artist,
        author: fullData.Author,
      };
    }

    // IPTC data
    if (extractTypes.includes('iptc') || extractTypes.includes('all')) {
      if (fullData.ObjectName || fullData.Caption || fullData.Keywords) {
        result.iptc = {
          title: fullData.ObjectName,
          caption: fullData.Caption,
          keywords: fullData.Keywords,
          category: fullData.Category,
          city: fullData.City,
          country: fullData.Country,
        };
      }
    }

    // Thumbnail extraction
    if (args.include_thumbnail || extractTypes.includes('thumbnail')) {
      try {
        const thumbnail = await exifr.thumbnail(imageBuffer);
        if (thumbnail) {
          result.thumbnail = {
            available: true,
            data_base64: Buffer.from(thumbnail).toString('base64'),
          };
        } else {
          result.thumbnail = { available: false };
        }
      } catch {
        result.thumbnail = { available: false };
      }
    }

    result.has_metadata = true;

    return {
      toolCallId: toolCall.id,
      content: JSON.stringify(result),
      isError: false,
    };
  } catch (error) {
    return {
      toolCallId: toolCall.id,
      content: JSON.stringify({
        error: 'EXIF extraction failed',
        details: error instanceof Error ? error.message : String(error),
      }),
      isError: true,
    };
  }
}
