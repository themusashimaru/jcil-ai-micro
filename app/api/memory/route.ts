/**
 * PERSISTENT MEMORY API
 *
 * Enterprise-grade memory management endpoints for personalized AI experiences.
 * Provides GDPR-compliant access to user memory data.
 *
 * Endpoints:
 * - GET /api/memory - Retrieve user's memory profile
 * - PUT /api/memory - Update user preferences
 * - DELETE /api/memory - Clear all user memory (GDPR right to erasure)
 *
 * @module api/memory
 * @version 1.0.0
 */

import { createServerClient } from '@supabase/ssr';
import { NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { validateCSRF } from '@/lib/security/csrf';
import { logger } from '@/lib/logger';
import {
  successResponse,
  errors,
  validateBody,
  checkRequestRateLimit,
  rateLimits,
} from '@/lib/api/utils';
import { loadUserMemory, deleteUserMemory, updateUserMemory } from '@/lib/memory';
import type { UserPreferences } from '@/lib/memory';
import { z } from 'zod';

const log = logger('MemoryAPI');

export const runtime = 'nodejs';
export const maxDuration = 30;

// Schema for updating preferences
const updatePreferencesSchema = z.object({
  name: z.string().max(100).optional(),
  preferred_name: z.string().max(100).optional(),
  occupation: z.string().max(200).optional(),
  location: z.string().max(200).optional(),
  communication_style: z.enum(['formal', 'casual', 'technical', 'simple']).optional(),
  interests: z.array(z.string().max(100)).max(50).optional(),
  faith_context: z.string().max(500).optional(),
  goals: z.array(z.string().max(500)).max(20).optional(),
  interaction_preferences: z.array(z.string().max(200)).max(10).optional(),
});

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

/**
 * GET /api/memory
 * Retrieve user's memory profile
 *
 * Returns the user's stored memory including:
 * - Summary of past interactions
 * - Key topics discussed
 * - Learned preferences
 * - Recent conversation context
 */
export async function GET() {
  try {
    const supabase = await getSupabaseClient();

    // Get authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return errors.unauthorized();
    }

    // Rate limiting
    const rateLimitResult = await checkRequestRateLimit(
      `memory-get:${user.id}`,
      rateLimits.standard
    );
    if (!rateLimitResult.allowed) return rateLimitResult.response;

    // Load user memory
    const memory = await loadUserMemory(user.id);

    if (!memory) {
      return successResponse({
        memory: null,
        message: 'No memory profile exists yet. It will be created as you chat.',
      });
    }

    // Return memory with sensitive fields filtered
    return successResponse({
      memory: {
        id: memory.id,
        summary: memory.summary,
        key_topics: memory.key_topics,
        topic_timestamps: memory.topic_timestamps,
        preferences: memory.user_preferences,
        created_at: memory.created_at,
        updated_at: memory.updated_at,
        last_accessed_at: memory.last_accessed_at,
      },
    });
  } catch (error) {
    log.error('Error fetching memory', error as Error);
    return errors.serverError();
  }
}

/**
 * PUT /api/memory
 * Update user preferences
 *
 * Allows users to directly update their preference settings.
 * This is useful for onboarding or settings pages.
 */
export async function PUT(request: NextRequest) {
  // CSRF Protection
  const csrfCheck = validateCSRF(request);
  if (!csrfCheck.valid) return csrfCheck.response!;

  try {
    const supabase = await getSupabaseClient();

    // Get authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return errors.unauthorized();
    }

    // Rate limiting
    const rateLimitResult = await checkRequestRateLimit(
      `memory-update:${user.id}`,
      rateLimits.standard
    );
    if (!rateLimitResult.allowed) return rateLimitResult.response;

    // Validate request body
    const validation = await validateBody(request, updatePreferencesSchema);
    if (!validation.success) return validation.response;

    const preferences = validation.data as Partial<UserPreferences>;

    // Convert preferences to memory extraction format
    const facts = Object.entries(preferences)
      .filter(([, value]) => value !== undefined)
      .map(([key, value]) => ({
        category: 'preference' as const,
        fact: `User preference: ${key}`,
        key,
        value: value as string | string[],
        confidence: 1.0,
      }));

    // Update memory with new preferences
    const result = await updateUserMemory(user.id, {
      facts,
      topics: [],
      summary: '',
      confidence: 1.0,
    });

    if (!result.success) {
      log.error('Failed to update memory', { error: result.error });
      return errors.serverError();
    }

    log.info('User preferences updated', { userId: user.id });

    return successResponse({
      success: true,
      message: 'Preferences updated successfully',
    });
  } catch (error) {
    log.error('Error updating memory', error as Error);
    return errors.serverError();
  }
}

/**
 * DELETE /api/memory
 * Clear all user memory (GDPR right to erasure)
 *
 * Completely removes all stored memory for the user.
 * This action is irreversible.
 */
export async function DELETE(request: NextRequest) {
  // CSRF Protection
  const csrfCheck = validateCSRF(request);
  if (!csrfCheck.valid) return csrfCheck.response!;

  try {
    const supabase = await getSupabaseClient();

    // Get authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return errors.unauthorized();
    }

    // Rate limiting (stricter for destructive operations)
    const rateLimitResult = await checkRequestRateLimit(`memory-delete:${user.id}`, {
      ...rateLimits.standard,
      limit: 5,
    });
    if (!rateLimitResult.allowed) return rateLimitResult.response;

    // Delete all memory
    const deleted = await deleteUserMemory(user.id);

    if (deleted) {
      log.info('User memory deleted (GDPR erasure)', { userId: user.id });
      return successResponse({
        success: true,
        message: 'All memory has been permanently deleted',
      });
    } else {
      return successResponse({
        success: true,
        message: 'No memory existed to delete',
      });
    }
  } catch (error) {
    log.error('Error deleting memory', error as Error);
    return errors.serverError();
  }
}
