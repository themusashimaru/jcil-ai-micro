/**
 * DESIGN SETTINGS API
 * Get and save site-wide branding settings
 * GET: Public (anyone can read branding) - Redis cached for 5 minutes
 * POST: Admin only (requires admin authentication)
 */

import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server-auth';
import { cacheGet, cacheSet, cacheDelete } from '@/lib/redis/client';
import { logger } from '@/lib/logger';
import {
  successResponse,
  errors,
  validateBody,
  checkRequestRateLimit,
  rateLimits,
  getClientIP,
} from '@/lib/api/utils';
import { designSettingsSchema } from '@/lib/validation/schemas';

const log = logger('DesignSettingsAPI');

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Cache key and TTL
const CACHE_KEY = 'design_settings';
const CACHE_TTL_SECONDS = 300; // 5 minutes

// Default settings
const DEFAULT_SETTINGS = {
  main_logo: '/images/logo.png',
  header_logo: '',
  login_logo: '',
  light_mode_logo: '',
  favicon: '',
  site_name: 'JCIL.ai',
  subtitle: 'Your AI Assistant',
  model_name: '',
};

// GET - Public endpoint to fetch current design settings (Redis + HTTP cached)
export async function GET(request: NextRequest) {
  try {
    // Rate limiting
    const clientIP = getClientIP(request);
    const rateLimitCheck = await checkRequestRateLimit(clientIP, rateLimits.standard);
    if (!rateLimitCheck.allowed) return rateLimitCheck.response;

    // Try Redis cache first
    const cached = await cacheGet<typeof DEFAULT_SETTINGS>(CACHE_KEY);
    if (cached) {
      return NextResponse.json(cached, {
        headers: {
          'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
          'X-Cache': 'HIT',
        },
      });
    }

    // Cache miss - fetch from database
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error('Missing Supabase configuration');
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    const { data, error } = await supabase.from('design_settings').select('*').limit(1).single();

    if (error) {
      log.error('Error fetching settings', error instanceof Error ? error : { error });
      // Cache defaults on error to prevent repeated DB hits
      await cacheSet(CACHE_KEY, DEFAULT_SETTINGS, 60); // Short TTL for errors
      return NextResponse.json(DEFAULT_SETTINGS, {
        headers: {
          'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120',
          'X-Cache': 'MISS',
        },
      });
    }

    const settings = data || DEFAULT_SETTINGS;

    // Cache the result in Redis
    await cacheSet(CACHE_KEY, settings, CACHE_TTL_SECONDS);

    return NextResponse.json(settings, {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
        'X-Cache': 'MISS',
      },
    });
  } catch (error) {
    log.error('Unexpected error in GET', error as Error);
    return NextResponse.json(DEFAULT_SETTINGS, {
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120',
        'X-Cache': 'ERROR',
      },
    });
  }
}

// POST - Admin only endpoint to update design settings
export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const clientIP = getClientIP(request);
    const rateLimitCheck = await checkRequestRateLimit(clientIP, rateLimits.strict);
    if (!rateLimitCheck.allowed) return rateLimitCheck.response;

    // Check admin authentication
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return errors.unauthorized();
    }

    // Check if user is admin
    const { data: adminUser } = await supabase
      .from('admin_users')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (!adminUser) {
      return errors.forbidden();
    }

    // Validate request body
    const validation = await validateBody(request, designSettingsSchema);
    if (!validation.success) return validation.response;

    const settings = validation.data;

    // Use service role key for update (admin operation)
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase configuration');
    }

    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    // Check if settings row exists
    const { data: existing } = await adminClient
      .from('design_settings')
      .select('id')
      .limit(1)
      .single();

    let result;

    if (existing) {
      // Update existing row
      result = await adminClient
        .from('design_settings')
        .update({
          main_logo: settings.mainLogo,
          header_logo: settings.headerLogo,
          login_logo: settings.loginLogo,
          light_mode_logo: settings.lightModeLogo,
          favicon: settings.favicon,
          site_name: settings.siteName,
          subtitle: settings.subtitle,
          model_name: settings.modelName,
        })
        .eq('id', existing.id)
        .select()
        .single();
    } else {
      // Insert new row
      result = await adminClient
        .from('design_settings')
        .insert({
          main_logo: settings.mainLogo,
          header_logo: settings.headerLogo,
          login_logo: settings.loginLogo,
          light_mode_logo: settings.lightModeLogo,
          favicon: settings.favicon,
          site_name: settings.siteName,
          subtitle: settings.subtitle,
          model_name: settings.modelName,
        })
        .select()
        .single();
    }

    if (result.error) {
      log.error('Error saving settings', result.error);
      return errors.serverError();
    }

    // Invalidate cache and store new settings
    await cacheDelete(CACHE_KEY);
    await cacheSet(CACHE_KEY, result.data, CACHE_TTL_SECONDS);

    log.info('Design settings updated by admin');

    return successResponse({
      settings: result.data,
    });
  } catch (error) {
    log.error('Unexpected error in POST', error as Error);
    return errors.serverError();
  }
}
