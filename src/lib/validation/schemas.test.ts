import { describe, it, expect } from 'vitest';
import {
  uuidSchema,
  emailSchema,
  urlSchema,
  paginationSchema,
  messageContentSchema,
  messageRoleSchema,
  createMessageSchema,
  conversationTitleSchema,
  createConversationSchema,
  userSettingsSchema,
  createTicketSchema,
  ticketPrioritySchema,
  ticketStatusSchema,
  ticketReplySchema,
  fileUploadSchema,
  codeLabSessionSchema,
  codeExecutionSchema,
  adminUserUpdateSchema,
  designSettingsSchema,
  leadSubmitSchema,
  checkoutSchema,
  validateBody,
  validateQuery,
  validationErrorResponse,
} from './schemas';

describe('Validation Schemas', () => {
  describe('uuidSchema', () => {
    it('should accept valid UUIDs', () => {
      const validUuid = '550e8400-e29b-41d4-a716-446655440000';
      expect(uuidSchema.parse(validUuid)).toBe(validUuid);
    });

    it('should reject invalid UUIDs', () => {
      expect(() => uuidSchema.parse('not-a-uuid')).toThrow();
      expect(() => uuidSchema.parse('123')).toThrow();
      expect(() => uuidSchema.parse('')).toThrow();
    });
  });

  describe('emailSchema', () => {
    it('should accept valid emails', () => {
      expect(emailSchema.parse('test@example.com')).toBe('test@example.com');
      expect(emailSchema.parse('user.name+tag@domain.co')).toBe('user.name+tag@domain.co');
    });

    it('should reject invalid emails', () => {
      expect(() => emailSchema.parse('not-an-email')).toThrow();
      expect(() => emailSchema.parse('@domain.com')).toThrow();
      expect(() => emailSchema.parse('user@')).toThrow();
    });
  });

  describe('urlSchema', () => {
    it('should accept valid URLs', () => {
      expect(urlSchema.parse('https://example.com')).toBe('https://example.com');
      expect(urlSchema.parse('http://localhost:3000/path')).toBe('http://localhost:3000/path');
    });

    it('should reject invalid URLs', () => {
      expect(() => urlSchema.parse('not-a-url')).toThrow();
      expect(() => urlSchema.parse('example.com')).toThrow();
    });
  });

  describe('paginationSchema', () => {
    it('should parse valid pagination params', () => {
      const result = paginationSchema.parse({ page: '2', limit: '25' });
      expect(result.page).toBe(2);
      expect(result.limit).toBe(25);
    });

    it('should use defaults for missing params', () => {
      const result = paginationSchema.parse({});
      expect(result.page).toBe(1);
      expect(result.limit).toBe(50);
    });

    it('should reject invalid page numbers', () => {
      expect(() => paginationSchema.parse({ page: '0' })).toThrow();
      expect(() => paginationSchema.parse({ page: '-1' })).toThrow();
    });

    it('should enforce max limit', () => {
      expect(() => paginationSchema.parse({ limit: '1000' })).toThrow();
    });
  });

  describe('messageContentSchema', () => {
    it('should accept valid message content', () => {
      const content = 'Hello, this is a test message';
      expect(messageContentSchema.parse(content)).toBe(content);
    });

    it('should reject empty messages', () => {
      expect(() => messageContentSchema.parse('')).toThrow();
    });

    it('should reject messages exceeding max length', () => {
      const longMessage = 'a'.repeat(33000);
      expect(() => messageContentSchema.parse(longMessage)).toThrow();
    });
  });

  describe('messageRoleSchema', () => {
    it('should accept valid roles', () => {
      expect(messageRoleSchema.parse('user')).toBe('user');
      expect(messageRoleSchema.parse('assistant')).toBe('assistant');
      expect(messageRoleSchema.parse('system')).toBe('system');
    });

    it('should reject invalid roles', () => {
      expect(() => messageRoleSchema.parse('admin')).toThrow();
      expect(() => messageRoleSchema.parse('bot')).toThrow();
    });
  });

  describe('createMessageSchema', () => {
    it('should parse valid message creation request', () => {
      const input = {
        content: 'Hello world',
        role: 'user',
      };
      const result = createMessageSchema.parse(input);
      expect(result.content).toBe('Hello world');
      expect(result.role).toBe('user');
      expect(result.content_type).toBe('text');
    });

    it('should apply defaults', () => {
      const result = createMessageSchema.parse({ content: 'Test' });
      expect(result.role).toBe('user');
      expect(result.content_type).toBe('text');
      expect(result.type).toBe('text');
    });

    it('should allow optional fields', () => {
      const input = {
        content: 'Test with options',
        temperature: 0.7,
        tokens_used: 100,
      };
      const result = createMessageSchema.parse(input);
      expect(result.temperature).toBe(0.7);
      expect(result.tokens_used).toBe(100);
    });
  });

  describe('conversationTitleSchema', () => {
    it('should accept valid titles', () => {
      expect(conversationTitleSchema.parse('My Conversation')).toBe('My Conversation');
    });

    it('should reject empty titles', () => {
      expect(() => conversationTitleSchema.parse('')).toThrow();
    });

    it('should reject titles exceeding max length', () => {
      const longTitle = 'a'.repeat(201);
      expect(() => conversationTitleSchema.parse(longTitle)).toThrow();
    });
  });

  describe('createConversationSchema', () => {
    it('should parse valid conversation creation', () => {
      const input = {
        title: 'New Chat',
        tool_context: 'general',
      };
      const result = createConversationSchema.parse(input);
      expect(result.title).toBe('New Chat');
      expect(result.tool_context).toBe('general');
    });

    it('should allow all optional fields', () => {
      const result = createConversationSchema.parse({});
      expect(result.title).toBeUndefined();
      expect(result.folder_id).toBeUndefined();
    });
  });

  describe('userSettingsSchema', () => {
    it('should parse valid user settings', () => {
      const input = {
        display_name: 'John Doe',
        theme: 'dark',
        language: 'en',
      };
      const result = userSettingsSchema.parse(input);
      expect(result.display_name).toBe('John Doe');
      expect(result.theme).toBe('dark');
    });

    it('should reject invalid theme values', () => {
      expect(() => userSettingsSchema.parse({ theme: 'invalid' })).toThrow();
    });
  });

  describe('createTicketSchema', () => {
    it('should parse valid ticket creation', () => {
      const input = {
        subject: 'Help needed',
        description: 'I need help with my account settings and configuration.',
        priority: 'high',
      };
      const result = createTicketSchema.parse(input);
      expect(result.subject).toBe('Help needed');
      expect(result.priority).toBe('high');
    });

    it('should require minimum subject length', () => {
      expect(() => createTicketSchema.parse({
        subject: 'Hi',
        description: 'This is a detailed description of the issue.',
      })).toThrow();
    });

    it('should require minimum description length', () => {
      expect(() => createTicketSchema.parse({
        subject: 'Valid subject',
        description: 'Too short',
      })).toThrow();
    });

    it('should use default priority', () => {
      const input = {
        subject: 'Valid subject',
        description: 'This is a detailed description of my issue.',
      };
      const result = createTicketSchema.parse(input);
      expect(result.priority).toBe('medium');
    });
  });

  describe('ticketPrioritySchema', () => {
    it('should accept valid priorities', () => {
      expect(ticketPrioritySchema.parse('low')).toBe('low');
      expect(ticketPrioritySchema.parse('medium')).toBe('medium');
      expect(ticketPrioritySchema.parse('high')).toBe('high');
      expect(ticketPrioritySchema.parse('urgent')).toBe('urgent');
    });

    it('should reject invalid priorities', () => {
      expect(() => ticketPrioritySchema.parse('critical')).toThrow();
    });
  });

  describe('ticketStatusSchema', () => {
    it('should accept valid statuses', () => {
      expect(ticketStatusSchema.parse('open')).toBe('open');
      expect(ticketStatusSchema.parse('in_progress')).toBe('in_progress');
      expect(ticketStatusSchema.parse('resolved')).toBe('resolved');
      expect(ticketStatusSchema.parse('closed')).toBe('closed');
    });
  });

  describe('ticketReplySchema', () => {
    it('should parse valid reply', () => {
      const result = ticketReplySchema.parse({ message: 'Thank you for your help!' });
      expect(result.message).toBe('Thank you for your help!');
      expect(result.is_internal).toBe(false);
    });

    it('should reject empty replies', () => {
      expect(() => ticketReplySchema.parse({ message: '' })).toThrow();
    });
  });

  describe('fileUploadSchema', () => {
    it('should parse valid file upload', () => {
      const input = {
        filename: 'document.pdf',
        content_type: 'application/pdf',
        size: 1024000,
      };
      const result = fileUploadSchema.parse(input);
      expect(result.filename).toBe('document.pdf');
    });

    it('should reject files exceeding max size', () => {
      expect(() => fileUploadSchema.parse({
        filename: 'huge.zip',
        content_type: 'application/zip',
        size: 100 * 1024 * 1024, // 100MB
      })).toThrow();
    });
  });

  describe('codeLabSessionSchema', () => {
    it('should parse valid session', () => {
      const input = {
        name: 'My Project',
        language: 'typescript',
        framework: 'nextjs',
      };
      const result = codeLabSessionSchema.parse(input);
      expect(result.name).toBe('My Project');
    });

    it('should require name', () => {
      expect(() => codeLabSessionSchema.parse({})).toThrow();
    });
  });

  describe('codeExecutionSchema', () => {
    it('should parse valid execution request', () => {
      const input = {
        code: 'console.log("Hello")',
        language: 'javascript',
      };
      const result = codeExecutionSchema.parse(input);
      expect(result.code).toBe('console.log("Hello")');
      expect(result.timeout).toBe(30000);
    });

    it('should reject invalid languages', () => {
      expect(() => codeExecutionSchema.parse({
        code: 'print("hello")',
        language: 'ruby',
      })).toThrow();
    });
  });

  describe('adminUserUpdateSchema', () => {
    it('should parse valid admin update', () => {
      const input = {
        role: 'admin',
        subscription_tier: 'pro',
        is_active: true,
      };
      const result = adminUserUpdateSchema.parse(input);
      expect(result.role).toBe('admin');
    });

    it('should reject invalid roles', () => {
      expect(() => adminUserUpdateSchema.parse({ role: 'superadmin' })).toThrow();
    });
  });

  describe('designSettingsSchema', () => {
    it('should parse valid design settings', () => {
      const input = {
        siteName: 'My Company',
        subtitle: 'Best in class',
        modelName: 'Custom AI',
      };
      const result = designSettingsSchema.parse(input);
      expect(result.siteName).toBe('My Company');
      expect(result.subtitle).toBe('Best in class');
    });

    it('should reject site names exceeding max length', () => {
      expect(() => designSettingsSchema.parse({ siteName: 'a'.repeat(101) })).toThrow();
      expect(() => designSettingsSchema.parse({ subtitle: 'a'.repeat(201) })).toThrow();
    });
  });

  describe('leadSubmitSchema', () => {
    it('should parse valid lead submission', () => {
      const input = {
        name: 'John Doe',
        email: 'john@example.com',
        message: 'I am interested in your services for my business.',
      };
      const result = leadSubmitSchema.parse(input);
      expect(result.name).toBe('John Doe');
      expect(result.email).toBe('john@example.com');
    });

    it('should require minimum name length', () => {
      expect(() => leadSubmitSchema.parse({
        name: 'J',
        email: 'j@test.com',
        message: 'Valid message for the form.',
      })).toThrow();
    });
  });

  describe('checkoutSchema', () => {
    it('should parse valid checkout request', () => {
      const input = {
        priceId: 'price_123abc',
        successUrl: 'https://example.com/success',
      };
      const result = checkoutSchema.parse(input);
      expect(result.priceId).toBe('price_123abc');
    });

    it('should require priceId', () => {
      expect(() => checkoutSchema.parse({})).toThrow();
    });
  });

  describe('validateBody', () => {
    it('should return success with valid data', () => {
      const result = validateBody(emailSchema, 'test@example.com');
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe('test@example.com');
      }
    });

    it('should return error with invalid data', () => {
      const result = validateBody(emailSchema, 'not-an-email');
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('Validation failed');
        expect(result.details.length).toBeGreaterThan(0);
      }
    });
  });

  describe('validateQuery', () => {
    it('should validate URL search params', () => {
      const params = new URLSearchParams('page=2&limit=10');
      const result = validateQuery(paginationSchema, params);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.page).toBe(2);
        expect(result.data.limit).toBe(10);
      }
    });
  });

  describe('validationErrorResponse', () => {
    it('should create error response object', () => {
      const errors = [{ path: ['email'], message: 'Invalid email', code: 'invalid_string' as const }];
      const response = validationErrorResponse('Validation failed', errors);
      expect(response.error).toBe('Validation Error');
      expect(response.code).toBe('VALIDATION_FAILED');
      expect(response.details[0].field).toBe('email');
    });
  });
});
