/**
 * VISUAL-TO-CODE API
 *
 * Convert screenshots/designs to React components.
 * - POST: Convert image to code
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server-auth';
import { logger } from '@/lib/logger';
import { validateCSRF } from '@/lib/security/csrf';
import { rateLimiters } from '@/lib/security/rate-limit';

export const runtime = 'nodejs';
export const maxDuration = 120;
import { convertVisualToCode, quickConvert } from '@/lib/visual-to-code';

const log = logger('CodeLabVisualToCode');

/**
 * POST - Convert visual design to code
 */
export async function POST(request: NextRequest) {
  // CSRF protection
  const csrfCheck = validateCSRF(request);
  if (!csrfCheck.valid) return csrfCheck.response!;

  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Rate limiting
    const rateLimit = await rateLimiters.codeLabEdit(user.id);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Rate limit exceeded', retryAfter: rateLimit.retryAfter },
        { status: 429 }
      );
    }

    const body = await request.json();
    const {
      image, // Base64 encoded image
      options = {},
      quick = false, // Use quick mode for faster results
    } = body;

    if (!image) {
      return NextResponse.json({ error: 'Missing image data' }, { status: 400 });
    }

    log.info(`[Visual-to-Code API] Processing image (quick: ${quick})`);

    if (quick) {
      // Quick conversion - just the code
      const code = await quickConvert(image, options.componentName || 'Component');
      return NextResponse.json({ code });
    }

    // Full conversion with analysis
    const result = await convertVisualToCode(image, {
      framework: options.framework || 'react',
      styling: options.styling || 'tailwind',
      typescript: options.typescript !== false,
      responsive: options.responsive !== false,
      accessibility: options.accessibility !== false,
      componentName: options.componentName || 'GeneratedComponent',
    });

    return NextResponse.json({
      analysis: result.analysis,
      components: result.components,
      mainComponent: result.mainComponent,
      previewHtml: result.previewHtml,
    });
  } catch (error) {
    log.error('[Visual-to-Code API] Error:', error instanceof Error ? error : { error });
    return NextResponse.json(
      {
        error: 'Failed to generate code from image',
        code: 'VISUAL_TO_CODE_FAILED',
      },
      { status: 500 }
    );
  }
}
