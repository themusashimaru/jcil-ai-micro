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
      xaiApiKey: {
        exists: !!process.env.XAI_API_KEY,
        value: process.env.XAI_API_KEY ? 'SET' : 'MISSING',
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
      diagnostics.checks.error = `Users query failed: ${usersError.message}`;
    } else {
      diagnostics.checks.canQueryDatabase = true;
      diagnostics.checks.userCount = users?.length || 0;
    }

    // Try to query the admin_users table
    const { data: adminUsers, error: adminError } = await supabase
      .from('admin_users')
      .select('id', { count: 'exact', head: true });

    if (adminError) {
      diagnostics.checks.error = diagnostics.checks.error
        ? `${diagnostics.checks.error} | Admin users query failed: ${adminError.message}`
        : `Admin users query failed: ${adminError.message}`;
    } else {
      diagnostics.checks.adminUserCount = adminUsers?.length || 0;
    }

  } catch (error) {
    diagnostics.checks.error = error instanceof Error ? error.message : 'Unknown error';
  }

  return NextResponse.json(diagnostics, { status: 200 });
}
