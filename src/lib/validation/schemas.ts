/**
 * ZOD VALIDATION SCHEMAS
 *
 * Centralized input validation for all API routes.
 * Provides type-safe validation with detailed error messages.
 */

import { z } from 'zod';
import { MESSAGE_LIMITS, FILE_LIMITS, PAGINATION } from '@/lib/constants';

// ========================================
// COMMON SCHEMAS
// ========================================

/** UUID validation */
export const uuidSchema = z.string().uuid('Invalid UUID format');

/** Email validation */
export const emailSchema = z.string().email('Invalid email format').max(255);

/** URL validation */
export const urlSchema = z.string().url('Invalid URL format').max(2048);

/** Pagination schemas */
export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(PAGINATION.MAX_PAGE_SIZE)
    .default(PAGINATION.DEFAULT_PAGE_SIZE),
});

export const userPaginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(PAGINATION.USER_MAX_PAGE_SIZE)
    .default(PAGINATION.USER_DEFAULT_PAGE_SIZE),
});

/** Date range schema */
export const dateRangeSchema = z
  .object({
    startDate: z.string().datetime().optional(),
    endDate: z.string().datetime().optional(),
  })
  .refine(
    (data) => {
      if (data.startDate && data.endDate) {
        return new Date(data.startDate) <= new Date(data.endDate);
      }
      return true;
    },
    { message: 'Start date must be before end date' }
  );

// ========================================
// MESSAGE SCHEMAS
// ========================================

/** Message role validation */
export const messageRoleSchema = z.enum(['user', 'assistant', 'system']);

/** Message content validation */
export const messageContentSchema = z
  .string()
  .min(MESSAGE_LIMITS.MIN_MESSAGE_LENGTH, 'Message cannot be empty')
  .max(
    MESSAGE_LIMITS.MAX_MESSAGE_LENGTH,
    `Message exceeds ${MESSAGE_LIMITS.MAX_MESSAGE_LENGTH} characters`
  )
  .refine((val) => val.trim().length > 0, {
    message: 'Message cannot be empty or contain only whitespace',
  });

/** Create message request */
export const createMessageSchema = z.object({
  content: messageContentSchema,
  role: messageRoleSchema.default('user'),
  content_type: z.enum(['text', 'image', 'code', 'markdown']).default('text'),
  model_used: z.string().max(100).optional().nullable(),
  temperature: z.number().min(0).max(2).optional().nullable(),
  tokens_used: z.number().int().min(0).optional().nullable(),
  image_url: urlSchema.optional().nullable(),
  prompt: z.string().max(10000).optional().nullable(),
  type: z.enum(['text', 'image', 'code', 'markdown']).default('text'),
  attachment_urls: z.array(z.string().max(50000)).max(FILE_LIMITS.MAX_FILES_PER_REQUEST).optional(),
  metadata: z.record(z.unknown()).optional().nullable(),
});

// ========================================
// CONVERSATION SCHEMAS
// ========================================

/** Conversation title validation */
export const conversationTitleSchema = z
  .string()
  .min(1, 'Title cannot be empty')
  .max(
    MESSAGE_LIMITS.MAX_TITLE_LENGTH,
    `Title exceeds ${MESSAGE_LIMITS.MAX_TITLE_LENGTH} characters`
  );

/** Create conversation request */
export const createConversationSchema = z.object({
  title: conversationTitleSchema.optional(),
  tool_context: z.string().max(50).optional().nullable(),
  folder_id: uuidSchema.optional().nullable(),
});

/** Update conversation request */
export const updateConversationSchema = z.object({
  title: conversationTitleSchema.optional(),
  folder_id: uuidSchema.optional().nullable(),
});

// ========================================
// USER SCHEMAS
// ========================================

/** User settings update */
export const userSettingsSchema = z.object({
  display_name: z.string().min(1).max(100).optional(),
  avatar_url: urlSchema.optional().nullable(),
  preferences: z.record(z.unknown()).optional(),
  theme: z.enum(['light', 'dark', 'system']).optional(),
  language: z.string().min(2).max(10).optional(),
  notifications_enabled: z.boolean().optional(),
});

// ========================================
// SUPPORT TICKET SCHEMAS
// ========================================

/** Support ticket priority */
export const ticketPrioritySchema = z.enum(['low', 'medium', 'high', 'urgent']);

/** Support ticket status */
export const ticketStatusSchema = z.enum(['open', 'in_progress', 'resolved', 'closed']);

/** Create support ticket */
export const createTicketSchema = z.object({
  subject: z.string().min(5, 'Subject must be at least 5 characters').max(200),
  description: z.string().min(20, 'Description must be at least 20 characters').max(5000),
  priority: ticketPrioritySchema.default('medium'),
  category: z.string().max(50).optional(),
});

/** Update support ticket */
export const updateTicketSchema = z.object({
  status: ticketStatusSchema.optional(),
  priority: ticketPrioritySchema.optional(),
  assigned_to: uuidSchema.optional().nullable(),
  resolution: z.string().max(5000).optional(),
});

/** Add ticket reply */
export const ticketReplySchema = z.object({
  message: z.string().min(1, 'Reply cannot be empty').max(5000),
  is_internal: z.boolean().default(false),
});

// ========================================
// FILE UPLOAD SCHEMAS
// ========================================

/** File upload metadata */
export const fileUploadSchema = z.object({
  filename: z.string().min(1).max(255),
  content_type: z.string().max(100),
  size: z.number().int().min(1).max(FILE_LIMITS.MAX_FILE_SIZE),
});

/** Document upload */
export const documentUploadSchema = fileUploadSchema.extend({
  size: z.number().int().min(1).max(FILE_LIMITS.MAX_DOCUMENT_SIZE),
});

// ========================================
// CODE LAB SCHEMAS
// ========================================

/** Code lab session */
export const codeLabSessionSchema = z.object({
  name: z.string().min(1).max(100),
  language: z.string().max(50).optional(),
  framework: z.string().max(50).optional(),
});

/** Code execution request */
export const codeExecutionSchema = z.object({
  code: z.string().min(1).max(100000),
  language: z.enum(['javascript', 'typescript', 'python', 'html', 'css']),
  timeout: z.number().int().min(1000).max(60000).default(30000),
});

// ========================================
// ADMIN SCHEMAS
// ========================================

/** Admin user update */
export const adminUserUpdateSchema = z.object({
  role: z.enum(['user', 'admin', 'moderator']).optional(),
  subscription_tier: z.enum(['free', 'plus', 'pro', 'executive']).optional(),
  is_active: z.boolean().optional(),
  notes: z.string().max(1000).optional(),
});

/** Admin search params */
export const adminSearchSchema = z
  .object({
    query: z.string().max(200).optional(),
    status: z.string().max(50).optional(),
    sort: z.enum(['created_at', 'updated_at', 'email', 'name']).default('created_at'),
    order: z.enum(['asc', 'desc']).default('desc'),
  })
  .merge(paginationSchema);

// ========================================
// DESIGN SETTINGS SCHEMAS
// ========================================

/** Design settings */
export const designSettingsSchema = z.object({
  mainLogo: z.string().optional(),
  headerLogo: z.string().optional(),
  loginLogo: z.string().optional(),
  lightModeLogo: z.string().optional(),
  favicon: z.string().optional(),
  siteName: z.string().max(100).optional(),
  subtitle: z.string().max(200).optional(),
  modelName: z.string().max(100).optional(),
});

// ========================================
// LEAD/CONTACT SCHEMAS
// ========================================

/** Lead submission */
export const leadSubmitSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(100),
  email: emailSchema,
  phone: z.string().max(20).optional(),
  company: z.string().max(100).optional(),
  message: z.string().min(10, 'Message must be at least 10 characters').max(2000),
  source: z.string().max(50).optional(),
});

// ========================================
// STRIPE/PAYMENT SCHEMAS
// ========================================

/** Checkout session request */
export const checkoutSchema = z.object({
  priceId: z.string().min(1),
  successUrl: urlSchema.optional(),
  cancelUrl: urlSchema.optional(),
});

/** Stripe portal request */
export const stripePortalSchema = z.object({
  returnUrl: urlSchema.optional(),
});

// ========================================
// WEBAUTHN/PASSKEY SCHEMAS
// ========================================

/** WebAuthn registration options request */
export const webAuthnRegisterOptionsSchema = z.object({
  deviceName: z.string().min(1).max(100).optional(),
});

/** WebAuthn registration verification */
export const webAuthnRegisterVerifySchema = z.object({
  response: z.object({
    id: z.string(),
    rawId: z.string(),
    response: z.object({
      clientDataJSON: z.string(),
      attestationObject: z.string(),
      transports: z.array(z.string()).optional(),
    }),
    type: z.literal('public-key'),
    clientExtensionResults: z.record(z.unknown()).optional(),
  }),
  challengeKey: z.string().min(1),
  deviceName: z.string().max(100).optional(),
});

/** WebAuthn authentication options request */
export const webAuthnAuthOptionsSchema = z.object({
  email: emailSchema.optional(),
});

/** WebAuthn authentication verification */
export const webAuthnAuthVerifySchema = z.object({
  response: z.object({
    id: z.string(),
    rawId: z.string(),
    response: z.object({
      clientDataJSON: z.string(),
      authenticatorData: z.string(),
      signature: z.string(),
      userHandle: z.string().optional(),
    }),
    type: z.literal('public-key'),
    clientExtensionResults: z.record(z.unknown()).optional(),
  }),
  challengeKey: z.string().min(1),
});

// ========================================
// CHAT SCHEMAS
// ========================================

/** Text content part for multimodal messages */
const textContentPartSchema = z.object({
  type: z.literal('text'),
  text: z
    .string()
    .max(MESSAGE_LIMITS.MAX_MESSAGE_LENGTH)
    .refine((val) => val.trim().length > 0, {
      message: 'Text content cannot be empty or contain only whitespace',
    }),
});

/** Image content part for multimodal messages */
const imageContentPartSchema = z.object({
  type: z.literal('image'),
  image: z.string().max(10000000), // Base64 data URL (up to ~7MB)
});

/** Content part union for multimodal messages */
const contentPartSchema = z.union([textContentPartSchema, imageContentPartSchema]);

/** Chat message content - either string or array of content parts (for multimodal) */
const chatContentSchema = z.union([
  z
    .string()
    .max(MESSAGE_LIMITS.MAX_MESSAGE_LENGTH)
    .refine((val) => val.trim().length > 0, {
      message: 'Message cannot be empty or contain only whitespace',
    }),
  z.array(contentPartSchema).min(1).max(20), // Max 20 parts (images + text), must have at least 1
]);

/** Chat message in conversation */
export const chatMessageSchema = z.object({
  role: z.enum(['user', 'assistant', 'system']),
  content: chatContentSchema,
});

/** User context for personalization */
const userContextSchema = z
  .object({
    name: z.string().max(100).optional(),
    role: z.string().max(50).optional(),
    field: z.string().max(100).optional(),
    purpose: z.string().max(500).optional(),
  })
  .optional();

/** Selected GitHub repo for code operations */
const selectedRepoSchema = z
  .object({
    owner: z.string().max(100),
    repo: z.string().max(100),
    fullName: z.string().max(200),
    defaultBranch: z.string().max(100),
  })
  .optional();

/** Main chat request */
export const chatRequestSchema = z.object({
  messages: z.array(chatMessageSchema).min(1).max(100),
  conversationId: uuidSchema.optional(),
  // Tool modes: search tools + document creation + resume generator
  searchMode: z
    .enum([
      'none',
      'search',
      'factcheck',
      'research',
      'doc_word',
      'doc_excel',
      'doc_pdf',
      'resume_generator',
    ])
    .optional(),
  temperature: z.number().min(0).max(2).optional(),
  max_tokens: z.number().int().min(1).max(128000).optional(),
  model: z.string().max(100).optional(),
  tool_context: z.string().max(50).optional(),
  userContext: userContextSchema,
  selectedRepo: selectedRepoSchema,
  // AI Provider selection - allows users to choose between Claude, xAI, DeepSeek, etc.
  provider: z.enum(['claude', 'openai', 'xai', 'deepseek', 'google']).optional(),
  // Extended thinking configuration (Claude Sonnet 4.6+ / Opus 4.6+ only)
  thinking: z
    .object({
      enabled: z.boolean(),
      budgetTokens: z.number().int().min(1000).max(50000).optional(),
    })
    .optional(),
});

/** Generate title request */
export const generateTitleSchema = z.object({
  userMessage: z.string().min(1).max(MESSAGE_LIMITS.MAX_MESSAGE_LENGTH),
  assistantMessage: z.string().max(MESSAGE_LIMITS.MAX_MESSAGE_LENGTH).optional(),
});

// ========================================
// CODE LAB EXTENDED SCHEMAS
// ========================================

/** Code lab chat request */
export const codeLabChatSchema = z.object({
  sessionId: uuidSchema,
  content: z.string().max(100000).optional(),
  repo: z.string().max(500).optional(),
  attachments: z
    .array(
      z.object({
        name: z.string().max(255),
        content: z.string().max(10000000), // 10MB base64
        type: z.string().max(100),
      })
    )
    .max(10)
    .optional(),
  forceSearch: z.boolean().optional(),
});

/** Code lab session create */
export const codeLabSessionCreateSchema = z.object({
  title: z.string().min(1).max(200).default('New Session'),
  repo: z.string().max(500).optional(),
  language: z.string().max(50).optional(),
  framework: z.string().max(50).optional(),
});

/** Code lab file operation */
export const codeLabFileSchema = z.object({
  path: z.string().min(1).max(1000),
  content: z.string().max(10000000).optional(), // 10MB max
  operation: z.enum(['read', 'write', 'delete', 'create']).optional(),
});

/** Code lab deploy request */
export const codeLabDeploySchema = z.object({
  sessionId: uuidSchema,
  platform: z.enum(['vercel', 'netlify', 'cloudflare', 'railway']),
  config: z.object({
    projectName: z.string().min(1).max(100).optional(),
    environmentVariables: z.record(z.string()).optional(),
    buildCommand: z.string().max(500).optional(),
    outputDirectory: z.string().max(255).optional(),
  }),
});

// ========================================
// ADMIN EXTENDED SCHEMAS
// ========================================

/** Admin users query params */
export const adminUsersQuerySchema = paginationSchema.extend({
  search: z.string().max(200).optional(),
  tier: z.enum(['free', 'plus', 'pro', 'executive', 'all']).optional(),
  status: z.enum(['active', 'inactive', 'banned', 'all']).optional(),
  sort: z
    .enum(['created_at', 'email', 'subscription_tier', 'last_message_date'])
    .default('created_at'),
  order: z.enum(['asc', 'desc']).default('desc'),
});

/** Admin tickets query params */
export const adminTicketsQuerySchema = paginationSchema.extend({
  search: z.string().max(200).optional(),
  status: ticketStatusSchema.optional(),
  priority: ticketPrioritySchema.optional(),
  category: z.string().max(50).optional(),
  assignedTo: uuidSchema.optional(),
});

/** Admin messages send */
export const adminMessageSchema = z
  .object({
    recipient_type: z.enum(['individual', 'broadcast']),
    recipient_user_id: uuidSchema.optional(),
    recipient_email: emailSchema.optional(),
    recipient_tier: z.enum(['free', 'basic', 'pro', 'executive', 'all']).optional(),
    subject: z.string().min(1).max(200),
    message: z.string().min(1).max(10000),
    message_type: z
      .enum([
        'general',
        'account',
        'feature',
        'maintenance',
        'promotion',
        'support_response',
        'welcome',
        'warning',
      ])
      .default('general'),
    priority: z.enum(['low', 'normal', 'high', 'urgent']).default('normal'),
    expires_at: z.string().datetime().optional(),
  })
  .refine(
    (data) => {
      if (data.recipient_type === 'individual') {
        return data.recipient_user_id || data.recipient_email;
      }
      if (data.recipient_type === 'broadcast') {
        return data.recipient_tier;
      }
      return false;
    },
    { message: 'Individual messages require user ID or email, broadcast requires tier' }
  );

// ========================================
// UPLOAD SCHEMAS
// ========================================

/** Upload start request */
export const uploadStartSchema = z.object({
  filename: z.string().min(1).max(255),
  contentType: z.string().min(1).max(100),
  size: z.number().int().min(1).max(FILE_LIMITS.MAX_TOTAL_UPLOAD_SIZE),
  folder: z.string().max(255).optional(),
});

/** Upload complete request */
export const uploadCompleteSchema = z.object({
  uploadId: z.string().min(1).max(100),
  parts: z
    .array(
      z.object({
        partNumber: z.number().int().min(1),
        etag: z.string().min(1),
      })
    )
    .optional(),
});

// ========================================
// FOLDER SCHEMAS
// ========================================

/** Create folder */
export const createFolderSchema = z.object({
  name: z.string().min(1).max(100),
  parent_id: uuidSchema.optional().nullable(),
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/)
    .optional(),
});

/** Update folder */
export const updateFolderSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  parent_id: uuidSchema.optional().nullable(),
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/)
    .optional(),
});

// ========================================
// DOCUMENT GENERATION SCHEMAS
// ========================================

/** Document generate request */
export const documentGenerateSchema = z.object({
  type: z.enum(['invoice', 'resume', 'letter', 'report', 'spreadsheet', 'presentation']),
  format: z.enum(['pdf', 'docx', 'xlsx', 'pptx']).default('pdf'),
  data: z.record(z.unknown()),
  template: z.string().max(100).optional(),
});

// ========================================
// IMAGE GENERATION SCHEMAS
// ========================================

/** Image generate request */
export const imageGenerateSchema = z.object({
  prompt: z.string().min(1).max(4000),
  size: z.enum(['256x256', '512x512', '1024x1024', '1024x1792', '1792x1024']).default('1024x1024'),
  quality: z.enum(['standard', 'hd']).default('standard'),
  style: z.enum(['vivid', 'natural']).default('vivid'),
  n: z.number().int().min(1).max(4).default(1),
});

// ========================================
// CONNECTOR SCHEMAS
// ========================================

/** Connector configuration */
export const connectorConfigSchema = z.object({
  type: z.enum(['github', 'slack', 'notion', 'google', 'stripe']),
  credentials: z.record(z.string()).optional(),
  settings: z.record(z.unknown()).optional(),
});

// ========================================
// QR CODE SCHEMAS
// ========================================

/** QR code generate request */
export const qrCodeGenerateSchema = z.object({
  data: z.string().min(1).max(4000),
  size: z.number().int().min(100).max(1000).default(256),
  format: z.enum(['png', 'svg']).default('png'),
  errorCorrection: z.enum(['L', 'M', 'Q', 'H']).default('M'),
});

// ========================================
// HELPER FUNCTIONS
// ========================================

/**
 * Validate request body against a schema
 * @returns Parsed data or error response
 */
export function validateBody<T extends z.ZodSchema>(
  schema: T,
  data: unknown
):
  | { success: true; data: z.infer<T> }
  | { success: false; error: string; details: z.ZodError['errors'] } {
  const result = schema.safeParse(data);

  if (result.success) {
    return { success: true, data: result.data };
  }

  return {
    success: false,
    error: 'Validation failed',
    details: result.error.errors,
  };
}

/**
 * Validate query parameters against a schema
 */
export function validateQuery<T extends z.ZodSchema>(
  schema: T,
  searchParams: URLSearchParams
):
  | { success: true; data: z.infer<T> }
  | { success: false; error: string; details: z.ZodError['errors'] } {
  const params = Object.fromEntries(searchParams.entries());
  return validateBody(schema, params);
}

/**
 * Create a validation error response
 */
export function validationErrorResponse(error: string, details: z.ZodError['errors']) {
  return {
    error: 'Validation Error',
    message: error,
    code: 'VALIDATION_FAILED',
    details: details.map((d) => ({
      field: d.path.join('.'),
      message: d.message,
    })),
  };
}
