import { NextRequest } from 'next/server';
import { logger } from '@/lib/logger';
import type { Json } from '@/lib/supabase/types';
import { errors, validateBody } from '@/lib/api/utils';
import { createMessageSchema } from '@/lib/validation/schemas';

const log = logger('MessagesAPI');

export type ParsedMessageInput = {
  success: true;
  role: 'user' | 'assistant' | 'system';
  content: string;
  content_type_field: string;
  model_used: string | null;
  temperature: number | null;
  tokens_used: number | null;
  attachment_urls: string[];
  image_url: string | null;
  prompt: string | null;
  type: string;
  metadata: Json | null;
};

type ParseError = {
  success: false;
  response: Response;
};

export async function parseMessageInput(
  request: NextRequest
): Promise<ParsedMessageInput | ParseError> {
  const contentType = request.headers.get('content-type') || '';

  let role: 'user' | 'assistant' | 'system' = 'user';
  let content = '';
  let content_type_field = 'text';
  let model_used: string | null = null;
  let temperature: number | null = null;
  let tokens_used: number | null = null;
  let attachment_urls: string[] = [];
  let image_url: string | null = null;
  let prompt: string | null = null;
  let type = 'text';
  let metadata: Json | null = null;

  // Handle multipart/form-data (file uploads)
  if (contentType.includes('multipart/form-data')) {
    let formData: FormData;
    try {
      formData = await request.formData();
    } catch (e) {
      log.error('[API] FormData parse error', e instanceof Error ? e : { error: e });
      return { success: false, response: errors.badRequest('Failed to parse form data') };
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
    if (roleValue === 'user' || roleValue === 'assistant' || roleValue === 'system') {
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
            log.error(
              '[API] File processing error',
              fileError instanceof Error ? fileError : { error: fileError }
            );
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
        log.error(
          '[API] attachments_json parse error',
          jsonError instanceof Error ? jsonError : { error: jsonError }
        );
        return {
          success: false,
          response: errors.badRequest('attachments_json is not valid JSON'),
        };
      }
    }
  } else {
    // Handle JSON request
    // Make content optional to allow messages with only attachments or prompts
    const messageSchema = createMessageSchema.partial({ content: true });
    const validation = await validateBody(request, messageSchema);

    if (!validation.success) {
      return { success: false, response: validation.response };
    }

    const body = validation.data;

    // Extract validated fields
    role = body.role;
    content = body.content || '';
    content_type_field = body.content_type;
    model_used = body.model_used || null;
    temperature = body.temperature || null;
    tokens_used = body.tokens_used || null;
    image_url = body.image_url || null;
    prompt = body.prompt || null;
    type = body.type;
    attachment_urls = body.attachment_urls || [];
    metadata = (body.metadata as Json) || null;
  }

  return {
    success: true,
    role,
    content,
    content_type_field,
    model_used,
    temperature,
    tokens_used,
    attachment_urls,
    image_url,
    prompt,
    type,
    metadata,
  };
}
