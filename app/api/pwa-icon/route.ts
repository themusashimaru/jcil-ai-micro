/**
 * PWA ICON API
 * Serves the favicon image from design settings for PWA home screen icon
 */

import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error('Missing Supabase configuration');
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    // Fetch favicon from design settings
    const { data, error } = await supabase
      .from('design_settings')
      .select('favicon')
      .limit(1)
      .single();

    if (error || !data?.favicon) {
      // Redirect to static fallback icon
      return NextResponse.redirect(new URL('/icon-192.png', request.url));
    }

    const favicon = data.favicon;

    // Check if it's a base64 data URL
    if (!favicon.startsWith('data:')) {
      return NextResponse.redirect(new URL('/icon-192.png', request.url));
    }

    // Parse base64 data URL
    const matches = favicon.match(/^data:([^;]+);base64,(.+)$/);
    if (!matches) {
      return NextResponse.redirect(new URL('/icon-192.png', request.url));
    }

    const mimeType = matches[1];
    const base64Data = matches[2];

    // Convert base64 to buffer
    const imageBuffer = Buffer.from(base64Data, 'base64');

    // Return the image
    return new NextResponse(imageBuffer, {
      headers: {
        'Content-Type': mimeType,
        'Cache-Control': 'public, max-age=86400', // Cache for 24 hours
      },
    });
  } catch (error) {
    console.error('[PWA Icon API] Error:', error);
    // Redirect to static fallback
    return NextResponse.redirect(new URL('/icon-192.png', request.url));
  }
}
