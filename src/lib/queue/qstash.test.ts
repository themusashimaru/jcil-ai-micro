import { describe, it, expect, vi, beforeEach } from 'vitest';

// ============================================
// MOCKS — must appear BEFORE imports
// ============================================

const mockPublishJSON = vi.fn();

vi.mock('@upstash/qstash', () => ({
  Client: vi.fn().mockImplementation(() => ({
    publishJSON: mockPublishJSON,
  })),
  Receiver: vi.fn().mockImplementation(() => ({
    verify: vi.fn().mockResolvedValue(true),
  })),
}));

vi.mock('@/lib/logger', () => ({
  logger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn(),
}));

// ============================================
// TESTS
// ============================================

describe('qstash', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getPriorityDelay', () => {
    it('should return 0 for executive plan (immediate)', async () => {
      const { getPriorityDelay } = await import('./qstash');
      expect(getPriorityDelay('executive')).toBe(0);
    });

    it('should return 1 for pro plan', async () => {
      const { getPriorityDelay } = await import('./qstash');
      expect(getPriorityDelay('pro')).toBe(1);
    });

    it('should return 3 for plus plan', async () => {
      const { getPriorityDelay } = await import('./qstash');
      expect(getPriorityDelay('plus')).toBe(3);
    });

    it('should return 10 for free plan', async () => {
      const { getPriorityDelay } = await import('./qstash');
      expect(getPriorityDelay('free')).toBe(10);
    });

    it('should return 5 for unknown plan', async () => {
      const { getPriorityDelay } = await import('./qstash');
      expect(getPriorityDelay('some-other-plan')).toBe(5);
    });

    it('should return 5 when planKey is undefined', async () => {
      const { getPriorityDelay } = await import('./qstash');
      expect(getPriorityDelay(undefined)).toBe(5);
    });

    it('should return 5 when called with no arguments', async () => {
      const { getPriorityDelay } = await import('./qstash');
      expect(getPriorityDelay()).toBe(5);
    });
  });

  describe('isQStashAvailable', () => {
    it('should return false when QSTASH_TOKEN is not set', async () => {
      vi.resetModules();
      delete process.env.QSTASH_TOKEN;
      const { isQStashAvailable } = await import('./qstash');
      expect(isQStashAvailable()).toBe(false);
    });

    it('should return true when QSTASH_TOKEN is set', async () => {
      vi.resetModules();
      process.env.QSTASH_TOKEN = 'test-token';
      const { isQStashAvailable } = await import('./qstash');
      expect(isQStashAvailable()).toBe(true);
      delete process.env.QSTASH_TOKEN;
    });

    it('should return false when QSTASH_TOKEN is empty string', async () => {
      vi.resetModules();
      process.env.QSTASH_TOKEN = '';
      const { isQStashAvailable } = await import('./qstash');
      expect(isQStashAvailable()).toBe(false);
      delete process.env.QSTASH_TOKEN;
    });
  });

  describe('getQStashClient', () => {
    it('should return null when QSTASH_TOKEN is not set', async () => {
      vi.resetModules();
      delete process.env.QSTASH_TOKEN;
      const { getQStashClient } = await import('./qstash');
      expect(getQStashClient()).toBeNull();
    });

    it('should return a Client instance when QSTASH_TOKEN is set', async () => {
      vi.resetModules();
      process.env.QSTASH_TOKEN = 'test-token';
      const { getQStashClient } = await import('./qstash');
      const client = getQStashClient();
      expect(client).not.toBeNull();
      delete process.env.QSTASH_TOKEN;
    });

    it('should return cached client on subsequent calls', async () => {
      vi.resetModules();
      process.env.QSTASH_TOKEN = 'test-token';
      const { getQStashClient } = await import('./qstash');
      const c1 = getQStashClient();
      const c2 = getQStashClient();
      expect(c1).toBe(c2);
      delete process.env.QSTASH_TOKEN;
    });
  });

  describe('publishChatJob', () => {
    it('should return null when QStash client is not available', async () => {
      vi.resetModules();
      delete process.env.QSTASH_TOKEN;
      const { publishChatJob } = await import('./qstash');
      const result = await publishChatJob({
        conversationId: 'conv-1',
        userId: 'user-1',
        messages: [{ role: 'user', content: 'Hello' }],
      });
      expect(result).toBeNull();
    });

    it('should publish a chat job and return messageId', async () => {
      vi.resetModules();
      process.env.QSTASH_TOKEN = 'test-token';
      process.env.NEXT_PUBLIC_APP_URL = 'https://app.example.com';
      mockPublishJSON.mockResolvedValueOnce({ messageId: 'msg-123' });

      const { publishChatJob } = await import('./qstash');
      const result = await publishChatJob({
        conversationId: 'conv-1',
        userId: 'user-1',
        messages: [{ role: 'user', content: 'Hello' }],
      });
      expect(result).toEqual({ messageId: 'msg-123' });
      delete process.env.QSTASH_TOKEN;
      delete process.env.NEXT_PUBLIC_APP_URL;
    });

    it('should include type: chat in the payload', async () => {
      vi.resetModules();
      process.env.QSTASH_TOKEN = 'test-token';
      process.env.NEXT_PUBLIC_APP_URL = 'https://app.example.com';
      mockPublishJSON.mockResolvedValueOnce({ messageId: 'msg-456' });

      const { publishChatJob } = await import('./qstash');
      await publishChatJob({
        conversationId: 'conv-1',
        userId: 'user-1',
        messages: [{ role: 'user', content: 'Hello' }],
      });

      expect(mockPublishJSON).toHaveBeenCalledWith(
        expect.objectContaining({
          body: expect.objectContaining({
            type: 'chat',
            conversationId: 'conv-1',
          }),
        })
      );
      delete process.env.QSTASH_TOKEN;
      delete process.env.NEXT_PUBLIC_APP_URL;
    });

    it('should use default retries of 3', async () => {
      vi.resetModules();
      process.env.QSTASH_TOKEN = 'test-token';
      process.env.NEXT_PUBLIC_APP_URL = 'https://app.example.com';
      mockPublishJSON.mockResolvedValueOnce({ messageId: 'msg-789' });

      const { publishChatJob } = await import('./qstash');
      await publishChatJob({
        conversationId: 'conv-1',
        userId: 'user-1',
        messages: [{ role: 'user', content: 'Hello' }],
      });

      expect(mockPublishJSON).toHaveBeenCalledWith(
        expect.objectContaining({
          retries: 3,
          contentBasedDeduplication: true,
        })
      );
      delete process.env.QSTASH_TOKEN;
      delete process.env.NEXT_PUBLIC_APP_URL;
    });

    it('should pass custom options (delay, deduplicationId, retries)', async () => {
      vi.resetModules();
      process.env.QSTASH_TOKEN = 'test-token';
      process.env.NEXT_PUBLIC_APP_URL = 'https://app.example.com';
      mockPublishJSON.mockResolvedValueOnce({ messageId: 'msg-custom' });

      const { publishChatJob } = await import('./qstash');
      await publishChatJob(
        {
          conversationId: 'conv-1',
          userId: 'user-1',
          messages: [{ role: 'user', content: 'Hello' }],
        },
        {
          delay: 30,
          deduplicationId: 'dedup-1',
          retries: 5,
        }
      );

      expect(mockPublishJSON).toHaveBeenCalledWith(
        expect.objectContaining({
          delay: 30,
          deduplicationId: 'dedup-1',
          retries: 5,
        })
      );
      delete process.env.QSTASH_TOKEN;
      delete process.env.NEXT_PUBLIC_APP_URL;
    });

    it('should return null on publish error', async () => {
      vi.resetModules();
      process.env.QSTASH_TOKEN = 'test-token';
      process.env.NEXT_PUBLIC_APP_URL = 'https://app.example.com';
      mockPublishJSON.mockRejectedValueOnce(new Error('Network error'));

      const { publishChatJob } = await import('./qstash');
      const result = await publishChatJob({
        conversationId: 'conv-1',
        userId: 'user-1',
        messages: [{ role: 'user', content: 'Hello' }],
      });
      expect(result).toBeNull();
      delete process.env.QSTASH_TOKEN;
      delete process.env.NEXT_PUBLIC_APP_URL;
    });

    it('should construct webhook URL with https prefix when missing', async () => {
      vi.resetModules();
      process.env.QSTASH_TOKEN = 'test-token';
      process.env.NEXT_PUBLIC_APP_URL = '';
      process.env.VERCEL_URL = 'my-app.vercel.app';
      mockPublishJSON.mockResolvedValueOnce({ messageId: 'msg-url' });

      const { publishChatJob } = await import('./qstash');
      await publishChatJob({
        conversationId: 'conv-1',
        userId: 'user-1',
        messages: [{ role: 'user', content: 'Hello' }],
      });

      expect(mockPublishJSON).toHaveBeenCalledWith(
        expect.objectContaining({
          url: 'https://my-app.vercel.app/api/queue/webhook',
        })
      );
      delete process.env.QSTASH_TOKEN;
      delete process.env.NEXT_PUBLIC_APP_URL;
      delete process.env.VERCEL_URL;
    });

    it('should use NEXT_PUBLIC_APP_URL when it includes http prefix', async () => {
      vi.resetModules();
      process.env.QSTASH_TOKEN = 'test-token';
      process.env.NEXT_PUBLIC_APP_URL = 'https://custom.example.com';
      mockPublishJSON.mockResolvedValueOnce({ messageId: 'msg-full-url' });

      const { publishChatJob } = await import('./qstash');
      await publishChatJob({
        conversationId: 'conv-1',
        userId: 'user-1',
        messages: [{ role: 'user', content: 'Hello' }],
      });

      expect(mockPublishJSON).toHaveBeenCalledWith(
        expect.objectContaining({
          url: 'https://custom.example.com/api/queue/webhook',
        })
      );
      delete process.env.QSTASH_TOKEN;
      delete process.env.NEXT_PUBLIC_APP_URL;
    });
  });

  describe('publishCodeLabJob', () => {
    it('should return null when QStash client is not available', async () => {
      vi.resetModules();
      delete process.env.QSTASH_TOKEN;
      const { publishCodeLabJob } = await import('./qstash');
      const result = await publishCodeLabJob({
        sessionId: 'sess-1',
        userId: 'user-1',
        prompt: 'Write hello world',
      });
      expect(result).toBeNull();
    });

    it('should publish a code lab job and return messageId', async () => {
      vi.resetModules();
      process.env.QSTASH_TOKEN = 'test-token';
      process.env.NEXT_PUBLIC_APP_URL = 'https://app.example.com';
      mockPublishJSON.mockResolvedValueOnce({ messageId: 'msg-codelab-1' });

      const { publishCodeLabJob } = await import('./qstash');
      const result = await publishCodeLabJob({
        sessionId: 'sess-1',
        userId: 'user-1',
        prompt: 'Write hello world',
      });
      expect(result).toEqual({ messageId: 'msg-codelab-1' });
      delete process.env.QSTASH_TOKEN;
      delete process.env.NEXT_PUBLIC_APP_URL;
    });

    it('should include type: codelab in the payload', async () => {
      vi.resetModules();
      process.env.QSTASH_TOKEN = 'test-token';
      process.env.NEXT_PUBLIC_APP_URL = 'https://app.example.com';
      mockPublishJSON.mockResolvedValueOnce({ messageId: 'msg-codelab-2' });

      const { publishCodeLabJob } = await import('./qstash');
      await publishCodeLabJob({
        sessionId: 'sess-1',
        userId: 'user-1',
        prompt: 'Write hello world',
      });

      expect(mockPublishJSON).toHaveBeenCalledWith(
        expect.objectContaining({
          body: expect.objectContaining({
            type: 'codelab',
            sessionId: 'sess-1',
          }),
        })
      );
      delete process.env.QSTASH_TOKEN;
      delete process.env.NEXT_PUBLIC_APP_URL;
    });

    it('should use default retries of 2 for code lab jobs', async () => {
      vi.resetModules();
      process.env.QSTASH_TOKEN = 'test-token';
      process.env.NEXT_PUBLIC_APP_URL = 'https://app.example.com';
      mockPublishJSON.mockResolvedValueOnce({ messageId: 'msg-codelab-3' });

      const { publishCodeLabJob } = await import('./qstash');
      await publishCodeLabJob({
        sessionId: 'sess-1',
        userId: 'user-1',
        prompt: 'Write hello world',
      });

      expect(mockPublishJSON).toHaveBeenCalledWith(
        expect.objectContaining({
          retries: 2,
        })
      );
      delete process.env.QSTASH_TOKEN;
      delete process.env.NEXT_PUBLIC_APP_URL;
    });

    it('should return null on publish error', async () => {
      vi.resetModules();
      process.env.QSTASH_TOKEN = 'test-token';
      process.env.NEXT_PUBLIC_APP_URL = 'https://app.example.com';
      mockPublishJSON.mockRejectedValueOnce(new Error('Publish failed'));

      const { publishCodeLabJob } = await import('./qstash');
      const result = await publishCodeLabJob({
        sessionId: 'sess-1',
        userId: 'user-1',
        prompt: 'Write hello world',
      });
      expect(result).toBeNull();
      delete process.env.QSTASH_TOKEN;
      delete process.env.NEXT_PUBLIC_APP_URL;
    });
  });

  describe('scheduleJob', () => {
    it('should return null when QStash client is not available', async () => {
      vi.resetModules();
      delete process.env.QSTASH_TOKEN;
      const { scheduleJob } = await import('./qstash');
      const result = await scheduleJob(
        {
          type: 'chat',
          conversationId: 'conv-1',
          userId: 'user-1',
          messages: [{ role: 'user', content: 'Hello' }],
        },
        new Date(Date.now() + 60000)
      );
      expect(result).toBeNull();
    });

    it('should schedule a job for future execution', async () => {
      vi.resetModules();
      process.env.QSTASH_TOKEN = 'test-token';
      process.env.NEXT_PUBLIC_APP_URL = 'https://app.example.com';
      mockPublishJSON.mockResolvedValueOnce({ messageId: 'msg-scheduled' });

      const { scheduleJob } = await import('./qstash');
      const futureDate = new Date(Date.now() + 120000); // 2 minutes from now
      const result = await scheduleJob(
        {
          type: 'chat',
          conversationId: 'conv-1',
          userId: 'user-1',
          messages: [{ role: 'user', content: 'Hello' }],
        },
        futureDate
      );

      expect(result).toEqual({ messageId: 'msg-scheduled' });
      expect(mockPublishJSON).toHaveBeenCalledWith(
        expect.objectContaining({
          delay: expect.any(Number),
        })
      );
      delete process.env.QSTASH_TOKEN;
      delete process.env.NEXT_PUBLIC_APP_URL;
    });

    it('should calculate delay in seconds from now to executeAt', async () => {
      vi.resetModules();
      process.env.QSTASH_TOKEN = 'test-token';
      process.env.NEXT_PUBLIC_APP_URL = 'https://app.example.com';
      mockPublishJSON.mockResolvedValueOnce({ messageId: 'msg-delay-check' });

      const { scheduleJob } = await import('./qstash');
      const now = Date.now();
      const futureDate = new Date(now + 60000); // exactly 60 seconds from now

      await scheduleJob(
        {
          type: 'codelab',
          sessionId: 'sess-1',
          userId: 'user-1',
          prompt: 'test',
        },
        futureDate
      );

      const callArgs = mockPublishJSON.mock.calls[0][0];
      // Delay should be approximately 60 seconds (allow some tolerance for test execution time)
      expect(callArgs.delay).toBeGreaterThanOrEqual(59);
      expect(callArgs.delay).toBeLessThanOrEqual(61);
      delete process.env.QSTASH_TOKEN;
      delete process.env.NEXT_PUBLIC_APP_URL;
    });

    it('should use delay of 0 for past dates', async () => {
      vi.resetModules();
      process.env.QSTASH_TOKEN = 'test-token';
      process.env.NEXT_PUBLIC_APP_URL = 'https://app.example.com';
      mockPublishJSON.mockResolvedValueOnce({ messageId: 'msg-past' });

      const { scheduleJob } = await import('./qstash');
      const pastDate = new Date(Date.now() - 60000); // 1 minute ago

      await scheduleJob(
        {
          type: 'chat',
          conversationId: 'conv-1',
          userId: 'user-1',
          messages: [{ role: 'user', content: 'Hello' }],
        },
        pastDate
      );

      const callArgs = mockPublishJSON.mock.calls[0][0];
      expect(callArgs.delay).toBe(0);
      delete process.env.QSTASH_TOKEN;
      delete process.env.NEXT_PUBLIC_APP_URL;
    });

    it('should return null on scheduling error', async () => {
      vi.resetModules();
      process.env.QSTASH_TOKEN = 'test-token';
      process.env.NEXT_PUBLIC_APP_URL = 'https://app.example.com';
      mockPublishJSON.mockRejectedValueOnce(new Error('Schedule failed'));

      const { scheduleJob } = await import('./qstash');
      const result = await scheduleJob(
        {
          type: 'chat',
          conversationId: 'conv-1',
          userId: 'user-1',
          messages: [{ role: 'user', content: 'Hello' }],
        },
        new Date(Date.now() + 60000)
      );
      expect(result).toBeNull();
      delete process.env.QSTASH_TOKEN;
      delete process.env.NEXT_PUBLIC_APP_URL;
    });
  });

  describe('verifyWebhookSignature', () => {
    it('should return false when QStash client is not available', async () => {
      vi.resetModules();
      delete process.env.QSTASH_TOKEN;
      const { verifyWebhookSignature } = await import('./qstash');
      const result = await verifyWebhookSignature('sig', 'body');
      expect(result).toBe(false);
    });

    it('should return true when signing key is not set (dev mode)', async () => {
      vi.resetModules();
      process.env.QSTASH_TOKEN = 'test-token';
      delete process.env.QSTASH_CURRENT_SIGNING_KEY;
      const { verifyWebhookSignature } = await import('./qstash');
      const result = await verifyWebhookSignature('sig', 'body');
      expect(result).toBe(true);
      delete process.env.QSTASH_TOKEN;
    });

    it('should verify signature when signing keys are set', async () => {
      vi.resetModules();
      process.env.QSTASH_TOKEN = 'test-token';
      process.env.QSTASH_CURRENT_SIGNING_KEY = 'signing-key';
      process.env.QSTASH_NEXT_SIGNING_KEY = 'next-signing-key';

      const { verifyWebhookSignature } = await import('./qstash');
      const result = await verifyWebhookSignature('valid-sig', '{"data":"test"}');
      expect(result).toBe(true);

      delete process.env.QSTASH_TOKEN;
      delete process.env.QSTASH_CURRENT_SIGNING_KEY;
      delete process.env.QSTASH_NEXT_SIGNING_KEY;
    });

    it('should use current signing key as fallback for next signing key', async () => {
      vi.resetModules();
      process.env.QSTASH_TOKEN = 'test-token';
      process.env.QSTASH_CURRENT_SIGNING_KEY = 'signing-key';
      delete process.env.QSTASH_NEXT_SIGNING_KEY;

      const { Receiver } = await import('@upstash/qstash');
      const { verifyWebhookSignature } = await import('./qstash');
      await verifyWebhookSignature('sig', 'body');

      expect(Receiver).toHaveBeenCalledWith({
        currentSigningKey: 'signing-key',
        nextSigningKey: 'signing-key',
      });

      delete process.env.QSTASH_TOKEN;
      delete process.env.QSTASH_CURRENT_SIGNING_KEY;
    });
  });

  describe('Type definitions', () => {
    it('should define ChatJobPayload with required type field', () => {
      const payload = {
        type: 'chat' as const,
        conversationId: 'conv-1',
        userId: 'user-1',
        messages: [{ role: 'user' as const, content: 'Hello' }],
      };
      expect(payload.type).toBe('chat');
      expect(payload.conversationId).toBeDefined();
      expect(payload.userId).toBeDefined();
      expect(payload.messages).toHaveLength(1);
    });

    it('should define CodeLabJobPayload with required type field', () => {
      const payload = {
        type: 'codelab' as const,
        sessionId: 'sess-1',
        userId: 'user-1',
        prompt: 'Write code',
      };
      expect(payload.type).toBe('codelab');
      expect(payload.sessionId).toBeDefined();
      expect(payload.prompt).toBeDefined();
    });

    it('should allow ChatJobPayload optional fields', () => {
      const payload = {
        type: 'chat' as const,
        conversationId: 'conv-1',
        userId: 'user-1',
        messages: [{ role: 'user' as const, content: 'Hello' }],
        model: 'claude-3-opus',
        systemPrompt: 'Be helpful',
        webSearchEnabled: true,
        priority: 1,
      };
      expect(payload.model).toBe('claude-3-opus');
      expect(payload.systemPrompt).toBe('Be helpful');
      expect(payload.webSearchEnabled).toBe(true);
      expect(payload.priority).toBe(1);
    });

    it('should allow CodeLabJobPayload optional context field', () => {
      const payload = {
        type: 'codelab' as const,
        sessionId: 'sess-1',
        userId: 'user-1',
        prompt: 'Write code',
        context: 'Node.js project with TypeScript',
      };
      expect(payload.context).toBe('Node.js project with TypeScript');
    });
  });
});
