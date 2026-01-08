/**
 * CONVERSATION MESSAGES API
 *
 * GET - Load all messages for a conversation
 * POST - Save a new message to a conversation
 *
 * Supports both JSON and multipart/form-data for file uploads
 */

import { createServerClient } from '@supabase/ssr';
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { logger } from '@/lib/logger';

const log = logger('MessagesAPI');

// Force Node runtime for file Buffer support
export const runtime = 'nodejs';
// Avoid static optimization; we accept uploads
export const dynamic = 'force-dynamic';

/**
 * Structured error response helper
 */
function errorResponse(
  status: number,
  code: string,
  message: string,
  extra?: unknown
) {
  return NextResponse.json(
    { ok: false, error: { code, message, extra } },
    { status }
  );
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

/**
 * GET /api/conversations/[id]/messages
 * Load all messages for a conversation
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await getSupabaseClient();
    const { id } = await params;

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify conversation belongs to user
    const { data: conversation, error: convError } = await supabase
      .from('conversations')
      .select('id')
      .eq('id', id)
      .eq('user_id', user.id)
      .single();

    if (convError || !conversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }

    // Fetch messages
    const { data: messages, error } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', id)
      .is('deleted_at', null)
      .order('created_at', { ascending: true });

    if (error) {
      log.error('Error fetching messages', error);
      return NextResponse.json({ error: 'Failed to load messages' }, { status: 500 });
    }

    return NextResponse.json({ messages });
  } catch (error) {
    log.error('Unexpected error in GET', error as Error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/conversations/[id]/messages
 * Save a new message to a conversation
 *
 * Supports both JSON and multipart/form-data:
 * - JSON: { role, content, content_type, attachment_urls, ... }
 * - FormData: text, role, files[], attachments_json
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await getSupabaseClient();
    const { id: conversationId } = await params;

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return errorResponse(401, 'UNAUTHORIZED', 'Authentication required');
    }

    const contentType = request.headers.get('content-type') || '';

    // Variables to hold parsed data
    let role = 'user';
    let content = '';
    let content_type_field = 'text';
    let model_used: string | null = null;
    let temperature: number | null = null;
    let tokens_used: number | null = null;
    let attachment_urls: string[] = [];
    let image_url: string | null = null;
    let prompt: string | null = null;
    let type = 'text';

    // Handle multipart/form-data (file uploads)
    if (contentType.includes('multipart/form-data')) {
      let formData: FormData;
      try {
        formData = await request.formData();
      } catch (e) {
        console.error('[API] FormData parse error:', e);
        return errorResponse(400, 'BAD_FORMDATA', 'Failed to parse form data');
      }

      // Extract text content from multiple possible field names
      const textValue =
        (formData.get('text') as string | null) ??
        (formData.get('message') as string | null) ??
        (formData.get('content') as string | null) ??
        '';
      content = textValue;

      // Extract role
      const roleValue = (formData.get('role') as string | null) ?? 'user';
      if (['user', 'system', 'assistant'].includes(roleValue)) {
        role = roleValue;
      }

      // Process file uploads
      const fileKeys = ['files', 'file', 'attachment', 'attachments[]'];
      for (const key of fileKeys) {
        const files = formData.getAll(key);
        for (const file of files) {
          if (file instanceof File && file.size > 0) {
            try {
              // Convert file to base64 data URL for storage
              const arrayBuffer = await file.arrayBuffer();
              const buffer = Buffer.from(arrayBuffer);
              const base64 = buffer.toString('base64');
              const mimeType = file.type || 'application/octet-stream';
              const dataUrl = `data:${mimeType};base64,${base64}`;
              attachment_urls.push(dataUrl);
            } catch (fileError) {
              console.error('[API] File processing error:', fileError);
              // Continue with other files
            }
          }
        }
      }

      // Also support JSON attachments in a field (for base64 uploads via form)
      const attachmentsJson = formData.get('attachments_json') as string | null;
      if (attachmentsJson) {
        try {
          const arr = JSON.parse(attachmentsJson) as Array<{
            name?: string;
            mime?: string;
            base64: string;
            url?: string;
          }>;
          for (const att of arr) {
            if (att.base64) {
              const mime = att.mime || 'application/octet-stream';
              attachment_urls.push(`data:${mime};base64,${att.base64}`);
            } else if (att.url) {
              attachment_urls.push(att.url);
            }
          }
        } catch (jsonError) {
          console.error('[API] attachments_json parse error:', jsonError);
          return errorResponse(400, 'BAD_ATTACHMENTS_JSON', 'attachments_json is not valid JSON');
        }
      }
    } else {
      // Handle JSON request
      let body: Record<string, unknown>;
      try {
        body = await request.json();
      } catch (e) {
        console.error('[API] JSON parse error:', e);
        return errorResponse(400, 'BAD_JSON', 'Request body is not valid JSON');
      }

      // Safely extract fields with defaults
      role = typeof body.role === 'string' ? body.role : 'user';
      content = typeof body.content === 'string' ? body.content : '';
      content_type_field = typeof body.content_type === 'string' ? body.content_type : 'text';
      model_used = typeof body.model_used === 'string' ? body.model_used : null;
      temperature = typeof body.temperature === 'number' ? body.temperature : null;
      tokens_used = typeof body.tokens_used === 'number' ? body.tokens_used : null;
      image_url = typeof body.image_url === 'string' ? body.image_url : null;
      prompt = typeof body.prompt === 'string' ? body.prompt : null;
      type = typeof body.type === 'string' ? body.type : 'text';

      // Handle attachment URLs
      if (Array.isArray(body.attachment_urls)) {
        attachment_urls = body.attachment_urls.filter(
          (url): url is string => typeof url === 'string'
        );
      }
    }

    // Normalize content: handle different message types
    // For image messages, content might be empty but prompt exists
    const normalizedContent =
      content && content.trim()
        ? content
        : prompt && typeof prompt === 'string'
          ? prompt
          : '';

    // Include image_url in attachments if present
    if (image_url) {
      attachment_urls.push(image_url);
    }

    // Validate: require at least text or attachments
    if (!normalizedContent && attachment_urls.length === 0) {
      return errorResponse(400, 'EMPTY_MESSAGE', 'Provide text or at least one file');
    }

    // Verify conversation belongs to user
    const { data: conversation, error: convError } = await supabase
      .from('conversations')
      .select('id')
      .eq('id', conversationId)
      .eq('user_id', user.id)
      .single();

    if (convError || !conversation) {
      return errorResponse(404, 'NOT_FOUND', 'Conversation not found');
    }

    // Calculate retention date (30 days from now by default)
    const retentionDate = new Date();
    retentionDate.setDate(retentionDate.getDate() + 30);

    // Safe preview for logging
    const contentPreview =
      normalizedContent.length > 0
        ? normalizedContent.slice(0, 50)
        : '[no text content]';

    console.log('[API] Attempting to save message:', {
      conversation_id: conversationId,
      user_id: user.id,
      role,
      type,
      content_preview: contentPreview,
      attachment_count: attachment_urls.length,
    });

    // Save message with normalized content
    const { data: message, error } = await supabase
      .from('messages')
      .insert({
        conversation_id: conversationId,
        user_id: user.id,
        role,
        content: normalizedContent,
        content_type: type === 'image' ? 'image' : content_type_field,
        model_used,
        temperature,
        tokens_used,
        has_attachments: attachment_urls.length > 0,
        attachment_urls: attachment_urls.length > 0 ? attachment_urls : null,
        retention_until: retentionDate.toISOString(),
      })
      .select()
      .single();

    if (error) {
      log.error('Error saving message', error);
      return errorResponse(500, 'DB_ERROR', 'Failed to save message');
    }

    log.info(`Message saved: ${message.id}`);

    // Note: message_count is incremented by database trigger (increment_conversation_message_count)
    // We only update last_message_at here to avoid duplicate counting
    const { error: updateError } = await supabase
      .from('conversations')
      .update({
        last_message_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', conversationId);

    if (updateError) {
      log.error('Error updating conversation timestamp', updateError);
      // Don't fail the request if this fails
    }

    // Return structured success response
    return NextResponse.json({
      ok: true,
      message,
      data: {
        conversationId,
        role,
        content: normalizedContent || null,
        attachments: attachment_urls.map((url, i) => ({
          index: i,
          hasData: url.startsWith('data:'),
        })),
      },
    });
  } catch (error) {
    log.error('Unexpected error in POST', error as Error);
    return errorResponse(500, 'INTERNAL', 'Failed to save message');
  }
}
