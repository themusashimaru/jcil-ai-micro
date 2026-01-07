/**
 * ADMIN DIAGNOSTIC API
 * PURPOSE: Check environment configuration and database connectivity
 * This helps diagnose issues with the admin panel
 * SECURITY: Admin authentication required
 */

import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/admin-guard';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  // Require admin authentication
  const auth = await requireAdmin();
  if (!auth.authorized) return auth.response;

  const diagnostics = {
    timestamp: new Date().toISOString(),
    environment: {
      supabaseUrl: {
        exists: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
        value: process.env.NEXT_PUBLIC_SUPABASE_URL ? 'SET' : 'MISSING',
      },
      supabaseAnonKey: {
        exists: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        value: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? 'SET' : 'MISSING',
      },
      supabaseServiceKey: {
        exists: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
        value: process.env.SUPABASE_SERVICE_ROLE_KEY ? 'SET' : 'MISSING',
      },
      openaiApiKey: {
        exists: !!process.env.OPENAI_API_KEY,
        value: process.env.OPENAI_API_KEY ? 'SET' : 'MISSING',
      },
      stripeSecretKey: {
        exists: !!process.env.STRIPE_SECRET_KEY,
        value: process.env.STRIPE_SECRET_KEY ? 'SET' : 'MISSING',
      },
      cronSecret: {
        exists: !!process.env.CRON_SECRET,
        value: process.env.CRON_SECRET ? 'SET' : 'MISSING',
      },
    },
    checks: {
      canCreateClient: false,
      canQueryDatabase: false,
      userCount: 0,
      adminUserCount: 0,
      error: null as string | null,
    },
  };

  try {
    // Check if we can create a Supabase client
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      diagnostics.checks.error = 'Missing required environment variables';
      return NextResponse.json(diagnostics, { status: 200 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
    diagnostics.checks.canCreateClient = true;

    // Try to query the users table
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id', { count: 'exact', head: true });

    if (usersError) {
      // SECURITY FIX: Log detailed error server-side only, return generic status
      console.error('[Diagnostic] Users query failed:', usersError.message, usersError.code);
      diagnostics.checks.error = 'Database query failed';
    } else {
      diagnostics.checks.canQueryDatabase = true;
      diagnostics.checks.userCount = users?.length || 0;
    }

    // Try to query the admin_users table
    const { data: adminUsers, error: adminError } = await supabase
      .from('admin_users')
      .select('id', { count: 'exact', head: true });

    if (adminError) {
      // SECURITY FIX: Log detailed error server-side only
      console.error('[Diagnostic] Admin users query failed:', adminError.message, adminError.code);
      diagnostics.checks.error = diagnostics.checks.error
        ? 'Multiple database queries failed'
        : 'Database query failed';
    } else {
      diagnostics.checks.adminUserCount = adminUsers?.length || 0;
    }

  } catch (error) {
    // SECURITY FIX: Don't expose internal error details to client
    console.error('[Diagnostic] Unexpected error:', error);
    diagnostics.checks.error = 'Diagnostic check failed';
  }

  return NextResponse.json(diagnostics, { status: 200 });
}
