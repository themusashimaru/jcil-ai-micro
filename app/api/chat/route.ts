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
import { moderateContent } from '@/lib/openai/moderation';
import { generateImageWithFallback, ImageSize } from '@/lib/openai/images';
import { buildSlimSystemPrompt, isFaithTopic, getRelevantCategories } from '@/lib/prompts/slimPrompt';
import { getKnowledgeBaseContent } from '@/lib/knowledge/knowledgeBase';
import { searchUserDocuments } from '@/lib/documents/userSearch';
import { getSystemPromptForTool, getAnthropicSearchOverride, getGeminiSearchGuidance } from '@/lib/openai/tools';
import { canMakeRequest, getTokenUsage, getTokenLimitWarningMessage, incrementImageUsage, getImageLimitWarningMessage } from '@/lib/limits';
import { decideRoute, logRouteDecision, parseSizeFromText } from '@/lib/routing/decideRoute';
import { createPendingRequest, completePendingRequest } from '@/lib/pending-requests';
import { getProviderSettings, Provider, getModelForTier, getDeepSeekReasoningModel } from '@/lib/provider/settings';
import {
  createAnthropicCompletion,
  createAnthropicStreamingCompletion,
  createAnthropicCompletionWithSearch,
  createAnthropicCompletionWithSkills,
  detectDocumentRequest,
} from '@/lib/anthropic/client';
import {
  createXAICompletion,
  createXAIStreamingCompletion,
} from '@/lib/xai/client';
import {
  createDeepSeekCompletion,
  createDeepSeekStreamingCompletion,
} from '@/lib/deepseek/client';
import {
  createGeminiCompletion,
  createGeminiStreamingCompletion,
  createGeminiStructuredCompletion,
  getDocumentSchema,
  getDocumentSchemaDescription,
} from '@/lib/gemini/client';
import { perplexitySearch, isPerplexityConfigured } from '@/lib/perplexity/client';
import { acquireSlot, releaseSlot, generateRequestId } from '@/lib/queue';
// Brave Search no longer needed - using native Anthropic web search
// import { braveSearch } from '@/lib/brave/search';
import { NextRequest } from 'next/server';
import { CoreMessage, generateText } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import crypto from 'crypto';
import { analyzeRequest, isTaskPlanningEnabled } from '@/lib/taskPlanner';
import { executeTaskPlan, isSequentialExecutionEnabled, CheckpointState } from '@/lib/taskPlanner/executor';
import { getLearnedContext, extractAndLearn, isLearningEnabled } from '@/lib/learning/userLearning';
import { orchestrateAgents, shouldUseOrchestration, isOrchestrationEnabled } from '@/lib/agents/orchestrator';
import { isConnectorsEnabled } from '@/lib/connectors';

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

/**
 * Get prompt for native document generation (JSON output)
 * This instructs the AI to output structured JSON that can be converted to real files
 */
function getNativeDocumentPrompt(docType: 'resume' | 'spreadsheet' | 'document' | 'invoice'): string {
  const basePrompt = `
## NATIVE DOCUMENT GENERATION

You are generating a real, downloadable document. Output ONLY valid JSON that matches the schema below.

**CRITICAL RULES:**
- Output ONLY the JSON - no explanatory text, commentary, or descriptions
- Do NOT add any text before the JSON code block
- Do NOT add any text after the JSON code block (no "This resume includes...", "I've created...", etc.)
- Do NOT explain what you made or provide tips
- The ENTIRE response should be the JSON code block and nothing else

IMPORTANT: Wrap your JSON response in \`\`\`json code blocks like this:
\`\`\`json
{
  "type": "...",
  ...
}
\`\`\`
`;

  const schemas: Record<string, string> = {
    resume: `
### RESUME JSON SCHEMA

Output a JSON object with this structure:
{
  "type": "resume",
  "name": "Full Name",
  "contact": {
    "phone": "(555) 123-4567",
    "email": "email@example.com",
    "linkedin": "linkedin.com/in/username",
    "location": "City, State"
  },
  "summary": "Brief professional summary (2-3 sentences)",
  "experience": [
    {
      "title": "Job Title",
      "company": "Company Name",
      "location": "City, State",
      "startDate": "Month Year",
      "endDate": "Month Year or Present",
      "bullets": [
        "Achievement with quantified results",
        "Another accomplishment"
      ]
    }
  ],
  "education": [
    {
      "degree": "Degree Name",
      "school": "University Name",
      "location": "City, State",
      "graduationDate": "Month Year",
      "gpa": "3.8/4.0",
      "honors": ["Dean's List", "Cum Laude"]
    }
  ],
  "skills": ["Skill 1", "Skill 2", "Skill 3"],
  "certifications": [
    {
      "name": "Certification Name",
      "issuer": "Issuing Organization",
      "date": "Month Year"
    }
  ]
}

RESUME TIPS:
- Use strong action verbs (Led, Developed, Increased, Managed)
- Quantify achievements where possible (increased sales by 40%)
- Keep bullets concise and impactful
- Tailor content to the job/industry if specified
`,
    spreadsheet: `
### SPREADSHEET JSON SCHEMA

Output a JSON object with this structure:
{
  "type": "spreadsheet",
  "title": "Spreadsheet Title",
  "sheets": [
    {
      "name": "Sheet1",
      "rows": [
        {
          "isHeader": true,
          "cells": [
            { "value": "Column A Header" },
            { "value": "Column B Header", "alignment": "right" }
          ]
        },
        {
          "cells": [
            { "value": "Data" },
            { "value": 1234.56, "currency": true, "alignment": "right" }
          ]
        },
        {
          "cells": [
            { "value": "Total", "bold": true },
            { "formula": "=SUM(B2:B10)", "currency": true, "bold": true, "alignment": "right" }
          ]
        }
      ],
      "freezeRow": 1,
      "columnWidths": [30, 15, 15]
    }
  ],
  "format": {
    "alternatingRowColors": true,
    "headerColor": "#1e3a5f"
  }
}

CELL OPTIONS:
- value: string or number
- bold: true/false
- italic: true/false
- currency: true (formats as $X,XXX.XX)
- percent: true (formats as XX.XX%)
- formula: Excel formula (e.g., "=SUM(A1:A10)")
- backgroundColor: hex color
- textColor: hex color
- alignment: "left", "center", or "right"

SPREADSHEET TIPS:
- Use formulas for calculations (=SUM, =AVERAGE, etc.)
- Include totals rows for financial data
- Use currency formatting for money values
- Freeze the header row for easy scrolling
`,
    document: `
### WORD DOCUMENT JSON SCHEMA

Output a JSON object with this structure:
{
  "type": "document",
  "title": "Document Title",
  "sections": [
    {
      "type": "paragraph",
      "content": {
        "text": "Paragraph text here",
        "style": "title",
        "alignment": "center"
      }
    },
    {
      "type": "paragraph",
      "content": {
        "text": "Section Heading",
        "style": "heading1"
      }
    },
    {
      "type": "paragraph",
      "content": {
        "text": "Body paragraph text",
        "style": "normal"
      }
    },
    {
      "type": "paragraph",
      "content": {
        "text": "Bullet item",
        "bulletLevel": 1
      }
    },
    {
      "type": "table",
      "content": {
        "headers": ["Column 1", "Column 2"],
        "rows": [
          ["Data 1", "Data 2"],
          ["Data 3", "Data 4"]
        ]
      }
    },
    {
      "type": "pageBreak"
    },
    {
      "type": "horizontalRule"
    }
  ],
  "format": {
    "fontFamily": "Calibri",
    "fontSize": 11,
    "headerText": "Document Header",
    "footerText": "Page Footer"
  }
}

PARAGRAPH STYLES:
- "title": Large centered title
- "subtitle": Subtitle text
- "heading1", "heading2", "heading3": Section headings
- "normal": Regular paragraph text

PARAGRAPH OPTIONS:
- bold: true/false
- italic: true/false
- alignment: "left", "center", "right", "justify"
- bulletLevel: 1, 2, 3 (for bullet points)
`,
    invoice: `
### INVOICE JSON SCHEMA

Output a JSON object with this structure:
{
  "type": "invoice",
  "invoiceNumber": "INV-2024-001",
  "date": "January 15, 2024",
  "dueDate": "February 15, 2024",
  "from": {
    "name": "Your Business Name",
    "address": ["123 Business St", "City, State 12345"],
    "phone": "(555) 123-4567",
    "email": "billing@business.com"
  },
  "to": {
    "name": "Client Name",
    "address": ["456 Client Ave", "City, State 67890"],
    "phone": "(555) 987-6543",
    "email": "client@example.com"
  },
  "items": [
    {
      "description": "Service or Product Description",
      "quantity": 2,
      "unitPrice": 100.00,
      "total": 200.00
    }
  ],
  "subtotal": 200.00,
  "taxRate": 8.25,
  "tax": 16.50,
  "total": 216.50,
  "notes": "Thank you for your business!",
  "paymentTerms": "Net 30",
  "format": {
    "primaryColor": "#1e3a5f",
    "currency": "USD"
  }
}

INVOICE TIPS:
- Calculate totals accurately (subtotal, tax, total)
- Include clear item descriptions
- Specify payment terms
- Add notes for special instructions
`
  };

  return basePrompt + (schemas[docType] || schemas.document);
}

/**
 * Detect if user is requesting a NATIVE document (for JSON generation)
 * This is separate from detectDocumentRequest which is for the old markdown approach
 *
 * IMPORTANT: Only triggers on EXPLICIT download requests, not initial content requests.
 * This allows the two-step flow: 1) Show content for review, 2) Generate document on confirmation.
 *
 * Triggers on:
 * - Explicit format requests: "create a PDF resume", "make word document", "generate xlsx"
 * - Download language: "download as docx", "give me the pdf"
 * - Confirmation + format: "yes make it a pdf", "looks good create the document"
 *
 * Does NOT trigger on:
 * - Generic requests: "create a resume for me" (lets AI show content first)
 * - Questions: "can you make a resume?"
 */
/**
 * Check if user is confirming they want to generate a spreadsheet
 * after AI has asked qualifying questions
 */
function isSpreadsheetConfirmation(content: string, previousMessages: CoreMessage[]): boolean {
  const lowerContent = content.toLowerCase();

  // Confirmation patterns - short affirmative responses
  const isConfirmation = /\b(yes|yep|yeah|sure|ok|okay|please|go\s*ahead|looks?\s*good|perfect|great|that'?s?\s*(good|great|perfect|it)|generate\s*it|create\s*it|make\s*it|do\s*it)\b/.test(lowerContent);

  // Check if there's explicit spreadsheet generation request
  const hasExplicitGenerate = /\b(generate|create|make|download)\s*(the|my|a)?\s*(spreadsheet|excel|file|xlsx)\b/.test(lowerContent);

  if (hasExplicitGenerate) {
    return true;
  }

  if (!isConfirmation) {
    return false;
  }

  // Check if previous assistant message was asking about spreadsheet details
  const lastAssistantMessage = [...previousMessages].reverse().find(m => m.role === 'assistant');
  if (lastAssistantMessage && typeof lastAssistantMessage.content === 'string') {
    const assistantContent = lastAssistantMessage.content.toLowerCase();
    // Check if assistant was discussing spreadsheet and asking questions
    const wasDiscussingSpreadsheet = /\b(spreadsheet|excel|budget|categories|columns|rows|worksheet)\b/.test(assistantContent);
    const wasAskingQuestions = /\?|would you like|what.*include|which.*categories|how.*organize/.test(assistantContent);

    if (wasDiscussingSpreadsheet && wasAskingQuestions) {
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

/**
 * Detect if user wants image generation (Nano Banana)
 *
 * Triggers on:
 * - Image/picture requests: "create an image of", "generate a picture", "draw me"
 * - Slide/presentation requests: "make a slide", "create a powerpoint", "slide deck"
 *
 * Returns the type of image generation request
 */
function detectImageGenerationRequest(content: string): 'image' | 'slide' | null {
  const lowerContent = content.toLowerCase();

  // Image/picture detection - explicit creation requests
  const imagePatterns = [
    /\b(create|make|generate|draw|design)\s+(an?\s+)?(image|picture|illustration|artwork|graphic|visual)/i,
    /\b(image|picture|illustration|artwork|graphic|visual)\s+(of|for|showing|depicting)/i,
    /\bgive\s+me\s+(an?\s+)?(image|picture)/i,
    /\bdraw\s+me\b/i,
    /\bdesign\s+(an?\s+)?(logo|banner|poster|flyer)/i,
  ];

  for (const pattern of imagePatterns) {
    if (pattern.test(lowerContent)) {
      return 'image';
    }
  }

  // Slide/presentation detection
  const slidePatterns = [
    /\b(create|make|generate|build)\s+(a\s+)?(slide|powerpoint|presentation|deck|ppt)/i,
    /\b(slide\s*deck|power\s*point|presentation)\b/i,
    /\bslide\s+(for|about|on|showing)/i,
    /\bppt\s+(for|about|on)/i,
  ];

  for (const pattern of slidePatterns) {
    if (pattern.test(lowerContent)) {
      return 'slide';
    }
  }

  return null;
}

/**
 * Extract JSON document data from AI response
 * Looks for JSON wrapped in ```json code blocks
 */
function extractDocumentJSON(response: string): { json: unknown; cleanResponse: string } | null {
  // Look for ```json ... ``` blocks
  const jsonBlockMatch = response.match(/```json\s*([\s\S]*?)```/);
  if (jsonBlockMatch) {
    try {
      const json = JSON.parse(jsonBlockMatch[1].trim());
      // Validate it has a type field
      if (json && typeof json === 'object' && 'type' in json) {
        const validTypes = ['resume', 'spreadsheet', 'document', 'invoice'];
        if (validTypes.includes(json.type)) {
          // Remove the JSON block from the response for display
          const cleanResponse = response
            .replace(/```json[\s\S]*?```/g, '')
            .trim();
          return { json, cleanResponse };
        }
      }
    } catch {
      // Not valid JSON, continue
    }
  }

  // Also try to find raw JSON object (fallback)
  const jsonObjectMatch = response.match(/\{[\s\S]*"type"\s*:\s*"(resume|spreadsheet|document|invoice)"[\s\S]*\}/);
  if (jsonObjectMatch) {
    try {
      const json = JSON.parse(jsonObjectMatch[0]);
      const cleanResponse = response.replace(jsonObjectMatch[0], '').trim();
      return { json, cleanResponse };
    } catch {
      // Not valid JSON
    }
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
    const { messages, tool, temperature, max_tokens, userContext, conversationId, searchMode, reasoningMode, selectedRepo } = body;

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

    // Get provider settings early to determine moderation strategy
    const providerSettings = await getProviderSettings();
    const activeProvider: Provider = providerSettings.activeProvider;

    // Moderate user messages (skip for Gemini - uses native safety settings)
    const lastMessage = messages[messages.length - 1];
    if (lastMessage && lastMessage.role === 'user' && activeProvider !== 'gemini') {
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

    if (isTaskPlanningEnabled() && lastUserContent) {
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
    // PROVIDER CHECK - Already fetched earlier for moderation decision
    // ========================================
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
            model: activeProvider === 'anthropic' ? 'claude-sonnet-4-5-20250929' : 'gpt-5-mini',
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
          model: 'claude-sonnet-4-5-20250929',
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

    // Check if we should route to website/landing page generation
    if (routeDecision.target === 'website') {
      console.log('[Chat API] Routing to website generation');

      // System prompt for generating landing page HTML
      const websiteSystemPrompt = `You are an expert web developer. Generate a complete, single-file HTML landing page based on the user's request.

IMPORTANT RULES:
1. Output ONLY the HTML code - no explanations, no markdown code blocks
2. Include all CSS in a <style> tag in the <head>
3. Include any JavaScript in a <script> tag at the end of the <body>
4. Use modern, responsive design with Tailwind-like utility patterns
5. Include beautiful gradients, shadows, and modern typography
6. Make it mobile-responsive
7. Include realistic placeholder content (not lorem ipsum)
8. Add smooth animations and hover effects
9. Use a professional color scheme appropriate for the business type

The HTML should be ready to render directly in an iframe.`;

      try {
        // Create OpenAI provider for website generation
        const openaiProvider = createOpenAI({
          apiKey: process.env.OPENAI_API_KEY,
        });

        // Generate the landing page HTML
        const result = await generateText({
          model: openaiProvider('gpt-4o'),
          system: websiteSystemPrompt,
          prompt: lastUserContent,
          temperature: 0.7,
          maxOutputTokens: 8000,
        });

        const generatedCode = result.text || '';

        // Clean the code - remove markdown code blocks if present
        let cleanCode = generatedCode.trim();
        if (cleanCode.startsWith('```html')) {
          cleanCode = cleanCode.slice(7);
        }
        if (cleanCode.startsWith('```')) {
          cleanCode = cleanCode.slice(3);
        }
        if (cleanCode.endsWith('```')) {
          cleanCode = cleanCode.slice(0, -3);
        }
        cleanCode = cleanCode.trim();

        // Extract title from the HTML
        const titleMatch = cleanCode.match(/<title>([^<]+)<\/title>/i);
        const title = titleMatch ? titleMatch[1] : 'Landing Page';

        return new Response(
          JSON.stringify({
            type: 'code_preview',
            content: `**${title}**\n\nI've generated a complete landing page for you. Click "Open Preview" to see it live, or copy the code to use in your project.\n\n*Tip: You can ask me to modify colors, add sections, or change the layout!*`,
            model: 'gpt-4o',
            codePreview: {
              code: cleanCode,
              language: 'html',
              title: title,
              description: `Generated from: ${lastUserContent.slice(0, 100)}${lastUserContent.length > 100 ? '...' : ''}`,
            },
          }),
          {
            status: 200,
            headers: {
              'Content-Type': 'application/json',
              'X-Route-Target': 'website',
              'X-Route-Reason': routeDecision.reason,
            },
          }
        );
      } catch (error) {
        console.error('[Chat API] Website generation error:', error);
        return new Response(
          JSON.stringify({
            type: 'text',
            content: 'Sorry, I encountered an error generating the website. Please try again.',
            model: 'gpt-4o',
          }),
          { status: 500 }
        );
      }
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

    // Check if web search will be triggered - this always uses gpt-5-mini
    const lastUserText = getLastUserMessageText(messagesWithContext);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const willUseWebSearch = shouldUseWebSearch(effectiveTool as any, lastUserText);

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

        let finalContent = '';
        let modelUsed = '';

        if (activeProvider === 'anthropic') {
          // Post-process through Anthropic
          const anthropicModel = await getModelForTier(userTier);
          const result = await createAnthropicCompletion({
            messages: [{ role: 'user', content: summaryPrompt }],
            model: anthropicModel,
            maxTokens: 2048,
            systemPrompt: platformSystemPrompt,
          });
          finalContent = result.text;
          modelUsed = result.model;
          console.log(`[Chat API] Search post-processed through Anthropic (${modelUsed})`);
        } else if (activeProvider === 'xai') {
          // Post-process through xAI (Grok)
          const xaiModel = await getModelForTier(userTier, 'xai');
          const result = await createXAICompletion({
            messages: [{ role: 'user', content: summaryPrompt }],
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            model: xaiModel as any,
            maxTokens: 2048,
            systemPrompt: platformSystemPrompt,
          });
          finalContent = result.text;
          modelUsed = result.model;
          console.log(`[Chat API] Search post-processed through xAI (${modelUsed})`);
        } else if (activeProvider === 'deepseek') {
          // Post-process through DeepSeek
          const deepseekModel = await getModelForTier(userTier, 'deepseek');
          const result = await createDeepSeekCompletion({
            messages: [{ role: 'user', content: summaryPrompt }],
            model: deepseekModel as 'deepseek-chat' | 'deepseek-reasoner',
            maxTokens: 2048,
            systemPrompt: platformSystemPrompt,
            reasoning: false, // Don't use reasoning for search post-processing
          });
          finalContent = result.text;
          modelUsed = result.model;
          console.log(`[Chat API] Search post-processed through DeepSeek (${modelUsed})`);
        } else {
          // Post-process through OpenAI
          // NOTE: Gemini uses native Google Search grounding, so it never enters this section
          const openaiModel = await getModelForTier(userTier);
          const result = await createChatCompletion({
            messages: [
              { role: 'system', content: platformSystemPrompt },
              { role: 'user', content: summaryPrompt },
            ],
            stream: false,
            maxTokens: 2048,
            modelOverride: openaiModel,
          });
          finalContent = await result.text;
          modelUsed = openaiModel;
          console.log(`[Chat API] Search post-processed through OpenAI (${modelUsed})`);
        }

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
              'X-Provider': activeProvider,
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
    // ANTHROPIC PATH - Claude (tier-specific model)
    // ========================================
    if (activeProvider === 'anthropic') {
      // IMPORTANT: Disable auto-search for Anthropic
      // Search ONLY happens via explicit Search/Fact Check buttons
      const willUseWebSearch = false;

      // Get tier-specific model (uses provider settings with tier lookup)
      const anthropicModel = await getModelForTier(userTier);
      console.log('[Chat API] Using Anthropic provider with model:', anthropicModel, 'for tier:', userTier);

      // Build Anthropic system prompt using slim prompt + KB
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
          console.log(`[Chat API] Anthropic: Faith topic detected, loading KB categories: ${categories.join(', ')}`);

          // Load relevant knowledge base content
          const kbContent = await getKnowledgeBaseContent(categories);
          if (kbContent) {
            baseSystemPrompt += '\n\n---\n\n## FAITH TOPIC CONTEXT\n\n' + kbContent;
          }
        }

        // Search user's uploaded documents for relevant context (RAG)
        console.log(`[Chat API] Anthropic: Starting RAG search for user ${rateLimitIdentifier}`);
        try {
          const { contextString, results } = await searchUserDocuments(rateLimitIdentifier, lastUserContent, {
            matchCount: 5,
            matchThreshold: 0.1,
          });
          console.log(`[Chat API] Anthropic: RAG returned ${results?.length || 0} results`);
          if (contextString) {
            baseSystemPrompt += '\n\n---\n\n' + contextString;
          }
        } catch (docSearchError) {
          console.error('[Chat API] Anthropic: User document search failed:', docSearchError);
        }

        // USER LEARNING: Inject learned preferences (lowest priority - style only)
        if (isLearningEnabled() && rateLimitIdentifier) {
          try {
            const learnedContext = await getLearnedContext(rateLimitIdentifier);
            if (learnedContext.promptInjection) {
              baseSystemPrompt += learnedContext.promptInjection;
              console.log(`[Chat API] Anthropic: Injected ${learnedContext.preferences.length} learned preferences`);
            }
          } catch (learnError) {
            console.error('[Chat API] Anthropic: Learning context failed:', learnError);
          }
        }

        // GITHUB REPO CONTEXT: Add selected repo info for proactive assistance
        if (selectedRepo) {
          baseSystemPrompt += buildRepoContextPrompt(selectedRepo);
          console.log(`[Chat API] Anthropic: Added GitHub repo context: ${selectedRepo.fullName}`);
        }
      }

      // Add Anthropic-specific search guidance (guides users to Search/Fact Check buttons)
      const systemPrompt = isAuthenticated
        ? `${baseSystemPrompt}\n\n${getAnthropicSearchOverride()}`
        : baseSystemPrompt;

      // ========================================
      // SPREADSHEET GATHERING (Ask questions first)
      // ========================================
      // For initial spreadsheet requests, ask qualifying questions before generating
      if (isInitialSpreadsheetRequest(lastUserContent)) {
        console.log('[Chat API] Initial spreadsheet request - asking qualifying questions');

        const spreadsheetGatheringPrompt = `${systemPrompt}

SPREADSHEET REQUEST DETECTED: The user wants to create a spreadsheet/Excel file.
Before generating the file, ask 2-3 brief qualifying questions to understand their needs:

1. What specific categories or data do they want to track?
2. What time period (weekly, monthly, yearly)?
3. Any specific calculations or totals needed?

Keep your questions concise and professional. After they provide details, you can generate the spreadsheet.
Do NOT show a markdown table - just ask the questions conversationally.`;

        const gatherResult = await createAnthropicCompletion({
          messages: messagesWithContext,
          model: anthropicModel,
          maxTokens: 500,
          temperature: 0.7,
          systemPrompt: spreadsheetGatheringPrompt,
          userId: isAuthenticated ? rateLimitIdentifier : undefined,
          planKey: userTier,
        });

        return new Response(
          JSON.stringify({
            content: gatherResult.text,
            model: anthropicModel,
            provider: 'anthropic',
          }),
          {
            status: 200,
            headers: {
              'Content-Type': 'application/json',
              'X-Model-Used': anthropicModel,
              'X-Provider': 'anthropic',
            },
          }
        );
      }

      // ========================================
      // NATIVE DOCUMENT GENERATION (NEW: JSON → DOCX/XLSX)
      // ========================================
      // Check for native document requests first (resume, spreadsheet, invoice, document)
      const nativeDocType = detectNativeDocumentRequest(lastUserContent, messagesWithContext);
      // QR codes handled separately (Gemini provider)
      if (nativeDocType && nativeDocType !== 'qrcode' && isAuthenticated) {
        console.log(`[Chat API] Native document generation: ${nativeDocType}`);
        const structuredDocType = nativeDocType as 'resume' | 'spreadsheet' | 'document' | 'invoice';

        try {
          // Get the JSON schema prompt for the document type
          const nativeDocPrompt = getNativeDocumentPrompt(structuredDocType);
          const enhancedSystemPrompt = `${systemPrompt}\n\n${nativeDocPrompt}`;

          // Get AI to generate structured JSON
          const result = await createAnthropicCompletion({
            messages: messagesWithContext,
            model: anthropicModel,
            maxTokens: clampedMaxTokens,
            temperature,
            systemPrompt: enhancedSystemPrompt,
            userId: isAuthenticated ? rateLimitIdentifier : undefined,
            planKey: userTier,
          });

          // Try to extract JSON document data from response
          const extractedDoc = extractDocumentJSON(result.text);

          if (extractedDoc) {
            console.log(`[Chat API] Extracted ${(extractedDoc.json as { type: string }).type} document JSON`);

            // Call the native document generation API
            const docResponse = await fetch(
              `${process.env.NEXT_PUBLIC_SITE_URL || 'https://jcil.ai'}/api/documents/native`,
              {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Cookie': request.headers.get('cookie') || '',
                },
                body: JSON.stringify({
                  documentData: extractedDoc.json,
                  returnType: 'url',
                }),
              }
            );

            if (docResponse.ok) {
              const docResult = await docResponse.json();
              console.log(`[Chat API] Native document generated: ${docResult.filename}`);

              // Return response with document download link
              const responseText = extractedDoc.cleanResponse ||
                `I've created your ${nativeDocType} document. You can download it below.`;

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
                    'X-Provider': 'anthropic',
                    'X-Document-Type': nativeDocType,
                    'X-Document-Format': docResult.format,
                  },
                }
              );
            } else {
              console.error('[Chat API] Native document generation failed:', await docResponse.text());
              // Fall through to return text response
            }
          }

          // If JSON extraction failed, return the text response
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
              },
            }
          );
        } catch (nativeDocError) {
          console.error('[Chat API] Native document error, falling back:', nativeDocError);
          // Fall through to Skills API
        }
      }

      // ========================================
      // LEGACY DOCUMENT GENERATION (Skills API)
      // ========================================
      // Check if document generation is requested (Excel, PowerPoint, Word, PDF)
      const documentType = detectDocumentRequest(lastUserContent);
      if (documentType && isAuthenticated) {
        console.log(`[Chat API] Legacy document generation detected: ${documentType}`);

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
    // XAI PATH - Grok (tier-specific model)
    // ========================================
    if (activeProvider === 'xai') {
      // Get tier-specific model (uses provider settings with tier lookup)
      const xaiModel = await getModelForTier(userTier, 'xai');
      console.log('[Chat API] Using xAI provider with model:', xaiModel, 'for tier:', userTier);

      // Build xAI system prompt using slim prompt + KB
      let baseSystemPrompt = 'You are a helpful AI assistant.';

      if (isAuthenticated) {
        baseSystemPrompt = buildSlimSystemPrompt({
          includeVision: true,
          includeDocuments: true,
        });

        if (isFaithTopic(lastUserContent)) {
          const categories = getRelevantCategories(lastUserContent);
          console.log(`[Chat API] xAI: Faith topic detected, loading KB categories: ${categories.join(', ')}`);
          const kbContent = await getKnowledgeBaseContent(categories);
          if (kbContent) {
            baseSystemPrompt += '\n\n---\n\n## FAITH TOPIC CONTEXT\n\n' + kbContent;
          }
        }

        // Search user's uploaded documents for relevant context (RAG)
        try {
          const { contextString, results } = await searchUserDocuments(rateLimitIdentifier, lastUserContent, {
            matchCount: 5,
            matchThreshold: 0.1,
          });
          console.log(`[Chat API] xAI: RAG returned ${results?.length || 0} results`);
          if (contextString) {
            baseSystemPrompt += '\n\n---\n\n' + contextString;
          }
        } catch (docSearchError) {
          console.error('[Chat API] xAI: User document search failed:', docSearchError);
        }

        // USER LEARNING: Inject learned preferences (lowest priority - style only)
        if (isLearningEnabled() && rateLimitIdentifier) {
          try {
            const learnedContext = await getLearnedContext(rateLimitIdentifier);
            if (learnedContext.promptInjection) {
              baseSystemPrompt += learnedContext.promptInjection;
              console.log(`[Chat API] xAI: Injected ${learnedContext.preferences.length} learned preferences`);
            }
          } catch (learnError) {
            console.error('[Chat API] xAI: Learning context failed:', learnError);
          }
        }

        // GITHUB REPO CONTEXT: Add selected repo info for proactive assistance
        if (selectedRepo) {
          baseSystemPrompt += buildRepoContextPrompt(selectedRepo);
          console.log(`[Chat API] xAI: Added GitHub repo context: ${selectedRepo.fullName}`);
        }
      }

      const systemPrompt = isAuthenticated
        ? `${baseSystemPrompt}\n\n${getAnthropicSearchOverride()}`
        : baseSystemPrompt;

      // ========================================
      // SPREADSHEET GATHERING (Ask questions first)
      // ========================================
      if (isInitialSpreadsheetRequest(lastUserContent)) {
        console.log('[Chat API] xAI: Initial spreadsheet request - asking qualifying questions');

        const spreadsheetGatheringPrompt = `${systemPrompt}

SPREADSHEET REQUEST DETECTED: The user wants to create a spreadsheet/Excel file.
Before generating the file, ask 2-3 brief qualifying questions to understand their needs:

1. What specific categories or data do they want to track?
2. What time period (weekly, monthly, yearly)?
3. Any specific calculations or totals needed?

Keep your questions concise and professional. After they provide details, you can generate the spreadsheet.
Do NOT show a markdown table - just ask the questions conversationally.`;

        const gatherResult = await createXAICompletion({
          messages: messagesWithContext,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          model: xaiModel as any,
          maxTokens: 500,
          temperature: 0.7,
          systemPrompt: spreadsheetGatheringPrompt,
          stream: false,
          userId: isAuthenticated ? rateLimitIdentifier : undefined,
          planKey: userTier,
        });

        return new Response(
          JSON.stringify({
            content: gatherResult.text,
            model: xaiModel,
            provider: 'xai',
          }),
          {
            status: 200,
            headers: {
              'Content-Type': 'application/json',
              'X-Model-Used': xaiModel,
              'X-Provider': 'xai',
            },
          }
        );
      }

      // ========================================
      // NATIVE DOCUMENT GENERATION (NEW: JSON → DOCX/XLSX)
      // ========================================
      // Check for native document requests first (resume, spreadsheet, invoice, document)
      const xaiNativeDocType = detectNativeDocumentRequest(lastUserContent, messagesWithContext);
      if (xaiNativeDocType && xaiNativeDocType !== 'qrcode' && isAuthenticated) {
        console.log(`[Chat API] xAI: Native document generation: ${xaiNativeDocType}`);
        const structuredDocType = xaiNativeDocType as 'resume' | 'spreadsheet' | 'document' | 'invoice';

        try {
          // Get the JSON schema prompt for the document type
          const nativeDocPrompt = getNativeDocumentPrompt(structuredDocType);
          const enhancedSystemPrompt = `${systemPrompt}\n\n${nativeDocPrompt}`;

          // Get AI to generate structured JSON
          const result = await createXAICompletion({
            messages: messagesWithContext,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            model: xaiModel as any,
            maxTokens: clampedMaxTokens,
            temperature,
            systemPrompt: enhancedSystemPrompt,
            stream: false,
            userId: isAuthenticated ? rateLimitIdentifier : undefined,
            planKey: userTier,
          });

          // Try to extract JSON document data from response
          const extractedDoc = extractDocumentJSON(result.text);

          if (extractedDoc) {
            console.log(`[Chat API] xAI: Extracted ${(extractedDoc.json as { type: string }).type} document JSON`);

            // Call the native document generation API
            const docResponse = await fetch(
              `${process.env.NEXT_PUBLIC_SITE_URL || 'https://jcil.ai'}/api/documents/native`,
              {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Cookie': request.headers.get('cookie') || '',
                },
                body: JSON.stringify({
                  documentData: extractedDoc.json,
                  returnType: 'url',
                }),
              }
            );

            if (docResponse.ok) {
              const docResult = await docResponse.json();
              console.log(`[Chat API] xAI: Native document generated: ${docResult.filename}`);

              // Return response with document download link
              const responseText = extractedDoc.cleanResponse ||
                `I've created your ${xaiNativeDocType} document. You can download it below.`;

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
                    'X-Provider': 'xai',
                    'X-Document-Type': xaiNativeDocType,
                    'X-Document-Format': docResult.format,
                  },
                }
              );
            } else {
              console.error('[Chat API] xAI: Native document generation failed:', await docResponse.text());
              // Fall through to return text response
            }
          }

          // If JSON extraction failed, return the text response
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
                'X-Provider': 'xai',
              },
            }
          );
        } catch (nativeDocError) {
          console.error('[Chat API] xAI: Native document error, falling back:', nativeDocError);
          // Fall through to legacy document generation
        }
      }

      // ========================================
      // LEGACY DOCUMENT GENERATION (PDF fallback)
      // ========================================
      // Check if document generation is requested (Excel, PowerPoint, Word, PDF)
      // For xAI, we generate PDF versions (same as OpenAI - no native doc generation)
      const xaiDocumentType = detectDocumentRequest(lastUserContent);
      if (xaiDocumentType && isAuthenticated) {
        console.log(`[Chat API] xAI: Legacy document request detected: ${xaiDocumentType}`);

        // Get the comprehensive document formatting prompt
        const documentFormattingInstructions = getDocumentFormattingPrompt(xaiDocumentType);

        // For Excel/PPT/Word requests, instruct AI to create content for PDF
        const docTypeNames: Record<string, string> = {
          xlsx: 'spreadsheet',
          pptx: 'presentation',
          docx: 'document',
          pdf: 'PDF',
        };
        const docName = docTypeNames[xaiDocumentType] || 'document';

        // Add special instruction for xAI to format content for PDF generation
        const pdfFormatInstruction = xaiDocumentType !== 'pdf' ? `
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

        // Build enhanced system prompt with document formatting instructions
        const enhancedSystemPrompt = `${systemPrompt}\n\n${documentFormattingInstructions}${pdfFormatInstruction}`;

        // Use non-streaming for document generation
        const docResult = await createXAICompletion({
          messages: messagesWithContext,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          model: xaiModel as any,
          maxTokens: clampedMaxTokens,
          temperature,
          systemPrompt: enhancedSystemPrompt,
          stream: false,
          userId: isAuthenticated ? rateLimitIdentifier : undefined,
          planKey: userTier,
        });

        return new Response(
          JSON.stringify({
            type: 'text',
            content: docResult.text,
            model: docResult.model,
          }),
          {
            status: 200,
            headers: {
              'Content-Type': 'application/json',
              'X-Model-Used': docResult.model,
              'X-Document-Type': xaiDocumentType,
              'X-Provider': 'xai',
            },
          }
        );
      }

      // Non-streaming for image analysis
      if (hasImages) {
        console.log('[Chat API] xAI: Non-streaming mode for image analysis');
        const result = await createXAICompletion({
          messages: messagesWithContext,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          model: xaiModel as any,
          maxTokens: clampedMaxTokens,
          temperature,
          systemPrompt,
          stream: false,
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
              'X-Provider': 'xai',
            },
          }
        );
      }

      // Streaming text chat with xAI
      console.log('[Chat API] xAI: Streaming mode');
      const streamResult = await createXAIStreamingCompletion({
        messages: messagesWithContext,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        model: xaiModel as any,
        maxTokens: clampedMaxTokens,
        temperature,
        systemPrompt,
        userId: isAuthenticated ? rateLimitIdentifier : undefined,
        planKey: userTier,
      });

      return new Response(streamResult.stream, {
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'Transfer-Encoding': 'chunked',
          'X-Model-Used': streamResult.model,
          'X-Provider': 'xai',
        },
      });
    }

    // ========================================
    // DEEPSEEK PATH - DeepSeek (tier-specific model with reasoning)
    // ========================================
    if (activeProvider === 'deepseek') {
      // Get tier-specific model (uses provider settings with tier lookup)
      const isReasoning = reasoningMode === true;
      // Use reasoning model from settings when reasoning mode is enabled
      const deepseekModel = isReasoning
        ? await getDeepSeekReasoningModel()
        : await getModelForTier(userTier, 'deepseek');
      console.log('[Chat API] Using DeepSeek provider with model:', deepseekModel, 'reasoning:', isReasoning, 'for tier:', userTier);

      // Build DeepSeek system prompt using slim prompt + KB
      let baseSystemPrompt = 'You are a helpful AI assistant.';

      if (isAuthenticated) {
        baseSystemPrompt = buildSlimSystemPrompt({
          includeVision: true,
          includeDocuments: true,
        });

        if (isFaithTopic(lastUserContent)) {
          const categories = getRelevantCategories(lastUserContent);
          console.log(`[Chat API] DeepSeek: Faith topic detected, loading KB categories: ${categories.join(', ')}`);
          const kbContent = await getKnowledgeBaseContent(categories);
          if (kbContent) {
            baseSystemPrompt += '\n\n---\n\n## FAITH TOPIC CONTEXT\n\n' + kbContent;
          }
        }

        // Search user's uploaded documents for relevant context (RAG)
        try {
          const { contextString, results } = await searchUserDocuments(rateLimitIdentifier, lastUserContent, {
            matchCount: 5,
            matchThreshold: 0.1,
          });
          console.log(`[Chat API] DeepSeek: RAG returned ${results?.length || 0} results`);
          if (contextString) {
            baseSystemPrompt += '\n\n---\n\n' + contextString;
          }
        } catch (docSearchError) {
          console.error('[Chat API] DeepSeek: User document search failed:', docSearchError);
        }

        // USER LEARNING: Inject learned preferences (lowest priority - style only)
        if (isLearningEnabled() && rateLimitIdentifier) {
          try {
            const learnedContext = await getLearnedContext(rateLimitIdentifier);
            if (learnedContext.promptInjection) {
              baseSystemPrompt += learnedContext.promptInjection;
              console.log(`[Chat API] DeepSeek: Injected ${learnedContext.preferences.length} learned preferences`);
            }
          } catch (learnError) {
            console.error('[Chat API] DeepSeek: Learning context failed:', learnError);
          }
        }

        // GITHUB REPO CONTEXT: Add selected repo info for proactive assistance
        if (selectedRepo) {
          baseSystemPrompt += buildRepoContextPrompt(selectedRepo);
          console.log(`[Chat API] DeepSeek: Added GitHub repo context: ${selectedRepo.fullName}`);
        }
      }

      const systemPrompt = isAuthenticated
        ? `${baseSystemPrompt}\n\n${getAnthropicSearchOverride()}`
        : baseSystemPrompt;

      // ========================================
      // SPREADSHEET GATHERING (Ask questions first)
      // ========================================
      if (isInitialSpreadsheetRequest(lastUserContent)) {
        console.log('[Chat API] DeepSeek: Initial spreadsheet request - asking qualifying questions');

        const spreadsheetGatheringPrompt = `${systemPrompt}

SPREADSHEET REQUEST DETECTED: The user wants to create a spreadsheet/Excel file.
Before generating the file, ask 2-3 brief qualifying questions to understand their needs:

1. What specific categories or data do they want to track?
2. What time period (weekly, monthly, yearly)?
3. Any specific calculations or totals needed?

Keep your questions concise and professional. After they provide details, you can generate the spreadsheet.
Do NOT show a markdown table - just ask the questions conversationally.`;

        const gatherResult = await createDeepSeekCompletion({
          messages: messagesWithContext,
          model: deepseekModel as 'deepseek-chat' | 'deepseek-reasoner',
          maxTokens: 500,
          temperature: 0.7,
          systemPrompt: spreadsheetGatheringPrompt,
          reasoning: false,
          userId: isAuthenticated ? rateLimitIdentifier : undefined,
          planKey: userTier,
        });

        return new Response(
          JSON.stringify({
            content: gatherResult.text,
            model: deepseekModel,
            provider: 'deepseek',
          }),
          {
            status: 200,
            headers: {
              'Content-Type': 'application/json',
              'X-Model-Used': deepseekModel,
              'X-Provider': 'deepseek',
            },
          }
        );
      }

      // ========================================
      // NATIVE DOCUMENT GENERATION (NEW: JSON → DOCX/XLSX)
      // ========================================
      // Check for native document requests first (resume, spreadsheet, invoice, document)
      const deepseekNativeDocType = detectNativeDocumentRequest(lastUserContent, messagesWithContext);
      if (deepseekNativeDocType && deepseekNativeDocType !== 'qrcode' && isAuthenticated) {
        console.log(`[Chat API] DeepSeek: Native document generation: ${deepseekNativeDocType}`);
        const structuredDocType = deepseekNativeDocType as 'resume' | 'spreadsheet' | 'document' | 'invoice';

        try {
          // Get the JSON schema prompt for the document type
          const nativeDocPrompt = getNativeDocumentPrompt(structuredDocType);
          const enhancedSystemPrompt = `${systemPrompt}\n\n${nativeDocPrompt}`;

          // Get AI to generate structured JSON (don't use reasoning for document generation)
          const result = await createDeepSeekCompletion({
            messages: messagesWithContext,
            model: deepseekModel as 'deepseek-chat' | 'deepseek-reasoner',
            maxTokens: clampedMaxTokens,
            temperature,
            systemPrompt: enhancedSystemPrompt,
            reasoning: false, // Don't use reasoning for document generation
            userId: isAuthenticated ? rateLimitIdentifier : undefined,
            planKey: userTier,
          });

          // Try to extract JSON document data from response
          let extractedDoc = extractDocumentJSON(result.text);

          // If DeepSeek failed to produce valid JSON, fallback to GPT-4o-mini
          if (!extractedDoc) {
            console.log('[Chat API] DeepSeek: JSON extraction failed, falling back to GPT-4o-mini...');
            try {
              const fallbackResult = await createChatCompletion({
                messages: [
                  { role: 'system', content: enhancedSystemPrompt },
                  ...messagesWithContext.filter(m => m.role !== 'system'),
                ],
                modelOverride: 'gpt-4o-mini',
                maxTokens: clampedMaxTokens,
                temperature,
                stream: false,
              });
              const fallbackText = await fallbackResult.text;
              if (fallbackText) {
                extractedDoc = extractDocumentJSON(fallbackText);
                if (extractedDoc) {
                  console.log('[Chat API] DeepSeek: GPT-4o-mini fallback successful for document JSON');
                }
              }
            } catch (fallbackError) {
              console.error('[Chat API] DeepSeek: GPT-4o-mini fallback also failed:', fallbackError);
            }
          }

          if (extractedDoc) {
            console.log(`[Chat API] DeepSeek: Extracted ${(extractedDoc.json as { type: string }).type} document JSON`);

            // Call the native document generation API
            const docResponse = await fetch(
              `${process.env.NEXT_PUBLIC_SITE_URL || 'https://jcil.ai'}/api/documents/native`,
              {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Cookie': request.headers.get('cookie') || '',
                },
                body: JSON.stringify({
                  documentData: extractedDoc.json,
                  returnType: 'url',
                }),
              }
            );

            if (docResponse.ok) {
              const docResult = await docResponse.json();
              console.log(`[Chat API] DeepSeek: Native document generated: ${docResult.filename}`);

              // Return response with document download link
              const responseText = extractedDoc.cleanResponse ||
                `I've created your ${deepseekNativeDocType} document. You can download it below.`;

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
                    'X-Provider': 'deepseek',
                    'X-Document-Type': deepseekNativeDocType,
                    'X-Document-Format': docResult.format,
                  },
                }
              );
            } else {
              console.error('[Chat API] DeepSeek: Native document generation failed:', await docResponse.text());
              // Fall through to return text response
            }
          }

          // If JSON extraction failed, return the text response
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
                'X-Provider': 'deepseek',
              },
            }
          );
        } catch (nativeDocError) {
          console.error('[Chat API] DeepSeek: Native document error, falling back:', nativeDocError);
          // Fall through to legacy document generation
        }
      }

      // ========================================
      // LEGACY DOCUMENT GENERATION (PDF fallback)
      // ========================================
      // Check if document generation is requested (Excel, PowerPoint, Word, PDF)
      // For DeepSeek, we generate PDF versions (same as xAI/OpenAI - no native doc generation)
      const deepseekDocumentType = detectDocumentRequest(lastUserContent);
      if (deepseekDocumentType && isAuthenticated) {
        console.log(`[Chat API] DeepSeek: Legacy document request detected: ${deepseekDocumentType}`);

        // Get the comprehensive document formatting prompt
        const documentFormattingInstructions = getDocumentFormattingPrompt(deepseekDocumentType);

        // For Excel/PPT/Word requests, instruct AI to create content for PDF
        const docTypeNames: Record<string, string> = {
          xlsx: 'spreadsheet',
          pptx: 'presentation',
          docx: 'document',
          pdf: 'PDF',
        };
        const docName = docTypeNames[deepseekDocumentType] || 'document';

        // Add special instruction for DeepSeek to format content for PDF generation
        const pdfFormatInstruction = deepseekDocumentType !== 'pdf' ? `
IMPORTANT: Since you cannot create native ${docName} files, format your response for PDF output instead:
- Use clear markdown formatting
- Use tables (| col1 | col2 |) for spreadsheet-like data
- Use headers (## and ###) for sections
- The content will be converted to a professional PDF document` : '';

        const enhancedSystemPrompt = `${systemPrompt}\n\n${documentFormattingInstructions}${pdfFormatInstruction}`;

        // Use non-streaming for document generation (need full content for PDF)
        const result = await createDeepSeekCompletion({
          messages: messagesWithContext,
          model: deepseekModel as 'deepseek-chat' | 'deepseek-reasoner',
          maxTokens: clampedMaxTokens,
          temperature,
          systemPrompt: enhancedSystemPrompt,
          reasoning: false, // Don't use reasoning for document generation
          userId: isAuthenticated ? rateLimitIdentifier : undefined,
          planKey: userTier,
        });

        return new Response(
          JSON.stringify({
            type: 'text',
            content: result.text,
            model: result.model,
            documentGeneration: true,
            documentType: 'pdf', // Always PDF for DeepSeek
          }),
          {
            status: 200,
            headers: {
              'Content-Type': 'application/json',
              'X-Model-Used': result.model,
              'X-Provider': 'deepseek',
              'X-Document-Type': 'pdf',
            },
          }
        );
      }

      // ========================================
      // REGULAR CHAT (streaming) with optional reasoning
      // ========================================
      const streamResult = await createDeepSeekStreamingCompletion({
        messages: messagesWithContext,
        model: deepseekModel as 'deepseek-chat' | 'deepseek-reasoner',
        maxTokens: clampedMaxTokens,
        temperature,
        systemPrompt,
        reasoning: isReasoning, // Enable reasoning if user toggled it
        userId: isAuthenticated ? rateLimitIdentifier : undefined,
        planKey: userTier,
      });

      return new Response(streamResult.stream, {
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'Transfer-Encoding': 'chunked',
          'X-Model-Used': streamResult.model,
          'X-Provider': 'deepseek',
          'X-Reasoning-Mode': isReasoning ? 'true' : 'false',
        },
      });
    }

    // ========================================
    // GEMINI PATH - Google Gemini (tier-specific model)
    // ========================================
    if (activeProvider === 'gemini') {
      // Get tier-specific model (uses provider settings with tier lookup)
      const geminiModel = await getModelForTier(userTier, 'gemini');
      console.log('[Chat API] Using Gemini provider with model:', geminiModel, 'for tier:', userTier);

      // Build Gemini system prompt using slim prompt + KB (same as other paths)
      // IMPORTANT: Gemini ignores system messages in messagesWithContext,
      // so we must pass the full prompt via the systemPrompt parameter
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
          console.log(`[Chat API] Gemini: Faith topic detected, loading KB categories: ${categories.join(', ')}`);

          // Load relevant knowledge base content
          const kbContent = await getKnowledgeBaseContent(categories);
          if (kbContent) {
            baseSystemPrompt += '\n\n---\n\n## FAITH TOPIC CONTEXT\n\n' + kbContent;
          }
        }

        // Search user's uploaded documents for relevant context (RAG)
        console.log(`[Chat API] Gemini: Starting RAG search for user ${rateLimitIdentifier}`);
        try {
          const { contextString, results } = await searchUserDocuments(rateLimitIdentifier, lastUserContent, {
            matchCount: 5,
            matchThreshold: 0.1,
          });
          console.log(`[Chat API] Gemini: RAG returned ${results?.length || 0} results`);
          if (contextString) {
            baseSystemPrompt += '\n\n---\n\n' + contextString;
          }
        } catch (docSearchError) {
          console.error('[Chat API] Gemini: User document search failed:', docSearchError);
        }

        // USER LEARNING: Inject learned preferences (lowest priority - style only)
        if (isLearningEnabled() && rateLimitIdentifier) {
          try {
            const learnedContext = await getLearnedContext(rateLimitIdentifier);
            if (learnedContext.promptInjection) {
              baseSystemPrompt += learnedContext.promptInjection;
              console.log(`[Chat API] Gemini: Injected ${learnedContext.preferences.length} learned preferences`);
            }
          } catch (learnError) {
            console.error('[Chat API] Gemini: Learning context failed:', learnError);
          }
        }

        // GITHUB REPO CONTEXT: Add selected repo info for proactive assistance
        if (selectedRepo) {
          baseSystemPrompt += buildRepoContextPrompt(selectedRepo);
          console.log(`[Chat API] Gemini: Added GitHub repo context: ${selectedRepo.fullName}`);
        }
      }

      // Use Gemini-specific search guidance (native Google Search, not buttons)
      const systemPrompt = isAuthenticated
        ? `${baseSystemPrompt}\n\n${getGeminiSearchGuidance()}`
        : baseSystemPrompt;

      // ========================================
      // SPREADSHEET GATHERING (Ask questions first)
      // ========================================
      if (isInitialSpreadsheetRequest(lastUserContent)) {
        console.log('[Chat API] Gemini: Initial spreadsheet request - asking qualifying questions');

        const spreadsheetGatheringPrompt = `${systemPrompt}

SPREADSHEET REQUEST DETECTED: The user wants to create a spreadsheet/Excel file.
Before generating the file, ask 2-3 brief qualifying questions to understand their needs:

1. What specific categories or data do they want to track?
2. What time period (weekly, monthly, yearly)?
3. Any specific calculations or totals needed?

Keep your questions concise and professional. After they provide details, you can generate the spreadsheet.
Do NOT show a markdown table - just ask the questions conversationally.`;

        const gatherResult = await createGeminiCompletion({
          messages: messagesWithContext,
          model: geminiModel,
          maxTokens: 500,
          temperature: 0.7,
          systemPrompt: spreadsheetGatheringPrompt,
        });

        return new Response(
          JSON.stringify({
            content: gatherResult.text,
            model: geminiModel,
            provider: 'gemini',
          }),
          {
            status: 200,
            headers: {
              'Content-Type': 'application/json',
              'X-Model-Used': geminiModel,
              'X-Provider': 'gemini',
            },
          }
        );
      }

      // ========================================
      // QR CODE PDF GENERATION
      // ========================================
      // Special handling for QR codes - uses {{QR:url:count}} syntax
      const geminiNativeDocType = detectNativeDocumentRequest(lastUserContent, messagesWithContext);
      if (geminiNativeDocType === 'qrcode' && isAuthenticated) {
        console.log('[Chat API] Gemini: QR Code PDF generation');

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
            const result = await createGeminiCompletion({
              messages: messagesWithContext,
              model: geminiModel,
              maxTokens: 500,
              temperature: 0.3,
              systemPrompt: `${systemPrompt}\n\nThe user wants to create a QR code. Extract the URL or data they want in the QR code from the conversation. If no URL is specified, ask them to provide one. Respond briefly.`,
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
                    'X-Provider': 'gemini',
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
            console.log('[Chat API] Gemini: QR Code PDF generated:', docResult.filename);

            const responseText = qrCount > 1
              ? `I've created a PDF with ${qrCount} QR codes for ${qrUrl}. You can download it below.`
              : `I've created a QR code PDF for ${qrUrl}. You can download it below.`;

            return new Response(
              JSON.stringify({
                type: 'text',
                content: responseText,
                model: geminiModel,
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
                  'X-Model-Used': geminiModel,
                  'X-Provider': 'gemini',
                  'X-Document-Type': 'qrcode',
                  'X-Document-Format': 'pdf',
                },
              }
            );
          } else {
            const errorText = await docResponse.text();
            console.error('[Chat API] Gemini: QR PDF generation error:', errorText);
          }
        } catch (qrError) {
          console.error('[Chat API] Gemini: QR Code generation error:', qrError);
        }
        // Fall through to regular chat if QR generation fails
      }

      // ========================================
      // IMAGE/SLIDE GENERATION - TEMPORARILY DISABLED
      // ========================================
      // Return a friendly message explaining our focus areas
      const imageGenRequest = detectImageGenerationRequest(lastUserContent);
      if (imageGenRequest) {
        console.log(`[Chat API] Image generation requested but disabled: ${imageGenRequest}`);

        const friendlyMessage = imageGenRequest === 'slide'
          ? `I appreciate your interest in creating slides! While I'm not currently set up for slide or presentation generation, I excel at helping with:\n\n• **Writing & Content** - Articles, emails, reports, and creative writing\n• **Programming & Code** - Development, debugging, and code review\n• **Data & Analysis** - Research, data interpretation, and summaries\n• **Documents** - Resumes, spreadsheets, invoices, and formatted documents\n\nWould you like help with any of these? I'd be happy to assist with the content for your presentation in text form!`
          : `I appreciate your interest in image creation! While I'm not currently set up for image generation, I excel at helping with:\n\n• **Writing & Content** - Articles, emails, reports, and creative writing\n• **Programming & Code** - Development, debugging, and code review\n• **Data & Analysis** - Research, data interpretation, and summaries\n• **Documents** - Resumes, spreadsheets, invoices, and formatted documents\n\nWould you like help with any of these instead?`;

        return new Response(
          JSON.stringify({
            content: friendlyMessage,
            model: geminiModel,
            provider: 'gemini',
          }),
          {
            status: 200,
            headers: {
              'Content-Type': 'application/json',
              'X-Model-Used': geminiModel,
              'X-Provider': 'gemini',
            },
          }
        );
      }

      // ========================================
      // NATIVE DOCUMENT GENERATION (Structured Outputs → DOCX/XLSX)
      // ========================================
      // Uses Gemini's structured outputs feature for guaranteed valid JSON
      if (geminiNativeDocType && geminiNativeDocType !== 'qrcode' && isAuthenticated) {
        console.log(`[Chat API] Gemini: Structured document generation: ${geminiNativeDocType}`);
        // Type assertion - we've already excluded 'qrcode' above
        const structuredDocType = geminiNativeDocType as 'resume' | 'spreadsheet' | 'document' | 'invoice';

        try {
          // Get the JSON schema and description for this document type
          const docSchema = getDocumentSchema(structuredDocType);
          const schemaDescription = getDocumentSchemaDescription(structuredDocType);

          // Use Gemini's structured outputs - guarantees valid JSON
          const result = await createGeminiStructuredCompletion({
            messages: messagesWithContext,
            model: geminiModel,
            maxTokens: clampedMaxTokens,
            temperature: 0.5, // Lower for more consistent output
            systemPrompt,
            schema: docSchema,
            schemaDescription,
          });

          console.log(`[Chat API] Gemini: Structured output received for ${geminiNativeDocType}`);

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
            console.log(`[Chat API] Gemini: Native document generated: ${docResult.filename}`);

            // Return response with document download link
            const docTypeNames: Record<string, string> = {
              resume: 'resume',
              spreadsheet: 'spreadsheet',
              document: 'document',
              invoice: 'invoice',
            };
            const responseText = `I've created your ${docTypeNames[geminiNativeDocType] || 'document'}. You can download it below.`;

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
                  'X-Provider': 'gemini',
                  'X-Document-Type': geminiNativeDocType,
                  'X-Document-Format': docResult.format,
                },
              }
            );
          } else {
            const errorText = await docResponse.text();
            console.error('[Chat API] Gemini: Document API error:', errorText);
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
                  'X-Provider': 'gemini',
                },
              }
            );
          }
        } catch (structuredError) {
          console.error('[Chat API] Gemini: Structured output error:', structuredError);
          // Fall through to legacy document generation (PDF fallback)
        }
      }

      // ========================================
      // LEGACY DOCUMENT GENERATION (PDF fallback)
      // ========================================
      // Check if document generation is requested (Excel, PowerPoint, Word, PDF)
      // For Gemini, we generate PDF versions (same as xAI/OpenAI - no native doc generation)
      const geminiDocumentType = detectDocumentRequest(lastUserContent);
      if (geminiDocumentType && isAuthenticated) {
        console.log(`[Chat API] Gemini: Legacy document request detected: ${geminiDocumentType}`);

        // Get the comprehensive document formatting prompt
        const documentFormattingInstructions = getDocumentFormattingPrompt(geminiDocumentType);

        // For Excel/PPT/Word requests, instruct AI to create content for PDF
        const docTypeNames: Record<string, string> = {
          xlsx: 'spreadsheet',
          pptx: 'presentation',
          docx: 'document',
          pdf: 'PDF',
        };
        const docName = docTypeNames[geminiDocumentType] || 'document';

        // Add special instruction for Gemini to format content for PDF generation
        const pdfFormatInstruction = geminiDocumentType !== 'pdf' ? `
IMPORTANT: Since you cannot create native ${docName} files, format your response for PDF output instead:
- Use clear markdown formatting
- Use tables (| col1 | col2 |) for spreadsheet-like data
- Use headers (## and ###) for sections
- The content will be converted to a professional PDF document` : '';

        const enhancedSystemPrompt = `${systemPrompt}\n\n${documentFormattingInstructions}${pdfFormatInstruction}`;

        // Use non-streaming for document generation (need full content for PDF)
        const result = await createGeminiCompletion({
          messages: messagesWithContext,
          model: geminiModel,
          maxTokens: clampedMaxTokens,
          temperature,
          systemPrompt: enhancedSystemPrompt,
          userId: isAuthenticated ? rateLimitIdentifier : undefined,
          planKey: userTier,
        });

        return new Response(
          JSON.stringify({
            type: 'text',
            content: result.text,
            model: result.model,
            documentGeneration: true,
            documentType: 'pdf', // Always PDF for Gemini
          }),
          {
            status: 200,
            headers: {
              'Content-Type': 'application/json',
              'X-Model-Used': result.model,
              'X-Provider': 'gemini',
              'X-Document-Type': 'pdf',
            },
          }
        );
      }

      // ========================================
      // REGULAR CHAT (streaming with native Google Search)
      // ========================================
      // Gemini uses native Google Search grounding - model automatically
      // decides when to search based on the query (no Perplexity needed)
      const streamResult = await createGeminiStreamingCompletion({
        messages: messagesWithContext,
        model: geminiModel,
        maxTokens: clampedMaxTokens,
        temperature,
        systemPrompt,
        userId: isAuthenticated ? rateLimitIdentifier : undefined,
        planKey: userTier,
        enableSearch: true, // Native Google Search grounding - auto-search when needed
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
          'X-Provider': 'gemini',
          'X-Native-Search': 'google', // Indicates native search is enabled
          ...(taskPlanText ? { 'X-Task-Plan': 'true' } : {}),
        },
      });
    }

    // ========================================
    // OPENAI PATH - GPT (tier-specific model)
    // ========================================
    // Get tier-specific model from provider settings (respects admin configuration)
    const openaiModel = await getModelForTier(userTier);
    console.log('[Chat API] Using OpenAI provider with model:', openaiModel, 'for tier:', userTier);

    // ========================================
    // SPREADSHEET GATHERING (Ask questions first)
    // ========================================
    if (isInitialSpreadsheetRequest(lastUserContent)) {
      console.log('[Chat API] OpenAI: Initial spreadsheet request - asking qualifying questions');

      // Use slim prompt for OpenAI spreadsheet gathering
      const baseSystemPrompt = isAuthenticated
        ? buildSlimSystemPrompt({ includeVision: true, includeDocuments: true })
        : 'You are a helpful AI assistant.';

      const spreadsheetGatheringPrompt = `${baseSystemPrompt}

SPREADSHEET REQUEST DETECTED: The user wants to create a spreadsheet/Excel file.
Before generating the file, ask 2-3 brief qualifying questions to understand their needs:

1. What specific categories or data do they want to track?
2. What time period (weekly, monthly, yearly)?
3. Any specific calculations or totals needed?

Keep your questions concise and professional. After they provide details, you can generate the spreadsheet.
Do NOT show a markdown table - just ask the questions conversationally.`;

      const gatherResult = await createChatCompletion({
        messages: [
          { role: 'system', content: spreadsheetGatheringPrompt },
          ...messagesWithContext.filter(m => m.role !== 'system'),
        ],
        stream: false,
        maxTokens: 500,
        temperature: 0.7,
        modelOverride: openaiModel,
      });

      const responseText = await gatherResult.text;

      return new Response(
        JSON.stringify({
          content: responseText,
          model: openaiModel,
          provider: 'openai',
        }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'X-Model-Used': openaiModel,
            'X-Provider': 'openai',
          },
        }
      );
    }

    // ========================================
    // NATIVE DOCUMENT GENERATION (NEW: JSON → DOCX/XLSX)
    // ========================================
    // Check for native document requests first (resume, spreadsheet, invoice, document)
    const openaiNativeDocType = detectNativeDocumentRequest(lastUserContent, messagesWithContext);
    if (openaiNativeDocType && openaiNativeDocType !== 'qrcode' && isAuthenticated) {
      console.log(`[Chat API] OpenAI: Native document generation: ${openaiNativeDocType}`);
      const structuredDocType = openaiNativeDocType as 'resume' | 'spreadsheet' | 'document' | 'invoice';

      try {
        // Get the JSON schema prompt for the document type
        const nativeDocPrompt = getNativeDocumentPrompt(structuredDocType);

        // Build system prompt with JSON schema instructions (use slim prompt)
        const baseSystemPrompt = isAuthenticated
          ? buildSlimSystemPrompt({ includeVision: true, includeDocuments: true })
          : 'You are a helpful AI assistant.';
        const enhancedSystemPrompt = `${baseSystemPrompt}\n\n${nativeDocPrompt}`;

        // Get AI to generate structured JSON
        const result = await createChatCompletion({
          messages: [
            { role: 'system', content: enhancedSystemPrompt },
            ...messagesWithContext.filter(m => m.role !== 'system'),
          ],
          stream: false,
          maxTokens: clampedMaxTokens,
          temperature,
          modelOverride: openaiModel,
        });

        const responseText = await result.text;

        // Try to extract JSON document data from response
        const extractedDoc = extractDocumentJSON(responseText);

        if (extractedDoc) {
          console.log(`[Chat API] OpenAI: Extracted ${(extractedDoc.json as { type: string }).type} document JSON`);

          // Call the native document generation API
          const docResponse = await fetch(
            `${process.env.NEXT_PUBLIC_SITE_URL || 'https://jcil.ai'}/api/documents/native`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Cookie': request.headers.get('cookie') || '',
              },
              body: JSON.stringify({
                documentData: extractedDoc.json,
                returnType: 'url',
              }),
            }
          );

          if (docResponse.ok) {
            const docResult = await docResponse.json();
            console.log(`[Chat API] OpenAI: Native document generated: ${docResult.filename}`);

            // Return response with document download link
            const displayText = extractedDoc.cleanResponse ||
              `I've created your ${openaiNativeDocType} document. You can download it below.`;

            return new Response(
              JSON.stringify({
                type: 'text',
                content: displayText,
                model: openaiModel,
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
                  'X-Model-Used': openaiModel,
                  'X-Provider': 'openai',
                  'X-Document-Type': openaiNativeDocType,
                  'X-Document-Format': docResult.format,
                },
              }
            );
          } else {
            console.error('[Chat API] OpenAI: Native document generation failed:', await docResponse.text());
            // Fall through to return text response
          }
        }

        // If JSON extraction failed, return the text response
        return new Response(
          JSON.stringify({
            type: 'text',
            content: responseText,
            model: openaiModel,
          }),
          {
            status: 200,
            headers: {
              'Content-Type': 'application/json',
              'X-Model-Used': openaiModel,
              'X-Provider': 'openai',
            },
          }
        );
      } catch (nativeDocError) {
        console.error('[Chat API] OpenAI: Native document error, falling back:', nativeDocError);
        // Fall through to legacy document generation
      }
    }

    // ========================================
    // LEGACY DOCUMENT GENERATION (PDF fallback)
    // ========================================
    // Check if document generation is requested (Excel, PowerPoint, Word, PDF)
    // For OpenAI, we generate PDF versions of documents (Excel/PPT/Word not supported)
    const openaiDocumentType = detectDocumentRequest(lastUserContent);
    if (openaiDocumentType && isAuthenticated) {
      console.log(`[Chat API] OpenAI: Legacy document request detected: ${openaiDocumentType}`);

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
      const resultModel = (result as any).model || openaiModel;

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
    console.log('[Chat API] Using streaming mode with model:', openaiModel, 'webSearch:', willUseWebSearch);

    // Create a pending request BEFORE calling AI
    // This allows background workers to complete the request if the user leaves
    let pendingRequestId: string | null = null;
    if (isAuthenticated && conversationId) {
      pendingRequestId = await createPendingRequest({
        userId: rateLimitIdentifier,
        conversationId,
        messages: messagesWithContext,
        tool: effectiveTool,
        model: openaiModel,
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
            'X-Model-Used': openaiModel,
            'X-Tool-Type': effectiveTool || 'default',
          },
        });

        console.log('[Chat API] Successfully created stream response with model:', openaiModel);
        return streamResponse;
      } else {
        // Non-streaming result (from web search, etc.)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const resultModel = (result as any).model || openaiModel;
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
      const fallbackModel = (result as any).model || openaiModel;

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
