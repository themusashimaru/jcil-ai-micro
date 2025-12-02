/**
 * IMAGE GENERATION API - OpenAI DALL-E 3
 *
 * PURPOSE:
 * - Generate images from text prompts using DALL-E 3
 * - Support various sizes and quality settings
 * - Track usage against plan limits
 *
 * PUBLIC ROUTES:
 * - POST /api/image
 *
 * DEPENDENCIES/ENVS:
 * - OPENAI_API_KEY (required)
 *
 * MODEL: dall-e-3
 * ENDPOINT: https://api.openai.com/v1/images/generations
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export const runtime = 'nodejs';

// Image size options for DALL-E 3
type ImageSize = '1024x1024' | '1024x1792' | '1792x1024';
type ImageQuality = 'standard' | 'hd';
type ImageStyle = 'vivid' | 'natural';

interface ImageRequest {
  prompt: string;
  userId?: string;
  size?: ImageSize;
  quality?: ImageQuality;
  style?: ImageStyle;
  n?: number;
}

// Get authenticated Supabase client
async function getSupabaseClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Silently handle cookie errors
          }
        },
      },
    }
  );
}

// Check and update image usage
async function checkImageUsage(userId: string): Promise<{
  allowed: boolean;
  used: number;
  limit: number;
  remaining: number;
}> {
  try {
    const supabase = await getSupabaseClient();

    // Get user's plan and usage
    const { data: user, error } = await supabase
      .from('users')
      .select('subscription_tier, images_generated_today')
      .eq('id', userId)
      .single();

    if (error || !user) {
      // Default to free tier limits
      return { allowed: true, used: 0, limit: 0, remaining: 0 };
    }

    // Plan limits per directive
    const planLimits: Record<string, number> = {
      free: 0,
      basic: 50,
      pro: 200,
      executive: 500,
    };

    const limit = planLimits[user.subscription_tier] || 0;
    const used = user.images_generated_today || 0;
    const remaining = Math.max(0, limit - used);

    return {
      allowed: used < limit,
      used,
      limit,
      remaining,
    };
  } catch (error) {
    console.error('[Image API] Usage check error:', error);
    // Allow on error (fail open)
    return { allowed: true, used: 0, limit: 50, remaining: 50 };
  }
}

// Update image usage count
async function updateImageUsage(userId: string): Promise<void> {
  try {
    const supabase = await getSupabaseClient();

    // Increment image count
    await supabase.rpc('increment_image_count', { user_id_param: userId });
  } catch (error) {
    console.error('[Image API] Usage update error:', error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'OPENAI_API_KEY not configured' },
        { status: 500 }
      );
    }

    const body: ImageRequest = await request.json();
    const {
      prompt,
      userId,
      size = '1024x1024',
      quality = 'standard',
      style = 'vivid',
      n = 1,
    } = body;

    // Validate prompt
    if (!prompt || typeof prompt !== 'string') {
      return NextResponse.json(
        { error: 'Prompt is required and must be a string' },
        { status: 400 }
      );
    }

    if (prompt.length > 4000) {
      return NextResponse.json(
        { error: 'Prompt exceeds maximum length of 4000 characters' },
        { status: 400 }
      );
    }

    // Validate size
    const validSizes: ImageSize[] = ['1024x1024', '1024x1792', '1792x1024'];
    if (!validSizes.includes(size)) {
      return NextResponse.json(
        { error: `Invalid size. Must be one of: ${validSizes.join(', ')}` },
        { status: 400 }
      );
    }

    // Validate quality
    const validQualities: ImageQuality[] = ['standard', 'hd'];
    if (!validQualities.includes(quality)) {
      return NextResponse.json(
        { error: `Invalid quality. Must be one of: ${validQualities.join(', ')}` },
        { status: 400 }
      );
    }

    // Check usage limits if userId provided
    if (userId) {
      const usage = await checkImageUsage(userId);
      if (!usage.allowed) {
        return NextResponse.json(
          {
            error: 'Image generation limit reached',
            message: `You've hit your monthly image limit of ${usage.limit}. Upgrade your plan for more images.`,
            usage: {
              used: usage.used,
              limit: usage.limit,
              remaining: 0,
            },
          },
          { status: 429 }
        );
      }
    }

    // Call OpenAI DALL-E 3 API
    const response = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'dall-e-3',
        prompt,
        n: Math.min(n, 1), // DALL-E 3 only supports n=1
        size,
        quality,
        style,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('[Image API] DALL-E error:', error);

      // Handle content policy violations
      if (response.status === 400 && error.error?.code === 'content_policy_violation') {
        return NextResponse.json(
          {
            error: 'Content policy violation',
            message: 'Your prompt was rejected due to content policy. Please try a different prompt.',
          },
          { status: 400 }
        );
      }

      return NextResponse.json(
        { error: 'Image generation failed', details: error.error?.message || 'Unknown error' },
        { status: response.status }
      );
    }

    const data = await response.json();

    // Update usage if userId provided
    if (userId) {
      await updateImageUsage(userId);
    }

    // Return image data
    return NextResponse.json({
      success: true,
      data: data.data.map((img: { url: string; revised_prompt?: string }) => ({
        url: img.url,
        revised_prompt: img.revised_prompt,
      })),
      model: 'dall-e-3',
      size,
      quality,
    });

  } catch (error) {
    console.error('[Image API] Error:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
