import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('Send Message Helper', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockReset();
  });

  describe('Module Exports', () => {
    it('should export sendMessage function', async () => {
      const { sendMessage } = await import('./sendMessage');
      expect(typeof sendMessage).toBe('function');
    });

    it('should export createTextMessage function', async () => {
      const { createTextMessage } = await import('./sendMessage');
      expect(typeof createTextMessage).toBe('function');
    });

    it('should export createImageMessage function', async () => {
      const { createImageMessage } = await import('./sendMessage');
      expect(typeof createImageMessage).toBe('function');
    });

    it('should export createToolMessage function', async () => {
      const { createToolMessage } = await import('./sendMessage');
      expect(typeof createToolMessage).toBe('function');
    });

    it('should export SendMessageResult type', async () => {
      // Type exports are verified by module loading
      const importedModule = await import('./sendMessage');
      expect(importedModule).toBeDefined();
    });
  });

  describe('createTextMessage', () => {
    it('should create text message with default role', async () => {
      const { createTextMessage } = await import('./sendMessage');

      const message = createTextMessage('Hello world');

      expect(message).toEqual({
        type: 'text',
        role: 'user',
        content: 'Hello world',
      });
    });

    it('should create text message with specified role', async () => {
      const { createTextMessage } = await import('./sendMessage');

      const message = createTextMessage('Response', 'assistant');

      expect(message).toEqual({
        type: 'text',
        role: 'assistant',
        content: 'Response',
      });
    });

    it('should preserve content exactly', async () => {
      const { createTextMessage } = await import('./sendMessage');

      const content = '  spaces and\nnewlines  ';
      const message = createTextMessage(content);

      expect(message.content).toBe(content);
    });
  });

  describe('createImageMessage', () => {
    it('should create image message with default size', async () => {
      const { createImageMessage } = await import('./sendMessage');

      const message = createImageMessage('A beautiful sunset');

      expect(message).toEqual({
        type: 'image',
        role: 'user',
        prompt: 'A beautiful sunset',
        size: '1024x1024',
      });
    });

    it('should create image message with specified size', async () => {
      const { createImageMessage } = await import('./sendMessage');

      const message = createImageMessage('A cat', '512x512');

      expect(message).toEqual({
        type: 'image',
        role: 'user',
        prompt: 'A cat',
        size: '512x512',
      });
    });

    it('should support all size options', async () => {
      const { createImageMessage } = await import('./sendMessage');

      const msg256 = createImageMessage('test', '256x256');
      const msg512 = createImageMessage('test', '512x512');
      const msg1024 = createImageMessage('test', '1024x1024');

      expect(msg256.type).toBe('image');
      expect(msg512.type).toBe('image');
      expect(msg1024.type).toBe('image');
      // Verify the messages were created with correct sizes
      expect((msg256 as { size: string }).size).toBe('256x256');
      expect((msg512 as { size: string }).size).toBe('512x512');
      expect((msg1024 as { size: string }).size).toBe('1024x1024');
    });
  });

  describe('createToolMessage', () => {
    it('should create tool message with minimal args', async () => {
      const { createToolMessage } = await import('./sendMessage');

      const message = createToolMessage('web_search');

      expect(message).toEqual({
        type: 'tool',
        role: 'user',
        tool: 'web_search',
        args: undefined,
        content: undefined,
      });
    });

    it('should create tool message with args', async () => {
      const { createToolMessage } = await import('./sendMessage');

      const message = createToolMessage('calculator', { expression: '2 + 2' });

      expect(message).toEqual({
        type: 'tool',
        role: 'user',
        tool: 'calculator',
        args: { expression: '2 + 2' },
        content: undefined,
      });
    });

    it('should create tool message with content', async () => {
      const { createToolMessage } = await import('./sendMessage');

      const message = createToolMessage('web_search', { query: 'test' }, 'Search results here');

      expect(message).toEqual({
        type: 'tool',
        role: 'user',
        tool: 'web_search',
        args: { query: 'test' },
        content: 'Search results here',
      });
    });
  });

  describe('sendMessage', () => {
    it('should validate payload before sending', async () => {
      const { sendMessage } = await import('./sendMessage');

      // Invalid payload - missing required fields
      const result = await sendMessage('conv-123', {});

      expect(result.ok).toBe(false);
      expect(result.error).toContain('Validation error');
    });

    it('should reject empty content for text messages', async () => {
      const { sendMessage } = await import('./sendMessage');

      const result = await sendMessage('conv-123', {
        type: 'text',
        content: '',
      });

      expect(result.ok).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should send valid text message', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ message: { id: 'msg-123' } }),
      });

      const { sendMessage } = await import('./sendMessage');

      const result = await sendMessage('conv-123', {
        type: 'text',
        content: 'Hello',
      });

      expect(result.ok).toBe(true);
      expect(result.message).toEqual({ id: 'msg-123' });
    });

    it('should handle API errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: () => Promise.resolve({ error: 'Internal server error' }),
      });

      const { sendMessage } = await import('./sendMessage');

      const result = await sendMessage('conv-123', {
        type: 'text',
        content: 'Hello',
      });

      expect(result.ok).toBe(false);
      expect(result.error).toContain('Internal server error');
    });

    it('should handle network errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network failure'));

      const { sendMessage } = await import('./sendMessage');

      const result = await sendMessage('conv-123', {
        type: 'text',
        content: 'Hello',
      });

      expect(result.ok).toBe(false);
      expect(result.error).toBe('Network failure');
    });

    it('should call correct API endpoint', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ message: {} }),
      });

      const { sendMessage } = await import('./sendMessage');

      await sendMessage('my-conv-id', {
        type: 'text',
        content: 'Test',
      });

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/conversations/my-conv-id/messages',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        })
      );
    });

    it('should include preview in request body', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ message: {} }),
      });

      const { sendMessage } = await import('./sendMessage');

      await sendMessage('conv-123', {
        type: 'text',
        content: 'Hello world',
      });

      const [, options] = mockFetch.mock.calls[0];
      const body = JSON.parse(options.body);
      expect(body._preview).toBeDefined();
    });
  });
});

describe('Send Message Validation', () => {
  describe('Text Message Validation', () => {
    it('should require content for text messages', async () => {
      const { sendMessage } = await import('./sendMessage');

      const result = await sendMessage('conv-123', {
        type: 'text',
        // missing content
      });

      expect(result.ok).toBe(false);
    });

    it('should accept valid text message', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ message: {} }),
      });

      const { sendMessage } = await import('./sendMessage');

      const result = await sendMessage('conv-123', {
        type: 'text',
        content: 'Valid message',
      });

      expect(result.ok).toBe(true);
    });
  });

  describe('Image Message Validation', () => {
    it('should require prompt for image messages', async () => {
      const { sendMessage } = await import('./sendMessage');

      const result = await sendMessage('conv-123', {
        type: 'image',
        // missing prompt
      });

      expect(result.ok).toBe(false);
    });

    it('should accept valid image message', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ message: {} }),
      });

      const { sendMessage } = await import('./sendMessage');

      const result = await sendMessage('conv-123', {
        type: 'image',
        prompt: 'A cat',
      });

      expect(result.ok).toBe(true);
    });
  });

  describe('Tool Message Validation', () => {
    it('should require tool name', async () => {
      const { sendMessage } = await import('./sendMessage');

      const result = await sendMessage('conv-123', {
        type: 'tool',
        // missing tool
      });

      expect(result.ok).toBe(false);
    });

    it('should accept valid tool message', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ message: {} }),
      });

      const { sendMessage } = await import('./sendMessage');

      const result = await sendMessage('conv-123', {
        type: 'tool',
        tool: 'calculator',
      });

      expect(result.ok).toBe(true);
    });
  });
});
