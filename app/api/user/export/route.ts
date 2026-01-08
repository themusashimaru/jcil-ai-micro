/**
 * USER DATA EXPORT API
 * PURPOSE: Allow users to export all their data (conversations, messages, account info)
 * SECURITY: Requires user authentication, exports only their own data
 */

import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server-auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  try {
    // Get authenticated user
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Fetch user profile
    const { data: userProfile } = await supabase
      .from('users')
      .select('*')
      .eq('id', user.id)
      .single();

    // Type assertion for user profile
    const profile = userProfile as {
      email?: string;
      full_name?: string;
      role?: string;
      field?: string;
      subscription_tier?: string;
      subscription_status?: string;
      total_messages?: number;
      total_images?: number;
      created_at?: string;
      last_login_at?: string;
    } | null;

    // Fetch all conversations
    const { data: conversationsData } = await supabase
      .from('conversations')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    const conversations = conversationsData as Array<{
      id: string;
      title?: string;
      tool_context?: string;
      message_count?: number;
      created_at: string;
      last_message_at?: string;
    }> | null;

    // Fetch all messages
    const { data: messagesData } = await supabase
      .from('messages')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true });

    const messages = messagesData as Array<{
      id: string;
      conversation_id: string;
      role: string;
      content: string;
      created_at: string;
    }> | null;

    // Build CSV content
    const csvRows: string[] = [];

    // Header
    csvRows.push('JCIL.ai User Data Export');
    csvRows.push(`Export Date: ${new Date().toISOString()}`);
    csvRows.push(`User Email: ${user.email}`);
    csvRows.push('');

    // Account Information Section
    csvRows.push('=== ACCOUNT INFORMATION ===');
    csvRows.push('Field,Value');
    csvRows.push(`Email,${profile?.email || user.email}`);
    csvRows.push(`Full Name,"${profile?.full_name || 'N/A'}"`);
    csvRows.push(`Role,${profile?.role || 'N/A'}`);
    csvRows.push(`Field/Industry,"${profile?.field || 'N/A'}"`);
    csvRows.push(`Subscription Tier,${profile?.subscription_tier || 'free'}`);
    csvRows.push(`Subscription Status,${profile?.subscription_status || 'N/A'}`);
    csvRows.push(`Total Messages,${profile?.total_messages || 0}`);
    csvRows.push(`Total Images Generated,${profile?.total_images || 0}`);
    csvRows.push(`Account Created,${profile?.created_at || 'N/A'}`);
    csvRows.push(`Last Login,${profile?.last_login_at || 'N/A'}`);
    csvRows.push('');

    // Conversations Section
    csvRows.push('=== CONVERSATIONS ===');
    csvRows.push('Conversation ID,Title,Tool Context,Message Count,Created At,Last Message At');

    if (conversations && conversations.length > 0) {
      conversations.forEach((conv) => {
        csvRows.push(
          `${conv.id},"${(conv.title || 'Untitled').replace(/"/g, '""')}",${conv.tool_context || 'general'},${conv.message_count || 0},${conv.created_at},${conv.last_message_at || conv.created_at}`
        );
      });
    } else {
      csvRows.push('No conversations found');
    }
    csvRows.push('');

    // Messages Section
    csvRows.push('=== MESSAGES ===');
    csvRows.push('Message ID,Conversation ID,Role,Content,Created At');

    if (messages && messages.length > 0) {
      messages.forEach((msg) => {
        // Escape quotes and newlines in content for CSV
        const content = (msg.content || '')
          .replace(/"/g, '""')
          .replace(/\n/g, ' ')
          .substring(0, 1000); // Limit content length for CSV
        csvRows.push(
          `${msg.id},${msg.conversation_id},${msg.role},"${content}",${msg.created_at}`
        );
      });
    } else {
      csvRows.push('No messages found');
    }
    csvRows.push('');

    // Summary
    csvRows.push('=== EXPORT SUMMARY ===');
    csvRows.push(`Total Conversations: ${conversations?.length || 0}`);
    csvRows.push(`Total Messages: ${messages?.length || 0}`);

    // Join all rows
    const csv = csvRows.join('\n');

    // Return as downloadable CSV file (Excel compatible)
    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="jcil-ai-data-export-${new Date().toISOString().split('T')[0]}.csv"`,
      },
    });

  } catch (error) {
    console.error('[User Export] Error:', error);
    return NextResponse.json(
      { error: 'Failed to export data' },
      { status: 500 }
    );
  }
}
