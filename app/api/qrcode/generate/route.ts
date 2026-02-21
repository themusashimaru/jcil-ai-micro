/**
 * QR Code Generation API
 *
 * Generates functional QR codes that can be scanned.
 * Returns a PNG data URL.
 */

import { NextRequest, NextResponse } from 'next/server';
import QRCode from 'qrcode';
import { logger } from '@/lib/logger';

const log = logger('QRCodeAPI');

export const runtime = 'nodejs';

interface QRCodeRequest {
  data: string;
  size?: number;
  darkColor?: string;
  lightColor?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: QRCodeRequest = await request.json();
    const { data, size = 300, darkColor = '#000000', lightColor = '#ffffff' } = body;

    if (!data || typeof data !== 'string') {
      return NextResponse.json({ error: 'Data is required' }, { status: 400 });
    }

    // Validate data length (QR codes have limits)
    if (data.length > 2953) {
      return NextResponse.json(
        { error: 'Data too long for QR code (max 2953 characters)' },
        { status: 400 }
      );
    }

    // Generate QR code as data URL
    const qrDataUrl = await QRCode.toDataURL(data, {
      width: size,
      margin: 2,
      color: {
        dark: darkColor,
        light: lightColor,
      },
      errorCorrectionLevel: 'M', // Medium error correction
    });

    return NextResponse.json({
      success: true,
      dataUrl: qrDataUrl,
      data: data,
      size: size,
    });
  } catch (error) {
    log.error(
      '[QR Code API] Error generating QR code:',
      error instanceof Error ? error : { error }
    );
    return NextResponse.json({ error: 'Failed to generate QR code' }, { status: 500 });
  }
}
