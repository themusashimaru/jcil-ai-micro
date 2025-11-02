// src/app/api/chat/route.ts
// SINGLE CHAT ROUTE – Supabase auth, tools, file validation, Gemini call
// no protected, no chat2, no re-exports

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

// ===== SYSTEM PROMPTS =====
const regularChatPrompt = `You are a helpful and neutral AI assistant. Your goal is to answer questions, provide information, and engage in conversation clearly and directly.

Guidelines:
1. Be direct.
2. Stay neutral.
3. Be helpful.
4. Sound natural.
`;

const textMessageToolPrompt = `You are a concise message assistant. Your task is to draft a short, clear, and professional text message (SMS, WhatsApp, etc.) in response to a user's request or an uploaded screenshot.

CRITICAL OUTPUT MANDATE:
Your entire response will be the text message itself.
`;

const emailWriterPrompt = `You are a high-precision email drafting tool. Your single task is to generate a professional, plain-text email based on the user's request.

CRITICAL OUTPUT MANDATE:
Your entire response will be the email text itself, starting with "Subject:" or the first line of the email body.
`;

const recipeExtractorPrompt = `You are a meticulous culinary assistant. Your sole purpose is to extract ingredients from a recipe (provided as text or an image) and generate a clean shopping list.

CRITICAL OUTPUT MANDATE:
Your entire response must follow this strict format.
`;

// ===== CONSTANTS =====
const MAX_MESSAGE_LENGTH = 10000;
const MAX_MESSAGES_IN_CONVERSATION = 100;
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];

const RATE_LIMIT_CONFIG = {
  maxRequests: 20,
  windowMs: 60 * 1000,
};

export async function POST(req: NextRequest) {
  const cookieStore = await cookies();

  // --- Supabase server client (with cookies)
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
    // 1) AUTH
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2) RATE LIMIT
    const rl = rateLimit(user.id, RATE_LIMIT_CONFIG);
    if (!rl.success) {
      const retryAfter = Math.ceil((rl.reset - Date.now()) / 1000);
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.', retryAfter },
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

    // 3) PARSE BODY
    const {
      messages: rawMessages,
      conversationId,
      tool,
      fileUrl,
      fileMimeType,
    } = await req.json();

    const messages = rawMessages as CoreMessage[];

    // 4) VALIDATE BODY
    if (!Array.isArray(messages)) {
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

    // 5) OWNERSHIP CHECK
    const { data: convo, error: convErr } = await supabase
      .from('conversations')
      .select('user_id')
      .eq('id', conversationId)
      .single();

    if (convErr) {
      console.error('conversation lookup error:', convErr);
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }

    if (convo.user_id !== user.id) {
      return NextResponse.json({ error: 'Unauthorized access to conversation' }, { status: 403 });
    }

    // 6) EXTRACT LAST USER MESSAGE (TS SAFE)
    const lastMessage = messages[messages.length - 1];
    let userText = '';

    if (typeof lastMessage?.content === 'string') {
      userText = lastMessage.content;
    } else if (Array.isArray(lastMessage?.content)) {
      const textPart = (lastMessage.content as Array<{ type?: string; text?: string }>).find(
        (p) => p?.type === 'text'
      );
      if (textPart?.text) {
        userText = textPart.text;
      }
    }

    if (!userText) {
      return NextResponse.json({ error: 'Last message content is missing or not text' }, { status: 400 });
    }

    if (userText.length > MAX_MESSAGE_LENGTH) {
      return NextResponse.json(
        { error: `Message too long. Maximum ${MAX_MESSAGE_LENGTH} characters` },
        { status: 400 }
      );
    }

    if (containsSuspiciousContent(userText)) {
      return NextResponse.json({ error: 'Message contains invalid content' }, { status: 400 });
    }

    const sanitizedContent = sanitizeInput(userText);
    if (!sanitizedContent) {
      return NextResponse.json({ error: 'Message content is invalid after sanitization' }, { status: 400 });
    }

    // 7) TEXT MODERATION
    const moderation = await moderateUserMessage(user.id, sanitizedContent);
    if (!moderation.allowed) {
      return NextResponse.json(
        {
          error: moderation.reason,
          violationType: moderation.violationType,
          action: moderation.action,
        },
        { status: 403 }
      );
    }

    // 8) IMAGE VALIDATION (NO STORAGE LOOKUP – THIS WAS CAUSING PAIN)
    let fileSize: number | null = null;

    if (fileUrl && fileMimeType) {
      if (!ALLOWED_IMAGE_TYPES.includes(fileMimeType.toLowerCase())) {
        return NextResponse.json(
          { error: `Invalid file type. Allowed types: ${ALLOWED_IMAGE_TYPES.join(', ')}` },
          { status: 400 }
        );
      }

      // must be valid URL
      try {
        new URL(fileUrl);
      } catch {
        return NextResponse.json({ error: 'Invalid file URL' }, { status: 400 });
      }

      // must come from our Supabase
      const supaUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
      if (!fileUrl.startsWith(supaUrl)) {
        return NextResponse.json({ error: 'Invalid file source' }, { status: 400 });
      }

      // IMAGE MODERATION
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

      // we don't actually need the real size for now
      fileSize = null;
    }

    // 9) SAVE USER MESSAGE (async)
    (async () => {
      const { error: saveErr } = await supabase.from('messages').insert({
        conversation_id: conversationId,
        user_id: user.id,
        role: 'user',
        content: sanitizedContent,
        file_url: fileUrl || null,
        file_type: fileMimeType || null,
        file_size: fileSize,
      });
      if (saveErr) console.error('save user message error:', saveErr);
    })();

    // 10) BUILD AI MESSAGES
    let systemPrompt = regularChatPrompt;
    if (tool === 'textMessageTool') systemPrompt = textMessageToolPrompt;
    else if (tool === 'emailWriter') systemPrompt = emailWriterPrompt;
    else if (tool === 'recipeExtractor') systemPrompt = recipeExtractorPrompt;

    const messagesForAI: CoreMessage[] = [...messages];
    const lastIdx = messagesForAI.length - 1;
    const last = messagesForAI[lastIdx];

    if (fileUrl) {
      // rebuild as multimodal
      let baseText = '';
      if (typeof last.content === 'string') {
        baseText = last.content;
      } else if (Array.isArray(last.content)) {
        const part = (last.content as Array<{ type?: string; text?: string }>).find((p) => p?.type === 'text');
        if (part?.text) baseText = part.text;
      }

      const multimodalContent: any[] = [];
      if (baseText) multimodalContent.push({ type: 'text', text: baseText });
      multimodalContent.push({ type: 'image', image: new URL(fileUrl) });

      messagesForAI[lastIdx] = {
        ...last,
        content: multimodalContent as any,
      };
    }

    // 11) INIT GEMINI *INSIDE* HANDLER
    const GEMINI_KEY =
      process.env.GOOGLE_GENERATIVE_AI_API_KEY ||
      process.env.GOOGLE_API_KEY ||
      process.env.NEXT_PUBLIC_GOOGLE_GENERATIVE_AI_API_KEY;

    if (!GEMINI_KEY) {
      console.error('Missing Gemini key');
      return NextResponse.json({ error: 'Gemini API key is not configured' }, { status: 500 });
    }

    const google = createGoogleGenerativeAI({ apiKey: GEMINI_KEY });

    // 12) CALL AI
    const result = await streamText({
      model: google('gemini-2.5-flash'),
      system: systemPrompt,
      messages: messagesForAI,
      onFinish: async ({ text }) => {
        if (text) {
          const cleaned = sanitizeInput(text);
          const { error: saveAssistantErr } = await supabase.from('messages').insert({
            conversation_id: conversationId,
            user_id: user.id,
            role: 'assistant',
            content: cleaned,
          });
          if (saveAssistantErr) console.error('save assistant msg error:', saveAssistantErr);
        }
      },
    });

    // 13) STREAM BACK
    return new Response(result.textStream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'X-RateLimit-Limit': rl.limit.toString(),
        'X-RateLimit-Remaining': rl.remaining.toString(),
        'X-RateLimit-Reset': rl.reset.toString(),
      },
    });
  } catch (err) {
    console.error('Error in POST /api/chat:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

// keep GET simple
export async function GET() {
  return NextResponse.json({ ok: true, route: '/api/chat' }, { status: 200 });
}
