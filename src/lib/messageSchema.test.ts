import { describe, it, expect } from 'vitest';
import {
  MessageSchema,
  TextMessage,
  ImageMessage,
  ToolMessage,
  normalizeContent,
  parseMessage,
  safeParseMessage,
} from './messageSchema';

describe('Message Schema', () => {
  describe('TextMessage', () => {
    it('should validate valid text message', () => {
      const result = TextMessage.safeParse({
        type: 'text',
        content: 'Hello world',
      });

      expect(result.success).toBe(true);
    });

    it('should require content', () => {
      const result = TextMessage.safeParse({
        type: 'text',
      });

      expect(result.success).toBe(false);
    });

    it('should reject empty content', () => {
      const result = TextMessage.safeParse({
        type: 'text',
        content: '',
      });

      expect(result.success).toBe(false);
    });

    it('should accept role field', () => {
      const result = TextMessage.safeParse({
        type: 'text',
        content: 'Test',
        role: 'assistant',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.role).toBe('assistant');
      }
    });

    it('should default role to user', () => {
      const result = TextMessage.safeParse({
        type: 'text',
        content: 'Test',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.role).toBe('user');
      }
    });

    it('should accept metadata', () => {
      const result = TextMessage.safeParse({
        type: 'text',
        content: 'Test',
        metadata: { key: 'value' },
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.metadata).toEqual({ key: 'value' });
      }
    });
  });

  describe('ImageMessage', () => {
    it('should validate valid image message', () => {
      const result = ImageMessage.safeParse({
        type: 'image',
        prompt: 'A beautiful sunset',
      });

      expect(result.success).toBe(true);
    });

    it('should require prompt', () => {
      const result = ImageMessage.safeParse({
        type: 'image',
      });

      expect(result.success).toBe(false);
    });

    it('should reject empty prompt', () => {
      const result = ImageMessage.safeParse({
        type: 'image',
        prompt: '',
      });

      expect(result.success).toBe(false);
    });

    it('should default size to 1024x1024', () => {
      const result = ImageMessage.safeParse({
        type: 'image',
        prompt: 'Test',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.size).toBe('1024x1024');
      }
    });

    it('should accept valid size options', () => {
      const sizes = ['256x256', '512x512', '1024x1024'] as const;

      for (const size of sizes) {
        const result = ImageMessage.safeParse({
          type: 'image',
          prompt: 'Test',
          size,
        });

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.size).toBe(size);
        }
      }
    });

    it('should reject invalid size', () => {
      const result = ImageMessage.safeParse({
        type: 'image',
        prompt: 'Test',
        size: '2048x2048',
      });

      expect(result.success).toBe(false);
    });

    it('should accept optional content', () => {
      const result = ImageMessage.safeParse({
        type: 'image',
        prompt: 'Test',
        content: 'Additional text',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.content).toBe('Additional text');
      }
    });
  });

  describe('ToolMessage', () => {
    it('should validate valid tool message', () => {
      const result = ToolMessage.safeParse({
        type: 'tool',
        tool: 'web_search',
      });

      expect(result.success).toBe(true);
    });

    it('should require tool name', () => {
      const result = ToolMessage.safeParse({
        type: 'tool',
      });

      expect(result.success).toBe(false);
    });

    it('should reject empty tool name', () => {
      const result = ToolMessage.safeParse({
        type: 'tool',
        tool: '',
      });

      expect(result.success).toBe(false);
    });

    it('should accept args', () => {
      const result = ToolMessage.safeParse({
        type: 'tool',
        tool: 'calculator',
        args: { expression: '2 + 2' },
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.args).toEqual({ expression: '2 + 2' });
      }
    });

    it('should accept content', () => {
      const result = ToolMessage.safeParse({
        type: 'tool',
        tool: 'web_search',
        content: 'Search results here',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.content).toBe('Search results here');
      }
    });
  });

  describe('MessageSchema (Discriminated Union)', () => {
    it('should discriminate text messages', () => {
      const result = MessageSchema.safeParse({
        type: 'text',
        content: 'Hello',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.type).toBe('text');
      }
    });

    it('should discriminate image messages', () => {
      const result = MessageSchema.safeParse({
        type: 'image',
        prompt: 'A cat',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.type).toBe('image');
      }
    });

    it('should discriminate tool messages', () => {
      const result = MessageSchema.safeParse({
        type: 'tool',
        tool: 'calculator',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.type).toBe('tool');
      }
    });

    it('should reject invalid type', () => {
      const result = MessageSchema.safeParse({
        type: 'unknown',
        content: 'Test',
      });

      expect(result.success).toBe(false);
    });

    it('should reject missing type', () => {
      const result = MessageSchema.safeParse({
        content: 'Test',
      });

      expect(result.success).toBe(false);
    });
  });
});

describe('normalizeContent', () => {
  it('should normalize text message content', () => {
    const result = normalizeContent({
      type: 'text',
      role: 'user',
      content: 'Hello world',
    });

    expect(result).toBe('Hello world');
  });

  it('should normalize image message with content', () => {
    const result = normalizeContent({
      type: 'image',
      role: 'user',
      prompt: 'A cat',
      size: '1024x1024',
      content: 'Generated image description',
    });

    expect(result).toBe('Generated image description');
  });

  it('should normalize image message without content', () => {
    const result = normalizeContent({
      type: 'image',
      role: 'user',
      prompt: 'A beautiful sunset',
      size: '1024x1024',
    });

    expect(result).toBe('A beautiful sunset');
  });

  it('should normalize tool message with content', () => {
    const result = normalizeContent({
      type: 'tool',
      role: 'user',
      tool: 'calculator',
      content: 'Result: 4',
    });

    expect(result).toBe('Result: 4');
  });

  it('should normalize tool message with args', () => {
    const result = normalizeContent({
      type: 'tool',
      role: 'user',
      tool: 'calculator',
      args: { expression: '2+2' },
    });

    expect(result).toBe('{"expression":"2+2"}');
  });

  it('should normalize tool message with no content or args', () => {
    const result = normalizeContent({
      type: 'tool',
      role: 'user',
      tool: 'calculator',
    });

    expect(result).toBe('{}');
  });
});

describe('parseMessage', () => {
  it('should parse valid text message', () => {
    const result = parseMessage({
      type: 'text',
      content: 'Hello',
    });

    expect(result.type).toBe('text');
    expect(result.content).toBe('Hello');
  });

  it('should throw on invalid message', () => {
    expect(() =>
      parseMessage({
        type: 'text',
        // missing content
      })
    ).toThrow();
  });

  it('should parse valid image message', () => {
    const result = parseMessage({
      type: 'image',
      prompt: 'A cat',
    });

    expect(result.type).toBe('image');
  });

  it('should parse valid tool message', () => {
    const result = parseMessage({
      type: 'tool',
      tool: 'web_search',
    });

    expect(result.type).toBe('tool');
  });
});

describe('safeParseMessage', () => {
  it('should return success for valid message', () => {
    const result = safeParseMessage({
      type: 'text',
      content: 'Hello',
    });

    expect(result.success).toBe(true);
  });

  it('should return error for invalid message', () => {
    const result = safeParseMessage({
      type: 'text',
      // missing content
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeDefined();
    }
  });

  it('should not throw on invalid input', () => {
    expect(() => safeParseMessage(null)).not.toThrow();
    expect(() => safeParseMessage(undefined)).not.toThrow();
    expect(() => safeParseMessage('string')).not.toThrow();
    expect(() => safeParseMessage(123)).not.toThrow();
  });
});

describe('Message Roles', () => {
  const validRoles = ['user', 'assistant', 'system', 'tool'] as const;

  for (const role of validRoles) {
    it(`should accept role: ${role}`, () => {
      const result = TextMessage.safeParse({
        type: 'text',
        content: 'Test',
        role,
      });

      expect(result.success).toBe(true);
    });
  }

  it('should reject invalid role', () => {
    const result = TextMessage.safeParse({
      type: 'text',
      content: 'Test',
      role: 'invalid',
    });

    expect(result.success).toBe(false);
  });
});

describe('Type Exports', () => {
  it('should export MessagePayload type', () => {
    // TypeScript type checking - verified by compilation
    const textMessage: import('./messageSchema').MessagePayload = {
      type: 'text',
      role: 'user',
      content: 'Hello',
    };
    expect(textMessage).toBeDefined();
  });

  it('should export TextMessagePayload type', () => {
    const textMessage: import('./messageSchema').TextMessagePayload = {
      type: 'text',
      role: 'user',
      content: 'Hello',
    };
    expect(textMessage.type).toBe('text');
  });

  it('should export ImageMessagePayload type', () => {
    const imageMessage: import('./messageSchema').ImageMessagePayload = {
      type: 'image',
      role: 'user',
      prompt: 'A cat',
      size: '1024x1024',
    };
    expect(imageMessage.type).toBe('image');
  });

  it('should export ToolMessagePayload type', () => {
    const toolMessage: import('./messageSchema').ToolMessagePayload = {
      type: 'tool',
      role: 'user',
      tool: 'calculator',
    };
    expect(toolMessage.type).toBe('tool');
  });
});
