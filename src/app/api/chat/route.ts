// src/app/api/chat/route.ts
// UPDATED: move Gemini init *inside* the handler so missing env doesn't crash the route
// also keeps image moderation + file tracking + TS-safe multimodal

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

// --- System Prompts ---
const regularChatPrompt = `You are a helpful and neutral AI assistant. Your goal is to answer questions, provide information, and engage in conversation clearly and directly.

**Guidelines:**
1.  **Be Direct:** Provide factual, direct answers to the user's queries.
2.  **Stay Neutral:** Approach all topics objectively.
3.  **Be Helpful:** Fulfill the user's request to the best of your ability.
4.  **Natural Conversation:** Respond in a natural, conversational manner.
`;

const textMessageToolPrompt = `You are a concise message assistant. Your task is to draft a short, clear, and professional text message (SMS, WhatsApp, etc.) in response to a user's request or an uploaded screenshot.

**CRITICAL OUTPUT MANDATE:**
Your entire response will be the text message itself.
`;

const emailWriterPrompt = `You are a high-precision email drafting tool. Your single task is to generate a professional, plain-text email based on the user's request.

**CRITICAL OUTPUT MANDATE:**
Your entire response will be the email text itself, starting with "Subject:" or the first line of the email body.
`;

const recipeExtractorPrompt = `You are a meticulous culinary assistant. Your sole purpose is to extract ingredients from a recipe (provided as text or an image) and generate a clean shopping list.

**CRITICAL OUTPUT MANDATE:**
Your entire response must follow this strict format.
`;

// ===== VALIDATION CONSTANTS =====
const MAX_MESSAGE_LENGTH = 10000;
const MAX_MESSAGES_IN_CONVERSATION = 100;
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];

// ===== RATE LIMIT CONFIG =====
const RATE_LIMIT_CONFIG = {
  maxRequests: 20,
  windowMs: 60 * 1000,
};

export async function POST(req: NextRequest) {
  const cookieStore = await cookies();

  // Supabase (server-side, with cookies)
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
    // 1. Auth
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      console.error('Auth Error in /api/chat:', authError);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Rate limit
    const rateLimitResult = rateLimit(user.id, RATE_LIMIT_CONFIG);
    if (!rateLimitResult.success) {
      const retryAfter = Math.ceil((rateLimitResult.reset - Date.now()) / 1000);
      return NextResponse.json(
        {
          error: 'Too many requests. Please try again later.',
          retryAfter,
        },
        {
          status: 429,
          headers: {
            'X-RateLimit-Limit': rateLimitResult.limit.toString(),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': rateLimitResult.reset.toString(),
            'Retry-After': retryAfter.toString(),
          },
        }
      );
    }

    // 3. Parse body
    const {
      messages: rawMessages,
      conversationId,
      tool,
      fileUrl,
      fileMimeType,
    } = await req.json();

    const messages = rawMessages as CoreMessage[];

    // 4. Validate
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

    // 5. Check conversation ownership
    const { data: conversationData, error: convError } = await supabase
      .from('conversations')
      .select('user_id')
      .eq('id', conversationId)
      .single();

    if (convError) {
      console.error('Error verifying conversation ownership:', convError);
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }

    if (conversationData.user_id !== user.id) {
      console.warn(`Unauthorized access attempt: User ${user.id} tried to access conversation ${conversationId}`);
      return NextResponse.json({ error: 'Unauthorized access to conversation' }, { status: 403 });
    }

    // 6. Extract last message text (TS-safe)
    const userMessage = messages[messages.length - 1];
    let userMessageContent = '';

    if (typeof userMessage?.content === 'string') {
      userMessageContent = userMessage.content;
    } else if (Array.isArray(userMessage?.content)) {
      const textPart = (userMessage.content as Array<{ type?: string; text?: string }>).find(
        (part) => part?.type === 'text'
      );
      if (textPart && typeof textPart.text === 'string') {
        userMessageContent = textPart.text;
      }
    }

    if (!userMessageContent) {
      return NextResponse.json({ error: 'Last message content is missing or not text' }, { status: 400 });
    }

    if (userMessageContent.length > MAX_MESSAGE_LENGTH) {
      return NextResponse.json(
        { error: `Message too long. Maximum ${MAX_MESSAGE_LENGTH} characters` },
        { status: 400 }
      );
    }

    if (containsSuspiciousContent(userMessageContent)) {
      console.warn(`Suspicious content detected from user ${user.id}`);
      return NextResponse.json({ error: 'Message contains invalid content' }, { status: 400 });
    }

    const sanitizedContent = sanitizeInput(userMessageContent);
    if (!sanitizedContent) {
      return NextResponse.json({ error: 'Message content is invalid after sanitization' }, { status: 400 });
    }

    // 7. Text moderation
    const moderationResult = await moderateUserMessage(user.id, sanitizedContent);
    if (!moderationResult.allowed) {
      console.warn(`Message blocked for user ${user.id}: ${moderationResult.reason}`);
      return NextResponse.json(
        {
          error: moderationResult.reason,
          violationType: moderationResult.violationType,
          action: moderationResult.action,
        },
        { status: 403 }
      );
    }

    // 8. Image validation / moderation (optional)
    let fileSize: number | null = null;

    if (fileUrl && fileMimeType) {
      if (!ALLOWED_IMAGE_TYPES.includes(fileMimeType.toLowerCase())) {
        return NextResponse.json(
          { error: `Invalid file type. Allowed types: ${ALLOWED_IMAGE_TYPES.join(', ')}` },
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
        console.warn(`File URL from unexpected domain: ${fileUrl}`);
        return NextResponse.json({ error: 'Invalid file source' }, { status: 400 });
      }

      try {
        const filePathMatch = fileUrl.match(/uploads\/(.+)$/);
        if (filePathMatch) {
          const filePath = filePathMatch[1];
          const { data: fileData } = await supabase.storage.from('uploads').list('', {
            search: filePath,
          });
          if (fileData && fileData.length > 0) {
            const meta = (fileData[0] as any).metadata;
            if (meta && typeof meta === 'object' && 'size' in meta) {
              fileSize = Number(meta.size) || null;
            }
          }
        }
      } catch (err) {
        console.warn('Could not get file size:', err);
      }

      const imageModerationResult = await moderateImage(user.id, fileUrl);
      if (!imageModerationResult.allowed) {
        console.warn(`Image blocked for user ${user.id}: ${imageModerationResult.reason}`);
        return NextResponse.json(
          {
            error: imageModerationResult.reason,
            severity: imageModerationResult.severity,
            categories: imageModerationResult.categories,
            action: imageModerationResult.action,
          },
          { status: 403 }
        );
      }
    }

    // 9. Save user message (async)
    (async () => {
      const { error: userMsgError } = await supabase.from('messages').insert({
        conversation_id: conversationId,
        user_id: user.id,
        role: 'user',
        content: sanitizedContent,
        file_url: fileUrl || null,
        file_type: fileMimeType || null,
        file_size: fileSize,
      });
      if (userMsgError) {
        console.error('Error saving user message:', userMsgError);
      }
    })();

    // 10. Prepare AI messages
    let messagesForAI: CoreMessage[] = [...messages];
    const lastMessageIndex = messagesForAI.length - 1;
    const lastMsg = messagesForAI[lastMessageIndex];

    let systemPrompt: string;
    if (tool === 'textMessageTool') systemPrompt = textMessageToolPrompt;
    else if (tool === 'emailWriter') systemPrompt = emailWriterPrompt;
    else if (tool === 'recipeExtractor') systemPrompt = recipeExtractorPrompt;
    else systemPrompt = regularChatPrompt;

    // 11. If image present, make multimodal
    if (fileUrl) {
      let baseText = '';
      if (typeof lastMsg.content === 'string') {
        baseText = lastMsg.content;
      } else if (Array.isArray(lastMsg.content)) {
        const parts = lastMsg.content as Array<{ type?: string; text?: string }>;
        const textPart = parts.find((p) => p && p.type === 'text');
        if (textPart && typeof textPart.text === 'string') {
          baseText = textPart.text;
        }
      }

      const multimodalContent: any[] = [];
      if (baseText) {
        multimodalContent.push({ type: 'text', text: baseText });
      }
      multimodalContent.push({
        type: 'image',
        image: new URL(fileUrl),
      });

      messagesForAI[lastMessageIndex] = {
        ...lastMsg,
        content: multimodalContent as any,
      };
    }

    // 12. INIT GEMINI *HERE*, not at top
    const GEMINI_API_KEY =
      process.env.GOOGLE_GENERATIVE_AI_API_KEY ||
      process.env.GOOGLE_API_KEY ||
      process.env.NEXT_PUBLIC_GOOGLE_GENERATIVE_AI_API_KEY;

    if (!GEMINI_API_KEY) {
      console.error('🚨 Missing Gemini API key in /api/chat');
      return NextResponse.json(
        { error: 'Gemini API key is not configured on the server.' },
        { status: 500 }
      );
    }

    const google = createGoogleGenerativeAI({
      apiKey: GEMINI_API_KEY,
    });

    // 13. Call AI
    const result = await streamText({
      model: google('gemini-2.5-flash'),
      system: systemPrompt,
      messages: messagesForAI,
      onFinish: async ({ text }) => {
        if (conversationId && text) {
          const sanitizedResponse = sanitizeInput(text);
          const { error: assistantMsgError } = await supabase.from('messages').insert({
            conversation_id: conversationId,
            user_id: user.id,
            role: 'assistant',
            content: sanitizedResponse,
          });
          if (assistantMsgError) {
            console.error('Error saving assistant message:', assistantMsgError);
          }
        }
      },
    });

    return new Response(result.textStream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'X-RateLimit-Limit': rateLimitResult.limit.toString(),
        'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
        'X-RateLimit-Reset': rateLimitResult.reset.toString(),
      },
    });
  } catch (error) {
    console.error('Error in POST /api/chat:', error);
    const message = error instanceof Error ? error.message : 'An internal error occurred';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

// 👇 GET must stay simple and must NOT crash even if Gemini is missing
export async function GET() {
  return NextResponse.json({ ok: true, route: '/api/chat' }, { status: 200 });
}
