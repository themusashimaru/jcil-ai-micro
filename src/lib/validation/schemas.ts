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
  limit: z.coerce.number().int().min(1).max(PAGINATION.MAX_PAGE_SIZE).default(PAGINATION.DEFAULT_PAGE_SIZE),
});

export const userPaginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(PAGINATION.USER_MAX_PAGE_SIZE).default(PAGINATION.USER_DEFAULT_PAGE_SIZE),
});

/** Date range schema */
export const dateRangeSchema = z.object({
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
}).refine(
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
export const messageContentSchema = z.string()
  .min(MESSAGE_LIMITS.MIN_MESSAGE_LENGTH, 'Message cannot be empty')
  .max(MESSAGE_LIMITS.MAX_MESSAGE_LENGTH, `Message exceeds ${MESSAGE_LIMITS.MAX_MESSAGE_LENGTH} characters`);

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
});

// ========================================
// CONVERSATION SCHEMAS
// ========================================

/** Conversation title validation */
export const conversationTitleSchema = z.string()
  .min(1, 'Title cannot be empty')
  .max(MESSAGE_LIMITS.MAX_TITLE_LENGTH, `Title exceeds ${MESSAGE_LIMITS.MAX_TITLE_LENGTH} characters`);

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
export const adminSearchSchema = z.object({
  query: z.string().max(200).optional(),
  status: z.string().max(50).optional(),
  sort: z.enum(['created_at', 'updated_at', 'email', 'name']).default('created_at'),
  order: z.enum(['asc', 'desc']).default('desc'),
}).merge(paginationSchema);

// ========================================
// DESIGN SETTINGS SCHEMAS
// ========================================

/** Design settings */
export const designSettingsSchema = z.object({
  primary_color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Invalid hex color').optional(),
  secondary_color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Invalid hex color').optional(),
  logo_url: urlSchema.optional().nullable(),
  favicon_url: urlSchema.optional().nullable(),
  company_name: z.string().max(100).optional(),
  tagline: z.string().max(200).optional(),
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
): { success: true; data: z.infer<T> } | { success: false; error: string; details: z.ZodError['errors'] } {
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
): { success: true; data: z.infer<T> } | { success: false; error: string; details: z.ZodError['errors'] } {
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
    details: details.map(d => ({
      field: d.path.join('.'),
      message: d.message,
    })),
  };
}
