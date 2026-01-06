/**
 * CHAT API ROUTE - Claude Exclusive Edition
 *
 * PURPOSE:
 * - Handle chat message requests with streaming responses
 * - Text generation via Claude (Haiku 4.5 / Sonnet 4.5 hybrid routing)
 * - Research via Perplexity + Claude Sonnet synthesis
 *
 * MODEL ROUTING (Claude Hybrid):
 * - Claude Haiku 4.5: Basic chat, greetings, simple Q&A (cost-optimized)
 * - Claude Sonnet 4.5: Research, faith topics, complex reasoning, documents
 * - Perplexity: Web search (with Claude post-processing)
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
 * - ANTHROPIC_API_KEY_1 (required for text)
 * - NEXT_PUBLIC_SUPABASE_URL (optional, for auth)
 *
 * FEATURES:
 * - ✅ Streaming responses with SSE
 * - ✅ Claude Haiku/Sonnet hybrid routing (auto-select by complexity)
 * - ✅ Research agent with Claude Sonnet synthesis
 * - ✅ Faith-grounded responses (Biblical principles)
 * - ✅ Tool-specific system prompts
 * - ✅ Temperature and token optimization per tool
 * - ✅ Retry logic with exponential backoff
 * - ✅ Admin bypass for rate/usage limits
 *
 * TODO:
 * - [ ] Add authentication
 * - [✓] Implement rate limiting (60/hr auth, 20/hr anon)
 * - [ ] Store messages in database
 * - [✓] Add content moderation
 * - [✓] Implement usage tracking (daily limits with 80% warning)
 */

// =============================================================================
// CLAUDE EXCLUSIVE IMPORTS
// Using: Claude (text) + Perplexity (research)
// =============================================================================
import { buildSlimSystemPrompt, isFaithTopic, getRelevantCategories } from '@/lib/prompts/slimPrompt';
import { getKnowledgeBaseContent } from '@/lib/knowledge/knowledgeBase';
import { searchUserDocuments } from '@/lib/documents/userSearch';
import { getSystemPromptForTool } from '@/lib/openai/tools';
import { canMakeRequest, getTokenUsage, getTokenLimitWarningMessage } from '@/lib/limits';
import { decideRoute, logRouteDecision, hasWebsiteIntent, hasCodeExecutionIntent, isWebsiteDiscoveryResponse, RouteTarget } from '@/lib/routing/decideRoute';
import { executeCode, extractCodeBlocks, shouldTestCode } from '@/lib/agents/codeExecutor';
import { isSandboxConfigured } from '@/lib/connectors/vercel-sandbox';
import { getProviderSettings, Provider, getModelForTier, getGeminiImageModel } from '@/lib/provider/settings';
import { perplexitySearch, isPerplexityConfigured } from '@/lib/perplexity/client';
// Claude hybrid routing for text generation (Haiku for simple, Sonnet for complex)
import {
  createClaudeStreamingChat,
  createClaudeChat,
  detectDocumentRequest,
  createClaudeStructuredOutput,
} from '@/lib/anthropic/client';
import { acquireSlot, releaseSlot, generateRequestId } from '@/lib/queue';
// Brave Search no longer needed - using native Anthropic web search
// import { braveSearch } from '@/lib/brave/search';
import { NextRequest } from 'next/server';
import { CoreMessage } from 'ai';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import crypto from 'crypto';
import { analyzeRequest, isTaskPlanningEnabled } from '@/lib/taskPlanner';
import { executeTaskPlan, isSequentialExecutionEnabled, CheckpointState } from '@/lib/taskPlanner/executor';
import { getLearnedContext, extractAndLearn, isLearningEnabled } from '@/lib/learning/userLearning';
import { orchestrateAgents, shouldUseOrchestration, isOrchestrationEnabled } from '@/lib/agents/orchestrator';
import { shouldUseResearchAgent, executeResearchAgent, isResearchAgentEnabled } from '@/agents/research';
// Code Agent removed from main chat - now isolated to Code Lab only
// import { shouldUseCodeAgent, executeCodeAgent, isCodeAgentEnabled, isCodeReviewRequest, generateNoRepoSelectedResponse } from '@/agents/code';
import { isConnectorsEnabled } from '@/lib/connectors';
// FORGE & MUSASHI: Pure AI mode - only using category detection for context, not templates
import { detectCategory, extractBusinessInfo } from '@/lib/templates/templateService';
// NOTE: Auth templates temporarily disabled while streaming is implemented
// TODO: Re-enable when multi-page streaming is added
// import { generateLoginPage, generateSignupPage, generateAuthCallbackPage, generateDashboardPage, generateMagicLinkPage, generateForgotPasswordPage, hasMagicLinkIntent, AuthConfig } from '@/lib/templates/authTemplates';
import {
  githubFunctionDeclarations,
  executeGitHubTool,
} from '@/lib/gemini/githubTools';
// FORGE & MUSASHI: Website Pipeline - comprehensive website generation with all assets
import {
  generateCompleteWebsite,
  getActiveWebsiteSession,
  applySmartModification,
  pushWebsiteToGitHub,
  deployWebsiteToVercel,
  isGitHubPushRequest,
  isVercelDeployRequest,
  GenerationContext,
  WebsiteSession,
} from '@/lib/website/websitePipeline';
import { hasWebsiteModificationIntent } from '@/lib/routing/decideRoute';

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
const MAX_SYSTEM_PROMPT_CHARS = 20000; // ~5K tokens max for system prompt

/**
 * Truncate system prompt to prevent context overflow
 */
function truncateSystemPrompt(prompt: string, maxChars: number = MAX_SYSTEM_PROMPT_CHARS): string {
  if (prompt.length <= maxChars) return prompt;
  console.log(`[Chat API] System prompt too long (${prompt.length} chars), truncating to ${maxChars}`);
  const truncated = prompt.substring(0, maxChars);
  const lastSection = truncated.lastIndexOf('\n\n---\n\n');
  if (lastSection > maxChars * 0.7) {
    return truncated.substring(0, lastSection) + '\n\n[Additional context truncated]';
  }
  return truncated + '\n\n[Context truncated]';
}

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

// ========================================
// GitHub Token Helpers (for Code Review)
// ========================================

/**
 * Get encryption key for token decryption
 */
function getEncryptionKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  return crypto.createHash('sha256').update(key).digest();
}

/**
 * Decrypt GitHub token stored in database
 */
function decryptToken(encryptedData: string): string | null {
  try {
    const parts = encryptedData.split(':');
    if (parts.length !== 3) return null;

    const iv = Buffer.from(parts[0], 'hex');
    const authTag = Buffer.from(parts[1], 'hex');
    const encrypted = parts[2];

    const key = getEncryptionKey();
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  } catch {
    return null;
  }
}

/**
 * Get user's GitHub token for code review tasks
 */
async function getGitHubTokenForUser(userId: string): Promise<string | null> {
  if (!isConnectorsEnabled()) return null;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) return null;

  try {
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);
    const { data: connector } = await adminClient
      .from('connectors')
      .select('encrypted_token')
      .eq('user_id', userId)
      .eq('type', 'github')
      .single();

    if (!connector?.encrypted_token) return null;

    return decryptToken(connector.encrypted_token);
  } catch {
    return null;
  }
}

/**
 * Prepend text to a ReadableStream
 * Used for task planning to show the plan before the AI response
 */
function prependToStream(prefixText: string, stream: ReadableStream<Uint8Array>): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const prefixBytes = encoder.encode(prefixText);

  return new ReadableStream({
    async start(controller) {
      // First, send the prefix
      controller.enqueue(prefixBytes);

      // Then, pipe the original stream
      const reader = stream.getReader();
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          controller.enqueue(value);
        }
        controller.close();
      } catch (error) {
        controller.error(error);
      } finally {
        reader.releaseLock();
      }
    }
  });
}

/**
 * Professional document formatting instructions for Skills API
 * Ensures high-quality, well-formatted output documents
 */
function getDocumentFormattingPrompt(docType: 'xlsx' | 'pptx' | 'docx' | 'pdf'): string {
  const basePrompt = `
## CRITICAL DOCUMENT FORMATTING REQUIREMENTS

You are creating a PROFESSIONAL document. Quality and formatting are paramount.

**CRITICAL: OUTPUT ONLY THE DOCUMENT CONTENT**
- Do NOT add any explanatory text, commentary, or notes about the document
- Do NOT explain what you created or describe the formatting
- Do NOT add tips, suggestions, or "this resume demonstrates..." type text
- The output should ONLY be the document content that will be rendered
- End your response immediately after the last line of the document

### General Rules:
- Use proper margins (1 inch / 2.5cm on all sides)
- Use professional fonts: Arial, Helvetica, or Calibri
- Ensure consistent spacing throughout
- Use proper heading hierarchy
- Include page numbers for multi-page documents

`;

  const typeSpecific: Record<string, string> = {
    pdf: `### PDF Resume - USE THIS EXACT MARKDOWN FORMAT:

# FULL NAME HERE

(555) 123-4567 | email@example.com | linkedin.com/in/username

## PROFESSIONAL SUMMARY

Write 2-3 sentences summarizing qualifications. Keep this as a single paragraph, left-aligned.

## PROFESSIONAL EXPERIENCE

### Job Title Here
**Company Name**, City, ST                                    Month Year - Present

- Achievement with quantified results (increased X by Y%)
- Another accomplishment using action verbs
- Third bullet point with measurable impact

### Previous Job Title
**Previous Company**, City, ST                                Month Year - Month Year

- Achievement bullet point
- Another accomplishment

## EDUCATION

### Degree Name (e.g., Bachelor of Science in Business)
**University Name**, City, ST                                 Year

Honors or GPA if notable

## SKILLS

**Technical:** Skill 1, Skill 2, Skill 3, Skill 4
**Leadership:** Skill 5, Skill 6, Skill 7

## CERTIFICATIONS

- Certification Name - Issuing Organization (Year)
- Another Certification (Year)

---

**CRITICAL FORMATTING RULES:**
1. # = Name (ONLY this is centered)
2. Contact line = plain text (centered, right below name)
3. ## = Section headers (PROFESSIONAL EXPERIENCE, EDUCATION, etc.) - LEFT aligned
4. ### = Job titles and degree names - LEFT aligned, bold
5. **Bold** = Company names and universities
6. - = Bullet points for achievements - LEFT aligned
7. Everything after the contact line must be LEFT ALIGNED
8. NO commentary or explanation - ONLY the resume content
`,
    docx: `### Word Document Requirements:

**FOR RESUMES - USE EXACT SAME FORMAT AS PDF:**
- Name centered at top (large, bold)
- Contact info centered below name
- Section headers LEFT aligned (PROFESSIONAL EXPERIENCE, EDUCATION, SKILLS)
- Job titles LEFT aligned, bold
- Company names bold, with location and dates on same line
- All bullets LEFT aligned
- Skills LEFT aligned
- NO CENTERING except name and contact info

**FOR LETTERS:**
- Sender address top right
- Date below sender
- Recipient address left
- Salutation, body paragraphs, closing
- Signature line

**FOR REPORTS:**
- Title page with centered title
- All body content LEFT aligned
- Use heading hierarchy (Heading 1, 2, 3)

**GENERAL:**
- 11-12pt body text
- 1.15 line spacing
- NO commentary - only document content
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

function isSpreadsheetConfirmation(content: string, previousMessages: CoreMessage[]): boolean {
  const lowerContent = content.toLowerCase().trim();

  // Check if there's explicit spreadsheet generation request
  const hasExplicitGenerate = /\b(generate|create|make|download)\s*(the|my|a)?\s*(spreadsheet|excel|file|xlsx)\b/.test(lowerContent);

  if (hasExplicitGenerate) {
    return true;
  }

  // Get recent assistant messages for context
  const recentAssistantMessages = previousMessages
    .slice(-4)
    .filter((m: CoreMessage) => m.role === 'assistant')
    .map((m: CoreMessage) => typeof m.content === 'string' ? m.content : '')
    .join(' ')
    .toLowerCase();

  // Check if we're in a spreadsheet qualification context (AI asked questions about spreadsheet)
  const isInSpreadsheetQualificationContext =
    /\b(what.*categories|what.*track|time period|weekly.*monthly|monthly.*yearly|budget.*actual|specific.*calculations?)\b/i.test(recentAssistantMessages) &&
    /\b(spreadsheet|excel|budget|finance|tracker)\b/i.test(recentAssistantMessages);

  // FORGE & MUSASHI: If user provides financial DATA after qualification questions,
  // that's an implicit confirmation to generate the spreadsheet
  if (isInSpreadsheetQualificationContext) {
    // Check if user is providing financial categories/data
    const financialCategories = content.match(/\b(income|salary|earnings|rent|mortgage|groceries|insurance|utilities|savings|expenses?|car|school|tuition|entertainment|subscriptions?|bills?|loan|credit|gas|electric|water|phone|internet|food|dining|clothing|medical|health|childcare|kids?|fun|discretionary)\b/gi);

    // If user mentions 2+ financial categories, they're providing data = implicit confirmation
    if (financialCategories && financialCategories.length >= 2) {
      console.log('[isSpreadsheetConfirmation] User provided financial categories after qualification:', financialCategories);
      return true;
    }

    // If user provides dollar amounts, that's also data
    if (/\$\d+/.test(content)) {
      console.log('[isSpreadsheetConfirmation] User provided dollar amounts after qualification');
      return true;
    }

    // If user provides percentage or "per hour/month" etc
    if (/\b\d+\s*(%|percent|per\s*(hour|month|week|year))\b/i.test(content)) {
      console.log('[isSpreadsheetConfirmation] User provided rate/percentage after qualification');
      return true;
    }
  }

  // FIXED: Confirmation patterns must be more specific - "ok" alone is NOT enough
  // User must explicitly confirm spreadsheet generation with context-aware phrases
  const isStrongConfirmation = /\b(yes\s*(please|,?\s*(generate|create|make)\s*(it|the\s*spreadsheet)?)?|generate\s*(it|the\s*spreadsheet)|create\s*(it|the\s*spreadsheet)|make\s*(it|the\s*spreadsheet)|go\s*ahead\s*(and\s*(generate|create|make))?|that'?s?\s*perfect,?\s*(generate|create)|looks?\s*good,?\s*(generate|create))\b/.test(lowerContent);

  // Weak confirmations like "ok" require explicit spreadsheet mention in the SAME message
  const isWeakConfirmation = /^(ok|okay|sure|yes|yep|yeah)\.?$/i.test(lowerContent);
  const mentionsSpreadsheet = /spreadsheet|excel|xlsx/i.test(lowerContent);

  if (!isStrongConfirmation && !(isWeakConfirmation && mentionsSpreadsheet)) {
    return false;
  }

  // Additional context check: Previous assistant message must be SPECIFICALLY about generating a spreadsheet
  const lastAssistantMessage = [...previousMessages].reverse().find(m => m.role === 'assistant');
  if (lastAssistantMessage && typeof lastAssistantMessage.content === 'string') {
    const assistantContent = lastAssistantMessage.content.toLowerCase();
    // Must be asking to GENERATE/CREATE the spreadsheet, not just mentioning it
    const wasAskingToGenerate = /\b(generate|create|ready to (generate|create)|shall i (generate|create)|would you like me to (generate|create)|i('ll| will) (generate|create))\b.*\b(spreadsheet|excel)\b/i.test(assistantContent) ||
                                /\b(spreadsheet|excel)\b.*\b(generate|create|ready|shall i|would you like)\b/i.test(assistantContent);

    if (wasAskingToGenerate && isStrongConfirmation) {
      return true;
    }
  }

  return false;
}

/**
 * Check if this is an initial spreadsheet request (should ask questions first)
 * vs a request that should immediately generate
 */
function isInitialSpreadsheetRequest(content: string): boolean {
  const lowerContent = content.toLowerCase();

  // Check if it's a spreadsheet request
  const isSpreadsheetRequest = /\b(excel|spreadsheet|xlsx)\b/.test(lowerContent) ||
    (/\b(budget|financial\s*(model|plan|tracker))\b/.test(lowerContent) &&
     /\b(excel|spreadsheet|xlsx|file)\b/.test(lowerContent));

  if (!isSpreadsheetRequest) {
    return false;
  }

  const actionVerbs = /\b(create|make|generate|build|download|give\s*me|need|want|write|draft)\b/;
  if (!actionVerbs.test(lowerContent)) {
    return false;
  }

  // Check if user is providing detailed specifications (don't ask more questions)
  // If message is long with specifics, they probably know what they want
  const hasDetailedSpecs = lowerContent.length > 200 ||
    /\b(columns?|rows?|sheets?|categories|items|formula|calculate)\b.*\b(columns?|rows?|sheets?|categories|items)\b/.test(lowerContent);

  return !hasDetailedSpecs;
}

function detectNativeDocumentRequest(content: string, previousMessages?: CoreMessage[]): 'resume' | 'spreadsheet' | 'document' | 'invoice' | 'qrcode' | null {
  const lowerContent = content.toLowerCase();

  // Common action verbs for document creation
  const actionVerbs = /\b(create|make|generate|build|download|give\s*me|need|want|write|draft)\b/;

  // QR Code detection - special case, doesn't need format intent
  if (/\b(qr\s*code|qrcode)\b/.test(lowerContent) && actionVerbs.test(lowerContent)) {
    return 'qrcode';
  }

  // Spreadsheet/Excel detection - check for confirmation if we have message history
  if (previousMessages && isSpreadsheetConfirmation(content, previousMessages)) {
    return 'spreadsheet';
  }

  // For other document types, require explicit format/download intent
  const hasExplicitFormatRequest = /\b(pdf|docx|word\s*doc|download|as\s+a\s+(pdf|word|document|file))\b/.test(lowerContent);
  const hasConfirmationWithFormat = /\b(yes|looks?\s*good|perfect|great|that'?s?\s*(good|great|perfect)|make\s*it|generate\s*it|create\s*it)\b/.test(lowerContent) &&
                                    /\b(pdf|docx|word|document|file|download)\b/.test(lowerContent);

  if (!hasExplicitFormatRequest && !hasConfirmationWithFormat) {
    return null;
  }

  // Resume detection - with explicit format request
  if (/\b(resume|résumé|cv|curriculum vitae)\b/.test(lowerContent) && actionVerbs.test(lowerContent)) {
    return 'resume';
  }

  // Invoice detection
  if (/\b(invoice|bill|receipt)\b/.test(lowerContent) && actionVerbs.test(lowerContent)) {
    return 'invoice';
  }

  // General Word document detection
  if (/\b(word\s*document|docx|letter|memo|report)\b/.test(lowerContent) && actionVerbs.test(lowerContent)) {
    return 'document';
  }

  return null;
}

function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    return null; // Rate limiting disabled if not configured
  }

  return createClient(supabaseUrl, supabaseServiceKey);
}

// ============================================================================
// IN-MEMORY FALLBACK RATE LIMITER (for when database is unavailable)
// This provides security even when Supabase is down
// ============================================================================
const memoryRateLimits = new Map<string, { count: number; resetAt: number }>();
const MEMORY_RATE_LIMIT = 10; // Very conservative limit when DB is down
const MEMORY_WINDOW_MS = 60 * 60 * 1000; // 1 hour

function checkMemoryRateLimit(identifier: string): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const entry = memoryRateLimits.get(identifier);

  // Clean up expired entries periodically (every 100th check)
  if (Math.random() < 0.01) {
    for (const [key, value] of memoryRateLimits.entries()) {
      if (value.resetAt < now) {
        memoryRateLimits.delete(key);
      }
    }
  }

  if (!entry || entry.resetAt < now) {
    // New window
    memoryRateLimits.set(identifier, { count: 1, resetAt: now + MEMORY_WINDOW_MS });
    return { allowed: true, remaining: MEMORY_RATE_LIMIT - 1 };
  }

  if (entry.count >= MEMORY_RATE_LIMIT) {
    return { allowed: false, remaining: 0 };
  }

  entry.count++;
  return { allowed: true, remaining: MEMORY_RATE_LIMIT - entry.count };
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
      console.error('[Chat API] Rate limit DB error, using memory fallback:', error);
      // FAIL-CLOSED: Use in-memory rate limiting when database is unavailable
      const memoryCheck = checkMemoryRateLimit(identifier);
      return { allowed: memoryCheck.allowed, remaining: memoryCheck.remaining, resetIn: memoryCheck.allowed ? 0 : 3600 };
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
    console.error('[Chat API] Rate limit exception, using memory fallback:', error);
    // FAIL-CLOSED: Use in-memory rate limiting when any error occurs
    const memoryCheck = checkMemoryRateLimit(identifier);
    return { allowed: memoryCheck.allowed, remaining: memoryCheck.remaining, resetIn: memoryCheck.allowed ? 0 : 3600 };
  }
}

interface UserContext {
  name: string;
  role: 'student' | 'professional';
  field?: string;
  purpose?: string;
}

interface SelectedRepo {
  owner: string;
  repo: string;
  fullName: string;
  defaultBranch: string;
}

/**
 * Build GitHub repo context for system prompt
 * This tells the AI what repo the user is working with
 */
function buildRepoContextPrompt(repo: SelectedRepo | undefined): string {
  if (!repo) return '';

  return `

---

## ACTIVE GITHUB REPOSITORY

The user has selected **${repo.fullName}** to work with.

- **Repository:** ${repo.repo}
- **Owner:** ${repo.owner}
- **Default Branch:** ${repo.defaultBranch}

You have access to this repository. Be proactive:
- If they ask to "review my code" or "check my project" - analyze the repo and provide actionable feedback
- Suggest specific improvements with code examples
- After reviewing, offer to help fix issues or add features
- If they haven't asked anything yet, you can say: "I see you're working on ${repo.repo}. Would you like me to review the code, find potential bugs, or help with something specific?"

---`;
}

interface ChatRequestBody {
  messages: CoreMessage[];
  tool?: string;
  temperature?: number;
  max_tokens?: number;
  userContext?: UserContext;
  conversationId?: string; // Current conversation ID to exclude from history
  searchMode?: 'none' | 'search' | 'factcheck'; // User-triggered search mode (Anthropic only)
  reasoningMode?: boolean; // User-triggered reasoning mode (DeepSeek only)
  selectedRepo?: SelectedRepo; // User-selected GitHub repo for code review
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
    // PHASE 2: reasoningMode no longer used (DeepSeek removed) - spread to suppress warning
    const { messages, tool, temperature, max_tokens, userContext, conversationId, searchMode, selectedRepo, ...rest } = body;
    void rest; // Suppress unused variable warning (includes reasoningMode)

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

    // Get GitHub token for code review tasks (if user is authenticated and has connected GitHub)
    let githubToken: string | null = null;
    if (isAuthenticated && isConnectorsEnabled()) {
      githubToken = await getGitHubTokenForUser(rateLimitIdentifier);
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

    // Get provider settings (PHASE 2: Always returns Gemini)
    const providerSettings = await getProviderSettings();
    const activeProvider: Provider = providerSettings.activeProvider;

    // PHASE 2: Moderation handled by Gemini's native safety filters
    // No external moderation call needed

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

    // USER LEARNING: Fire async learning extraction (non-blocking)
    // This runs in background and learns from user's message patterns
    if (isLearningEnabled() && isAuthenticated && rateLimitIdentifier && lastUserContent) {
      // Fire and forget - don't await, let it run in background
      extractAndLearn({
        userMessages: [lastUserContent],
        assistantMessages: messages
          .filter((m: CoreMessage) => m.role === 'assistant')
          .slice(-3)
          .map((m: CoreMessage) => typeof m.content === 'string' ? m.content : ''),
        userId: rateLimitIdentifier,
      }).catch(err => console.error('[Chat API] Background learning failed:', err));
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
    // CHECKPOINT CONTINUATION (Phase 4)
    // ========================================
    // Check if user wants to continue from a checkpoint
    // Looks for "continue" message and checkpoint state in previous assistant message
    if (isSequentialExecutionEnabled() && lastUserContent) {
      const normalizedMessage = lastUserContent.toLowerCase().trim();
      const isContinueRequest = normalizedMessage === 'continue' ||
                                normalizedMessage === 'yes' ||
                                normalizedMessage === 'proceed' ||
                                normalizedMessage.startsWith('continue');

      if (isContinueRequest) {
        // Look for checkpoint in recent assistant messages
        const assistantMessages = messages
          .filter((m: CoreMessage) => m.role === 'assistant')
          .slice(-3); // Check last 3 assistant messages

        for (const msg of assistantMessages) {
          const content = typeof msg.content === 'string' ? msg.content : '';
          // Look for checkpoint in both new format [c:STATE] and old HTML comment format
          const checkpointMatch = content.match(/\[c:([A-Za-z0-9+/=]+)\]/) ||
                                  content.match(/<!-- CHECKPOINT:([A-Za-z0-9+/=]+) -->/);

          if (checkpointMatch) {
            try {
              const encodedState = checkpointMatch[1];
              const decodedState = Buffer.from(encodedState, 'base64').toString('utf-8');
              const checkpointState: CheckpointState = JSON.parse(decodedState);

              console.log('[Chat API] Resuming from checkpoint:', {
                nextStep: checkpointState.nextStepIndex + 1,
                totalSteps: checkpointState.plan.subtasks.length,
                completedSteps: checkpointState.completedSteps.length
              });

              // Resume execution from checkpoint
              const geminiModel = await getModelForTier(userTier, 'gemini');

              const executionStream = await executeTaskPlan(
                checkpointState.plan,
                checkpointState.originalRequest,
                geminiModel,
                isAuthenticated ? rateLimitIdentifier : undefined,
                userTier,
                checkpointState, // Pass checkpoint state to resume
                githubToken || undefined, // Pass GitHub token for code review
                selectedRepo // Pass user-selected repo for code review
              );

              return new Response(executionStream, {
                headers: {
                  'Content-Type': 'text/plain; charset=utf-8',
                  'Transfer-Encoding': 'chunked',
                  'X-Model-Used': geminiModel,
                  'X-Provider': 'gemini',
                  'X-Task-Plan': 'resumed',
                },
              });
            } catch (parseError) {
              console.error('[Chat API] Failed to parse checkpoint state:', parseError);
              // Continue with normal flow if checkpoint parsing fails
            }
          }
        }
      }
    }

    // ========================================
    // RESEARCH AGENT (Dynamic Multi-Source Intelligence)
    // ========================================
    // For competitor analysis, market research, and deep business intelligence
    // Uses dynamic query generation, parallel execution, and self-evaluation
    if (isResearchAgentEnabled() && lastUserContent && shouldUseResearchAgent(lastUserContent)) {
      console.log('[Chat API] Using Research Agent for deep research request');

      const researchStream = await executeResearchAgent(lastUserContent, {
        userId: isAuthenticated ? rateLimitIdentifier : undefined,
        conversationId: conversationId || undefined,
        depth: 'standard',
        previousMessages: messages.slice(-5).map(m => ({
          role: String(m.role),
          content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content),
        })),
      });

      return new Response(researchStream, {
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'Transfer-Encoding': 'chunked',
          'X-Provider': 'gemini',
          'X-Agent': 'research',
        },
      });
    }

    // ========================================
    // CODE AGENT - REMOVED FROM MAIN CHAT
    // ========================================
    // Code Agent is now isolated to Code Lab only for cleaner routing
    // Users should use Code Lab (/code-lab) for code generation tasks
    // This prevents conflicts with other features in main chat

    // ========================================
    // MULTI-AGENT ORCHESTRATION
    // ========================================
    // For complex research + deliverable requests, use Researcher → Analyst → Writer pipeline
    // Feature flag controlled - off by default for safety
    if (isOrchestrationEnabled() && lastUserContent && shouldUseOrchestration(lastUserContent)) {
      console.log('[Chat API] Using multi-agent orchestration for request');

      const geminiModel = await getModelForTier(userTier, 'gemini');

      const orchestrationStream = await orchestrateAgents(lastUserContent, {
        model: geminiModel,
        userId: isAuthenticated ? rateLimitIdentifier : undefined,
        userTier,
        enableResearcher: true,
        enableAnalyst: true,
      });

      return new Response(orchestrationStream, {
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'Transfer-Encoding': 'chunked',
          'X-Model-Used': geminiModel,
          'X-Provider': 'gemini',
          'X-Orchestration': 'multi-agent',
        },
      });
    }

    // ========================================
    // TASK PLANNING (Phase 1 & 2)
    // ========================================
    // Phase 1: Detect complex requests and show task plan
    // Phase 2: Sequential execution with progress tracking
    // Feature flag controlled - off by default for safety
    let taskPlanText: string | null = null;
    let taskPlanResult: Awaited<ReturnType<typeof analyzeRequest>> | null = null;

    // FORGE & MUSASHI: Skip task planning for direct routes (website, video, image)
    // These have their own specialized handlers that are more powerful
    // Do early route check (without file uploads) to determine if we should skip
    const skipTaskPlanningForRoutes: RouteTarget[] = ['website', 'video', 'image'];
    const earlyRouteCheck = decideRoute(lastUserContent, tool);
    let shouldSkipTaskPlanning = skipTaskPlanningForRoutes.includes(earlyRouteCheck.target);

    // CRITICAL: Also check for website discovery response BEFORE task planning
    // This catches when user provides business details after we asked for them
    const earlyDiscoveryCheck = isWebsiteDiscoveryResponse(lastUserContent);

    // Check if we're in a "website building" conversation context
    // Look at recent assistant messages for website/landing page mentions
    const recentAssistantMessages = messages
      .slice(-6)
      .filter((m: CoreMessage) => m.role === 'assistant')
      .map((m: CoreMessage) => typeof m.content === 'string' ? m.content : '')
      .join(' ');

    const isInWebsiteContext = /\b(build|create|generate|making)\s*(you\s*)?(a\s*)?(landing\s*page|website|web\s*page|business\s*site)\b/i.test(recentAssistantMessages) ||
      /\b(business\s*name|contact\s*email|pricing|style\s*preferences?)\b.*\b(website|landing\s*page|site)\b/i.test(recentAssistantMessages) ||
      /\bI'?d\s*love\s*to\s*build\s*you\b/i.test(recentAssistantMessages) ||
      /\bTo\s*make\s*it\s*perfect,?\s*I\s*need\b/i.test(recentAssistantMessages);

    if (earlyDiscoveryCheck.isDiscoveryResponse && isInWebsiteContext) {
      console.log('[Chat API] FORGE & MUSASHI: Detected website discovery response - skipping task planner');
      console.log('[Chat API] Discovery extracted:', earlyDiscoveryCheck.extractedInfo);
      shouldSkipTaskPlanning = true;
    }

    // CRITICAL: Check for spreadsheet discovery response BEFORE task planning
    // This catches when user provides spreadsheet details after we asked qualifying questions
    const isInSpreadsheetContext = /\b(spreadsheet|excel|xlsx)\b.*\b(categories|track|columns?|time\s*period|calculations?|data)\b/i.test(recentAssistantMessages) ||
      /\b(What specific categories|What do you want to track|time period|weekly|monthly|yearly)\b.*\b(spreadsheet|excel|budget|finance)\b/i.test(recentAssistantMessages) ||
      /\bcreate\s*(a|an|the)?\s*(home\s*)?(finance|budget|expense|income)\s*(spreadsheet|tracker|excel)\b/i.test(recentAssistantMessages) ||
      /\bqualifying questions\b.*\b(spreadsheet|excel)\b/i.test(recentAssistantMessages) ||
      /\bwhat.*categories.*track\b/i.test(recentAssistantMessages) ||
      /\bmonthly view or.*yearly\b/i.test(recentAssistantMessages) ||
      /\bBudget vs\.? Actual\b/i.test(recentAssistantMessages);

    // Check if user is providing financial/spreadsheet data (categories, dollar amounts, etc.)
    const lowerUserContent = lastUserContent.toLowerCase();
    const isProvidingSpreadsheetData = (
      // Mentions income, expenses, or specific categories
      (/\b(income|salary|earnings|rent|groceries|insurance|utilities|savings|expenses?)\b/i.test(lastUserContent) &&
       /\b(my|the|for|pay|have|need)\b/i.test(lowerUserContent)) ||
      // Lists multiple financial items
      (lastUserContent.match(/\b(rent|groceries|insurance|utilities|car|school|savings|entertainment|subscriptions?)\b/gi)?.length || 0) >= 2 ||
      // Dollar amounts
      /\$\d+/.test(lastUserContent) ||
      // Budget-related keywords with action context
      (/\b(track|tracking|budget|finance|expenses?)\b/i.test(lastUserContent) && /\b(want|need|have|keep)\b/i.test(lowerUserContent))
    );

    if (isInSpreadsheetContext && isProvidingSpreadsheetData) {
      console.log('[Chat API] FORGE & MUSASHI: Detected spreadsheet discovery response - skipping task planner');
      console.log('[Chat API] User is providing spreadsheet details after qualifying questions');
      shouldSkipTaskPlanning = true;
    }

    if (shouldSkipTaskPlanning) {
      console.log(`[Chat API] FORGE & MUSASHI: Skipping task planner for direct route: ${earlyRouteCheck.target}`);
    }

    if (isTaskPlanningEnabled() && lastUserContent && !shouldSkipTaskPlanning) {
      try {
        // Get recent context for better classification
        const recentContext = messages
          .slice(-3)
          .filter((m: CoreMessage) => m.role === 'assistant')
          .map((m: CoreMessage) => typeof m.content === 'string' ? m.content.slice(0, 200) : '')
          .join('\n');

        taskPlanResult = await analyzeRequest(lastUserContent, recentContext || undefined);

        if (taskPlanResult.shouldShowPlan) {
          taskPlanText = taskPlanResult.planDisplayText;
          console.log('[Chat API] Task plan generated:', {
            subtasks: taskPlanResult.plan.subtasks?.length || 0,
            summary: taskPlanResult.plan.summary
          });

          // Phase 2: If sequential execution is enabled, execute the plan
          if (isSequentialExecutionEnabled() && taskPlanResult.plan.subtasks.length > 0) {
            console.log('[Chat API] Starting sequential task execution');

            // Get the model to use (Gemini for now)
            const geminiModel = await getModelForTier(userTier, 'gemini');

            const executionStream = await executeTaskPlan(
              taskPlanResult.plan,
              lastUserContent,
              geminiModel,
              isAuthenticated ? rateLimitIdentifier : undefined,
              userTier,
              undefined, // No checkpoint state
              githubToken || undefined, // Pass GitHub token for code review
              selectedRepo // Pass user-selected repo for code review
            );

            return new Response(executionStream, {
              headers: {
                'Content-Type': 'text/plain; charset=utf-8',
                'Transfer-Encoding': 'chunked',
                'X-Model-Used': geminiModel,
                'X-Provider': 'gemini',
                'X-Task-Plan': 'sequential',
              },
            });
          }
        }
      } catch (error) {
        // Task planning failure should never break the chat
        console.error('[Chat API] Task planning error (non-fatal):', error);
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
    let routeDecision = hasFileUploads
      ? { target: 'mini' as const, reason: messageHasUploadedImages ? 'image-analysis' as const : 'file-analysis' as const, confidence: 1.0 }
      : decideRoute(lastUserContent, tool);

    // Check for website discovery response - user providing business details after discovery questions
    // This catches follow-ups like "Business name, email, $250/hour"
    // Reuse the early discovery check from above (earlyDiscoveryCheck) and context check (isInWebsiteContext)
    if (earlyDiscoveryCheck.isDiscoveryResponse && routeDecision.target !== 'website') {
      // Only override if we're in a website context OR if discovery has strong signals
      const hasStrongDiscoverySignals = (
        (earlyDiscoveryCheck.extractedInfo.businessName && earlyDiscoveryCheck.extractedInfo.email) ||
        (earlyDiscoveryCheck.extractedInfo.businessName && earlyDiscoveryCheck.extractedInfo.location) ||
        earlyDiscoveryCheck.extractedInfo.isAutoGenerate
      );

      if (isInWebsiteContext || hasStrongDiscoverySignals) {
        console.log('[Chat API] Detected website discovery response - overriding route to website');
        console.log('[Chat API] Discovery extracted:', earlyDiscoveryCheck.extractedInfo);
        console.log('[Chat API] In website context:', isInWebsiteContext, 'Strong signals:', hasStrongDiscoverySignals);
        routeDecision = { target: 'website', reason: 'website-intent', confidence: 0.95, matchedPattern: 'discovery-response' };
      }
    }

    // Log the routing decision for telemetry
    logRouteDecision(rateLimitIdentifier, routeDecision, lastUserContent);

    if (messageHasUploadedImages) {
      console.log('[Chat API] Detected uploaded image - routing to gpt-5-mini for analysis');
    } else if (messageHasFileAttachments) {
      console.log('[Chat API] Detected file attachment - routing to gpt-5-mini for analysis');
    }

    // ========================================
    // PROVIDER CHECK - Already fetched earlier for moderation decision
    // ========================================
    console.log('[Chat API] Active provider:', activeProvider);

    // ========================================
    // VIDEO GENERATION - Coming Soon
    // ========================================
    if (routeDecision.target === 'video') {
      return new Response(
        JSON.stringify({
          type: 'text',
          content: '**Video Generation Coming Soon**\n\nAI video generation is being developed and will be available in a future update.\n\nIn the meantime, I can help you with:\n- Writing video scripts or storyboards\n- Describing video concepts in detail\n- Building complete websites with AI\n- Creating documents, spreadsheets, and presentations\n\nIs there something else I can help you with?',
          model: 'claude-sonnet-4-5-20250929',
        }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'X-Video-Unavailable': 'coming-soon',
          },
        }
      );
    }

    // ========================================
    // FORGE & MUSASHI: WEBSITE GENERATION PIPELINE
    // Complete website generation with all assets
    // ========================================
    if (routeDecision.target === 'website') {
      // FORGE & MUSASHI: Enhanced website detection with multi-page, cloning, and auth support
      const websiteIntent = hasWebsiteIntent(lastUserContent);
      const isMultiPage = websiteIntent.isMultiPage;
      const isCloning = websiteIntent.isCloning;
      const cloneUrl = websiteIntent.cloneUrl;
      const hasAuth = websiteIntent.hasAuth;

      console.log('[Chat API] Routing to ENHANCED website generation with Template RAG + AI images');
      console.log('[Chat API] Multi-page:', isMultiPage, 'Cloning:', isCloning, 'Auth:', hasAuth, 'URL:', cloneUrl || 'N/A');

      try {
        // Get models from admin settings
        const geminiModel = await getModelForTier('pro', 'gemini');
        const imageModel = await getGeminiImageModel();
        console.log('[Chat API] Using Gemini model:', geminiModel, 'Image model:', imageModel);

        // Check if this is a modification request to an existing website
        const modificationCheck = hasWebsiteModificationIntent(lastUserContent);
        let existingSession: WebsiteSession | null = null;

        if (rateLimitIdentifier) {
          existingSession = await getActiveWebsiteSession(rateLimitIdentifier);
        }

        // Handle website modifications with SMART section-level editing
        if (modificationCheck.isModification && existingSession) {
          console.log('[Chat API] FORGE & MUSASHI: Processing smart website modification...');
          console.log('[Chat API] Matched pattern:', modificationCheck.matchedPattern);

          const modResult = await applySmartModification(
            existingSession,
            lastUserContent,
            geminiModel
          );

          if (modResult.success) {
            const sectionNote = modResult.updatedSection
              ? `\n\n✨ *Smart update: Modified the **${modResult.updatedSection}** section using your business model.*`
              : '';

            return new Response(
              JSON.stringify({
                type: 'code_preview',
                content: `**Website Updated!**\n\n${modResult.changesDescription}${sectionNote}\n\nClick **"Open Preview"** to see the changes!\n\n*Want more changes? Just tell me what to adjust. When you're happy, say "push to GitHub" or "deploy to Vercel"!*`,
                model: geminiModel,
                codePreview: {
                  code: modResult.html,
                  language: 'html',
                  title: existingSession.businessName,
                  description: `Modified: ${lastUserContent.slice(0, 80)}...`,
                },
              }),
              {
                status: 200,
                headers: {
                  'Content-Type': 'application/json',
                  'X-Route-Target': 'website-modification',
                  'X-Session-Id': existingSession.id,
                },
              }
            );
          }
        }

        // Handle GitHub push requests
        if (existingSession && isGitHubPushRequest(lastUserContent)) {
          console.log('[Chat API] FORGE & MUSASHI: Processing GitHub push request...');

          // Get GitHub token for the user
          const githubToken = await getGitHubTokenForUser(rateLimitIdentifier || '');

          if (!githubToken) {
            return new Response(
              JSON.stringify({
                type: 'text',
                content: `**GitHub Not Connected**\n\nTo push your website to GitHub, you need to connect your GitHub account:\n\n1. Go to **Settings** → **Connectors**\n2. Click **Connect GitHub**\n3. Authorize access\n4. Come back and say "push to GitHub" again!\n\nYour website is saved and ready to push once connected.`,
                model: geminiModel,
              }),
              {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
              }
            );
          }

          const pushResult = await pushWebsiteToGitHub(existingSession, githubToken);

          if (pushResult.success) {
            return new Response(
              JSON.stringify({
                type: 'text',
                content: `**Website Pushed to GitHub!** 🚀\n\nYour website is now live on GitHub:\n\n📁 **Repository**: [${pushResult.repoUrl}](${pushResult.repoUrl})\n\n*What's next?*\n- Say "deploy to Vercel" to go live\n- Enable GitHub Pages for free hosting\n- Clone the repo to make local changes`,
                model: geminiModel,
              }),
              {
                status: 200,
                headers: {
                  'Content-Type': 'application/json',
                  'X-Route-Target': 'website-github-push',
                  'X-Repo-Url': pushResult.repoUrl || '',
                },
              }
            );
          } else {
            return new Response(
              JSON.stringify({
                type: 'text',
                content: `**GitHub Push Failed**\n\nSorry, I couldn't push to GitHub: ${pushResult.error}\n\nPlease try again or check your GitHub connection in Settings.`,
                model: geminiModel,
              }),
              {
                status: 500,
                headers: { 'Content-Type': 'application/json' },
              }
            );
          }
        }

        // Handle Vercel deployment requests
        if (existingSession && isVercelDeployRequest(lastUserContent)) {
          console.log('[Chat API] FORGE & MUSASHI: Processing Vercel deployment request...');

          const deployResult = await deployWebsiteToVercel(existingSession);

          if (deployResult.success) {
            return new Response(
              JSON.stringify({
                type: 'text',
                content: `**Website Deployed to Vercel!** 🎉\n\nYour website is now LIVE:\n\n🌐 **Live URL**: [${deployResult.deploymentUrl}](${deployResult.deploymentUrl})\n\n*Your site is now accessible to the world!*\n\n**What's next?**\n- Share your URL with others\n- Connect a custom domain in Vercel dashboard\n- Say "push to GitHub" to save the source code`,
                model: geminiModel,
              }),
              {
                status: 200,
                headers: {
                  'Content-Type': 'application/json',
                  'X-Route-Target': 'website-vercel-deploy',
                  'X-Deployment-Url': deployResult.deploymentUrl || '',
                },
              }
            );
          } else {
            return new Response(
              JSON.stringify({
                type: 'text',
                content: `**Vercel Deployment Failed**\n\nSorry, I couldn't deploy to Vercel: ${deployResult.error}\n\nYou can still:\n- Preview your website using the "Open Preview" button\n- Push to GitHub and deploy from there\n- Download the HTML and host it anywhere`,
                model: geminiModel,
              }),
              {
                status: 500,
                headers: { 'Content-Type': 'application/json' },
              }
            );
          }
        }

        // New website generation
        console.log('[Chat API] FORGE & MUSASHI: Generating new website with full asset pipeline...');

        // Extract business info
        const detectedCategory = detectCategory(lastUserContent);
        const extractedInfo = extractBusinessInfo(lastUserContent);

        // Smart business name extraction - STRICT: only match actual business names, not descriptions
        // "for my photography business" = NO NAME (describing type)
        // "for Lens & Light Studios" = NAME (actual business name)
        // "called Smith Photography" = NAME (actual business name)
        const businessNameMatch =
          // Match "called/named X" - explicit naming
          lastUserContent.match(/(?:called|named)\s+["\']?([A-Z][^"'\n,]{2,30})["\']?/i) ||
          // Match "for [Name] Studio/Photography/etc" - but NOT "for my [type] business"
          lastUserContent.match(/for\s+(?!my\s|a\s|an\s|the\s)([A-Z][a-zA-Z&'\s]{2,25})\s+(?:studio|photography|salon|gym|restaurant|agency|shop|store|clinic|dental|law|firm)/i) ||
          // Match quoted names
          lastUserContent.match(/["\']([^"']{3,30})["\']/) ||
          // Match "Business Name: X" or "Name: X"
          lastUserContent.match(/(?:business\s+name|name)[:\s]+([A-Z][^,\n]{2,30})/i);

        const businessName = extractedInfo.name || (businessNameMatch ? businessNameMatch[1].trim() : '');

        // Check if we have minimum required info for a quality website
        // Business name is REQUIRED - without it we can't create a proper logo or branding
        const hasBusinessName = businessName && businessName !== 'Your Business' && businessName.length > 2;

        // Discovery: Ask for essential details if missing
        if (!hasBusinessName) {
          console.log('[Chat API] Missing business info - asking discovery questions');
          const fallbackModel = await getModelForTier('pro', 'gemini');

          return new Response(
            JSON.stringify({
              type: 'text',
              content: `I'd love to build you an amazing ${detectedCategory.replace(/-/g, ' ')} website! To make it perfect, I need a few quick details:\n\n**1. What's your business name?** (This will be on your logo!)\n\n**2. What's your contact email?** (For the contact form)\n\n**3. Do you have pricing?** Tell me your rates, OR say "research market prices" and I'll look up competitive rates for ${detectedCategory.replace(/-/g, ' ')} businesses.\n\n**4. Any style preferences?** (modern, minimal, bold, elegant, etc.)\n\nJust reply with these details and I'll build you a stunning website!`,
              model: fallbackModel,
            }),
            {
              status: 200,
              headers: {
                'Content-Type': 'application/json',
                'X-Route-Target': 'website-discovery',
              },
            }
          );
        }

        console.log('[Chat API] Business:', businessName, 'Industry:', detectedCategory);

        // Build generation context
        const context: GenerationContext = {
          businessName,
          industry: detectedCategory.replace(/-/g, ' '),
          userPrompt: lastUserContent,
          existingSession: existingSession || undefined,
          isModification: false,
        };

        // ================================================
        // STREAMING WEBSITE GENERATION
        // Stream progress updates to prevent timeout
        // ================================================
        const encoder = new TextEncoder();

        const stream = new ReadableStream({
          async start(controller) {
            try {
              // Progress callback to stream updates during generation
              // This keeps the connection alive and prevents Vercel timeout
              const onProgress = (message: string, step?: number, totalSteps?: number) => {
                const progressData = {
                  type: 'progress',
                  message,
                  step: step || undefined,
                  totalSteps: totalSteps || undefined,
                };
                controller.enqueue(encoder.encode(`data: ${JSON.stringify(progressData)}\n\n`));
              };

              // Generate the complete website with progress streaming
              const result = await generateCompleteWebsite(
                rateLimitIdentifier || 'anonymous',
                context,
                geminiModel,
                imageModel,
                onProgress
              );

              if (!result.success) {
                controller.enqueue(encoder.encode(`data: {"type":"error","message":"${result.error || 'Website generation failed'}"}\n\n`));
                controller.close();
                return;
              }

              // Build response with asset summary
              const assetSummary: string[] = [];
              if (result.assets.favicon32) assetSummary.push('Custom favicon');
              if (result.assets.logo) assetSummary.push('AI-generated logo');
              if (result.assets.heroBackground) assetSummary.push('Hero background image');
              if (Object.values(result.assets.sectionImages).some(Boolean)) {
                assetSummary.push('Section images');
              }
              if (result.assets.teamAvatars.length > 0) {
                assetSummary.push(`${result.assets.teamAvatars.length} team photos`);
              }

              // Get the generated code from result
              let generatedCode = result.html;
              const logoDataUrl = result.assets.logo || null;
              const heroImageDataUrl = result.assets.heroBackground || null;

              // Clean the code
              generatedCode = generatedCode.trim();
              if (generatedCode.startsWith('```html')) generatedCode = generatedCode.slice(7);
              if (generatedCode.startsWith('```')) generatedCode = generatedCode.slice(3);
              if (generatedCode.endsWith('```')) generatedCode = generatedCode.slice(0, -3);
              generatedCode = generatedCode.trim();

              // Inject the actual image data URLs if the model used placeholders
              if (logoDataUrl) {
                generatedCode = generatedCode.replace(
                  /src=["'](?:logo\.png|placeholder|#logo|LOGO_URL|data:image[^"']*\.\.\.)[^"']*["']/gi,
                  `src="${logoDataUrl}"`
                );
                if (!generatedCode.includes(logoDataUrl)) {
                  generatedCode = generatedCode.replace(
                    /(<(?:header|nav)[^>]*>)/i,
                    `$1\n<img src="${logoDataUrl}" alt="${businessName} Logo" style="max-height: 60px; width: auto;">`
                  );
                }
              }

              if (heroImageDataUrl) {
                if (!generatedCode.includes(heroImageDataUrl)) {
                  generatedCode = generatedCode.replace(
                    /\.hero\s*\{([^}]*)\}/i,
                    `.hero { $1 background-image: linear-gradient(rgba(0,0,0,0.5), rgba(0,0,0,0.5)), url('${heroImageDataUrl}'); background-size: cover; background-position: center; }`
                  );
                }
              }

              const titleMatch = generatedCode.match(/<title>([^<]+)<\/title>/i);
              const title = titleMatch ? titleMatch[1] : businessName + ' - Landing Page';

              const features = [
                ...assetSummary.map(a => `🎨 ${a}`),
                '📱 Fully responsive design',
                '💰 Industry-researched pricing',
                '⭐ Realistic testimonials',
                '📝 Working contact form',
                '🎯 Conversion-optimized layout',
                '✨ Micro-animations & effects',
              ];

              controller.enqueue(encoder.encode(`data: {"type":"progress","message":"✅ Website complete!"}\n\n`));

              // Send the final website response
              const finalResponse = {
                type: 'code_preview',
                content: `**${title}**\n\nI've created a premium $10,000+ quality website with:\n${features.map(f => `- ${f}`).join('\n')}\n\nClick **"Open Preview"** to see it live!\n\n*What's next?*\n- Ask me to change colors, fonts, sections, or content\n- Say "push to GitHub" to save your code\n- Say "deploy to Vercel" to go live!`,
                model: geminiModel,
                codePreview: {
                  code: generatedCode,
                  language: 'html',
                  title: title,
                  description: result.description,
                },
                sessionId: result.sessionId,
              };

              controller.enqueue(encoder.encode(`data: ${JSON.stringify(finalResponse)}\n\n`));
              controller.enqueue(encoder.encode('data: [DONE]\n\n'));
              controller.close();

            } catch (error) {
              console.error('[Chat API] Streaming website generation error:', error);
              controller.enqueue(encoder.encode(`data: {"type":"error","message":"${error instanceof Error ? error.message : 'Unknown error'}"}\n\n`));
              controller.close();
            }
          }
        });

        return new Response(stream, {
          status: 200,
          headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'X-Route-Target': 'website',
            'X-Route-Reason': routeDecision.reason,
            'X-Model-Used': geminiModel,
          },
        });

        // NOTE: Multi-page and auth websites temporarily use streaming single-page for now
        // TODO: Add streaming support for multi-page websites with auth
      } catch (error) {
        console.error('[Chat API] Website generation error:', error);
        const fallbackModel = await getModelForTier('pro', 'gemini');
        return new Response(
          JSON.stringify({
            type: 'text',
            content: `**Website Generation Error**\n\nSorry, I encountered an issue: ${error instanceof Error ? error.message : 'Unknown error'}\n\nPlease try again with a clear description like:\n- "Create a website for [Business Name] - a [type of business]"\n- "Build a landing page for my AI startup called TechVision"`,
            model: fallbackModel,
          }),
          {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      }
    }

    // ========================================
    // CODE EXECUTION (VM Sandbox)
    // ========================================
    // Check for code execution requests - run tests, build, execute code
    const executionCheck = hasCodeExecutionIntent(lastUserContent);
    if (executionCheck.isExecution) {
      console.log('[Chat API] Code execution intent detected:', executionCheck.matchedPattern);

      // Get OIDC token from request headers (Vercel provides this)
      const oidcToken = request.headers.get('x-vercel-oidc-token');

      // Check if sandbox is available
      if (!isSandboxConfigured(oidcToken)) {
        console.log('[Chat API] Sandbox not configured, providing guidance');
        // Still handle the request but inform about sandbox status
        const geminiModel = await getModelForTier('pro', 'gemini');
        return new Response(
          JSON.stringify({
            type: 'text',
            content: `**Code Execution**\n\nI can see you want to run code! The sandbox VM is being configured.\n\nIn the meantime, here's what I can help with:\n- Review your code for errors\n- Suggest fixes\n- Explain what the code does\n\nWould you like me to analyze the code instead?`,
            model: geminiModel,
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      }

      // Look for code in recent messages
      const recentMessages = messages.slice(-5);
      let codeToExecute: { language: string; code: string } | null = null;

      for (const msg of recentMessages.reverse()) {
        if (msg.role === 'assistant' && typeof msg.content === 'string') {
          const blocks = extractCodeBlocks(msg.content);
          // Find first executable code block
          const executableBlock = blocks.find(b =>
            ['javascript', 'typescript', 'python', 'js', 'ts', 'py'].includes(b.language.toLowerCase())
          );
          if (executableBlock) {
            codeToExecute = {
              language: executableBlock.language.toLowerCase().replace('js', 'javascript').replace('ts', 'typescript').replace('py', 'python'),
              code: executableBlock.code,
            };
            break;
          }
        }
      }

      if (!codeToExecute) {
        // Check user's message for code
        const userBlocks = extractCodeBlocks(lastUserContent);
        const executableUserBlock = userBlocks.find(b =>
          ['javascript', 'typescript', 'python', 'js', 'ts', 'py'].includes(b.language.toLowerCase())
        );
        if (executableUserBlock) {
          codeToExecute = {
            language: executableUserBlock.language.toLowerCase().replace('js', 'javascript').replace('ts', 'typescript').replace('py', 'python'),
            code: executableUserBlock.code,
          };
        }
      }

      if (codeToExecute && shouldTestCode(codeToExecute.code, codeToExecute.language)) {
        console.log(`[Chat API] Executing ${codeToExecute.language} code in sandbox...`);

        try {
          const result = await executeCode({
            type: 'snippet',
            language: codeToExecute.language as 'javascript' | 'typescript' | 'python',
            code: codeToExecute.code,
          });

          const geminiModel = await getModelForTier('pro', 'gemini');
          const statusEmoji = result.success ? '✅' : '❌';
          const statusText = result.success ? 'Success' : 'Failed';

          return new Response(
            JSON.stringify({
              type: 'text',
              content: `**Code Execution ${statusEmoji} ${statusText}**\n\n\`\`\`\n${result.output}\n\`\`\`\n${result.errors.length > 0 ? `\n**Errors:**\n${result.errors.join('\n')}\n` : ''}${result.suggestion ? `\n**Suggestion:** ${result.suggestion}` : ''}\n\n*Executed in ${result.executionTime}ms*`,
              model: geminiModel,
            }),
            {
              status: 200,
              headers: {
                'Content-Type': 'application/json',
                'X-Execution-Time': String(result.executionTime),
                'X-Execution-Success': String(result.success),
              },
            }
          );
        } catch (error) {
          console.error('[Chat API] Code execution error:', error);
          const geminiModel = await getModelForTier('pro', 'gemini');
          return new Response(
            JSON.stringify({
              type: 'text',
              content: `**Code Execution Error**\n\n${error instanceof Error ? error.message : 'Unknown error occurred'}\n\nPlease try again or paste the code you'd like me to run.`,
              model: geminiModel,
            }),
            {
              status: 500,
              headers: { 'Content-Type': 'application/json' },
            }
          );
        }
      } else {
        // No executable code found
        const geminiModel = await getModelForTier('pro', 'gemini');
        return new Response(
          JSON.stringify({
            type: 'text',
            content: `**Ready to Execute**\n\nI'm ready to run your code! Please share the code you'd like me to execute.\n\nSupported languages:\n- JavaScript / TypeScript\n- Python\n\nJust paste your code in a code block:\n\`\`\`javascript\nconsole.log('Hello World!');\n\`\`\``,
            model: geminiModel,
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      }
    }

    // ========================================
    // GITHUB CODE REVIEW (with Tool Calling)
    // ========================================
    if (routeDecision.target === 'github') {
      console.log('[Chat API] Routing to GitHub code review');

      // Check if user is authenticated
      if (!isAuthenticated || !rateLimitIdentifier) {
        return new Response(
          JSON.stringify({
            type: 'text',
            content: 'To review GitHub repositories, please sign in first. Then connect your GitHub account in Settings > Connectors.',
            model: 'system',
          }),
          {
            status: 401,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      }

      // Get user's GitHub token
      const githubToken = await getGitHubTokenForUser(rateLimitIdentifier);

      if (!githubToken) {
        return new Response(
          JSON.stringify({
            type: 'text',
            content: `**GitHub Not Connected**

To review repositories, you need to connect your GitHub account:

1. Go to **Settings** → **Connectors**
2. Click **Connect GitHub**
3. Authorize access to your repositories
4. Come back and ask me to review your code!

Once connected, I can:
- 📖 Read and analyze your codebase
- 🔍 Find bugs and security issues
- 💡 Suggest improvements
- 📝 Create branches and pull requests`,
            model: 'system',
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      }

      try {
        // Get model from admin settings
        const geminiModel = await getModelForTier('pro', 'gemini');
        console.log('[Chat API] GitHub review using Gemini model:', geminiModel);

        // Comprehensive developer assistant system prompt
        const codeReviewSystemPrompt = `You are an elite full-stack developer, software architect, and DevOps engineer with 20+ years of experience across every major technology stack. You are THE expert that senior engineers consult when they're stuck.

# YOUR EXPERTISE

## Languages & Runtimes
- JavaScript/TypeScript (Node.js, Deno, Bun), Python, Rust, Go, Java, Kotlin, Swift, Ruby, PHP, C/C++, C#

## Frontend
- React, Next.js, Vue, Nuxt, Angular, Svelte, SvelteKit, Astro, Remix, Gatsby, Qwik
- State: Redux, Zustand, Jotai, Recoil, MobX, Pinia, Vuex
- Styling: Tailwind, CSS Modules, Styled Components, Emotion, Sass/SCSS

## Backend
- Express, Fastify, NestJS, Django, Flask, FastAPI, Rails, Laravel, Spring Boot, Gin, Fiber
- GraphQL: Apollo, Urql, Relay, Pothos, GraphQL Yoga

## Databases
- PostgreSQL, MySQL, MongoDB, Redis, SQLite, DynamoDB, Cassandra
- ORMs: Prisma, Drizzle, TypeORM, Sequelize, Mongoose, SQLAlchemy

## DevOps & Infrastructure
- Docker, Kubernetes, Terraform, Pulumi, AWS, GCP, Azure, Vercel, Netlify, Railway, Fly.io
- CI/CD: GitHub Actions, GitLab CI, Jenkins, CircleCI, ArgoCD

## Testing
- Jest, Vitest, Mocha, Cypress, Playwright, Testing Library, Pytest, RSpec

# YOUR CAPABILITIES

## 1. CODE REVIEW & ANALYSIS
When reviewing code, you:
- Identify bugs, security vulnerabilities (OWASP Top 10), and performance issues
- Analyze architecture and suggest improvements
- Check for code smells, anti-patterns, and technical debt
- Verify best practices for the specific framework/language
- Review error handling, edge cases, and type safety
- Assess test coverage and quality
- Check dependency health and security

## 2. DEBUGGING & TROUBLESHOOTING
When debugging, you:
- Parse error messages and stack traces to identify root causes
- Understand complex async/promise flows and race conditions
- Debug memory leaks, performance bottlenecks, and infinite loops
- Fix build errors (webpack, vite, tsc, babel)
- Resolve dependency conflicts and version mismatches
- Debug CI/CD pipeline failures
- Fix deployment issues across platforms

## 3. CODE GENERATION & IMPLEMENTATION
When writing code, you:
- Generate production-ready, type-safe code
- Follow framework-specific conventions and best practices
- Include proper error handling and edge case coverage
- Write clean, maintainable, and well-documented code
- Create complete implementations, not just snippets
- Follow SOLID principles and design patterns
- Consider performance from the start

## 4. TESTING
When working with tests, you:
- Write comprehensive unit, integration, and e2e tests
- Create proper mocks, stubs, and fixtures
- Ensure edge cases are covered
- Set up test infrastructure and configuration
- Fix failing tests with proper understanding

## 5. REFACTORING
When refactoring, you:
- Extract reusable functions and components
- Eliminate code duplication (DRY)
- Modernize legacy code patterns
- Improve type safety and error handling
- Optimize for readability and maintainability
- Migrate between frameworks/versions safely

## 6. DEVOPS & DEPLOYMENT
When handling DevOps, you:
- Write Dockerfiles and docker-compose configurations
- Create CI/CD pipelines (GitHub Actions, etc.)
- Configure environment variables and secrets
- Set up monitoring and logging
- Optimize build and deployment processes

# YOUR TOOLS

Use these tools strategically to help the user:

- **github_clone_repo**: Fetch repository files for analysis. Use this FIRST when asked to review, analyze, or work with a repository.
- **github_get_file**: Get specific file content when you need more detail on a particular file.
- **github_get_repo_info**: Get repository metadata (description, default branch, etc.)
- **github_list_branches**: List branches to understand the repo structure.
- **github_create_branch**: Create a new branch before making changes.
- **github_push_files**: Push code changes to implement fixes or features.
- **github_create_pr**: Create a pull request after pushing changes.

# YOUR APPROACH

1. **UNDERSTAND FIRST**: Before suggesting solutions, fully understand the codebase, the user's intent, and the context.

2. **BE SPECIFIC**: Always reference specific files, line numbers, and code snippets. Never be vague.

3. **EXPLAIN WHY**: Don't just say what's wrong—explain WHY it's a problem and the consequences.

4. **SHOW, DON'T TELL**: Provide actual code fixes, not just descriptions. Write the corrected code.

5. **PRIORITIZE**: Address critical issues (security, crashes, data loss) before style preferences.

6. **BE ACTIONABLE**: Every piece of feedback should have a clear action the user can take.

7. **CONSIDER CONTEXT**: Understand the project's constraints, team size, and timeline.

8. **BE ENCOURAGING**: Acknowledge what's done well while identifying improvements.

# RESPONSE FORMAT

For code reviews, structure your response as:

## 🎯 Summary
Brief overview of the codebase and your findings

## 🚨 Critical Issues
Security vulnerabilities, potential crashes, data loss risks

## ⚠️ Important Improvements
Bugs, performance issues, architectural concerns

## 💡 Suggestions
Best practices, code quality, maintainability improvements

## ✅ What's Done Well
Acknowledge good practices and well-written code

## 📋 Action Items
Clear, prioritized list of recommended changes

For debugging, structure your response as:

## 🔍 Problem Identified
What's causing the error

## 🛠️ Solution
The fix with complete code

## 📝 Explanation
Why this fix works

## 🔮 Prevention
How to prevent this in the future`;

        // Import the Gemini SDK for tool calling
        const { GoogleGenAI } = await import('@google/genai');
        const genai = new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY || '' });

        // Build initial messages with conversation history
        // Use the original messages array, converting to Gemini format
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const geminiMessages: any[] = messages.map((msg: CoreMessage) => ({
          role: msg.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content) }],
        }));

        // Tool calling loop - keep going until we get a final response
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let currentMessages: any[] = geminiMessages;
        const maxIterations = 10; // Safety limit
        let iteration = 0;
        let finalResponse = '';

        while (iteration < maxIterations) {
          iteration++;
          console.log(`[Chat API] GitHub tool loop iteration ${iteration}`);

          // Make the API call with tools
          const response = await genai.models.generateContent({
            model: geminiModel,
            contents: currentMessages,
            config: {
              systemInstruction: codeReviewSystemPrompt,
              tools: [{ functionDeclarations: githubFunctionDeclarations }],
            },
          });

          const candidate = response.candidates?.[0];
          if (!candidate?.content?.parts) {
            console.error('[Chat API] No valid response from Gemini');
            break;
          }

          const parts = candidate.content.parts;

          // Check if there are function calls
          const functionCalls = parts.filter((p: { functionCall?: unknown }) => p.functionCall);

          if (functionCalls.length === 0) {
            // No function calls - this is the final text response
            const textParts = parts.filter((p: { text?: string }) => p.text);
            finalResponse = textParts.map((p: { text?: string }) => p.text || '').join('\n');
            break;
          }

          // Execute each function call
          const functionResults = [];
          for (const part of functionCalls) {
            const fc = part.functionCall as { name: string; args: Record<string, unknown> };
            console.log(`[Chat API] Executing GitHub tool: ${fc.name}`);

            const result = await executeGitHubTool(fc.name, fc.args || {}, {
              githubToken,
            });

            functionResults.push({
              functionResponse: {
                name: fc.name,
                response: result,
              },
            });
          }

          // Add the model's response and function results to the conversation
          currentMessages = [
            ...currentMessages,
            {
              role: 'model',
              parts: parts,
            },
            {
              role: 'user',
              parts: functionResults,
            },
          ];
        }

        if (!finalResponse) {
          finalResponse = 'I was able to analyze the repository but encountered an issue generating the final response. Please try again.';
        }

        return new Response(
          JSON.stringify({
            type: 'text',
            content: finalResponse,
            model: geminiModel,
          }),
          {
            status: 200,
            headers: {
              'Content-Type': 'application/json',
              'X-Route-Target': 'github',
              'X-Route-Reason': routeDecision.reason,
              'X-Model-Used': geminiModel,
            },
          }
        );
      } catch (error) {
        console.error('[Chat API] GitHub review error:', error);
        const fallbackModel = await getModelForTier('pro', 'gemini');
        return new Response(
          JSON.stringify({
            type: 'text',
            content: `I encountered an error while trying to review the repository: ${error instanceof Error ? error.message : 'Unknown error'}. Please make sure your GitHub is connected and try again.`,
            model: fallbackModel,
          }),
          {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      }
    }

    // Image generation has been removed - provide helpful response
    if (routeDecision.target === 'image' && !messageHasUploadedImages) {
      console.log('[Chat API] Image generation requested but feature is disabled');
      return new Response(
        JSON.stringify({
          type: 'text',
          content: `I'd love to help you create something visual! While image generation isn't available right now, I can help you with:

- **Detailed descriptions** of what your image could look like
- **Writing prompts** for other image generation tools
- **Building complete websites** with professional designs
- **Creating documents** like PDFs, spreadsheets, or presentations

What would you like me to help you with?`,
          model: 'claude-sonnet-4-5-20250929',
        }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'X-Route-Target': 'text',
            'X-Feature-Disabled': 'image-generation',
          },
        }
      );
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
    // Uses SLIM prompt by default, loads faith content from KB only when relevant
    const effectiveTool = tool;

    if (isAuthenticated) {
      // Start with slim core prompt (professional first, faith when asked)
      let slingshotPrompt = buildSlimSystemPrompt({
        includeVision: true,
        includeDocuments: true,
      });

      // Check if this is a faith topic that needs additional context
      if (isFaithTopic(lastUserContent)) {
        const categories = getRelevantCategories(lastUserContent);
        console.log(`[Chat API] Faith topic detected, loading KB categories: ${categories.join(', ')}`);

        // Load relevant knowledge base content
        const kbContent = await getKnowledgeBaseContent(categories);
        if (kbContent) {
          slingshotPrompt += '\n\n---\n\n## FAITH TOPIC CONTEXT\n\n' + kbContent;
        }
      }

      // Search user's uploaded documents for relevant context (RAG)
      console.log(`[Chat API] Starting RAG search for user ${rateLimitIdentifier}, query: "${lastUserContent.substring(0, 50)}..."`);
      try {
        const { contextString, results } = await searchUserDocuments(rateLimitIdentifier, lastUserContent, {
          matchCount: 5,
          matchThreshold: 0.1, // Very low threshold - will match almost anything
        });
        console.log(`[Chat API] RAG search returned ${results?.length || 0} results`);
        if (contextString) {
          console.log(`[Chat API] Adding document context to prompt (${contextString.length} chars)`);
          slingshotPrompt += '\n\n---\n\n' + contextString;
        } else {
          console.log(`[Chat API] No document context found for user ${rateLimitIdentifier}`);
        }
      } catch (docSearchError) {
        console.error('[Chat API] User document search failed:', docSearchError);
        // Don't fail the request if document search fails
      }

      // USER LEARNING: Inject learned preferences (lowest priority - style only)
      if (isLearningEnabled() && isAuthenticated && rateLimitIdentifier) {
        try {
          const learnedContext = await getLearnedContext(rateLimitIdentifier);
          if (learnedContext.promptInjection) {
            slingshotPrompt += learnedContext.promptInjection;
            console.log(`[Chat API] Injected ${learnedContext.preferences.length} learned preferences`);
          }
        } catch (learnError) {
          console.error('[Chat API] Learning context fetch failed:', learnError);
          // Don't fail the request if learning fails
        }
      }

      // GITHUB REPO CONTEXT: Add selected repo info for proactive assistance
      if (selectedRepo) {
        slingshotPrompt += buildRepoContextPrompt(selectedRepo);
        console.log(`[Chat API] Added GitHub repo context: ${selectedRepo.fullName}`);
      }

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

    // PHASE 2: Web search detection moved to Gemini path (uses native Google Search)
    // const lastUserText = getLastUserMessageText(messagesWithContext);
    // const willUseWebSearch = shouldUseWebSearch(effectiveTool as any, lastUserText);

    // ========================================
    // PERPLEXITY SEARCH (Provider-agnostic, except Gemini)
    // ========================================
    // Handle user-triggered search modes (Search and Fact Check buttons)
    // This runs BEFORE the provider check so it works for both OpenAI and Anthropic
    // IMPORTANT: Perplexity gets raw facts, then we post-process through main AI
    // to maintain platform integrity (Christian conservative perspective)
    // NOTE: Gemini uses native Google Search grounding instead of Perplexity
    if (searchMode && searchMode !== 'none' && isPerplexityConfigured() && activeProvider !== 'gemini') {
      console.log(`[Chat API] User triggered ${searchMode} mode (provider: ${activeProvider})`);

      try {
        let searchQuery = lastUserContent;
        let searchSystemPrompt = '';

        if (searchMode === 'search') {
          // Web search mode - search for current information
          searchSystemPrompt = `You are a helpful web search assistant. Search the web and provide accurate, up-to-date information with sources. Be concise but comprehensive.`;
        } else if (searchMode === 'factcheck') {
          // Fact check mode - verify claims and provide evidence
          searchSystemPrompt = `You are a fact-checking assistant. Your job is to verify the accuracy of the following claim or statement. Search for reliable sources and provide:
1. Whether the claim is TRUE, FALSE, PARTIALLY TRUE, or UNVERIFIABLE
2. The evidence supporting your assessment
3. Relevant sources and citations
Be objective and thorough in your fact-checking.`;
          searchQuery = `Fact check the following: ${lastUserContent}`;
        }

        const perplexityResult = await perplexitySearch({
          query: searchQuery,
          systemPrompt: searchSystemPrompt,
        });

        // Clean up Perplexity response (remove citation markers)
        const rawSearchContent = perplexityResult.answer
          .replace(/\[\d+\]/g, '')  // Remove [1], [2], etc.
          .replace(/\s{2,}/g, ' ')  // Clean up double spaces left behind
          .trim();

        console.log(`[Chat API] Perplexity ${searchMode} completed, post-processing through ${activeProvider}`);

        // ========================================
        // POST-PROCESS THROUGH MAIN AI
        // ========================================
        // Send Perplexity results through Anthropic/OpenAI with system prompt
        // to maintain platform integrity (Christian conservative perspective)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const platformSystemPrompt = getSystemPromptForTool(effectiveTool as any);

        const summaryPrompt = searchMode === 'factcheck'
          ? `The user asked to fact-check: "${lastUserContent}"

Here are the search results from the web:

${rawSearchContent}

Please summarize this fact-check from our platform's perspective. Present the facts accurately while maintaining our values. Be concise and helpful.`
          : `The user searched for: "${lastUserContent}"

Here are the search results from the web:

${rawSearchContent}

Please summarize this information from our platform's perspective. Present the facts accurately while maintaining our values. Be concise and helpful.`;

        // PHASE 3: Post-process search results through Claude Sonnet
        // Using Sonnet for search synthesis (research-level task)
        const result = await createClaudeChat({
          messages: [{ role: 'user', content: summaryPrompt }],
          systemPrompt: platformSystemPrompt,
          maxTokens: 2048,
          forceModel: 'sonnet', // Always use Sonnet for search synthesis
        });
        const finalContent = result.text;
        const modelUsed = result.model;
        console.log(`[Chat API] Search post-processed through Claude (${modelUsed})`);

        return new Response(
          JSON.stringify({
            type: 'text',
            content: finalContent,
            model: modelUsed,
          }),
          {
            status: 200,
            headers: {
              'Content-Type': 'application/json',
              'X-Model-Used': modelUsed,
              'X-Provider': 'claude',
              'X-Search-Mode': searchMode,
              'X-Web-Search': 'perplexity',
            },
          }
        );
      } catch (searchError) {
        console.error(`[Chat API] Perplexity ${searchMode} error:`, searchError);
        // Fall through to regular chat if search fails
      }
    }

    // ========================================
    // MAIN CHAT PATH - Claude Exclusive
    // ========================================
    // All text generation now uses Claude Haiku/Sonnet hybrid routing
    {
      console.log('[Chat API] Using Claude provider for user tier:', userTier);

      // Build system prompt using slim prompt + KB
      let baseSystemPrompt = 'You are a helpful AI assistant.';

      if (isAuthenticated) {
        // Start with slim core prompt (professional first, faith when asked)
        baseSystemPrompt = buildSlimSystemPrompt({
          includeVision: true,
          includeDocuments: true,
        });

        // Check if this is a faith topic that needs additional context
        if (isFaithTopic(lastUserContent)) {
          const categories = getRelevantCategories(lastUserContent);
          console.log(`[Chat API] Claude: Faith topic detected, loading KB categories: ${categories.join(', ')}`);

          // Load relevant knowledge base content
          const kbContent = await getKnowledgeBaseContent(categories);
          if (kbContent) {
            baseSystemPrompt += '\n\n---\n\n## FAITH TOPIC CONTEXT\n\n' + kbContent;
          }
        }

        // Search user's uploaded documents for relevant context (RAG)
        console.log(`[Chat API] Claude: Starting RAG search for user ${rateLimitIdentifier}`);
        try {
          const { contextString, results } = await searchUserDocuments(rateLimitIdentifier, lastUserContent, {
            matchCount: 5,
            matchThreshold: 0.1,
          });
          console.log(`[Chat API] Claude: RAG returned ${results?.length || 0} results`);
          if (contextString) {
            baseSystemPrompt += '\n\n---\n\n' + contextString;
          }
        } catch (docSearchError) {
          console.error('[Chat API] Claude: User document search failed:', docSearchError);
        }

        // USER LEARNING: Inject learned preferences (lowest priority - style only)
        if (isLearningEnabled() && rateLimitIdentifier) {
          try {
            const learnedContext = await getLearnedContext(rateLimitIdentifier);
            if (learnedContext.promptInjection) {
              baseSystemPrompt += learnedContext.promptInjection;
              console.log(`[Chat API] Claude: Injected ${learnedContext.preferences.length} learned preferences`);
            }
          } catch (learnError) {
            console.error('[Chat API] Claude: Learning context failed:', learnError);
          }
        }

        // GITHUB REPO CONTEXT: Add selected repo info for proactive assistance
        if (selectedRepo) {
          baseSystemPrompt += buildRepoContextPrompt(selectedRepo);
          console.log(`[Chat API] Claude: Added GitHub repo context: ${selectedRepo.fullName}`);
        }
      }

      // Build final system prompt
      const systemPrompt = isAuthenticated
        ? `${baseSystemPrompt}\n\nWhen providing information, cite sources when relevant and indicate when information may need to be verified.`
        : baseSystemPrompt;

      // ========================================
      // SPREADSHEET GATHERING (Ask questions first)
      // ========================================
      if (isInitialSpreadsheetRequest(lastUserContent)) {
        console.log('[Chat API] Claude: Initial spreadsheet request - asking qualifying questions');

        const spreadsheetGatheringPrompt = `${systemPrompt}

SPREADSHEET REQUEST DETECTED: The user wants to create a spreadsheet/Excel file.
Before generating the file, ask 2-3 brief qualifying questions to understand their needs:

1. What specific categories or data do they want to track?
2. What time period (weekly, monthly, yearly)?
3. Any specific calculations or totals needed?

Keep your questions concise and professional. After they provide details, you can generate the spreadsheet.
Do NOT show a markdown table - just ask the questions conversationally.`;

        // PHASE 3: Use Claude Haiku for quick qualifying questions
        const gatherResult = await createClaudeChat({
          messages: messagesWithContext,
          systemPrompt: spreadsheetGatheringPrompt,
          maxTokens: 500,
          temperature: 0.7,
          forceModel: 'haiku', // Quick questions use Haiku
        });

        return new Response(
          JSON.stringify({
            content: gatherResult.text,
            model: gatherResult.model,
            provider: 'claude',
          }),
          {
            status: 200,
            headers: {
              'Content-Type': 'application/json',
              'X-Model-Used': gatherResult.model,
              'X-Provider': 'claude',
            },
          }
        );
      }

      // ========================================
      // QR CODE PDF GENERATION
      // ========================================
      // Special handling for QR codes - uses {{QR:url:count}} syntax
      const qrDocType = detectNativeDocumentRequest(lastUserContent, messagesWithContext);
      if (qrDocType === 'qrcode' && isAuthenticated) {
        console.log('[Chat API] Claude: QR Code PDF generation');

        try {
          // Extract URL/data and count from user message
          const urlMatch = lastUserContent.match(/(?:https?:\/\/[^\s]+|www\.[^\s]+)/i);
          const countMatch = lastUserContent.match(/(\d+)\s*(?:qr\s*code|copies|times)/i);

          // Get URL from message or ask for it
          let qrUrl = urlMatch ? urlMatch[0] : null;
          let qrCount = countMatch ? parseInt(countMatch[1]) : 1;
          qrCount = Math.min(Math.max(qrCount, 1), 20); // 1-20 codes

          if (!qrUrl) {
            // No URL found - ask AI to extract it from context or ask user
            // PHASE 3: Use Claude Haiku for quick extraction
            const result = await createClaudeChat({
              messages: messagesWithContext,
              systemPrompt: `${systemPrompt}\n\nThe user wants to create a QR code. Extract the URL or data they want in the QR code from the conversation. If no URL is specified, ask them to provide one. Respond briefly.`,
              maxTokens: 500,
              temperature: 0.3,
              forceModel: 'haiku', // Quick extraction uses Haiku
            });

            // Check if response contains a URL
            const extractedUrl = result.text.match(/(?:https?:\/\/[^\s]+|www\.[^\s]+)/i);
            if (extractedUrl) {
              qrUrl = extractedUrl[0];
            } else {
              // Return the AI's response asking for URL
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
                    'X-Provider': 'claude',
                  },
                }
              );
            }
          }

          // Create PDF content with QR code syntax
          const qrPdfContent = `# QR Code\n\n{{QR:${qrUrl}:${qrCount}}}\n\nScan this QR code to visit:\n${qrUrl}`;

          // Call document generator
          const docResponse = await fetch(
            `${process.env.NEXT_PUBLIC_SITE_URL || 'https://jcil.ai'}/api/documents/generate`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Cookie': request.headers.get('cookie') || '',
              },
              body: JSON.stringify({
                content: qrPdfContent,
                title: 'QR Code',
                format: 'pdf',
              }),
            }
          );

          if (docResponse.ok) {
            const docResult = await docResponse.json();
            console.log('[Chat API] Claude: QR Code PDF generated:', docResult.filename);

            const responseText = qrCount > 1
              ? `I've created a PDF with ${qrCount} QR codes for ${qrUrl}. You can download it below.`
              : `I've created a QR code PDF for ${qrUrl}. You can download it below.`;

            return new Response(
              JSON.stringify({
                type: 'text',
                content: responseText,
                model: 'claude-haiku-4-5-20250929',
                documentDownload: {
                  url: docResult.downloadUrl || docResult.dataUrl,
                  filename: docResult.filename,
                  format: 'pdf',
                  title: 'QR Code',
                },
              }),
              {
                status: 200,
                headers: {
                  'Content-Type': 'application/json',
                  'X-Model-Used': 'claude-haiku-4-5-20250929',
                  'X-Provider': 'claude',
                  'X-Document-Type': 'qrcode',
                  'X-Document-Format': 'pdf',
                },
              }
            );
          } else {
            const errorText = await docResponse.text();
            console.error('[Chat API] Claude: QR PDF generation error:', errorText);
          }
        } catch (qrError) {
          console.error('[Chat API] Claude: QR Code generation error:', qrError);
        }
        // Fall through to regular chat if QR generation fails
      }

      // ========================================
      // NATIVE DOCUMENT GENERATION (Structured Outputs → DOCX/XLSX)
      // ========================================
      // Uses Claude's structured outputs feature for guaranteed valid JSON
      const nativeDocType = detectNativeDocumentRequest(lastUserContent, messagesWithContext);
      if (nativeDocType && nativeDocType !== 'qrcode' && isAuthenticated) {
        console.log(`[Chat API] Claude: Structured document generation: ${nativeDocType}`);
        // Type assertion - we've already excluded 'qrcode' above
        const structuredDocType = nativeDocType as 'resume' | 'spreadsheet' | 'document' | 'invoice';

        try {
          // Build schema for structured output
          const docSchema = {
            type: 'object',
            properties: {
              title: { type: 'string' },
              content: { type: 'string' },
              sections: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    heading: { type: 'string' },
                    content: { type: 'string' },
                  },
                },
              },
            },
          };

          // Use Claude's structured outputs
          const result = await createClaudeStructuredOutput({
            messages: messagesWithContext,
            systemPrompt: `${systemPrompt}\n\nGenerate structured content for a ${structuredDocType}. Return valid JSON only.`,
            schema: docSchema,
          });

          console.log(`[Chat API] Claude: Structured output received for ${nativeDocType}`);

          // Call the native document generation API with the structured data
          const docResponse = await fetch(
            `${process.env.NEXT_PUBLIC_SITE_URL || 'https://jcil.ai'}/api/documents/native`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Cookie': request.headers.get('cookie') || '',
              },
              body: JSON.stringify({
                documentData: result.data,
                returnType: 'url',
              }),
            }
          );

          if (docResponse.ok) {
            const docResult = await docResponse.json();
            console.log(`[Chat API] Claude: Native document generated: ${docResult.filename}`);

            // Return response with document download link
            const docTypeNames: Record<string, string> = {
              resume: 'resume',
              spreadsheet: 'spreadsheet',
              document: 'document',
              invoice: 'invoice',
            };
            const responseText = `I've created your ${docTypeNames[nativeDocType] || 'document'}. You can download it below.`;

            return new Response(
              JSON.stringify({
                type: 'text',
                content: responseText,
                model: result.model,
                documentDownload: {
                  url: docResult.downloadUrl || docResult.dataUrl,
                  filename: docResult.filename,
                  format: docResult.format,
                  title: docResult.title,
                },
              }),
              {
                status: 200,
                headers: {
                  'Content-Type': 'application/json',
                  'X-Model-Used': result.model,
                  'X-Provider': 'claude',
                  'X-Document-Type': nativeDocType,
                  'X-Document-Format': docResult.format,
                },
              }
            );
          } else {
            const errorText = await docResponse.text();
            console.error('[Chat API] Claude: Document API error:', errorText);
            // Return error message to user
            return new Response(
              JSON.stringify({
                type: 'text',
                content: `I created the document data but there was an error generating the file: ${errorText}. Please try again.`,
                model: result.model,
              }),
              {
                status: 200,
                headers: {
                  'Content-Type': 'application/json',
                  'X-Model-Used': result.model,
                  'X-Provider': 'claude',
                },
              }
            );
          }
        } catch (structuredError) {
          console.error('[Chat API] Claude: Structured output error:', structuredError);
          // Fall through to legacy document generation (PDF fallback)
        }
      }

      // ========================================
      // LEGACY DOCUMENT GENERATION (PDF fallback)
      // ========================================
      // Check if document generation is requested (Excel, PowerPoint, Word, PDF)
      // Generate PDF versions for document requests
      const documentType = detectDocumentRequest(lastUserContent);
      if (documentType && isAuthenticated) {
        console.log(`[Chat API] Claude: Legacy document request detected: ${documentType}`);

        // Get the comprehensive document formatting prompt
        const documentFormattingInstructions = getDocumentFormattingPrompt(documentType);

        // For Excel/PPT/Word requests, instruct AI to create content for PDF
        const docTypeNames: Record<string, string> = {
          xlsx: 'spreadsheet',
          pptx: 'presentation',
          docx: 'document',
          pdf: 'PDF',
        };
        const docName = docTypeNames[documentType] || 'document';

        // Add instruction to format content for PDF generation
        const pdfFormatInstruction = documentType !== 'pdf' ? `
IMPORTANT: Since you cannot create native ${docName} files, format your response for PDF output instead:
- Use clear markdown formatting
- Use tables (| col1 | col2 |) for spreadsheet-like data
- Use headers (## and ###) for sections
- The content will be converted to a professional PDF document` : '';

        const enhancedSystemPrompt = `${systemPrompt}\n\n${documentFormattingInstructions}${pdfFormatInstruction}`;

        // Use non-streaming for document generation (need full content for PDF)
        // PHASE 3: Document generation with Claude Sonnet
        const result = await createClaudeChat({
          messages: messagesWithContext,
          systemPrompt: enhancedSystemPrompt,
          maxTokens: clampedMaxTokens,
          temperature,
          forceModel: 'sonnet', // Always use Sonnet for document generation
        });

        return new Response(
          JSON.stringify({
            type: 'text',
            content: result.text,
            model: result.model,
            documentGeneration: true,
            documentType: 'pdf',
          }),
          {
            status: 200,
            headers: {
              'Content-Type': 'application/json',
              'X-Model-Used': result.model,
              'X-Provider': 'claude',
              'X-Document-Type': 'pdf',
            },
          }
        );
      }

      // ========================================
      // REGULAR CHAT (Claude Hybrid Streaming)
      // ========================================
      // Claude hybrid routing: Haiku for simple queries, Sonnet for complex
      // Auto-selects based on query complexity, faith topics, research needs
      const isFaithQuery = isFaithTopic(lastUserContent);

      // Apply system prompt truncation to prevent context overflow
      const finalSystemPrompt = truncateSystemPrompt(systemPrompt);

      const streamResult = await createClaudeStreamingChat({
        messages: messagesWithContext,
        systemPrompt: finalSystemPrompt,
        maxTokens: clampedMaxTokens,
        temperature,
        isFaithTopic: isFaithQuery, // Force Sonnet for faith topics
      });

      // If task plan exists, prepend it to the stream
      const responseStream = taskPlanText
        ? prependToStream(taskPlanText, streamResult.stream)
        : streamResult.stream;

      return new Response(responseStream, {
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'Transfer-Encoding': 'chunked',
          'X-Model-Used': streamResult.model,
          'X-Provider': 'claude',
          'X-Faith-Topic': isFaithQuery ? 'true' : 'false',
          ...(taskPlanText ? { 'X-Task-Plan': 'true' } : {}),
        },
      });
    }
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
export const maxDuration = 300; // Allow up to 300 seconds for complex AI responses with large context
