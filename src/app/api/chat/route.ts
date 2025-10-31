// /app/api/chat/route.ts
// UPDATED with IMAGE MODERATION + FILE TRACKING

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { streamText, type CoreMessage, type TextStreamPart } from 'ai';
import { rateLimit } from '@/lib/rate-limit';
import { sanitizeInput, containsSuspiciousContent } from '@/lib/sanitize';
import { moderateUserMessage } from '@/lib/moderation';
import { moderateImage } from '@/lib/image-moderation';

export const dynamic = 'force-dynamic';

// --- Google Provider Only ---
const google = createGoogleGenerativeAI({
  apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
});

// --- System Prompts ---
const regularChatPrompt = `You are a helpful and neutral AI assistant. Your goal is to answer questions, provide information, and engage in conversation clearly and directly.

**Guidelines:**
1.  **Be Direct:** Provide factual, direct answers to the user's queries.
2.  **Stay Neutral:** Approach all topics objectively. Avoid expressing personal opinions, biases, or taking political stances.
3.  **Be Helpful:** Fulfill the user's request to the best of your ability, whether it's writing, summarizing, or explaining.
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
  maxRequests: 20, // 20 requests
  windowMs: 60 * 1000, // Per minute
};

export async function POST(req: NextRequest) {
  const cookieStore = await cookies();

  // Initialize Supabase Client
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get: (name: string) => {
          return cookieStore.get(name)?.value;
        },
        set: (name: string, value: string, options: CookieOptions) => {
          try { cookieStore.set(name, value, options); } catch (error) { console.error(`Failed to set cookie "${name}" (Route Handler):`, error); }
        },
        remove: (name: string, options: CookieOptions) => {
          try { cookieStore.set({ name, value: '', ...options }); } catch (error) { console.error(`Failed to delete cookie "${name}" (Route Handler):`, error); }
        },
      },
    }
  );

  try {
    // --- 1. AUTHENTICATION: Get User ---
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      console.error('Auth Error:', authError);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.log("User authenticated:", user.id);

    // ===== 2. RATE LIMITING =====
    const rateLimitResult = rateLimit(user.id, RATE_LIMIT_CONFIG);
    
    if (!rateLimitResult.success) {
      const retryAfter = Math.ceil((rateLimitResult.reset - Date.now()) / 1000);
      return NextResponse.json(
        { 
          error: 'Too many requests. Please try again later.',
          retryAfter 
        },
        { 
          status: 429,
          headers: {
            'X-RateLimit-Limit': rateLimitResult.limit.toString(),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': rateLimitResult.reset.toString(),
            'Retry-After': retryAfter.toString(),
          }
        }
      );
    }

    // --- 3. Parse Request Body ---
    const {
      messages: rawMessages,
      conversationId,
      tool,
      fileUrl,
      fileMimeType
    } = await req.json();

    const messages: CoreMessage[] = rawMessages as CoreMessage[]; 

    // ===== 4. INPUT VALIDATION =====
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

    // Validate tool parameter
    const validTools = ['none', 'textMessageTool', 'emailWriter', 'recipeExtractor'];
    if (tool && !validTools.includes(tool)) {
      return NextResponse.json({ error: 'Invalid tool parameter' }, { status: 400 });
    }

    // ===== 5. AUTHORIZATION: Verify Conversation Ownership =====
    const { data: conversationData, error: convError } = await supabase
      .from('conversations')
      .select('user_id')
      .eq('id', conversationId)
      .single();

    if (convError) {
      console.error('Error verifying conversation ownership:', convError);
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }

    // CRITICAL: Check if the conversation belongs to the authenticated user
    if (conversationData.user_id !== user.id) {
      console.warn(`Unauthorized access attempt: User ${user.id} tried to access conversation ${conversationId} owned by ${conversationData.user_id}`);
      return NextResponse.json({ error: 'Unauthorized access to conversation' }, { status: 403 });
    }

    // --- 6. Extract and Sanitize Message Content ---
    const userMessage = messages[messages.length - 1];
    let userMessageContent: string | undefined;

    if (typeof userMessage?.content === 'string') {
        userMessageContent = userMessage.content;
    } else if (Array.isArray(userMessage?.content)) {
        const textPart = userMessage.content.find(part => part.type === 'text');
        userMessageContent = textPart?.text;
    }

    if (typeof userMessageContent !== 'string') { 
      return NextResponse.json({ error: 'Last message content is missing or not text' }, { status: 400 }); 
    }

    // ===== 7. VALIDATE MESSAGE CONTENT =====
    if (userMessageContent.length === 0) {
      return NextResponse.json({ error: 'Message cannot be empty' }, { status: 400 });
    }

    if (userMessageContent.length > MAX_MESSAGE_LENGTH) {
      return NextResponse.json({ error: `Message too long. Maximum ${MAX_MESSAGE_LENGTH} characters` }, { status: 400 });
    }

    // ===== 8. XSS PROTECTION: Check for suspicious content =====
    if (containsSuspiciousContent(userMessageContent)) {
      console.warn(`Suspicious content detected from user ${user.id}`);
      return NextResponse.json({ error: 'Message contains invalid content' }, { status: 400 });
    }

    // ===== 9. SANITIZE INPUT =====
    const sanitizedContent = sanitizeInput(userMessageContent);

    if (sanitizedContent.length === 0) {
      return NextResponse.json({ error: 'Message content is invalid after sanitization' }, { status: 400 });
    }

    // ===== 9.5. TEXT CONTENT MODERATION =====
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

    // ===== 10. VALIDATE & MODERATE IMAGE IF PROVIDED =====
    let fileSize: number | null = null;
    
    if (fileUrl && fileMimeType) {
      // Validate file type
      if (!ALLOWED_IMAGE_TYPES.includes(fileMimeType.toLowerCase())) {
        return NextResponse.json({ 
          error: `Invalid file type. Allowed types: ${ALLOWED_IMAGE_TYPES.join(', ')}` 
        }, { status: 400 });
      }

      // Validate URL format
      try {
        new URL(fileUrl);
      } catch {
        return NextResponse.json({ error: 'Invalid file URL' }, { status: 400 });
      }

      // Verify URL is from Supabase storage
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
      if (!fileUrl.startsWith(supabaseUrl)) {
        console.warn(`File URL from unexpected domain: ${fileUrl}`);
        return NextResponse.json({ error: 'Invalid file source' }, { status: 400 });
      }

      // Get file size from storage
      try {
        const filePathMatch = fileUrl.match(/uploads\/(.+)$/);
        if (filePathMatch) {
          const filePath = filePathMatch[1];
          const { data: fileData, error: fileError } = await supabase
            .storage
            .from('uploads')
            .list('', {
              search: filePath
            });
          
          if (!fileError && fileData && fileData.length > 0) {
            fileSize = fileData[0].metadata?.size || null;
          }
        }
      } catch (error) {
        console.warn('Could not get file size:', error);
      }

      // IMAGE MODERATION CHECK
      console.log('🔍 Moderating uploaded image...');
      const imageModerationResult = await moderateImage(user.id, fileUrl);
      
      if (!imageModerationResult.allowed) {
        // Image was BLOCKED and AUTO-DELETED!
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
      
      console.log('✅ Image passed moderation');
    }

    // ===== 11. SAVE USER MESSAGE WITH FILE TRACKING 🔥 UPDATED! =====
    (async () => {
      const { error: userMsgError } = await supabase.from('messages').insert({
        conversation_id: conversationId,
        user_id: user.id,
        role: 'user',
        content: sanitizedContent,
        file_url: fileUrl || null,        // 🔥 NEW: Track file URL
        file_type: fileMimeType || null,  // 🔥 NEW: Track file type
        file_size: fileSize,              // 🔥 NEW: Track file size
      });
      if (userMsgError) {
        console.error('Error saving user message:', userMsgError);
      }
    })();
    
    // --- 12. Prepare AI Request ---
    let messagesForAI = [...messages]; 
    const lastMessageIndex = messagesForAI.length - 1;
    let result: TextStreamPart; 

    console.log(`Using Google Gemini (Tool: ${tool || 'none'})`);
    
    // Get System Prompt
    let systemPrompt: string;
    
    if (tool === 'textMessageTool') {
      systemPrompt = textMessageToolPrompt;
    }
    else if (tool === 'emailWriter') {
      systemPrompt = emailWriterPrompt;
    } 
    else if (tool === 'recipeExtractor') {
      systemPrompt = recipeExtractorPrompt;
    } 
    else {
      systemPrompt = regularChatPrompt;
    }
    
    // Prepare messages for AI (Gemini Image-only Multimodal)
    if (fileUrl && typeof messagesForAI[lastMessageIndex].content === 'string') {
      if (!fileMimeType?.startsWith('image/')) {
          console.warn(`Warning: Sending non-image file (${fileMimeType}) to Gemini.`);
      }
      
      console.log("Adding file URL as 'image' for Gemini:", fileUrl);
      const multimodalContent = [
        { type: 'text', text: messagesForAI[lastMessageIndex].content as string },
        { type: 'image', image: new URL(fileUrl) }
      ];
       messagesForAI[lastMessageIndex] = {
           ...messagesForAI[lastMessageIndex],
           content: multimodalContent as any
       };
    }

    // --- 13. Call Google AI ---
    result = await streamText({
      model: google('gemini-2.5-flash'),
      system: systemPrompt,
      messages: messagesForAI, 
      onFinish: async ({ text }) => {
        if (conversationId && text) {
          // Sanitize AI response before saving (extra safety layer)
          const sanitizedResponse = sanitizeInput(text);
          
          const { error: assistantMsgError } = await supabase.from('messages').insert({
            conversation_id: conversationId, 
            user_id: user.id, 
            role: 'assistant', 
            content: sanitizedResponse
          });
          if (assistantMsgError) console.error('Error saving assistant message:', assistantMsgError);
        }
      },
    });

    // --- 14. Return Response with Rate Limit Headers ---
    return new Response(result.textStream, {
      headers: {
        'Content-Type': 'text-plain; charset=utf-8',
        'X-RateLimit-Limit': rateLimitResult.limit.toString(),
        'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
        'X-RateLimit-Reset': rateLimitResult.reset.toString(),
      },
    });

  } catch (error) {
    console.error('Error in POST /api/chat:', error);
    let errorMessage = 'An internal error occurred';
    if (error instanceof Error) { errorMessage = error.message; }
     return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}