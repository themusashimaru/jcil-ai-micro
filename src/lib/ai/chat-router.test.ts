import { describe, it, expect, vi } from 'vitest';

// Mock provider service to avoid loading real providers
vi.mock('./providers/service', () => ({
  createProviderService: vi.fn().mockReturnValue({
    chat: vi.fn(),
    getProviderStatuses: vi.fn().mockReturnValue([]),
    getConfiguredProviders: vi.fn().mockReturnValue([]),
  }),
}));

vi.mock('@/lib/logger', () => ({
  logger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

import { convertToUnifiedMessages, getDefaultProviders } from './chat-router';
import type { CoreMessage } from 'ai';

// -------------------------------------------------------------------
// convertToUnifiedMessages
// -------------------------------------------------------------------
describe('convertToUnifiedMessages', () => {
  it('should convert string content message', () => {
    const messages: CoreMessage[] = [{ role: 'user', content: 'Hello' }];
    const result = convertToUnifiedMessages(messages);
    expect(result).toEqual([{ role: 'user', content: 'Hello' }]);
  });

  it('should convert assistant message', () => {
    const messages: CoreMessage[] = [{ role: 'assistant', content: 'Hi there' }];
    const result = convertToUnifiedMessages(messages);
    expect(result).toEqual([{ role: 'assistant', content: 'Hi there' }]);
  });

  it('should convert system message', () => {
    const messages: CoreMessage[] = [{ role: 'system', content: 'You are helpful' }];
    const result = convertToUnifiedMessages(messages);
    expect(result).toEqual([{ role: 'system', content: 'You are helpful' }]);
  });

  it('should simplify single text block array to string', () => {
    const messages: CoreMessage[] = [
      { role: 'user', content: [{ type: 'text', text: 'Hello world' }] },
    ];
    const result = convertToUnifiedMessages(messages);
    expect(result[0].content).toBe('Hello world');
  });

  it('should keep multiple content blocks as array', () => {
    const messages: CoreMessage[] = [
      {
        role: 'user',
        content: [
          { type: 'text', text: 'Check this image' },
          {
            type: 'image',
            image: 'data:image/png;base64,iVBORw0KGgo',
          },
        ],
      },
    ];
    const result = convertToUnifiedMessages(messages);
    expect(Array.isArray(result[0].content)).toBe(true);
    const content = result[0].content as Array<{ type: string }>;
    expect(content).toHaveLength(2);
    expect(content[0].type).toBe('text');
    expect(content[1].type).toBe('image');
  });

  it('should convert image data URL to base64 source', () => {
    const messages: CoreMessage[] = [
      {
        role: 'user',
        content: [{ type: 'image', image: 'data:image/jpeg;base64,abc123' }],
      },
    ];
    const result = convertToUnifiedMessages(messages);
    const content = result[0].content as Array<{
      type: string;
      source: { type: string; data: string; mediaType: string };
    }>;
    expect(content[0].source.type).toBe('base64');
    expect(content[0].source.data).toBe('abc123');
    expect(content[0].source.mediaType).toBe('image/jpeg');
  });

  it('should convert image URL string to url source', () => {
    const messages: CoreMessage[] = [
      {
        role: 'user',
        content: [{ type: 'image', image: 'https://example.com/image.png' }],
      },
    ];
    const result = convertToUnifiedMessages(messages);
    const content = result[0].content as Array<{
      type: string;
      source: { type: string; url: string };
    }>;
    expect(content[0].source.type).toBe('url');
    expect(content[0].source.url).toBe('https://example.com/image.png');
  });

  it('should convert tool-call parts', () => {
    const messages: CoreMessage[] = [
      {
        role: 'assistant',
        content: [
          {
            type: 'tool-call',
            toolCallId: 'call-1',
            toolName: 'web_search',
            args: { query: 'test' },
          },
        ],
      },
    ];
    const result = convertToUnifiedMessages(messages);
    const content = result[0].content as Array<{
      type: string;
      id: string;
      name: string;
      arguments: Record<string, unknown>;
    }>;
    expect(content[0].type).toBe('tool_use');
    expect(content[0].id).toBe('call-1');
    expect(content[0].name).toBe('web_search');
    expect(content[0].arguments).toEqual({ query: 'test' });
  });

  it('should convert tool-result parts', () => {
    const messages: CoreMessage[] = [
      {
        role: 'tool',
        content: [
          {
            type: 'tool-result',
            toolCallId: 'call-1',
            result: 'Search results here',
          },
        ],
      },
    ];
    const result = convertToUnifiedMessages(messages);
    const content = result[0].content as Array<{
      type: string;
      toolUseId: string;
      content: string;
    }>;
    expect(content[0].type).toBe('tool_result');
    expect(content[0].toolUseId).toBe('call-1');
  });

  it('should handle empty content array', () => {
    const messages: CoreMessage[] = [{ role: 'user', content: [] }];
    const result = convertToUnifiedMessages(messages);
    expect(result[0].content).toBe('');
  });

  it('should handle multiple messages', () => {
    const messages: CoreMessage[] = [
      { role: 'user', content: 'Hello' },
      { role: 'assistant', content: 'Hi' },
      { role: 'user', content: 'How are you?' },
    ];
    const result = convertToUnifiedMessages(messages);
    expect(result).toHaveLength(3);
    expect(result[0].role).toBe('user');
    expect(result[1].role).toBe('assistant');
    expect(result[2].role).toBe('user');
  });

  it('should extract text from unknown content part types', () => {
    const messages: CoreMessage[] = [
      {
        role: 'user',
        content: [
          { type: 'unknown-type', text: 'fallback text' } as unknown as {
            type: 'text';
            text: string;
          },
        ],
      },
    ];
    const result = convertToUnifiedMessages(messages);
    // Should fall back to extracting .text property
    expect(result[0].content).toBe('fallback text');
  });
});

// -------------------------------------------------------------------
// getDefaultProviders
// -------------------------------------------------------------------
describe('getDefaultProviders', () => {
  it('should return primary and fallback providers', () => {
    const providers = getDefaultProviders();
    expect(providers).toHaveProperty('primary');
    expect(providers).toHaveProperty('fallback');
    expect(typeof providers.primary).toBe('string');
    expect(typeof providers.fallback).toBe('string');
  });
});
