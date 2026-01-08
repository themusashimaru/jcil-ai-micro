/**
 * ADMIN SUPPORT TICKETS API
 *
 * Provides admin access to support ticket management.
 *
 * @module api/admin/support/tickets
 */

import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/admin-guard';
import { logger } from '@/lib/logger';
import { sanitizePostgrestInput } from '@/lib/security/postgrest';

const log = logger('AdminSupportAPI');

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing Supabase configuration');
  }

  return createClient(supabaseUrl, supabaseServiceKey);
}

export async function GET(request: NextRequest) {
  try {
    // Require admin authentication
    const auth = await requireAdmin();
    if (!auth.authorized) return auth.response;

    const supabase = getSupabaseAdmin();
    const { searchParams } = new URL(request.url);

    // Parse filters
    const source = searchParams.get('source'); // 'internal' | 'external'
    const category = searchParams.get('category');
    const status = searchParams.get('status');
    const isRead = searchParams.get('is_read');
    const isStarred = searchParams.get('is_starred');
    const isArchived = searchParams.get('is_archived') || 'false';
    const search = searchParams.get('search');
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = Math.min(100, parseInt(searchParams.get('limit') || '50', 10));
    const offset = (page - 1) * limit;

    // Build query
    let query = supabase
      .from('support_tickets')
      .select('*', { count: 'exact' });

    // Apply filters
    if (source) query = query.eq('source', source);
    if (category) query = query.eq('category', category);
    if (status) query = query.eq('status', status);
    if (isRead === 'true') query = query.eq('is_read', true);
    if (isRead === 'false') query = query.eq('is_read', false);
    if (isStarred === 'true') query = query.eq('is_starred', true);
    if (isArchived === 'true') {
      query = query.eq('is_archived', true);
    } else {
      query = query.eq('is_archived', false);
    }

    // Search by subject or email (sanitized to prevent filter injection)
    if (search) {
      const sanitized = sanitizePostgrestInput(search);
      if (sanitized.length > 0) {
        query = query.or(`subject.ilike.%${sanitized}%,sender_email.ilike.%${sanitized}%,sender_name.ilike.%${sanitized}%`);
      }
    }

    // Order by newest first
    query = query.order('created_at', { ascending: false });

    // Apply pagination
    query = query.range(offset, offset + limit - 1);

    const { data: tickets, error, count } = await query;

    if (error) {
      log.error('Error fetching tickets', error);
      return NextResponse.json(
        { error: 'Failed to fetch tickets' },
        { status: 500 }
      );
    }

    // Get counts for sidebar
    const { data: allTickets } = await supabase
      .from('support_tickets')
      .select('category, status, source, is_read, is_starred, is_archived');

    const counts = {
      all: 0,
      unread: 0,
      starred: 0,
      archived: 0,
      byCategory: {} as Record<string, number>,
      byStatus: {} as Record<string, number>,
      bySource: { internal: 0, external: 0 },
    };

    if (allTickets) {
      allTickets.forEach((t) => {
        if (!t.is_archived) {
          counts.all++;
          if (!t.is_read) counts.unread++;
          if (t.is_starred) counts.starred++;
          counts.byCategory[t.category] = (counts.byCategory[t.category] || 0) + 1;
          counts.byStatus[t.status] = (counts.byStatus[t.status] || 0) + 1;
          if (t.source === 'internal') counts.bySource.internal++;
          if (t.source === 'external') counts.bySource.external++;
        } else {
          counts.archived++;
        }
      });
    }

    return NextResponse.json({
      tickets: tickets || [],
      counts,
      pagination: {
        page,
        limit,
        totalCount: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
        hasNextPage: offset + limit < (count || 0),
        hasPreviousPage: page > 1,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    log.error('Unexpected error', error as Error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
