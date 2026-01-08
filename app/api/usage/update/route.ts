/**
 * USAGE UPDATE API
 *
 * PURPOSE:
 * - Update or reset usage counts for users
 * - Track chat and image usage against plan limits
 *
 * PUBLIC ROUTES:
 * - POST /api/usage/update
 *
 * DEPENDENCIES/ENVS:
 * - NEXT_PUBLIC_SUPABASE_URL
 * - NEXT_PUBLIC_SUPABASE_ANON_KEY
 * - SUPABASE_SERVICE_ROLE_KEY (for admin operations)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { logger } from '@/lib/logger';

const log = logger('UsageAPI');

export const runtime = 'nodejs';

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

// Get admin Supabase client for service operations
function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    return null;
  }

  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

interface UsageUpdateRequest {
  type: 'chat' | 'image';
  action?: 'increment' | 'reset';
  userId?: string; // Admin can specify user
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await getSupabaseClient();

    // Get authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const body: UsageUpdateRequest = await request.json();
    const { type, action = 'increment', userId } = body;

    // Validate type
    if (!type || !['chat', 'image'].includes(type)) {
      return NextResponse.json(
        { error: 'Invalid type. Must be "chat" or "image"' },
        { status: 400 }
      );
    }

    // Determine target user
    let targetUserId = user.id;

    // Admin can update other users' usage
    if (userId && userId !== user.id) {
      // Check if current user is admin
      const { data: adminCheck } = await supabase
        .from('users')
        .select('is_admin')
        .eq('id', user.id)
        .single();

      if (!adminCheck?.is_admin) {
        return NextResponse.json(
          { error: 'Only admins can update other users\' usage' },
          { status: 403 }
        );
      }

      targetUserId = userId;
    }

    // Get admin client for service operations
    const adminSupabase = getSupabaseAdmin();
    const client = adminSupabase || supabase;

    if (action === 'reset') {
      // Reset usage count
      const updateField = type === 'chat' ? 'messages_used_today' : 'images_generated_today';

      const { error: updateError } = await client
        .from('users')
        .update({ [updateField]: 0 })
        .eq('id', targetUserId);

      if (updateError) {
        log.error('[Usage API] Reset error:', updateError instanceof Error ? updateError : { updateError });
        return NextResponse.json(
          { error: 'Failed to reset usage' },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        message: `${type} usage reset successfully`,
        userId: targetUserId,
      });
    }

    // Increment usage (default action)
    const rpcName = type === 'chat' ? 'increment_message_count' : 'increment_image_count';

    const { data: newCount, error: rpcError } = await client.rpc(rpcName, {
      user_id_param: targetUserId,
    });

    if (rpcError) {
      log.error('[Usage API] Increment error:', rpcError instanceof Error ? rpcError : { rpcError });

      // Fallback: manual update
      const updateField = type === 'chat' ? 'messages_used_today' : 'images_generated_today';

      const { data: currentUser } = await client
        .from('users')
        .select(updateField)
        .eq('id', targetUserId)
        .single();

      // Type assertion to handle dynamic field access
      const userData = currentUser as Record<string, number> | null;
      const currentCount = userData?.[updateField] || 0;

      const { error: fallbackError } = await client
        .from('users')
        .update({ [updateField]: currentCount + 1 })
        .eq('id', targetUserId);

      if (fallbackError) {
        return NextResponse.json(
          { error: 'Failed to update usage' },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        type,
        newCount: currentCount + 1,
        userId: targetUserId,
      });
    }

    return NextResponse.json({
      success: true,
      type,
      newCount: newCount || 1,
      userId: targetUserId,
    });

  } catch (error) {
    log.error('[Usage API] Error:', error instanceof Error ? error : { error });
    return NextResponse.json(
      { error: 'Failed to update usage' },
      { status: 500 }
    );
  }
}
