// src/app/api/chat-strict/route.ts
// 🔒 original, Supabase-authenticated, conversation-based chat
// (this is basically your old file, just moved)

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { streamText, type CoreMessage } from 'ai';
import { rateLimit } from '@/lib/rate-limit';
import { sanitizeInput, containsSuspiciousContent } from '@/lib/sanitize';
import { moderateUserMessage } from '@/lib/moderation';
import { moderateImage } from '@/lib/image-moderation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const regularChatPrompt = `You are a helpful and neutral AI assistant. Your goal is to answer questions, provide information, and engage in conversation clearly and directly.

Guidelines:
1. Be direct.
2. Stay neutral.
3. Be helpful.
4. Sound natural.
`;

const textMessageToolPrompt = `You are a concise message assistant. Your task is to draft a short, clear, professional text message.

CRITICAL: output ONLY the message.`;

const emailWriterPrompt = `You are a high-precision email drafting tool.

CRITICAL: output ONLY the email text, starting with "Subject:" if needed.`;

const recipeExtractorPrompt = `You extract a shopping list from a recipe (text or image).

CRITICAL: output ONLY the shopping list format.`;

const MAX_MESSAGE_LENGTH = 10_000;
const MAX_MESSAGES_IN_CONVERSATION = 100;
const ALLOWED_IMAGE_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/webp',
];

const RATE_LIMIT_CONFIG = {
  maxRequests: 20,
  windowMs: 60_000,
};

export async function POST(req: NextRequest) {
  const cookieStore = await cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get: (name: string) => cookieStore.get(name)?.value,
        set: (name: string, value: string, options: CookieOptions) => {
          try {
            cookieStore.set(name, value, options);
          } catch (err) {
            console.error('supabase cookie set error:', err);
          }
        },
        remove: (name: string, options: CookieOptions) => {
          try {
            cookieStore.set({ name, value: '', ...options });
          } catch (err) {
            console.error('supabase cookie delete error:', err);
          }
        },
      },
    }
  );

  try {
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      console.error('Auth error in /api/chat-strict:', authError);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const rl = rateLimit(user.id, RATE_LIMIT_CONFIG);
    if (!rl.success) {
      const retryAfter = Math.ceil((rl.reset - Date.now()) / 1000);
      return NextResponse.json(
        {
          error: 'Too many requests. Please try again later.',
          retryAfter,
        },
        {
          status: 429,
          headers: {
            'X-RateLimit-Limit': rl.limit.toString(),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': rl.reset.toString(),
            'Retry-After': retryAfter.toString(),
          },
        }
      );
    }

    const {
      messages: rawMessages,
      conversationId,
      tool,
      fileUrl,
      fileMimeType,
    } = await req.json();

    const messages = rawMessages as CoreMessage[];

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json({ error: 'Messages must be an array' }, { status: 400 });
    }
    if (messages.length === 0) {
      return NextResponse.json({ error: 'At least one message is required' }, { status: 400 });
    }
    if (messages.length > MAX_MESSAGES_IN_CONVERSATION) {
      return NextResponse.json({ error: 'Too many messages in conversation' }, { status: 400 });
    }
    if (!conversationId || typeof conversationId !== 'string') {
      return NextResponse.json({ error: 'Valid conversationId is required' }, { status: 400 });
    }

    const validTools = ['none', 'textMessageTool', 'emailWriter', 'recipeExtractor'];
    if (tool && !validTools.includes(tool)) {
      return NextResponse.json({ error: 'Invalid tool parameter' }, { status: 400 });
    }

    const { data: convData, error: convErr } = await supabase
      .from('conversations')
      .select('user_id')
      .eq('id', conversationId)
      .single();

    if (convErr) {
      console.error('Conversation check failed:', convErr);
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }
    if (convData.user_id !== user.id) {
      console.warn(
        `Unauthorized convo access: user ${user.id} tried to use convo ${conversationId}`
      );
      return NextResponse.json({ error: 'Unauthorized access to conversation' }, { status: 403 });
    }

    const userMessage = messages[messages.length - 1];
    let userMessageContent = '';

    if (typeof userMessage?.content === 'string') {
      userMessageContent = userMessage.content;
    } else if (Array.isArray(userMessage?.content)) {
      const textPart = (userMessage.content as Array<{ type?: string; text?: string }>).find(
        (p) => p?.type === 'text'
      );
      if (textPart?.text) userMessageContent = textPart.text;
    }

    if (!userMessageContent) {
      return NextResponse.json(
        { error: 'Last message content is missing or not text' },
        { status: 400 }
      );
    }

    if (userMessageContent.length > MAX_MESSAGE_LENGTH) {
      return NextResponse.json(
        { error: `Message too long. Max ${MAX_MESSAGE_LENGTH} chars.` },
        { status: 400 }
      );
    }

    if (containsSuspiciousContent(userMessageContent)) {
      return NextResponse.json({ error: 'Message contains invalid content' }, { status: 400 });
    }

    const sanitizedContent = sanitizeInput(userMessageContent);
    if (!sanitizedContent) {
      return NextResponse.json(
        { error: 'Message content is invalid after sanitization' },
        { status: 400 }
      );
    }

    const moderationResult = await moderateUserMessage(user.id, sanitizedContent);
    if (!moderationResult.allowed) {
      return NextResponse.json(
        {
          error: moderationResult.reason,
          violationType: moderationResult.violationType,
          action: moderationResult.action,
        },
        { status: 403 }
      );
    }

    let fileSize: number | null = null;

    if (fileUrl && fileMimeType) {
      if (!ALLOWED_IMAGE_TYPES.includes(fileMimeType.toLowerCase())) {
        return NextResponse.json(
          {
            error: `Invalid file type. Allowed: ${ALLOWED_IMAGE_TYPES.join(', ')}`,
          },
          { status: 400 }
        );
      }

      try {
        new URL(fileUrl);
      } catch {
        return NextResponse.json({ error: 'Invalid file URL' }, { status: 400 });
      }

      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
      if (!fileUrl.startsWith(supabaseUrl)) {
        return NextResponse.json({ error: 'Invalid file source' }, { status: 400 });
      }

      try {
        const filePathMatch = fileUrl.match(/uploads\/(.+)$/);
        if (filePathMatch) {
          const filePath = filePathMatch[1];
          const { data: fileData } = await supabase.storage
            .from('uploads')
            .list('', { search: filePath });
          if (fileData && fileData.length > 0) {
            const meta = (fileData[0] as any).metadata;
            if (meta && typeof meta === 'object' && 'size' in meta) {
              fileSize = Number(meta.size) || null;
            }
          }
        }
      } catch (err) {
        console.warn('Could not read file size:', err);
      }

      const imgMod = await moderateImage(user.id, fileUrl);
      if (!imgMod.allowed) {
        return NextResponse.json(
          {
            error: imgMod.reason,
            severity: imgMod.severity,
            categories: imgMod.categories,
            action: imgMod.action,
          },
          { status: 403 }
        );
      }
    }

    (async () => {
      const { error: userMsgErr } = await supabase.from('messages').insert({
        conversation_id: conversationId,
        user_id: user.id,
        role: 'user',
        content: sanitizedContent,
        file_url: fileUrl || null,
        file_type: fileMimeType || null,
        file_size: fileSize,
      });
      if (userMsgErr) console.error('Error saving user message:', userMsgErr);
    })();

    let messagesForAI: CoreMessage[] = [...messages];
    const lastIndex = messagesForAI.length - 1;
    const lastMsg = messagesForAI[lastIndex];

    let systemPrompt: string;
    if (tool === 'textMessageTool') systemPrompt = textMessageToolPrompt;
    else if (tool === 'emailWriter') systemPrompt = emailWriterPrompt;
    else if (tool === 'recipeExtractor') systemPrompt = recipeExtractorPrompt;
    else systemPrompt = regularChatPrompt;

    if (fileUrl) {
      let baseText = '';
      if (typeof lastMsg.content === 'string') {
        baseText = lastMsg.content;
      } else if (Array.isArray(lastMsg.content)) {
        const parts = lastMsg.content as Array<{ type?: string; text?: string }>;
        const textPart = parts.find((p) => p && p.type === 'text');
        if (textPart?.text) baseText = textPart.text;
      }

      const multimodal: any[] = [];
      if (baseText) {
        multimodal.push({ type: 'text', text: baseText });
      }
      multimodal.push({ type: 'image', image: new URL(fileUrl) });

      messagesForAI[lastIndex] = {
        ...lastMsg,
        content: multimodal as any,
      };
    }

    const GEMINI_API_KEY =
      process.env.GOOGLE_GENERATIVE_AI_API_KEY ||
      process.env.GOOGLE_API_KEY ||
      process.env.NEXT_PUBLIC_GOOGLE_GENERATIVE_AI_API_KEY;

    if (!GEMINI_API_KEY) {
      console.error('Missing Gemini key on server');
      return NextResponse.json(
        { error: 'Gemini API key is not configured on the server.' },
        { status: 500 }
      );
    }

    const google = createGoogleGenerativeAI({ apiKey: GEMINI_API_KEY });

    const result = await streamText({
      model: google('gemini-2.5-flash'),
      system: systemPrompt,
      messages: messagesForAI,
      onFinish: async ({ text }) => {
        if (conversationId && text) {
          const sanitizedResponse = sanitizeInput(text);
          const { error: assistantErr } = await supabase.from('messages').insert({
            conversation_id: conversationId,
            user_id: user.id,
            role: 'assistant',
            content: sanitizedResponse,
          });
          if (assistantErr) {
            console.error('Error saving assistant message:', assistantErr);
          }
        }
      },
    });

    return new Response(result.textStream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'X-RateLimit-Limit': rl.limit.toString(),
        'X-RateLimit-Remaining': rl.remaining.toString(),
        'X-RateLimit-Reset': rl.reset.toString(),
      },
    });
  } catch (err) {
    console.error('Error in POST /api/chat-strict:', err);
    const msg = err instanceof Error ? err.message : 'Internal error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ ok: true, route: '/api/chat-strict' }, { status: 200 });
}
