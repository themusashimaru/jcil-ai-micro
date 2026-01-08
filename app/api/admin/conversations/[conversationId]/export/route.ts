/**
 * ADMIN CONVERSATION PDF EXPORT API
 * PURPOSE: Export conversation as PDF for compliance/legal requests
 * SECURITY: Admin authentication required, uses service role key
 */

import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/admin-guard';
import { logger } from '@/lib/logger';

const log = logger('AdminConversationExport');

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface ConversationUser {
  id: string;
  email: string;
  full_name: string | null;
}

interface ConversationData {
  id: string;
  title: string;
  tool_context: string | null;
  created_at: string;
  last_message_at: string;
  message_count: number;
  user_id: string;
  users: ConversationUser | ConversationUser[];
}

interface MessageData {
  id: string;
  role: string;
  content: string;
  created_at: string;
  moderation_flagged: boolean;
}

function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing Supabase configuration');
  }

  return createClient(supabaseUrl, supabaseServiceKey);
}

export async function GET(
  _request: NextRequest,
  { params }: { params: { conversationId: string } }
) {
  try {
    // Require admin authentication
    const auth = await requireAdmin();
    if (!auth.authorized) return auth.response;

    const { conversationId } = params;
    const supabase = getSupabaseAdmin();

    // Fetch conversation with user details
    const { data: conversation, error: convError } = await supabase
      .from('conversations')
      .select('*, users(id, email, full_name)')
      .eq('id', conversationId)
      .single();

    if (convError || !conversation) {
      return NextResponse.json(
        { error: 'Conversation not found' },
        { status: 404 }
      );
    }

    // Fetch all messages
    const { data: messages, error: msgError } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .is('deleted_at', null)
      .order('created_at', { ascending: true });

    if (msgError) {
      return NextResponse.json(
        { error: 'Failed to fetch messages' },
        { status: 500 }
      );
    }

    // Log admin export for audit trail
    log.info(`[Admin Audit] Admin exported conversation ${conversationId} as PDF (User: ${conversation.user_id})`);

    // Generate HTML content for PDF
    const user = Array.isArray(conversation.users) ? conversation.users[0] : conversation.users;
    const html = generatePDFHTML(conversation as ConversationData, user, messages || []);

    // Return HTML with special headers to trigger browser print
    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Disposition': `inline; filename="conversation-${conversationId}.html"`,
      },
    });
  } catch (error) {
    log.error('[Admin API] Error:', error instanceof Error ? error : { error });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

function generatePDFHTML(conversation: ConversationData, user: ConversationUser, messages: MessageData[]): string {
  const now = new Date().toLocaleString();

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Conversation Export - ${conversation.title}</title>
  <style>
    @media print {
      @page { margin: 1in; }
      body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      line-height: 1.6;
      max-width: 8.5in;
      margin: 0 auto;
      padding: 20px;
      background: white;
      color: #000;
    }
    .header {
      border-bottom: 2px solid #000;
      padding-bottom: 20px;
      margin-bottom: 30px;
    }
    .header h1 {
      margin: 0 0 10px 0;
      font-size: 24px;
    }
    .metadata {
      display: grid;
      grid-template-columns: 150px 1fr;
      gap: 8px;
      font-size: 14px;
      margin-bottom: 20px;
    }
    .metadata strong {
      font-weight: 600;
    }
    .message {
      margin-bottom: 20px;
      page-break-inside: avoid;
    }
    .message-header {
      display: flex;
      justify-content: space-between;
      margin-bottom: 8px;
      font-size: 12px;
      color: #666;
    }
    .message-role {
      font-weight: 600;
      text-transform: uppercase;
    }
    .message-role.user { color: #2563eb; }
    .message-role.assistant { color: #059669; }
    .message-role.system { color: #dc2626; }
    .message-content {
      background: #f9fafb;
      padding: 15px;
      border-left: 3px solid #e5e7eb;
      white-space: pre-wrap;
      word-wrap: break-word;
    }
    .message.user .message-content {
      border-left-color: #2563eb;
    }
    .message.assistant .message-content {
      border-left-color: #059669;
    }
    .footer {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 1px solid #e5e7eb;
      font-size: 12px;
      color: #666;
      text-align: center;
    }
    .warning {
      background: #fef3c7;
      border: 1px solid #f59e0b;
      padding: 15px;
      margin-bottom: 20px;
      border-radius: 4px;
      font-size: 14px;
    }
  </style>
  <script>
    // Auto-print when opened
    window.onload = function() {
      // Give a moment for the page to render
      setTimeout(() => {
        window.print();
      }, 500);
    };
  </script>
</head>
<body>
  <div class="header">
    <h1>Conversation Transcript</h1>
  </div>

  <div class="warning">
    <strong>⚠️ CONFIDENTIAL:</strong> This conversation transcript contains private user data.
    Handle according to privacy policy and applicable laws (COPPA, FERPA, etc.).
  </div>

  <div class="metadata">
    <strong>Conversation ID:</strong>
    <span>${conversation.id}</span>

    <strong>Title:</strong>
    <span>${escapeHtml(conversation.title)}</span>

    <strong>User:</strong>
    <span>${escapeHtml(user?.full_name || 'Unknown')} (${escapeHtml(user?.email || 'N/A')})</span>

    <strong>User ID:</strong>
    <span>${conversation.user_id}</span>

    <strong>Context:</strong>
    <span>${conversation.tool_context || 'general'}</span>

    <strong>Created:</strong>
    <span>${new Date(conversation.created_at).toLocaleString()}</span>

    <strong>Last Message:</strong>
    <span>${new Date(conversation.last_message_at).toLocaleString()}</span>

    <strong>Total Messages:</strong>
    <span>${messages.length}</span>

    <strong>Exported:</strong>
    <span>${now}</span>

    <strong>Export Reason:</strong>
    <span>Admin Review (see audit log for details)</span>
  </div>

  <h2 style="margin-top: 40px; margin-bottom: 20px; font-size: 18px;">Messages</h2>

  ${messages.map((msg) => `
    <div class="message ${msg.role}">
      <div class="message-header">
        <span class="message-role ${msg.role}">${msg.role}</span>
        <span class="message-time">${new Date(msg.created_at).toLocaleString()}</span>
      </div>
      <div class="message-content">${escapeHtml(msg.content)}</div>
      ${msg.moderation_flagged ? `
        <div style="color: #dc2626; font-size: 12px; margin-top: 8px;">
          ⚠️ Content flagged by moderation system
        </div>
      ` : ''}
    </div>
  `).join('\n')}

  <div class="footer">
    <p>
      <strong>JCIL.ai Conversation Export</strong><br>
      Generated: ${now}<br>
      This transcript is provided for compliance, legal, or safety purposes only.
    </p>
  </div>
</body>
</html>
  `.trim();
}

function escapeHtml(text: string): string {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
