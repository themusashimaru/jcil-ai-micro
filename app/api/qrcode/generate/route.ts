/**
 * QR Code Generation API
 *
 * Generates functional QR codes that can be scanned.
 * Returns a PNG data URL.
 */

import { NextRequest } from 'next/server';
import QRCode from 'qrcode';
import { logger } from '@/lib/logger';
import { requireUser } from '@/lib/auth/user-guard';
import { successResponse, errors, checkRequestRateLimit, rateLimits } from '@/lib/api/utils';

const log = logger('QRCodeAPI');

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  const auth = await requireUser(request);
  if (!auth.authorized) return auth.response;
  const { user } = auth;

  // Rate limit: use strict limits for CPU-intensive generation
  const rateLimitResult = await checkRequestRateLimit(`qrcode:${user.id}`, rateLimits.strict);
  if (!rateLimitResult.allowed) {
    return errors.rateLimited();
  }

  try {
    const body = await request.json();
    const { data, size = 300, darkColor = '#000000', lightColor = '#ffffff' } = body;

    if (!data || typeof data !== 'string') {
      return errors.badRequest('Data is required');
    }

    // Validate data length (QR codes have limits)
    if (data.length > 2953) {
      return errors.badRequest('Data too long for QR code (max 2953 characters)');
    }

    // Validate size
    const clampedSize = Math.min(Math.max(Number(size) || 300, 50), 1000);

    // Generate QR code as data URL
    const qrDataUrl = await QRCode.toDataURL(data, {
      width: clampedSize,
      margin: 2,
      color: {
        dark: String(darkColor).slice(0, 7),
        light: String(lightColor).slice(0, 7),
      },
      errorCorrectionLevel: 'M',
    });

    return successResponse({
      dataUrl: qrDataUrl,
      data: data,
      size: clampedSize,
    });
  } catch (error) {
    log.error(
      '[QR Code API] Error generating QR code:',
      error instanceof Error ? error : { error }
    );
    return errors.serverError('Failed to generate QR code');
  }
}
