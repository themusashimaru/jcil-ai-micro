/**
 * DYNAMIC OG IMAGE API
 * Serves the logo from design_settings as an Open Graph image
 * Checks main_logo first, then favicon as fallback
 * Social media crawlers need an actual URL, not base64 data URLs
 */

import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { readFileSync } from 'fs';
import { join } from 'path';
import { logger } from '@/lib/logger';

const log = logger('OGImageAPI');

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      // Return fallback icon
      return serveFallbackIcon();
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    // Fetch the design settings - check main_logo and favicon
    const { data, error } = await supabase
      .from('design_settings')
      .select('main_logo, favicon')
      .limit(1)
      .single();

    if (error) {
      return serveFallbackIcon();
    }

    // Prefer main_logo, fall back to favicon
    const logoUrl = data?.main_logo || data?.favicon;

    if (!logoUrl) {
      return serveFallbackIcon();
    }

    // Check if it's a base64 data URL
    if (logoUrl.startsWith('data:')) {
      // Parse the data URL
      const matches = logoUrl.match(/^data:([^;]+);base64,(.+)$/);

      if (!matches) {
        return serveFallbackIcon();
      }

      const mimeType = matches[1];
      const base64Data = matches[2];
      const imageBuffer = Buffer.from(base64Data, 'base64');

      return new NextResponse(imageBuffer, {
        status: 200,
        headers: {
          'Content-Type': mimeType,
          'Cache-Control': 'public, max-age=300, s-maxage=300', // 5 min cache for faster updates
        },
      });
    }

    // If it's a regular URL, redirect to it
    if (logoUrl.startsWith('http')) {
      return NextResponse.redirect(logoUrl);
    }

    // If it's a local path, try to serve it
    if (logoUrl.startsWith('/')) {
      return serveFallbackIcon();
    }

    return serveFallbackIcon();
  } catch (error) {
    log.error('[OG Image API] Error:', error instanceof Error ? error : { error });
    return serveFallbackIcon();
  }
}

function serveFallbackIcon(): NextResponse {
  try {
    // Try to read the fallback icon from public folder
    const iconPath = join(process.cwd(), 'public', 'icon-512.png');
    const iconBuffer = readFileSync(iconPath);

    return new NextResponse(iconBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=300, s-maxage=300',
      },
    });
  } catch {
    // Return a simple 1x1 transparent PNG if all else fails
    const transparentPng = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      'base64'
    );

    return new NextResponse(transparentPng, {
      status: 200,
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=3600, s-maxage=3600',
      },
    });
  }
}
