/**
 * Chat Document Generation Route Handlers
 *
 * Handles explicit document generation (button-triggered),
 * resume generation, and auto-detected document requests.
 */

import { CoreMessage } from 'ai';
import { logger } from '@/lib/logger';
import { routeChat, completeChat } from '@/lib/ai/chat-router';
import { generateDocument, validateDocumentJSON, type DocumentData } from '@/lib/documents';
import { uploadDocument } from '@/lib/documents/storage';
import {
  generateResumeDocuments,
  getResumeSystemPrompt,
  type ResumeData,
  MODERN_PRESET,
} from '@/lib/documents/resume';
import { trackTokenUsage } from '@/lib/usage/track';
import { incrementTokenUsage } from '@/lib/limits';
import { releaseSlot } from '@/lib/queue';
import { truncateMessages } from './helpers';
import { getCurrentDateFormatted, getCurrentDateISO } from './system-prompt';
import {
  getDocumentTypeName,
  getDocumentSchemaPrompt,
  detectDocumentIntent,
  detectDocumentSubtype,
  extractPreviousDocumentContext,
  buildDocumentContext,
  detectStyleMatchRequest,
  generateStyleMatchInstructions,
  detectMultiDocumentRequest,
  generateMultiDocInstructions,
  hasEnoughDetailToGenerate,
  generateDocumentResponseMessage,
} from './documents';

const log = logger('ChatDocRoutes');

interface DocRouteContext {
  messages: CoreMessage[];
  lastUserContent: string;
  userId: string;
  userPlanKey: string;
  conversationId?: string;
  isAuthenticated: boolean;
  memoryContext: string;
  requestId: string;
  slotAcquired: boolean;
}

/**
 * Track token usage for document/resume generation (fire-and-forget).
 */
function trackDocTokens(
  result: { usage?: { inputTokens?: number; outputTokens?: number }; model?: string },
  userId: string,
  userPlanKey: string,
  source: string,
  conversationId?: string
): void {
  if (!result.usage) return;
  const totalTokens = (result.usage.inputTokens || 0) + (result.usage.outputTokens || 0);
  trackTokenUsage({
    userId,
    modelName: result.model || 'claude-sonnet-4-6',
    inputTokens: result.usage.inputTokens || 0,
    outputTokens: result.usage.outputTokens || 0,
    source,
    conversationId,
  }).catch((err: unknown) =>
    log.error('logTokenUsage failed', err instanceof Error ? err : undefined)
  );
  incrementTokenUsage(userId, userPlanKey, totalTokens).catch((err: unknown) =>
    log.error('incrementTokenUsage failed', err instanceof Error ? err : undefined)
  );
}

/**
 * Strip markdown code fences from AI response.
 */
function stripCodeFences(text: string): string {
  let cleaned = text.trim();
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.replace(/^```json\n?/, '').replace(/\n?```$/, '');
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```\n?/, '').replace(/\n?```$/, '');
  }
  return cleaned;
}

/**
 * Handle explicit document generation (user clicked a Tools menu button).
 * Returns a Response if handled, null if not applicable.
 */
export async function handleExplicitDocumentGeneration(
  ctx: DocRouteContext,
  explicitDocType: 'xlsx' | 'docx' | 'pdf' | 'pptx'
): Promise<Response | null> {
  if (!ctx.isAuthenticated) {
    log.debug('Document generation requested but user not authenticated');
    return Response.json(
      {
        error:
          'Document generation requires authentication. Please sign in to create downloadable documents.',
        code: 'AUTH_REQUIRED',
      },
      { status: 401 }
    );
  }

  log.info('Document generation request (explicit)', { documentType: explicitDocType });

  try {
    const schemaPrompt = getDocumentSchemaPrompt(explicitDocType, ctx.lastUserContent);

    const docMessages: CoreMessage[] = [
      ...(ctx.messages as CoreMessage[]).slice(-5),
      { role: 'user', content: ctx.lastUserContent },
    ];
    const result = await completeChat(docMessages, {
      systemPrompt: schemaPrompt,
      model: 'claude-sonnet-4-6',
      maxTokens: 4096,
      temperature: 0.3,
    });

    trackDocTokens(result, ctx.userId, ctx.userPlanKey, 'chat-document', ctx.conversationId);

    const jsonText = stripCodeFences(result.text);
    const documentData = JSON.parse(jsonText) as DocumentData;

    const validation = validateDocumentJSON(documentData);
    if (!validation.valid) {
      throw new Error(`Invalid document structure: ${validation.error}`);
    }

    const fileResult = await generateDocument(documentData);
    const upload = await uploadDocument(
      ctx.userId,
      fileResult.buffer,
      fileResult.filename,
      fileResult.mimeType
    );

    const responseText =
      `I've created your ${getDocumentTypeName(explicitDocType)} document: **${fileResult.filename}**\n\n` +
      `Click the download button below to save it.\n\n` +
      `[DOCUMENT_DOWNLOAD:${JSON.stringify({
        filename: fileResult.filename,
        mimeType: fileResult.mimeType,
        downloadUrl: upload.url,
        type: explicitDocType,
      })}]`;

    return new Response(responseText, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'X-Document-Generated': 'true',
        'X-Document-Type': explicitDocType,
      },
    });
  } catch (error) {
    log.error('Document generation error', error as Error);
    return null; // Fall through to regular chat
  }
}

/**
 * Handle resume generation route.
 * Returns a Response if handled, null if not applicable.
 */
export async function handleResumeGeneration(ctx: DocRouteContext): Promise<Response | null> {
  if (!ctx.isAuthenticated) {
    return Response.json(
      {
        error: 'Resume generation requires authentication. Please sign in to create your resume.',
        code: 'AUTH_REQUIRED',
      },
      { status: 401 }
    );
  }

  log.info('Resume generator mode activated');

  try {
    const userMessageLower = ctx.lastUserContent.toLowerCase();
    const isUserConfirming =
      userMessageLower.includes('generate') ||
      userMessageLower.includes('create my resume') ||
      userMessageLower.includes('make my resume') ||
      userMessageLower.includes('make it') ||
      userMessageLower.includes('create it') ||
      userMessageLower.includes('done') ||
      userMessageLower.includes('looks good') ||
      userMessageLower.includes("that's correct") ||
      userMessageLower.includes('thats correct') ||
      userMessageLower.includes('yes') ||
      userMessageLower.includes('perfect') ||
      userMessageLower.includes('sounds good') ||
      userMessageLower.includes('go ahead') ||
      userMessageLower.includes('please') ||
      userMessageLower.includes('ready') ||
      userMessageLower.includes("let's do it") ||
      userMessageLower.includes('lets do it');

    const lastAssistantMessage = ctx.messages.filter((m) => m.role === 'assistant').pop();
    const assistantContent =
      typeof lastAssistantMessage?.content === 'string'
        ? lastAssistantMessage.content.toLowerCase()
        : '';
    const assistantIndicatedReady =
      assistantContent.includes('creating your resume') ||
      assistantContent.includes('generate your resume') ||
      assistantContent.includes('i have all the details') ||
      assistantContent.includes('ready to generate') ||
      assistantContent.includes('ready to create') ||
      assistantContent.includes('just take a moment') ||
      assistantContent.includes('let me create') ||
      assistantContent.includes('confirm the timeline') ||
      assistantContent.includes('once i have these');

    const conversationLength = ctx.messages.length;
    const hasEnoughContext = conversationLength >= 4;

    const shouldGenerate =
      (isUserConfirming && hasEnoughContext) ||
      (assistantIndicatedReady && hasEnoughContext && ctx.messages.length >= 6);

    if (shouldGenerate) {
      return await generateResumeFromConversation(ctx);
    }

    // Not ready to generate — continue conversation with resume-focused prompt
    return await streamResumeConversation(ctx);
  } catch (error) {
    log.error('Resume generator error', error as Error);
    return null;
  }
}

async function generateResumeFromConversation(ctx: DocRouteContext): Promise<Response> {
  log.info('Resume generation triggered', { messageCount: ctx.messages.length });

  const extractionPrompt = `You are a resume data extractor. Analyze this conversation and extract all resume information into a JSON object.

IMPORTANT: Return ONLY valid JSON, no markdown, no explanation.

Required JSON structure:
{
  "contact": {
    "fullName": "string",
    "email": "string",
    "phone": "string (optional)",
    "location": "string (optional)",
    "linkedin": "string (optional)"
  },
  "summary": "string - professional summary paragraph (optional)",
  "experience": [
    {
      "company": "string",
      "title": "string",
      "location": "string (optional)",
      "startDate": "string (e.g., Jan 2019)",
      "endDate": "string or null for current",
      "bullets": ["achievement 1", "achievement 2", ...]
    }
  ],
  "education": [
    {
      "institution": "string",
      "degree": "string",
      "field": "string (optional)",
      "graduationDate": "string (optional)",
      "gpa": "string (optional)",
      "honors": ["string"] (optional)
    }
  ],
  "skills": [
    {
      "category": "string (optional)",
      "items": ["skill1", "skill2", ...]
    }
  ],
  "certifications": [
    {
      "name": "string",
      "issuer": "string (optional)",
      "date": "string (optional)"
    }
  ]
}

For work experience bullets, write professional achievement-focused statements:
- Start with strong action verbs (Led, Developed, Increased, Managed, etc.)
- Include metrics when possible
- Focus on results and impact

If information is missing, make reasonable professional assumptions or leave optional fields empty.`;

  const conversationContext = ctx.messages
    .map(
      (m) => `${m.role}: ${typeof m.content === 'string' ? m.content : JSON.stringify(m.content)}`
    )
    .join('\n\n');

  const extractionMessages: CoreMessage[] = [
    {
      role: 'user',
      content: `${extractionPrompt}\n\n---\nCONVERSATION:\n${conversationContext}`,
    },
  ];
  const extractionResult = await completeChat(extractionMessages, {
    model: 'claude-sonnet-4-6',
    maxTokens: 4096,
    temperature: 0.1,
  });

  trackDocTokens(extractionResult, ctx.userId, ctx.userPlanKey, 'chat-resume', ctx.conversationId);

  const jsonText = stripCodeFences(extractionResult.text);
  const extractedData = JSON.parse(jsonText);

  const resumeData: ResumeData = {
    contact: {
      fullName: extractedData.contact?.fullName || 'Name Required',
      email: extractedData.contact?.email || '',
      phone: extractedData.contact?.phone,
      location: extractedData.contact?.location,
      linkedin: extractedData.contact?.linkedin,
    },
    summary: extractedData.summary,
    experience: extractedData.experience || [],
    education: extractedData.education || [],
    skills: extractedData.skills || [],
    certifications: extractedData.certifications,
    formatting: MODERN_PRESET,
  };

  log.info('Generating resume documents', { name: resumeData.contact.fullName });

  const documents = await generateResumeDocuments(resumeData);

  const docxUpload = await uploadDocument(
    ctx.userId,
    documents.docx,
    documents.docxFilename,
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  );
  const pdfUpload = await uploadDocument(
    ctx.userId,
    documents.pdf,
    documents.pdfFilename,
    'application/pdf'
  );

  const responseText =
    `I've created your professional resume! Here are your documents:\n\n` +
    `**Word Document** (easy to edit):\n` +
    `[DOCUMENT_DOWNLOAD:${JSON.stringify({
      filename: documents.docxFilename,
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      downloadUrl: docxUpload.url,
      type: 'docx',
    })}]\n\n` +
    `**PDF Version** (ready to submit):\n` +
    `[DOCUMENT_DOWNLOAD:${JSON.stringify({
      filename: documents.pdfFilename,
      mimeType: 'application/pdf',
      downloadUrl: pdfUpload.url,
      type: 'pdf',
      canPreview: true,
    })}]\n\n` +
    `Your resume includes:\n` +
    `- ${resumeData.experience.length} work experience${resumeData.experience.length !== 1 ? 's' : ''}\n` +
    `- ${resumeData.education.length} education entr${resumeData.education.length !== 1 ? 'ies' : 'y'}\n` +
    `- ${resumeData.skills.reduce((acc, s) => acc + s.items.length, 0)} skills\n` +
    (resumeData.certifications
      ? `- ${resumeData.certifications.length} certification${resumeData.certifications.length !== 1 ? 's' : ''}\n`
      : '') +
    `\nWould you like me to make any changes? I can adjust:\n` +
    `- Margins (wider/narrower)\n` +
    `- Fonts (modern, classic, or minimal style)\n` +
    `- Section order\n` +
    `- Content wording`;

  return new Response(responseText, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'X-Document-Generated': 'true',
      'X-Document-Type': 'resume',
    },
  });
}

async function streamResumeConversation(ctx: DocRouteContext): Promise<Response> {
  const resumeSystemPrompt =
    getResumeSystemPrompt() +
    `

CURRENT CONVERSATION CONTEXT:
You are helping the user build their resume. Based on the conversation so far, continue gathering information or confirm details.

REQUIRED INFORMATION:
- Full name and contact info (email, phone, location)
- Work experience (company, title, dates, achievements)
- Education (school, degree, graduation date)
- Skills (technical and soft skills)

IMPORTANT - WHEN YOU HAVE ALL REQUIRED INFO:
1. Summarize what you've collected in a clear list
2. Ask: "Does this look correct? Say 'yes' or 'generate' when you're ready and I'll create your Word and PDF documents!"
3. Do NOT say you're "creating" or "generating" until the user confirms - just ask them to confirm

When the user says "yes", "done", "generate", "looks good", "perfect", or similar confirmation, the system will automatically generate the documents.

Keep responses focused and concise. Ask ONE question at a time when gathering info.`;

  const truncatedMessages = truncateMessages(ctx.messages as CoreMessage[]);

  const streamResult = await routeChat(truncatedMessages, {
    systemPrompt: resumeSystemPrompt,
    model: 'claude-sonnet-4-6',
    maxTokens: 1024,
    temperature: 0.7,
    onUsage: (usage) => {
      const totalTokens = (usage.inputTokens || 0) + (usage.outputTokens || 0);
      trackTokenUsage({
        userId: ctx.userId,
        modelName: 'claude-sonnet-4-6',
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
        source: 'chat-resume',
        conversationId: ctx.conversationId,
      }).catch((err: unknown) =>
        log.error('logTokenUsage failed', err instanceof Error ? err : undefined)
      );
      incrementTokenUsage(ctx.userId, ctx.userPlanKey, totalTokens).catch((err: unknown) =>
        log.error('incrementTokenUsage failed', err instanceof Error ? err : undefined)
      );
    },
  });

  const wrappedStream = new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, controller) {
      controller.enqueue(chunk);
    },
    flush() {
      if (ctx.slotAcquired) {
        releaseSlot(ctx.requestId).catch((err) => log.error('Error releasing slot', err));
      }
    },
  });

  return new Response(streamResult.stream.pipeThrough(wrappedStream), {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Transfer-Encoding': 'chunked',
      'X-Provider': streamResult.providerId,
      'X-Model': streamResult.model,
      'X-Search-Mode': 'resume_generator',
    },
  });
}

/**
 * Handle auto-detected document generation.
 * Returns a Response if handled, null if should fall through to regular chat.
 */
export async function handleAutoDetectedDocument(ctx: DocRouteContext): Promise<Response | null> {
  const conversationForDetection = ctx.messages.map((m) => ({
    role: String(m.role),
    content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content),
  }));
  const detectedDocType = detectDocumentIntent(ctx.lastUserContent, conversationForDetection);

  if (!detectedDocType || !ctx.isAuthenticated) return null;

  const isEditRequest =
    /\b(add|change|update|modify|edit|adjust|remove|fix|redo|regenerate|different|instead|actually)\b/i.test(
      ctx.lastUserContent
    );

  const styleMatch = detectStyleMatchRequest(ctx.lastUserContent, conversationForDetection);
  const multiDocRequest = detectMultiDocumentRequest(ctx.lastUserContent, conversationForDetection);

  const shouldGenerateNow = hasEnoughDetailToGenerate(
    ctx.lastUserContent,
    detectedDocType,
    conversationForDetection
  );

  // If not enough detail, fall through to regular chat
  if (
    !shouldGenerateNow &&
    !isEditRequest &&
    !styleMatch.wantsStyleMatch &&
    !multiDocRequest.isMultiDoc
  ) {
    log.info('Document request detected but needs more detail, falling through to chat', {
      documentType: detectedDocType,
      message: ctx.lastUserContent.substring(0, 50),
    });
    return null;
  }

  const previousContext = extractPreviousDocumentContext(
    ctx.messages as Array<{ role: string; content: unknown }>
  );

  const subtype = detectDocumentSubtype(detectedDocType, ctx.lastUserContent);

  let styleMatchInstructions = '';
  if (styleMatch.wantsStyleMatch && styleMatch.uploadedFileInfo) {
    styleMatchInstructions = generateStyleMatchInstructions(styleMatch.uploadedFileInfo);
    log.info('Style matching detected', {
      documentType: detectedDocType,
      hasUploadedFile: !!styleMatch.uploadedFileInfo,
    });
  }

  let multiDocInstructions = '';
  if (multiDocRequest.isMultiDoc && multiDocRequest.uploadedDocs.length > 0) {
    multiDocInstructions = generateMultiDocInstructions(
      multiDocRequest.uploadedDocs,
      multiDocRequest.extractionHints,
      ctx.lastUserContent
    );
    log.info('Multi-document extraction detected', {
      documentType: detectedDocType,
      documentCount: multiDocRequest.uploadedDocs.length,
      hints: multiDocRequest.extractionHints.length,
    });
  }

  log.info('Document generation starting', {
    documentType: detectedDocType,
    subtype,
    message: ctx.lastUserContent.substring(0, 100),
    isEdit: isEditRequest,
    hasPreviousContext: !!previousContext.originalRequest,
    hasMemoryContext: !!ctx.memoryContext,
    hasStyleMatch: !!styleMatchInstructions,
    hasMultiDoc: !!multiDocInstructions,
  });

  try {
    const currentDate = getCurrentDateFormatted();
    const currentDateISO = getCurrentDateISO();

    let schemaPrompt = getDocumentSchemaPrompt(detectedDocType, ctx.lastUserContent);

    const intelligentContext = buildDocumentContext(
      ctx.lastUserContent,
      ctx.memoryContext || null,
      previousContext,
      isEditRequest
    );

    schemaPrompt = `${schemaPrompt}

CURRENT DATE INFORMATION:
- Today's date: ${currentDate}
- ISO format: ${currentDateISO}
Use these dates where appropriate (e.g., invoice dates, letter dates, document dates).
${intelligentContext}${styleMatchInstructions}${multiDocInstructions}`;

    // Use Sonnet for reliable JSON output — with retry logic
    let jsonText = '';
    let parseError: Error | null = null;
    const maxRetries = 2;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      const retryPrompt =
        attempt > 0
          ? `${schemaPrompt}\n\nIMPORTANT: Your previous response was not valid JSON. Output ONLY the JSON object with no markdown, no explanation, no text before or after. Start with { and end with }.`
          : schemaPrompt;

      const retryMessages: CoreMessage[] = [
        ...(ctx.messages as CoreMessage[]).slice(-5),
        { role: 'user', content: ctx.lastUserContent },
      ];
      const result = await completeChat(retryMessages, {
        systemPrompt: retryPrompt,
        model: 'claude-sonnet-4-6',
        maxTokens: 4096,
        temperature: attempt > 0 ? 0.1 : 0.3,
      });

      trackDocTokens(result, ctx.userId, ctx.userPlanKey, 'chat-document', ctx.conversationId);

      jsonText = stripCodeFences(result.text);

      try {
        JSON.parse(jsonText);
        parseError = null;
        break;
      } catch (e) {
        parseError = e as Error;
        log.warn(`JSON parse failed on attempt ${attempt + 1}`, {
          error: (e as Error).message,
        });
        if (attempt < maxRetries) {
          continue;
        }
      }
    }

    if (parseError) {
      throw parseError;
    }

    const documentData = JSON.parse(jsonText) as DocumentData;

    const validation = validateDocumentJSON(documentData);
    if (!validation.valid) {
      throw new Error(`Invalid document structure: ${validation.error}`);
    }

    const fileResult = await generateDocument(documentData);
    const upload = await uploadDocument(
      ctx.userId,
      fileResult.buffer,
      fileResult.filename,
      fileResult.mimeType
    );

    const responseMessage = generateDocumentResponseMessage(
      detectedDocType,
      fileResult.filename,
      subtype
    );

    const responseText =
      responseMessage +
      `[DOCUMENT_DOWNLOAD:${JSON.stringify({
        filename: fileResult.filename,
        mimeType: fileResult.mimeType,
        downloadUrl: upload.url,
        type: detectedDocType,
        canPreview: detectedDocType === 'pdf',
      })}]`;

    if (ctx.slotAcquired) {
      await releaseSlot(ctx.requestId);
    }

    return new Response(responseText, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'X-Document-Generated': 'true',
        'X-Document-Type': detectedDocType,
      },
    });
  } catch (error) {
    log.error('Auto-detected document generation error', error as Error);
    log.info('Falling back to regular chat after document generation failure');
    return null;
  }
}
