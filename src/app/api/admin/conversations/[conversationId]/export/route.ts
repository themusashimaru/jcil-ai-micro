import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ conversationId: string }> }
) {
  try {
    const supabase = await createClient();

    // Check authentication
    const { data: { session } } = await supabase.auth.getSession();

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is admin
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('is_admin')
      .eq('id', session.user.id)
      .single();

    if (!profile?.is_admin) {
      return NextResponse.json({ error: 'Forbidden - Admin access required' }, { status: 403 });
    }

    const { conversationId } = await params;

    // Create service role client
    const admin = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Get conversation
    const { data: conversation, error: convError } = await admin
      .from('conversations')
      .select('id, title, created_at, user_id')
      .eq('id', conversationId)
      .single();

    if (convError || !conversation) {
      return new NextResponse('Conversation not found', { status: 404 });
    }

    // Get user email and tier
    const { data: authData } = await admin.auth.admin.listUsers();
    const user = authData?.users?.find(u => u.id === conversation.user_id);
    const userEmail = user?.email || 'Unknown';

    // Get user tier
    const { data: userProfile } = await admin
      .from('user_profiles')
      .select('subscription_tier')
      .eq('id', conversation.user_id)
      .single();
    const userTier = userProfile?.subscription_tier || 'free';

    // Get all messages
    const { data: messages, error: messagesError } = await admin
      .from('messages')
      .select('id, role, content, created_at, file_url, file_type, file_size')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });

    if (messagesError) throw messagesError;

    // Extract attachments from messages
    const attachments = (messages || [])
      .filter(m => m.file_url)
      .map(m => ({
        id: m.id,
        file_url: m.file_url,
        file_type: m.file_type,
        file_size: m.file_size,
        created_at: m.created_at,
      }));

    const exportDate = new Date().toLocaleString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZoneName: 'short',
    });

    const conversationDate = new Date(conversation.created_at).toLocaleString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    // Generate HTML export
    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Conversation Export - ${conversation.title || 'Untitled'}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      padding: 40px;
      background: white;
      color: #1e293b;
      max-width: 1000px;
      margin: 0 auto;
    }
    .header {
      border-bottom: 3px solid #dc2626;
      padding-bottom: 20px;
      margin-bottom: 40px;
    }
    .header h1 {
      font-size: 28px;
      color: #dc2626;
      margin-bottom: 8px;
    }
    .header .subtitle {
      color: #64748b;
      font-size: 14px;
    }
    .metadata {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 20px;
      margin-bottom: 30px;
    }
    .metadata-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 16px;
    }
    .metadata-item {
      display: flex;
      flex-direction: column;
    }
    .metadata-label {
      font-size: 12px;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 4px;
    }
    .metadata-value {
      font-size: 14px;
      color: #1e293b;
      font-weight: 500;
    }
    .warning {
      background: #fef3c7;
      border-left: 4px solid #f59e0b;
      padding: 16px;
      margin-bottom: 30px;
      border-radius: 4px;
    }
    .warning-title {
      font-weight: 600;
      color: #92400e;
      margin-bottom: 8px;
    }
    .warning-text {
      font-size: 13px;
      color: #78350f;
    }
    .section-title {
      font-size: 20px;
      font-weight: 600;
      color: #1e293b;
      margin: 40px 0 20px 0;
      padding-bottom: 8px;
      border-bottom: 2px solid #e2e8f0;
    }
    .message {
      margin-bottom: 24px;
      padding: 16px;
      border-radius: 8px;
      border: 1px solid #e2e8f0;
    }
    .message-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 12px;
      padding-bottom: 8px;
      border-bottom: 1px solid #f1f5f9;
    }
    .message-role {
      font-weight: 600;
      text-transform: uppercase;
      font-size: 12px;
      letter-spacing: 0.5px;
    }
    .message-role.user { color: #2563eb; }
    .message-role.assistant { color: #059669; }
    .message-role.system { color: #7c3aed; }
    .message-time {
      font-size: 12px;
      color: #64748b;
    }
    .message-content {
      font-size: 14px;
      line-height: 1.6;
      color: #334155;
      white-space: pre-wrap;
      word-wrap: break-word;
    }
    .attachments-list {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 16px;
      margin-top: 20px;
    }
    .attachment-item {
      padding: 12px;
      background: white;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      margin-bottom: 8px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .attachment-name {
      font-size: 13px;
      color: #1e293b;
      font-weight: 500;
    }
    .attachment-meta {
      font-size: 12px;
      color: #64748b;
    }
    .footer {
      margin-top: 60px;
      padding-top: 20px;
      border-top: 1px solid #e2e8f0;
      text-align: center;
      color: #94a3b8;
      font-size: 11px;
    }
    @media print {
      body { padding: 20px; }
      .message { break-inside: avoid; }
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>🔒 Confidential Conversation Export</h1>
    <p class="subtitle">Generated: ${exportDate}</p>
  </div>

  <div class="warning">
    <div class="warning-title">⚠️ Confidential Legal Record</div>
    <div class="warning-text">
      This document contains private user communications and is intended for authorized legal,
      investigation, or compliance purposes only. Unauthorized access, use, or distribution
      is strictly prohibited.
    </div>
  </div>

  <div class="metadata">
    <div class="metadata-grid">
      <div class="metadata-item">
        <div class="metadata-label">Conversation ID</div>
        <div class="metadata-value">${conversation.id}</div>
      </div>
      <div class="metadata-item">
        <div class="metadata-label">Title</div>
        <div class="metadata-value">${conversation.title || 'Untitled'}</div>
      </div>
      <div class="metadata-item">
        <div class="metadata-label">User Email</div>
        <div class="metadata-value">${userEmail}</div>
      </div>
      <div class="metadata-item">
        <div class="metadata-label">User ID</div>
        <div class="metadata-value">${conversation.user_id}</div>
      </div>
      <div class="metadata-item">
        <div class="metadata-label">Subscription Tier</div>
        <div class="metadata-value">${userTier}</div>
      </div>
      <div class="metadata-item">
        <div class="metadata-label">Conversation Started</div>
        <div class="metadata-value">${conversationDate}</div>
      </div>
      <div class="metadata-item">
        <div class="metadata-label">Total Messages</div>
        <div class="metadata-value">${messages?.length || 0}</div>
      </div>
      <div class="metadata-item">
        <div class="metadata-label">Total Attachments</div>
        <div class="metadata-value">${attachments?.length || 0}</div>
      </div>
    </div>
  </div>

  <h2 class="section-title">📝 Message History</h2>

  ${(messages || []).map((msg: any, index: number) => {
    const msgDate = new Date(msg.created_at).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    return `
    <div class="message">
      <div class="message-header">
        <span class="message-role ${msg.role}">${msg.role}</span>
        <span class="message-time">${msgDate}</span>
      </div>
      <div class="message-content">${msg.content || '[No content]'}</div>
    </div>
    `;
  }).join('')}

  ${(attachments && attachments.length > 0) ? `
    <h2 class="section-title">📎 Attachments</h2>
    <div class="attachments-list">
      ${attachments.map((att: any) => {
        const attDate = new Date(att.created_at).toLocaleString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        });
        const fileName = att.file_url ? att.file_url.split('/').pop() : 'Unknown file';
        return `
        <div class="attachment-item">
          <div>
            <div class="attachment-name">📎 ${fileName}</div>
            <div class="attachment-meta">
              Type: ${att.file_type || 'Unknown'} • Size: ${att.file_size ? (att.file_size / 1024).toFixed(2) + ' KB' : 'Unknown'}
            </div>
            <div class="attachment-meta" style="margin-top: 4px; font-size: 11px;">
              <a href="${att.file_url}" target="_blank" style="color: #2563eb;">${att.file_url}</a>
            </div>
          </div>
          <div class="attachment-meta">${attDate}</div>
        </div>
        `;
      }).join('')}
    </div>
  ` : ''}

  <div class="footer">
    <p>This export was generated by an authorized administrator for legal and compliance purposes.</p>
    <p>Export ID: ${conversation.id} • Generated: ${exportDate}</p>
    <p>To save as PDF: Use your browser's Print function (Ctrl/Cmd + P) and select "Save as PDF"</p>
  </div>

  <script>
    // Auto-trigger print dialog when page loads
    window.onload = function() {
      setTimeout(function() {
        window.print();
      }, 500);
    };
  </script>
</body>
</html>
    `;

    return new NextResponse(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html',
      },
    });
  } catch (error: any) {
    console.error('[CONVERSATION_EXPORT] Error:', error);
    return NextResponse.json(
      { error: 'Failed to export conversation', details: error.message, stack: error.stack },
      { status: 500 }
    );
  }
}
