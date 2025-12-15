/**
 * CHAT API ROUTE - OpenAI GPT-5 Edition
 *
 * PURPOSE:
 * - Handle chat message requests with streaming responses
 * - Integrate with OpenAI API (GPT-5-nano/mini tiered routing)
 * - Route image generation to DALL-E 3
 *
 * MODEL ROUTING (GPT-5 Edition):
 * - gpt-5-nano: Basic chat, greetings, simple Q&A (cost-optimized)
 * - gpt-5-mini: Search, files, images, complex reasoning, code, AND fallback
 * - DALL-E 3: Image generation only
 *
 * PUBLIC ROUTES:
 * - POST /api/chat
 *
 * SECURITY/RLS NOTES:
 * - Input sanitization for prompts
 * - Rate limiting
 * - Content moderation
 * - Admin bypass for limits
 *
 * DEPENDENCIES/ENVS:
 * - OPENAI_API_KEY (required)
 * - NEXT_PUBLIC_SUPABASE_URL (optional, for auth)
 *
 * FEATURES:
 * - ✅ Streaming responses with SSE
 * - ✅ GPT-5-nano/mini tiered routing with auto-escalation
 * - ✅ Image generation with DALL-E 3
 * - ✅ Tool-specific system prompts
 * - ✅ Temperature and token optimization per tool
 * - ✅ Retry logic with exponential backoff
 * - ✅ Admin bypass for rate/usage limits
 *
 * TODO:
 * - [ ] Add authentication
 * - [✓] Implement rate limiting (60/hr auth, 20/hr anon)
 * - [ ] Store messages in database
 * - [✓] Add content moderation (OpenAI omni-moderation-latest)
 * - [✓] Implement usage tracking (daily limits with 80% warning)
 */

import { createChatCompletion, shouldUseWebSearch, getLastUserMessageText } from '@/lib/openai/client';
import { getModelForTool } from '@/lib/openai/models';
import { moderateContent } from '@/lib/openai/moderation';
import { generateImageWithFallback, ImageSize } from '@/lib/openai/images';
import { buildFullSystemPrompt } from '@/lib/prompts/systemPrompt';
import { getSystemPromptForTool } from '@/lib/openai/tools';
import { canMakeRequest, getTokenUsage, getTokenLimitWarningMessage, incrementImageUsage, getImageLimitWarningMessage } from '@/lib/limits';
import { decideRoute, logRouteDecision, parseSizeFromText } from '@/lib/routing/decideRoute';
import { createPendingRequest, completePendingRequest } from '@/lib/pending-requests';
import { getProviderSettings, Provider, getModelForTier } from '@/lib/provider/settings';
import {
  createAnthropicCompletion,
  createAnthropicStreamingCompletion,
  createAnthropicCompletionWithSearch,
  createAnthropicCompletionWithSkills,
  detectDocumentRequest,
} from '@/lib/anthropic/client';
import { acquireSlot, releaseSlot, generateRequestId } from '@/lib/queue';
// Brave Search no longer needed - using native Anthropic web search
// import { braveSearch } from '@/lib/brave/search';
import { NextRequest } from 'next/server';
import { CoreMessage } from 'ai';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

// Rate limits per hour (configurable via env vars for tier upgrades)
const RATE_LIMIT_AUTHENTICATED = parseInt(process.env.RATE_LIMIT_AUTH || '120', 10); // messages/hour for logged-in users
const RATE_LIMIT_ANONYMOUS = parseInt(process.env.RATE_LIMIT_ANON || '30', 10); // messages/hour for anonymous users

// ========================================
// TOKEN & CONTEXT LIMITS (Cost Optimization)
// ========================================
const MAX_RESPONSE_TOKENS = 4096; // Cap response size (saves money)
const DEFAULT_RESPONSE_TOKENS = 2048; // Default if not specified
const MAX_CONTEXT_MESSAGES = 40; // Max messages to send (oldest get truncated)
const MAX_CONTEXT_CHARS = 150000; // ~37K tokens approx (leave room for response)

/**
 * Truncate conversation history to fit within context limits
 * Keeps system messages and most recent messages, truncates from the middle
 */
function truncateMessages(messages: CoreMessage[], maxMessages: number = MAX_CONTEXT_MESSAGES, maxChars: number = MAX_CONTEXT_CHARS): CoreMessage[] {
  if (messages.length <= maxMessages) {
    // Still check character limit
    let totalChars = 0;
    const result: CoreMessage[] = [];

    // Process from newest to oldest, keep what fits
    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i];
      const msgContent = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content);
      const msgChars = msgContent.length;

      if (totalChars + msgChars <= maxChars) {
        result.unshift(msg);
        totalChars += msgChars;
      } else {
        // If we can't fit more, stop (but we processed newest first)
        break;
      }
    }

    return result.length > 0 ? result : messages.slice(-5); // Always keep at least last 5
  }

  // More than maxMessages - truncate
  // Keep first message (often context) and last N messages
  const keepFirst = messages[0];
  const keepLast = messages.slice(-(maxMessages - 1));

  return [keepFirst, ...keepLast];
}

/**
 * Clamp max_tokens to allowed range
 */
function clampMaxTokens(requestedTokens?: number): number {
  if (!requestedTokens) return DEFAULT_RESPONSE_TOKENS;
  return Math.min(Math.max(requestedTokens, 256), MAX_RESPONSE_TOKENS);
}

/**
 * Professional document formatting instructions for Skills API
 * Ensures high-quality, well-formatted output documents
 */
function getDocumentFormattingPrompt(docType: 'xlsx' | 'pptx' | 'docx' | 'pdf'): string {
  const basePrompt = `
## CRITICAL DOCUMENT FORMATTING REQUIREMENTS

You are creating a PROFESSIONAL document. Quality and formatting are paramount.

### General Rules:
- Use proper margins (1 inch / 2.5cm on all sides)
- Use professional fonts: Arial, Helvetica, or Calibri
- Ensure consistent spacing throughout
- Use proper heading hierarchy
- Include page numbers for multi-page documents
- Save the document to $OUTPUT_DIR with an appropriate filename

`;

  const typeSpecific: Record<string, string> = {
    pdf: `### PDF Specific Requirements:

**RESUME/CV FORMATTING (CRITICAL - FOLLOW EXACTLY):**

1. **HEADER SECTION (CRITICAL):**
   - DO NOT include any document title like "Resume", "John Smith Resume", "Master Electrician Resume", etc.
   - The VERY FIRST LINE of the document must be the person's NAME - nothing else above it
   - Name: 18-24pt bold, centered at top
   - Contact line directly below name: ONLY phone | email | LinkedIn URL (NO physical address)
   - Contact info: 10pt, centered, separated by pipes (|)
   - Example: "(555) 123-4567 | john.doe@email.com | linkedin.com/in/johndoe"

2. **PROFESSIONAL SUMMARY:**
   - Section header: 11pt bold, ALL CAPS, LEFT aligned with subtle line below
   - Summary text: 10pt regular, LEFT aligned
   - MUST stay within page margins - use text wrapping, do NOT exceed margins
   - Keep to 3-4 lines maximum

3. **PROFESSIONAL EXPERIENCE (CRITICAL LAYOUT):**
   - Section header: 11pt bold, ALL CAPS, LEFT aligned with line below
   - For EACH job entry, format EXACTLY like this:
     * Line 1: Job Title - 11pt bold, LEFT aligned
     * Line 2: Company Name, City ST - 10pt regular, LEFT aligned
     * Line 2 (same line): Date Range - 10pt, RIGHT aligned (use tab or spacing)
     * Bullet points: 10pt, indented, describe achievements
   - Example layout:
     [Job Title]
     [Company, City ST]                              [Date Range - RIGHT aligned]
     • Achievement bullet point
     • Another achievement

4. **EDUCATION:**
   - Section header: 11pt bold, ALL CAPS, LEFT aligned with line below
   - ALL education entries LEFT aligned (NOT centered)
   - Degree and school on separate lines or same line
   - Graduation date RIGHT aligned on same line as school

5. **SKILLS:**
   - Section header: 11pt bold, ALL CAPS, LEFT aligned
   - Skills listed LEFT aligned, can use columns or comma-separated

6. **GENERAL RULES:**
   - Page margins: 0.5-0.75 inch on all sides
   - NO text should extend past margins
   - Use consistent spacing between sections (10-12pt)
   - Keep to 1 page if possible, 2 pages maximum
   - NO generic titles like "Resume Template" - start with actual name
   - All body text LEFT aligned unless specified otherwise

- For PRESENTATIONS as PDF:
  * Title slide with large header (36pt+)
  * Each slide as a new page
  * Clear visual hierarchy
  * Bullet points for key information
  * Include slide numbers

- For GENERAL PDFs:
  * Clear title at top
  * Proper paragraph spacing (1.15-1.5 line height)
  * Headers/subheaders in bold
  * Professional color scheme (navy blue #1e3a5f for headers)
`,
    docx: `### Word Document Requirements:
- Use proper heading styles (Heading 1, Heading 2, etc.)
- Enable automatic table of contents if document has multiple sections
- Use consistent paragraph spacing
- For LETTERS: Include proper business letter format with date, addresses, salutation
- For REPORTS: Include title page, executive summary, sections with headers
- For RESUMES: Same professional formatting as PDF resumes
- Use 11-12pt font for body text
- Use 1.15 line spacing for readability
`,
    xlsx: `### Excel Spreadsheet Requirements:
- Use clear column headers in bold
- Apply proper number formatting (currency, percentages, dates)
- Use borders for data tables
- Include totals/summary rows where appropriate
- Use freeze panes for headers
- Apply alternating row colors for readability
- Size columns appropriately for content
- For BUDGETS: Include categories, amounts, totals, and variance columns
- For DATA: Sort logically, add filters where helpful
`,
    pptx: `### PowerPoint Requirements:
- Title slide with presentation name and subtitle
- Consistent slide layout throughout
- Use 28-44pt for slide titles
- Use 18-24pt for body text
- Maximum 6 bullet points per slide
- Maximum 6 words per bullet point (6x6 rule)
- Include speaker notes where helpful
- Use professional color scheme
- Add slide numbers
- Include summary/conclusion slide
`
  };

  return basePrompt + (typeSpecific[docType] || '');
}

function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    return null; // Rate limiting disabled if not configured
  }

  return createClient(supabaseUrl, supabaseServiceKey);
}

async function checkChatRateLimit(
  identifier: string,
  isAuthenticated: boolean
): Promise<{ allowed: boolean; remaining: number; resetIn: number }> {
  const supabase = getSupabaseAdmin();

  if (!supabase) {
    // If Supabase admin not configured, allow request (graceful degradation)
    return { allowed: true, remaining: -1, resetIn: 0 };
  }

  const limit = isAuthenticated ? RATE_LIMIT_AUTHENTICATED : RATE_LIMIT_ANONYMOUS;
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

  try {
    // Count recent chat messages from this identifier
    const { count, error } = await supabase
      .from('rate_limits')
      .select('*', { count: 'exact', head: true })
      .eq('identifier', identifier)
      .eq('action', 'chat_message')
      .gte('created_at', oneHourAgo);

    if (error) {
      console.error('[Chat API] Rate limit check error:', error);
      // Allow request on error (fail open for availability)
      return { allowed: true, remaining: -1, resetIn: 0 };
    }

    const currentCount = count || 0;
    const remaining = Math.max(0, limit - currentCount - 1);

    if (currentCount >= limit) {
      // Get the oldest rate limit entry to calculate reset time
      const { data: oldestEntry } = await supabase
        .from('rate_limits')
        .select('created_at')
        .eq('identifier', identifier)
        .eq('action', 'chat_message')
        .gte('created_at', oneHourAgo)
        .order('created_at', { ascending: true })
        .limit(1)
        .single();

      const resetIn = oldestEntry
        ? Math.ceil((new Date(oldestEntry.created_at).getTime() + 60 * 60 * 1000 - Date.now()) / 1000)
        : 3600;

      return { allowed: false, remaining: 0, resetIn };
    }

    // Record this request
    await supabase.from('rate_limits').insert({
      identifier,
      action: 'chat_message',
    });

    return { allowed: true, remaining, resetIn: 0 };
  } catch (error) {
    console.error('[Chat API] Rate limit error:', error);
    // Allow request on error
    return { allowed: true, remaining: -1, resetIn: 0 };
  }
}

interface UserContext {
  name: string;
  role: 'student' | 'professional';
  field?: string;
  purpose?: string;
}

interface ChatRequestBody {
  messages: CoreMessage[];
  tool?: string;
  temperature?: number;
  max_tokens?: number;
  userContext?: UserContext;
  conversationId?: string; // Current conversation ID to exclude from history
}

// Detect if user is asking about previous conversations
function isAskingAboutHistory(content: string): boolean {
  const lowerContent = content.toLowerCase();

  const historyPatterns = [
    /what (did|have|were) (we|i) (talk|discuss|chat)(ed)? about/i,
    /previous (conversation|chat|discussion)s?/i,
    /earlier (conversation|chat|discussion)s?/i,
    /our (past|last|recent) (conversation|chat|discussion)s?/i,
    /(show|tell|list) (me )?(my |the |our )?(previous|past|recent|earlier|last) (conversation|chat|discussion)s?/i,
    /what (was|were) (we|i) (talking|chatting|discussing) about/i,
    /(summarize|summary of) (my |our )?(previous|past|recent|earlier) (conversation|chat|discussion)s?/i,
    /history of (our|my) (conversation|chat|discussion)s?/i,
    /(remember|recall) (our|my) (previous|past|earlier) (conversation|chat|discussion)/i,
    /in (our|my) (previous|past|last|earlier) (conversation|chat|discussion)/i,
    /last (two|three|few|several) (conversation|chat|discussion)s?/i,
    /past (two|three|few|several) (conversation|chat|discussion)s?/i,
    /(yesterday|last week|last time|before)/i,
  ];

  return historyPatterns.some(pattern => pattern.test(lowerContent));
}

export async function POST(request: NextRequest) {
  // Generate a unique request ID for queue management
  const requestId = generateRequestId();
  let slotAcquired = false;

  try {
    // Acquire a slot in the queue (prevents overwhelming AI providers)
    slotAcquired = await acquireSlot(requestId);

    if (!slotAcquired) {
      console.log('[Chat API] Queue full, returning busy response');
      return new Response(
        JSON.stringify({
          error: 'Server busy',
          message: 'We\'re experiencing high demand right now. Please try again in a few seconds.',
          retryAfter: 5,
        }),
        {
          status: 503,
          headers: {
            'Content-Type': 'application/json',
            'Retry-After': '5',
          },
        }
      );
    }

    // Parse request body
    const body: ChatRequestBody = await request.json();
    const { messages, tool, temperature, max_tokens, userContext, conversationId } = body;

    // Validate messages
    if (!messages || messages.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Messages are required' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Check rate limiting
    // Get user auth status and identifier for rate limiting
    let rateLimitIdentifier: string;
    let isAuthenticated = false;
    let isAdmin = false;

    try {
      const cookieStore = await cookies();
      const supabase = createServerClient(
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

      const { data: { user } } = await supabase.auth.getUser();

      if (user) {
        rateLimitIdentifier = user.id;
        isAuthenticated = true;

        // Check if user is admin for bypass
        const { data: userData } = await supabase
          .from('users')
          .select('is_admin')
          .eq('id', user.id)
          .single();

        isAdmin = userData?.is_admin === true;
      } else {
        // Fall back to IP for anonymous users
        rateLimitIdentifier = request.headers.get('x-forwarded-for')?.split(',')[0] ||
                              request.headers.get('x-real-ip') ||
                              'anonymous';
      }
    } catch {
      // If auth check fails, use IP
      rateLimitIdentifier = request.headers.get('x-forwarded-for')?.split(',')[0] ||
                            request.headers.get('x-real-ip') ||
                            'anonymous';
    }

    // Get user's subscription tier (needed for token tracking)
    let userTier = 'free';
    if (isAuthenticated) {
      try {
        const cookieStore = await cookies();
        const supabase = createServerClient(
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
        const { data: userData } = await supabase
          .from('users')
          .select('subscription_tier')
          .eq('id', rateLimitIdentifier)
          .single();
        userTier = userData?.subscription_tier || 'free';
      } catch {
        // Default to free tier on error
      }
    }

    // Admin bypass: skip rate limiting and usage limits for admins
    if (!isAdmin) {
      // Check rate limit
      const rateLimit = await checkChatRateLimit(rateLimitIdentifier, isAuthenticated);

      if (!rateLimit.allowed) {
        console.log(`[Chat API] Rate limit exceeded for ${isAuthenticated ? 'user' : 'IP'}: ${rateLimitIdentifier}`);
        return new Response(
          JSON.stringify({
            error: 'Rate limit exceeded',
            message: `You've sent a high volume of messages. Please wait ${Math.ceil(rateLimit.resetIn / 60)} minutes before continuing. This helps ensure quality service for all users.`,
            retryAfter: rateLimit.resetIn,
          }),
          {
            status: 429,
            headers: {
              'Content-Type': 'application/json',
              'Retry-After': String(rateLimit.resetIn),
              'X-RateLimit-Remaining': '0',
              'X-RateLimit-Reset': String(Math.ceil(Date.now() / 1000) + rateLimit.resetIn),
            },
          }
        );
      }

      // Check monthly token limits (warn at 80%, stop at 100%)
      const canProceed = await canMakeRequest(rateLimitIdentifier, userTier);

      if (!canProceed) {
        const usage = await getTokenUsage(rateLimitIdentifier, userTier);
        const isFreeUser = userTier === 'free';
        console.log(`[Chat API] Token limit reached for ${isAuthenticated ? 'user' : 'anon'}: ${rateLimitIdentifier} (tier: ${userTier})`);
        return new Response(
          JSON.stringify({
            error: isFreeUser ? 'Free trial ended' : 'Monthly limit reached',
            message: getTokenLimitWarningMessage(usage, isFreeUser),
            usage: { used: usage.used, limit: usage.limit, remaining: 0 },
          }),
          {
            status: 429,
            headers: {
              'Content-Type': 'application/json',
              'X-Usage-Limit': String(usage.limit),
              'X-Usage-Remaining': '0',
            },
          }
        );
      }
    } else {
      console.log(`[Chat API] Admin bypass for user: ${rateLimitIdentifier}`);
    }

    // Moderate user messages before sending to OpenAI
    const lastMessage = messages[messages.length - 1];
    if (lastMessage && lastMessage.role === 'user') {
      // Extract only text content for moderation (not image data)
      let messageContent: string;
      if (typeof lastMessage.content === 'string') {
        messageContent = lastMessage.content;
      } else if (Array.isArray(lastMessage.content)) {
        // Extract text parts only from multimodal messages
        messageContent = lastMessage.content
          .filter((part: { type: string }) => part.type === 'text')
          .map((part: { type: string; text?: string }) => part.text || '')
          .join(' ');
      } else {
        messageContent = '';
      }

      // Only moderate if there's actual text content
      if (messageContent.trim()) {
        const moderationResult = await moderateContent(messageContent);

        if (moderationResult.flagged) {
          return new Response(
            JSON.stringify({
              type: 'text',
              content: moderationResult.message || 'Your message violates our content policy. Please rephrase your request in a respectful and appropriate manner.',
              moderated: true,
            }),
            {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            }
          );
        }
      }
      // If no text content (image-only), skip text moderation
    }

    // Check if user is asking about previous conversations
    let conversationHistory = '';
    const lastUserMessage = messages[messages.length - 1];
    // Extract text content for history detection (handle both string and array formats)
    let lastUserContent = '';
    if (typeof lastUserMessage?.content === 'string') {
      lastUserContent = lastUserMessage.content;
    } else if (Array.isArray(lastUserMessage?.content)) {
      lastUserContent = lastUserMessage.content
        .filter((part: { type: string }) => part.type === 'text')
        .map((part: { type: string; text?: string }) => part.text || '')
        .join(' ');
    }

    if (lastUserContent && isAskingAboutHistory(lastUserContent)) {
      try {
        // Get authenticated Supabase client
        const cookieStore = await cookies();
        const supabase = createServerClient(
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

        // Get authenticated user
        const { data: { user } } = await supabase.auth.getUser();

        if (user) {
          // Fetch recent conversations (exclude current conversation)
          let query = supabase
            .from('conversations')
            .select('id, title, tool_context, created_at, last_message_at')
            .eq('user_id', user.id)
            .is('deleted_at', null)
            .order('last_message_at', { ascending: false })
            .limit(10);

          if (conversationId) {
            query = query.neq('id', conversationId);
          }

          const { data: conversations } = await query;

          if (conversations && conversations.length > 0) {
            // Fetch messages for each conversation
            const conversationsWithMessages = await Promise.all(
              conversations.map(async (conv) => {
                const { data: msgs } = await supabase
                  .from('messages')
                  .select('role, content, content_type, created_at')
                  .eq('conversation_id', conv.id)
                  .is('deleted_at', null)
                  .order('created_at', { ascending: true })
                  .limit(10);

                return {
                  title: conv.title,
                  date: new Date(conv.last_message_at).toLocaleDateString(),
                  messages: msgs || [],
                };
              })
            );

            // Format conversation history for AI context
            conversationHistory = '\n\n=== PREVIOUS CONVERSATIONS ===\n\n';
            conversationHistory += conversationsWithMessages
              .map((conv) => {
                const messagesSummary = conv.messages
                  .slice(0, 5) // Limit to first 5 messages per conversation
                  .map((msg) => `${msg.role}: ${msg.content.slice(0, 200)}`)
                  .join('\n');

                return `Conversation: "${conv.title}" (${conv.date})\n${messagesSummary}`;
              })
              .join('\n\n---\n\n');

            conversationHistory += '\n\n=== END OF PREVIOUS CONVERSATIONS ===\n';
          }
        }
      } catch (error) {
        console.error('Error fetching conversation history:', error);
        // Continue without history if there's an error
      }
    }

    // ========================================
    // UNIFIED FILE ROUTING (Chat + Button)
    // ========================================
    // Check if the message contains uploaded images (for analysis)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const messageHasUploadedImages = messages.some((msg: any) =>
      Array.isArray(msg.content) &&
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      msg.content.some((item: any) => item.type === 'image_url' || item.type === 'image')
    );

    // Check if the message contains file attachments (PDFs, Excel, CSV, etc.)
    // These are embedded as text with [File: ...] or [Document: ...] markers
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const messageHasFileAttachments = messages.some((msg: any) => {
      const content = typeof msg.content === 'string' ? msg.content : '';
      return content.includes('[File:') ||
             content.includes('[Document:') ||
             content.includes('[Spreadsheet:') ||
             content.includes('data:application/pdf') ||
             content.includes('data:application/vnd');
    });

    // Route to gpt-5-mini for ANY file upload (images, PDFs, Excel, etc.)
    // Mini is smarter and better suited for file analysis tasks
    const hasFileUploads = messageHasUploadedImages || messageHasFileAttachments;

    // Only route to image generation if there are NO uploaded files
    // (uploaded files = user wants analysis, not generation)
    // Files always route to gpt-5-mini for better analysis
    const routeDecision = hasFileUploads
      ? { target: 'mini' as const, reason: messageHasUploadedImages ? 'image-analysis' as const : 'file-analysis' as const, confidence: 1.0 }
      : decideRoute(lastUserContent, tool);

    // Log the routing decision for telemetry
    logRouteDecision(rateLimitIdentifier, routeDecision, lastUserContent);

    if (messageHasUploadedImages) {
      console.log('[Chat API] Detected uploaded image - routing to gpt-5-mini for analysis');
    } else if (messageHasFileAttachments) {
      console.log('[Chat API] Detected file attachment - routing to gpt-5-mini for analysis');
    }

    // ========================================
    // PROVIDER CHECK - OpenAI vs Anthropic
    // ========================================
    const providerSettings = await getProviderSettings();
    const activeProvider: Provider = providerSettings.activeProvider;
    console.log('[Chat API] Active provider:', activeProvider);

    // ========================================
    // VIDEO GENERATION (Admin only for now)
    // ========================================
    if (routeDecision.target === 'video') {
      // Admin only for testing phase
      if (!isAdmin) {
        return new Response(
          JSON.stringify({
            type: 'text',
            content: '**Video Generation Coming Soon**\n\nVideo generation with Sora is currently in testing and available to administrators only.\n\nIn the meantime, I can help you with:\n- Describing video concepts in detail\n- Writing video scripts or storyboards\n- Creating images with DALL-E\n- General questions and assistance\n\nIs there something else I can help you with?',
            model: activeProvider === 'anthropic' ? 'claude-sonnet-4.5' : 'gpt-4o',
          }),
          {
            status: 200,
            headers: {
              'Content-Type': 'application/json',
              'X-Video-Unavailable': 'admin-only',
            },
          }
        );
      }

      // Admin video generation
      console.log('[Chat API] Admin video generation request');

      // Import video functions
      const { createVideoJob, validateVideoPrompt } = await import('@/lib/openai/video');

      // Extract prompt from last message
      const lastMessage = messages[messages.length - 1];
      let prompt = typeof lastMessage.content === 'string'
        ? lastMessage.content
        : '';

      // Clean up prompt if it starts with emoji prefix
      if (prompt.startsWith('🎬 Generate video:')) {
        prompt = prompt.replace(/^🎬\s*Generate video:\s*/i, '').trim();
      }

      // Parse duration from prompt (e.g., "40 second video", "1 minute", "30s")
      const parseDuration = (text: string): number | null => {
        const lowerText = text.toLowerCase();

        // Match patterns like "40 second", "40-second", "40s", "40 sec"
        const secondsMatch = lowerText.match(/(\d+)\s*[-]?\s*(second|sec|s)\b/);
        if (secondsMatch) {
          return parseInt(secondsMatch[1], 10);
        }

        // Match patterns like "1 minute", "2 min", "1m"
        const minutesMatch = lowerText.match(/(\d+)\s*[-]?\s*(minute|min|m)\b/);
        if (minutesMatch) {
          return parseInt(minutesMatch[1], 10) * 60;
        }

        return null;
      };

      const requestedDuration = parseDuration(prompt);
      // Snap to valid durations (4, 8, 12) or multi-segment for longer
      const snapToValidSeconds = (s: number): number => {
        if (s <= 4) return 4;
        if (s <= 8) return 8;
        return 12;
      };

      // For requests > 12s, we'll use multi-segment
      const MAX_SEGMENT = 12;
      const isMultiSegment = requestedDuration && requestedDuration > MAX_SEGMENT;
      const singleVideoSeconds = requestedDuration
        ? snapToValidSeconds(Math.min(requestedDuration, MAX_SEGMENT))
        : MAX_SEGMENT; // Default to 12s if not specified

      console.log(`[Chat API] Video request: duration=${requestedDuration || 'default'}, isMultiSegment=${isMultiSegment}, seconds=${singleVideoSeconds}`);

      // Validate prompt before starting
      const validationError = validateVideoPrompt(prompt);
      if (validationError) {
        return new Response(
          JSON.stringify({
            type: 'text',
            content: `**Video Generation Error**\n\n${validationError}\n\nPlease modify your prompt and try again.`,
            model: 'sora-2-pro',
          }),
          {
            status: 200,
            headers: {
              'Content-Type': 'application/json',
              'X-Video-Error': 'content-policy',
            },
          }
        );
      }

      // Start video generation job
      const result = await createVideoJob({
        prompt,
        model: 'sora-2-pro', // Pro model with audio support
        size: '1280x720',
        seconds: singleVideoSeconds,
        audio: true,
        userId: rateLimitIdentifier,
      });

      if (!result.ok) {
        return new Response(
          JSON.stringify({
            type: 'text',
            content: `**Video Generation Failed**\n\n${result.error}\n\n${result.retryable ? 'Please try again in a moment.' : 'Please modify your prompt and try again.'}`,
            model: 'sora-2-pro',
          }),
          {
            status: result.retryable ? 503 : 400,
            headers: {
              'Content-Type': 'application/json',
              'X-Video-Error': result.code,
            },
          }
        );
      }

      // Build video job response
      const totalDuration = isMultiSegment && requestedDuration ? requestedDuration : result.job.seconds;
      const totalSegments = isMultiSegment && requestedDuration ? Math.ceil(requestedDuration / MAX_SEGMENT) : 1;
      const durationText = isMultiSegment
        ? `${totalDuration} seconds (${totalSegments} segments of ${MAX_SEGMENT}s each)`
        : `${result.job.seconds} seconds`;

      const videoJobData: Record<string, unknown> = {
        job_id: result.job.id,
        status: result.job.status,
        progress: result.job.progress,
        model: result.job.model,
        size: result.job.size,
        seconds: result.job.seconds,
        status_url: `/api/video/status?job_id=${result.job.id}`,
        download_url: `/api/video/download?job_id=${result.job.id}`,
        prompt, // Include for continuation
      };

      // Add segment info for multi-segment videos
      if (isMultiSegment && requestedDuration) {
        videoJobData.segment = {
          current: 1,
          total: totalSegments,
          total_seconds: requestedDuration,
          seconds_remaining: requestedDuration - result.job.seconds,
        };
      }

      // Return video job info - frontend will poll for status
      return new Response(
        JSON.stringify({
          type: 'video_job',
          content: `**Video Generation Started**\n\nYour video is being generated. ${isMultiSegment ? `This is a multi-segment video (${totalSegments} segments).` : 'This typically takes 1-3 minutes.'}\n\n**Prompt:** ${prompt.slice(0, 100)}${prompt.length > 100 ? '...' : ''}\n**Model:** ${result.job.model}\n**Duration:** ${durationText}\n**Resolution:** ${result.job.size}`,
          model: result.job.model,
          video_job: videoJobData,
        }),
        {
          status: 202,
          headers: {
            'Content-Type': 'application/json',
            'X-Video-Job-Id': result.job.id,
            'X-Video-Status': result.job.status,
          },
        }
      );
    }

    // If Anthropic is active and user wants image generation, return unavailable message
    // EXCEPTION: Admins can use DALL-E 3 for testing
    if (activeProvider === 'anthropic' && routeDecision.target === 'image' && !messageHasUploadedImages && !isAdmin) {
      return new Response(
        JSON.stringify({
          type: 'text',
          content: '**Image Generation Not Available**\n\nOur app\'s core focus is on delivering faith-based intelligence and general AI assistance, not multimedia generation. We do not currently have native image generation capabilities.\n\nHowever, I can help you with:\n- Describing images or visual concepts in detail\n- Writing creative descriptions or prompts\n- Answering questions and providing guidance\n- Research and information gathering\n\nIs there something else I can help you with today?',
          model: 'claude-sonnet-4.5',
        }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'X-Provider': 'anthropic',
            'X-Image-Unavailable': 'true',
          },
        }
      );
    }

    // Check if we should route to image generation (only if no uploaded images)
    if (routeDecision.target === 'image' && !messageHasUploadedImages) {
      // Check image-specific monthly limits (warn at 80%, stop at 100%)
      // Get user tier if not already fetched (for image route)
      let imgUserTier = 'free';
      if (isAuthenticated) {
        try {
          const cookieStore = await cookies();
          const supabase = createServerClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
            {
              cookies: {
                getAll() { return cookieStore.getAll(); },
                setAll(cookiesToSet) {
                  try { cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options)); } catch {}
                },
              },
            }
          );
          const { data: userData } = await supabase
            .from('users')
            .select('subscription_tier')
            .eq('id', rateLimitIdentifier)
            .single();
          imgUserTier = userData?.subscription_tier || 'free';
        } catch {}
      }
      const imageUsage = await incrementImageUsage(
        rateLimitIdentifier,
        imgUserTier
      );

      if (imageUsage.stop) {
        console.log('[Chat API] Monthly image limit reached for:', rateLimitIdentifier);
        return new Response(
          JSON.stringify({
            error: 'Monthly image limit reached',
            message: getImageLimitWarningMessage(imageUsage),
            usage: { used: imageUsage.used, limit: imageUsage.limit, remaining: 0 },
          }),
          {
            status: 429,
            headers: {
              'Content-Type': 'application/json',
              'X-Image-Limit': String(imageUsage.limit),
              'X-Image-Remaining': '0',
            },
          }
        );
      }

      // Extract prompt from last message
      const lastMessage = messages[messages.length - 1];
      let prompt = typeof lastMessage.content === 'string'
        ? lastMessage.content
        : '';

      // Clean up prompt if it starts with emoji prefix from button
      if (prompt.startsWith('🎨 Generate image:')) {
        prompt = prompt.replace(/^🎨\s*Generate image:\s*/i, '').trim();
      }

      // Parse size from user text (supports 256, 512, 1024)
      const size: ImageSize = parseSizeFromText(prompt);

      // Log image request with user, model, promptHash, size
      const promptHash = prompt.slice(0, 32).replace(/\s+/g, '_');
      console.log('[Chat API] Image generation request:', {
        user_id: rateLimitIdentifier,
        type: 'image',
        model: 'dall-e-3',
        promptHash,
        size,
        reason: routeDecision.reason,
        confidence: routeDecision.confidence,
        imageUsage: {
          used: imageUsage.used,
          limit: imageUsage.limit,
          warn: imageUsage.warn,
        },
      });

      // Use new fallback-enabled image generation
      const startTime = Date.now();
      const imageResult = await generateImageWithFallback(prompt, size, rateLimitIdentifier);
      const latencyMs = Date.now() - startTime;

      // Log completion
      console.log('[Chat API] Image generation complete:', {
        user_id: rateLimitIdentifier,
        type: 'image',
        model: 'dall-e-3',
        promptHash,
        size,
        ok: imageResult.ok,
        latency_ms: latencyMs,
      });

      if (imageResult.ok) {
        // Include usage warning if at 80%
        const usageWarning = getImageLimitWarningMessage(imageUsage);

        return new Response(
          JSON.stringify({
            type: 'image',
            url: imageResult.image,
            prompt,
            model: imageResult.model,
            size: imageResult.size,
            routeReason: routeDecision.reason,
            ...(usageWarning && { usageWarning }),
            usage: {
              used: imageUsage.used,
              limit: imageUsage.limit,
              remaining: imageUsage.remaining,
            },
          }),
          {
            status: 200,
            headers: {
              'Content-Type': 'application/json',
              'X-Route-Target': 'image',
              'X-Route-Reason': routeDecision.reason,
              'X-Model-Used': imageResult.model || 'dall-e-3',
              'X-Image-Remaining': String(imageUsage.remaining),
            },
          }
        );
      } else {
        // Return text fallback instead of error
        return new Response(
          JSON.stringify({
            type: 'image_fallback',
            content: imageResult.fallbackText,
            retryHint: imageResult.retryHint,
            suggestedPrompts: imageResult.suggestedPrompts,
            error: imageResult.error,
            routeReason: routeDecision.reason,
          }),
          {
            status: 200, // 200 because we're providing useful fallback content
            headers: {
              'Content-Type': 'application/json',
              'X-Route-Target': 'image',
              'X-Route-Reason': routeDecision.reason,
            },
          }
        );
      }
    }

    // Add user context and conversation history as system messages if provided
    let messagesWithContext = messages;

    // Add conversation history context if available
    if (conversationHistory) {
      const historySystemMessage = {
        role: 'system' as const,
        content: `The user has asked about their previous conversations. Here is their conversation history (only accessible when specifically requested):${conversationHistory}\n\nUse this history to answer their question accurately. If they ask about something not in this history, let them know you can only see the conversations listed above.`,
      };
      messagesWithContext = [historySystemMessage, ...messagesWithContext];
    }

    // Add user context if provided
    if (userContext) {
      const userContextMessage = {
        role: 'system' as const,
        content: `You are assisting ${userContext.name}, a ${userContext.role}${userContext.field ? ` in ${userContext.field}` : ''}. ${userContext.purpose ? `They use this AI for: ${userContext.purpose}. ` : ''}Tailor your responses to their background, adjusting complexity, terminology, and examples accordingly.`,
      };
      messagesWithContext = [userContextMessage, ...messagesWithContext];
    }

    // Add Slingshot 2.0 system prompt for authenticated users
    // This includes routing logic and behavior guidelines
    const effectiveTool = tool;

    if (isAuthenticated) {
      const slingshotPrompt = buildFullSystemPrompt({
        includeImageCapability: true,
      });

      const slingshotSystemMessage = {
        role: 'system' as const,
        content: slingshotPrompt,
      };
      messagesWithContext = [slingshotSystemMessage, ...messagesWithContext];
    }

    // ========================================
    // APPLY CONTEXT LIMITS (Cost Optimization)
    // ========================================
    // Truncate messages to fit within context window (prevents API errors & saves money)
    const originalMessageCount = messagesWithContext.length;
    messagesWithContext = truncateMessages(messagesWithContext);
    if (messagesWithContext.length < originalMessageCount) {
      console.log(`[Chat API] Truncated messages: ${originalMessageCount} -> ${messagesWithContext.length}`);
    }

    // Clamp max_tokens to prevent excessive response costs
    const clampedMaxTokens = clampMaxTokens(max_tokens);
    if (max_tokens && max_tokens !== clampedMaxTokens) {
      console.log(`[Chat API] Clamped max_tokens: ${max_tokens} -> ${clampedMaxTokens}`);
    }

    // Check if any message contains images (need non-streaming for image analysis)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const hasImages = messagesWithContext.some((msg: any) =>
      Array.isArray(msg.content) &&
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      msg.content.some((item: any) => item.type === 'image_url' || item.type === 'image')
    );

    // Log messages for debugging
    console.log('[Chat API] Processing request:', {
      messageCount: messagesWithContext.length,
      hasImages,
      streaming: !hasImages,
      effectiveTool,
    });

    // Get the initial model (may be overridden by web search routing)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const initialModel = getModelForTool(effectiveTool as any);

    // Check if web search will be triggered - this always uses gpt-5-mini
    const lastUserText = getLastUserMessageText(messagesWithContext);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const willUseWebSearch = shouldUseWebSearch(effectiveTool as any, lastUserText);

    // Determine actual model: web search, images, and file attachments all use mini
    // Mini is the smarter model, better suited for complex analysis tasks
    const actualModel = willUseWebSearch || hasImages || messageHasFileAttachments
      ? 'gpt-5-mini'
      : initialModel;

    // ========================================
    // ANTHROPIC PATH - Claude (tier-specific model)
    // ========================================
    if (activeProvider === 'anthropic') {
      // Get tier-specific model (uses provider settings with tier lookup)
      const anthropicModel = await getModelForTier(userTier);
      console.log('[Chat API] Using Anthropic provider with model:', anthropicModel, 'for tier:', userTier);

      // Use unified system prompt for all providers (same as OpenAI)
      const systemPrompt = isAuthenticated
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ? getSystemPromptForTool(effectiveTool as any)
        : 'You are a helpful AI assistant.';

      // Check if document generation is requested (Excel, PowerPoint, Word, PDF)
      const documentType = detectDocumentRequest(lastUserContent);
      if (documentType && isAuthenticated) {
        console.log(`[Chat API] Document generation detected: ${documentType}`);

        try {
          // Build enhanced system prompt with professional document formatting instructions
          const documentFormattingInstructions = getDocumentFormattingPrompt(documentType);
          const enhancedSystemPrompt = `${systemPrompt}\n\n${documentFormattingInstructions}`;

          // Use Skills API for document generation
          const result = await createAnthropicCompletionWithSkills({
            messages: messagesWithContext,
            model: anthropicModel,
            maxTokens: clampedMaxTokens,
            temperature,
            systemPrompt: enhancedSystemPrompt,
            userId: rateLimitIdentifier,
            planKey: userTier,
            skills: [documentType],
          });

          // Build response with file information
          const responseData: {
            type: string;
            content: string;
            model: string;
            files?: Array<{
              file_id: string;
              filename: string;
              mime_type: string;
              download_url: string;
            }>;
          } = {
            type: 'text',
            content: result.text,
            model: result.model,
          };

          // Add file download URLs if files were generated
          if (result.files && result.files.length > 0) {
            responseData.files = result.files.map(file => ({
              file_id: file.file_id,
              filename: file.filename,
              mime_type: file.mime_type,
              download_url: `/api/files/anthropic/${file.file_id}`,
            }));
            console.log(`[Chat API] Generated ${result.files.length} document(s)`);
          }

          return new Response(JSON.stringify(responseData), {
            status: 200,
            headers: {
              'Content-Type': 'application/json',
              'X-Model-Used': result.model,
              'X-Provider': 'anthropic',
              'X-Document-Type': documentType,
            },
          });
        } catch (skillError) {
          console.error('[Chat API] Skills API error, falling back to regular completion:', skillError);
          // Fall through to regular completion if Skills fails
        }
      }

      // Non-streaming for image analysis
      if (hasImages) {
        console.log('[Chat API] Anthropic: Non-streaming mode for image analysis');
        const result = await createAnthropicCompletion({
          messages: messagesWithContext,
          model: anthropicModel,
          maxTokens: clampedMaxTokens,
          temperature,
          systemPrompt,
          userId: isAuthenticated ? rateLimitIdentifier : undefined,
          planKey: userTier,
        });

        return new Response(
          JSON.stringify({
            type: 'text',
            content: result.text,
            model: result.model,
          }),
          {
            status: 200,
            headers: {
              'Content-Type': 'application/json',
              'X-Model-Used': result.model,
              'X-Provider': 'anthropic',
              'X-Has-Images': 'true',
            },
          }
        );
      }

      // Check if web search is needed - use Perplexity for search, Claude for formatting
      if (willUseWebSearch) {
        console.log('[Chat API] Using Perplexity search + Claude formatting');
        const result = await createAnthropicCompletionWithSearch({
          messages: messagesWithContext,
          model: anthropicModel,
          maxTokens: clampedMaxTokens,
          temperature,
          systemPrompt,
          userId: isAuthenticated ? rateLimitIdentifier : undefined,
          planKey: userTier,
        });

        return new Response(
          JSON.stringify({
            type: 'text',
            content: result.text,
            model: result.model,
            citations: result.citations, // Pass full citation objects with title and url
            sourcesUsed: result.numSourcesUsed,
          }),
          {
            status: 200,
            headers: {
              'Content-Type': 'application/json',
              'X-Model-Used': result.model,
              'X-Provider': 'anthropic',
              'X-Web-Search': 'perplexity',
            },
          }
        );
      }

      // Streaming text chat with Anthropic
      console.log('[Chat API] Anthropic: Streaming mode');
      const streamResult = await createAnthropicStreamingCompletion({
        messages: messagesWithContext,
        model: anthropicModel,
        maxTokens: clampedMaxTokens,
        temperature,
        systemPrompt,
        userId: isAuthenticated ? rateLimitIdentifier : undefined,
        planKey: userTier,
      });

      return streamResult.toTextStreamResponse({
        headers: {
          'X-Model-Used': streamResult.model,
          'X-Provider': 'anthropic',
        },
      });
    }

    // ========================================
    // OPENAI PATH - GPT (tier-specific model)
    // ========================================
    // Get tier-specific model from provider settings
    const openaiModel = await getModelForTier(userTier);
    console.log('[Chat API] Using OpenAI provider with model:', openaiModel, 'for tier:', userTier);

    // Check if document generation is requested (Excel, PowerPoint, Word, PDF)
    // For OpenAI, we generate PDF versions of documents (Excel/PPT/Word not supported)
    const openaiDocumentType = detectDocumentRequest(lastUserContent);
    if (openaiDocumentType && isAuthenticated) {
      console.log(`[Chat API] OpenAI: Document request detected: ${openaiDocumentType}`);

      // For Excel/PPT/Word requests, instruct AI to create content for PDF
      // OpenAI doesn't have native document generation, so we output formatted content
      // that the frontend will convert to PDF using [GENERATE_PDF:] marker
      const docTypeNames: Record<string, string> = {
        xlsx: 'spreadsheet',
        pptx: 'presentation',
        docx: 'document',
        pdf: 'PDF',
      };
      const docName = docTypeNames[openaiDocumentType] || 'document';

      // Add special instruction for OpenAI to format content for PDF generation
      const pdfFormatInstruction = openaiDocumentType !== 'pdf' ? `
IMPORTANT: Since you cannot create native ${docName} files, format your response for PDF output instead:
1. Start with a brief acknowledgment like "I'll create that as a PDF document for you."
2. Then emit the [GENERATE_PDF: Title] marker followed by the formatted content.
3. For spreadsheet/budget requests: Use markdown tables with clear headers and totals.
4. For presentation requests: Create an outline with clear sections.
5. Example format:
Creating your ${docName} as a PDF now.

[GENERATE_PDF: Your Title Here]

## Section 1
Content here...

| Column 1 | Column 2 | Column 3 |
|----------|----------|----------|
| Data     | Data     | Data     |

Remember: Use the [GENERATE_PDF:] marker so the document can be downloaded.
` : '';

      // Prepend the PDF formatting instruction as a system message
      const docMessages = pdfFormatInstruction
        ? [{ role: 'system', content: pdfFormatInstruction }, ...messagesWithContext]
        : messagesWithContext;

      // Use non-streaming for document generation
      const docResult = await createChatCompletion({
        messages: docMessages,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        tool: effectiveTool as any,
        temperature,
        maxTokens: clampedMaxTokens,
        stream: false,
        userId: rateLimitIdentifier,
        conversationId: conversationId,
        modelOverride: openaiModel,
        planKey: userTier,
      });

      return new Response(
        JSON.stringify({
          type: 'text',
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          content: (docResult as any).text || '',
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          model: (docResult as any).model || openaiModel,
        }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            'X-Model-Used': (docResult as any).model || openaiModel,
            'X-Document-Type': openaiDocumentType,
            'X-Provider': 'openai',
          },
        }
      );
    }

    // Use non-streaming for image analysis (images need special handling)
    if (hasImages) {
      console.log('[Chat API] Using non-streaming mode for image analysis');
      console.log('[Chat API] Messages being sent:', JSON.stringify(messagesWithContext.slice(-2).map(m => ({
        role: m.role,
        hasArrayContent: Array.isArray(m.content),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        contentTypes: Array.isArray(m.content) ? m.content.map((c: any) => c.type) : 'string',
      }))));
      const result = await createChatCompletion({
        messages: messagesWithContext,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        tool: effectiveTool as any,
        temperature,
        maxTokens: clampedMaxTokens,
        stream: false,
        userId: isAuthenticated ? rateLimitIdentifier : undefined,
        conversationId: conversationId,
        modelOverride: openaiModel,
        planKey: userTier,
      });

      // Extract citations and actual model used from result
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const citations = (result as any).citations || [];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const numSourcesUsed = (result as any).numSourcesUsed || 0;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const resultModel = (result as any).model || actualModel;

      console.log('[Chat API] Image analysis complete, model used:', resultModel);

      return new Response(
        JSON.stringify({
          type: 'text',
          content: result.text,
          model: resultModel,
          citations: citations,
          sourcesUsed: numSourcesUsed,
        }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'X-Model-Used': resultModel,
            'X-Tool-Type': effectiveTool || 'default',
            'X-Has-Images': 'true',
          },
        }
      );
    }

    // Use streaming for regular text chat
    console.log('[Chat API] Using streaming mode with model:', actualModel, 'webSearch:', willUseWebSearch);

    // Create a pending request BEFORE calling AI
    // This allows background workers to complete the request if the user leaves
    let pendingRequestId: string | null = null;
    if (isAuthenticated && conversationId) {
      pendingRequestId = await createPendingRequest({
        userId: rateLimitIdentifier,
        conversationId,
        messages: messagesWithContext,
        tool: effectiveTool,
        model: actualModel,
      });
      if (pendingRequestId) {
        console.log('[Chat API] Created pending request:', pendingRequestId);
      }
    }

    try {
      console.log('[Chat API] Calling createChatCompletion with stream: true, model:', openaiModel);
      const result = await createChatCompletion({
        messages: messagesWithContext,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        tool: effectiveTool as any,
        temperature,
        maxTokens: clampedMaxTokens,
        stream: true,
        userId: isAuthenticated ? rateLimitIdentifier : undefined,
        conversationId: conversationId,
        pendingRequestId: pendingRequestId || undefined,
        modelOverride: openaiModel,
        planKey: userTier,
      });

      console.log('[Chat API] streamText returned, result type:', typeof result);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      console.log('[Chat API] result has toTextStreamResponse:', typeof (result as any).toTextStreamResponse);

      // Check if result is a streaming object (has toTextStreamResponse method)
      // Web search and some other operations return non-streaming results
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (typeof (result as any).toTextStreamResponse === 'function') {
        // Return streaming response using simple text stream
        // AI SDK v5 uses toTextStreamResponse instead of toDataStreamResponse
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const streamResponse = (result as any).toTextStreamResponse({
          headers: {
            'X-Model-Used': actualModel,
            'X-Tool-Type': effectiveTool || 'default',
          },
        });

        console.log('[Chat API] Successfully created stream response with model:', actualModel);
        return streamResponse;
      } else {
        // Non-streaming result (from web search, etc.)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const resultModel = (result as any).model || actualModel;
        console.log('[Chat API] Non-streaming result detected, model used:', resultModel);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const rawCitations = (result as any).citations || [];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const numSourcesUsed = (result as any).numSourcesUsed || 0;

        // Normalize citations to always have title and url
        const citations = rawCitations.map((c: { title?: string; url?: string } | string) => {
          if (typeof c === 'string') {
            // Extract domain from URL for title
            let title = 'Source';
            try { title = new URL(c).hostname.replace('www.', ''); } catch {}
            return { title, url: c };
          }
          return {
            title: c.title || (c.url ? new URL(c.url).hostname.replace('www.', '') : 'Source'),
            url: c.url || '',
          };
        }).filter((c: { url: string }) => c.url);

        // Complete the pending request - we got a successful result
        if (pendingRequestId) {
          completePendingRequest(pendingRequestId).catch(err => {
            console.error('[Chat API] Failed to complete pending request:', err);
          });
        }

        return new Response(
          JSON.stringify({
            type: 'text',
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            content: (result as any).text || '',
            model: resultModel,
            citations: citations, // Pass full citation objects with title and url
            sourcesUsed: numSourcesUsed,
          }),
          {
            status: 200,
            headers: {
              'Content-Type': 'application/json',
              'X-Model-Used': resultModel,
              'X-Tool-Type': effectiveTool || 'default',
            },
          }
        );
      }
    } catch (streamError) {
      // If streaming fails, fall back to non-streaming
      // Log detailed error info to diagnose streaming issues
      console.error('[Chat API] Streaming failed, falling back to non-streaming');
      if (streamError instanceof Error) {
        console.error('[Chat API] Error name:', streamError.name);
        console.error('[Chat API] Error message:', streamError.message);
        console.error('[Chat API] Error stack:', streamError.stack);
        // Check for API-specific error details
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const anyError = streamError as any;
        if (anyError.cause) console.error('[Chat API] Error cause:', anyError.cause);
        if (anyError.status) console.error('[Chat API] Error status:', anyError.status);
        if (anyError.statusCode) console.error('[Chat API] Error statusCode:', anyError.statusCode);
        if (anyError.response) console.error('[Chat API] Error response:', anyError.response);
      } else {
        console.error('[Chat API] Non-Error thrown:', streamError);
      }

      const result = await createChatCompletion({
        messages: messagesWithContext,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        tool: effectiveTool as any,
        temperature,
        maxTokens: clampedMaxTokens,
        stream: false,
        userId: isAuthenticated ? rateLimitIdentifier : undefined,
        conversationId: conversationId,
        planKey: userTier,
      });

      // Extract citations and actual model used from result
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const fallbackRawCitations = (result as any).citations || [];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const numSourcesUsed = (result as any).numSourcesUsed || 0;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const fallbackModel = (result as any).model || actualModel;

      // Normalize citations to always have title and url
      const fallbackCitations = fallbackRawCitations.map((c: { title?: string; url?: string } | string) => {
        if (typeof c === 'string') {
          let title = 'Source';
          try { title = new URL(c).hostname.replace('www.', ''); } catch {}
          return { title, url: c };
        }
        return {
          title: c.title || (c.url ? new URL(c.url).hostname.replace('www.', '') : 'Source'),
          url: c.url || '',
        };
      }).filter((c: { url: string }) => c.url);

      return new Response(
        JSON.stringify({
          type: 'text',
          content: result.text,
          model: fallbackModel,
          citations: fallbackCitations, // Pass full citation objects with title and url
          sourcesUsed: numSourcesUsed,
        }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'X-Model-Used': fallbackModel,
            'X-Tool-Type': effectiveTool || 'default',
          },
        }
      );
    }
  } catch (error) {
    // Check if this is an abort error (user navigated away)
    const isAbortError = error instanceof Error && (
      error.name === 'AbortError' ||
      error.message.toLowerCase().includes('aborted') ||
      error.message.toLowerCase().includes('socket hang up') ||
      error.message.toLowerCase().includes('client disconnected') ||
      error.message.toLowerCase().includes('connection closed')
    );

    if (isAbortError) {
      // User navigated away - this is not an error condition
      // The onFinish callback will still save the message if OpenAI completed
      console.log('[Chat API] Client disconnected (user navigated away) - response may still be saved via onFinish');
      return new Response(null, { status: 499 }); // 499 = Client Closed Request
    }

    console.error('Chat API error:', error);

    // Log detailed error info
    if (error instanceof Error) {
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
      // Log the full error object for debugging
      console.error('Full error object:', JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
    }

    // Return user-friendly error (keep technical details in server logs only)
    return new Response(
      JSON.stringify({
        error: 'Service temporarily unavailable',
        message: 'Due to high traffic, please try again in a few seconds.',
      }),
      {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } finally {
    // Always release the queue slot when request completes
    if (slotAcquired) {
      releaseSlot(requestId).catch(err => {
        console.error('[Chat API] Error releasing queue slot:', err);
      });
    }
  }
}

// Use Node.js runtime for better streaming support and logging
// Edge runtime can have issues with streaming responses
export const runtime = 'nodejs';
export const maxDuration = 120; // Allow up to 120 seconds for AI responses (Pro plan supports up to 300s)
