/**
 * DYNAMIC MANIFEST API
 * Generates PWA manifest with dynamic icons from design settings
 */

import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { logger } from '@/lib/logger';

const log = logger('ManifestAPI');

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error('Missing Supabase configuration');
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    // Fetch design settings
    const { data } = await supabase
      .from('design_settings')
      .select('favicon, site_name')
      .limit(1)
      .single();

    // Determine icon URLs - use dynamic API if favicon exists, otherwise fallback to static
    const hasCustomIcon = data?.favicon && data.favicon.startsWith('data:');
    const iconUrl = hasCustomIcon ? '/api/pwa-icon' : '/icon-192.png';
    const iconUrl512 = hasCustomIcon ? '/api/pwa-icon?size=512' : '/icon-512.png';

    const manifest = {
      name: data?.site_name || 'JCIL.ai',
      short_name: data?.site_name || 'JCIL.ai',
      description: 'AI-powered chat through a Christian conservative lens',
      start_url: '/chat',
      scope: '/',
      display: 'standalone',
      background_color: '#000000',
      theme_color: '#000000',
      orientation: 'portrait-primary',
      dir: 'ltr',
      lang: 'en-US',
      prefer_related_applications: false,
      icons: [
        {
          src: iconUrl,
          sizes: '192x192',
          type: 'image/png',
          purpose: 'any maskable',
        },
        {
          src: iconUrl512,
          sizes: '512x512',
          type: 'image/png',
          purpose: 'any maskable',
        },
      ],
      categories: ['productivity', 'utilities', 'business'],
      screenshots: [],
      shortcuts: [
        {
          name: 'New Chat',
          short_name: 'Chat',
          description: 'Start a new chat conversation',
          url: '/chat',
          icons: [{ src: iconUrl, sizes: '192x192' }],
        },
      ],
      share_target: {
        action: '/chat',
        method: 'GET',
        enctype: 'application/x-www-form-urlencoded',
        params: {
          title: 'title',
          text: 'text',
          url: 'url',
        },
      },
    };

    return NextResponse.json(manifest, {
      headers: {
        'Content-Type': 'application/manifest+json',
        'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
      },
    });
  } catch (error) {
    log.error('[Manifest API] Error:', error instanceof Error ? error : { error });

    // Return default manifest on error
    return NextResponse.json(
      {
        name: 'JCIL.ai',
        short_name: 'JCIL.ai',
        description: 'AI-powered chat through a Christian conservative lens',
        start_url: '/chat',
        display: 'standalone',
        background_color: '#000000',
        theme_color: '#000000',
        icons: [
          {
            src: '/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: '/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
          },
        ],
      },
      {
        headers: {
          'Content-Type': 'application/manifest+json',
        },
      }
    );
  }
}
