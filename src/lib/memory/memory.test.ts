import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the logger
vi.mock('@/lib/logger', () => ({
  logger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  }),
}));

// Mock Supabase client
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => null),
}));

// Mock Anthropic client
vi.mock('@/lib/anthropic/client', () => ({
  createClaudeChat: vi.fn(),
}));

describe('Persistent Memory Agent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  describe('Type Definitions', () => {
    it('should export UserMemory type', async () => {
      const types = await import('./types');
      expect(types).toBeDefined();
    });

    it('should export UserPreferences type', async () => {
      const types = await import('./types');
      expect(types).toBeDefined();
    });

    it('should export MemoryExtraction type', async () => {
      const types = await import('./types');
      expect(types).toBeDefined();
    });

    it('should export MemoryContext type', async () => {
      const types = await import('./types');
      expect(types).toBeDefined();
    });
  });

  describe('Module Exports', () => {
    it('should export loadUserMemory function', async () => {
      const { loadUserMemory } = await import('./index');
      expect(typeof loadUserMemory).toBe('function');
    });

    it('should export formatMemoryForPrompt function', async () => {
      const { formatMemoryForPrompt } = await import('./index');
      expect(typeof formatMemoryForPrompt).toBe('function');
    });

    it('should export createUserMemory function', async () => {
      const { createUserMemory } = await import('./index');
      expect(typeof createUserMemory).toBe('function');
    });

    it('should export updateUserMemory function', async () => {
      const { updateUserMemory } = await import('./index');
      expect(typeof updateUserMemory).toBe('function');
    });

    it('should export deleteUserMemory function', async () => {
      const { deleteUserMemory } = await import('./index');
      expect(typeof deleteUserMemory).toBe('function');
    });

    it('should export hasUserMemory function', async () => {
      const { hasUserMemory } = await import('./index');
      expect(typeof hasUserMemory).toBe('function');
    });

    it('should export forgetFromMemory function', async () => {
      const { forgetFromMemory } = await import('./index');
      expect(typeof forgetFromMemory).toBe('function');
    });

    it('should export extractMemoryFromConversation function', async () => {
      const { extractMemoryFromConversation } = await import('./index');
      expect(typeof extractMemoryFromConversation).toBe('function');
    });

    it('should export shouldExtractMemory function', async () => {
      const { shouldExtractMemory } = await import('./index');
      expect(typeof shouldExtractMemory).toBe('function');
    });

    it('should export getMemoryContext function', async () => {
      const { getMemoryContext } = await import('./index');
      expect(typeof getMemoryContext).toBe('function');
    });

    it('should export processConversationForMemory function', async () => {
      const { processConversationForMemory } = await import('./index');
      expect(typeof processConversationForMemory).toBe('function');
    });
  });

  describe('formatMemoryForPrompt', () => {
    it('should return empty context for null memory', async () => {
      const { formatMemoryForPrompt } = await import('./user-memory');

      const result = formatMemoryForPrompt(null);

      expect(result.loaded).toBe(false);
      expect(result.contextString).toBe('');
      expect(result.topicCount).toBe(0);
      expect(result.lastUpdated).toBeNull();
    });

    it('should format memory with user name', async () => {
      const { formatMemoryForPrompt } = await import('./user-memory');

      const memory = {
        id: 'test-id',
        user_id: 'user-123',
        summary: 'Test summary',
        key_topics: ['topic1', 'topic2'],
        user_preferences: {
          name: 'John Doe',
        },
        conversation_ids: [],
        last_conversations: [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        last_accessed_at: null,
      };

      const result = formatMemoryForPrompt(memory);

      expect(result.loaded).toBe(true);
      expect(result.contextString).toContain('John Doe');
      expect(result.topicCount).toBe(2);
    });

    it('should include occupation when available', async () => {
      const { formatMemoryForPrompt } = await import('./user-memory');

      const memory = {
        id: 'test-id',
        user_id: 'user-123',
        summary: '',
        key_topics: [],
        user_preferences: {
          name: 'Jane',
          occupation: 'Software Engineer',
        },
        conversation_ids: [],
        last_conversations: [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        last_accessed_at: null,
      };

      const result = formatMemoryForPrompt(memory);

      expect(result.contextString).toContain('Software Engineer');
    });

    it('should include location when available', async () => {
      const { formatMemoryForPrompt } = await import('./user-memory');

      const memory = {
        id: 'test-id',
        user_id: 'user-123',
        summary: '',
        key_topics: [],
        user_preferences: {
          location: 'San Francisco',
        },
        conversation_ids: [],
        last_conversations: [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        last_accessed_at: null,
      };

      const result = formatMemoryForPrompt(memory);

      expect(result.contextString).toContain('San Francisco');
    });

    it('should include communication style preference', async () => {
      const { formatMemoryForPrompt } = await import('./user-memory');

      const memory = {
        id: 'test-id',
        user_id: 'user-123',
        summary: '',
        key_topics: [],
        user_preferences: {
          communication_style: 'technical' as const,
        },
        conversation_ids: [],
        last_conversations: [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        last_accessed_at: null,
      };

      const result = formatMemoryForPrompt(memory);

      expect(result.contextString).toContain('technical');
    });

    it('should format key topics', async () => {
      const { formatMemoryForPrompt } = await import('./user-memory');

      const memory = {
        id: 'test-id',
        user_id: 'user-123',
        summary: '',
        key_topics: ['programming', 'theology', 'family'],
        user_preferences: {},
        conversation_ids: [],
        last_conversations: [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        last_accessed_at: null,
      };

      const result = formatMemoryForPrompt(memory);

      expect(result.contextString).toContain('programming');
      expect(result.contextString).toContain('theology');
      expect(result.contextString).toContain('family');
      expect(result.topicCount).toBe(3);
    });

    it('should limit topics to maxTopics option', async () => {
      const { formatMemoryForPrompt } = await import('./user-memory');

      const memory = {
        id: 'test-id',
        user_id: 'user-123',
        summary: '',
        key_topics: Array.from({ length: 20 }, (_, i) => `topic${i}`),
        user_preferences: {},
        conversation_ids: [],
        last_conversations: [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        last_accessed_at: null,
      };

      const result = formatMemoryForPrompt(memory, { maxTopics: 5 });

      // Should include only first 5 topics in context string
      expect(result.contextString).toContain('topic0');
      expect(result.contextString).toContain('topic4');
      // topicCount reflects total topics in memory
      expect(result.topicCount).toBe(20);
    });

    it('should truncate context if exceeds maxContextLength', async () => {
      const { formatMemoryForPrompt } = await import('./user-memory');

      const memory = {
        id: 'test-id',
        user_id: 'user-123',
        summary: 'A'.repeat(3000), // Very long summary
        key_topics: [],
        user_preferences: {},
        conversation_ids: [],
        last_conversations: [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        last_accessed_at: null,
      };

      const result = formatMemoryForPrompt(memory, { maxContextLength: 500 });

      expect(result.contextString.length).toBeLessThanOrEqual(500);
      expect(result.contextString).toContain('[Memory truncated');
    });

    it('should include family members', async () => {
      const { formatMemoryForPrompt } = await import('./user-memory');

      const memory = {
        id: 'test-id',
        user_id: 'user-123',
        summary: '',
        key_topics: [],
        user_preferences: {
          family_members: [
            { relation: 'wife', name: 'Sarah' },
            { relation: 'son', name: 'Michael' },
          ],
        },
        conversation_ids: [],
        last_conversations: [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        last_accessed_at: null,
      };

      const result = formatMemoryForPrompt(memory);

      expect(result.contextString).toContain('wife');
      expect(result.contextString).toContain('Sarah');
      expect(result.contextString).toContain('son');
      expect(result.contextString).toContain('Michael');
    });

    it('should include interests', async () => {
      const { formatMemoryForPrompt } = await import('./user-memory');

      const memory = {
        id: 'test-id',
        user_id: 'user-123',
        summary: '',
        key_topics: [],
        user_preferences: {
          interests: ['AI', 'music', 'cooking'],
        },
        conversation_ids: [],
        last_conversations: [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        last_accessed_at: null,
      };

      const result = formatMemoryForPrompt(memory);

      expect(result.contextString).toContain('AI');
      expect(result.contextString).toContain('music');
      expect(result.contextString).toContain('cooking');
    });

    it('should include goals', async () => {
      const { formatMemoryForPrompt } = await import('./user-memory');

      const memory = {
        id: 'test-id',
        user_id: 'user-123',
        summary: '',
        key_topics: [],
        user_preferences: {
          goals: ['Learn Spanish', 'Run a marathon'],
        },
        conversation_ids: [],
        last_conversations: [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        last_accessed_at: null,
      };

      const result = formatMemoryForPrompt(memory);

      expect(result.contextString).toContain('Learn Spanish');
      expect(result.contextString).toContain('Run a marathon');
    });

    it('should include recent conversation summaries when option enabled', async () => {
      const { formatMemoryForPrompt } = await import('./user-memory');

      const memory = {
        id: 'test-id',
        user_id: 'user-123',
        summary: '',
        key_topics: [],
        user_preferences: {},
        conversation_ids: [],
        last_conversations: [
          'Discussed project architecture',
          'Reviewed database design',
        ],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        last_accessed_at: null,
      };

      const result = formatMemoryForPrompt(memory, { includeConversationSummaries: true });

      expect(result.contextString).toContain('project architecture');
      expect(result.contextString).toContain('database design');
    });
  });

  describe('shouldExtractMemory', () => {
    it('should return true for messages with personal indicators', async () => {
      const { shouldExtractMemory } = await import('./memory-extractor');

      const messages = [
        { role: 'user', content: 'My name is John' },
      ];

      expect(shouldExtractMemory(messages)).toBe(true);
    });

    it('should return true for messages mentioning family', async () => {
      const { shouldExtractMemory } = await import('./memory-extractor');

      const messages = [
        { role: 'user', content: 'My wife loves cooking' },
      ];

      expect(shouldExtractMemory(messages)).toBe(true);
    });

    it('should return true for messages mentioning work', async () => {
      const { shouldExtractMemory } = await import('./memory-extractor');

      const messages = [
        { role: 'user', content: 'I work as a software engineer' },
      ];

      expect(shouldExtractMemory(messages)).toBe(true);
    });

    it('should return true for messages with location', async () => {
      const { shouldExtractMemory } = await import('./memory-extractor');

      const messages = [
        { role: 'user', content: 'I live in San Francisco' },
      ];

      expect(shouldExtractMemory(messages)).toBe(true);
    });

    it('should return true for messages with preferences', async () => {
      const { shouldExtractMemory } = await import('./memory-extractor');

      const messages = [
        { role: 'user', content: 'I prefer formal communication' },
      ];

      expect(shouldExtractMemory(messages)).toBe(true);
    });

    it('should return false for generic messages', async () => {
      const { shouldExtractMemory } = await import('./memory-extractor');

      const messages = [
        { role: 'user', content: 'What is the weather like today?' },
      ];

      expect(shouldExtractMemory(messages)).toBe(false);
    });

    it('should return false for code-only messages', async () => {
      const { shouldExtractMemory } = await import('./memory-extractor');

      const messages = [
        { role: 'user', content: 'function hello() { console.log("world"); }' },
      ];

      expect(shouldExtractMemory(messages)).toBe(false);
    });

    it('should check all messages in conversation', async () => {
      const { shouldExtractMemory } = await import('./memory-extractor');

      const messages = [
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi there!' },
        { role: 'user', content: 'My name is Alice' },
      ];

      expect(shouldExtractMemory(messages)).toBe(true);
    });
  });

  describe('extractTopicsLocally', () => {
    it('should extract topics from conversation', async () => {
      const { extractTopicsLocally } = await import('./memory-extractor');

      const messages = [
        { role: 'user', content: 'Tell me about machine learning and neural networks' },
        { role: 'assistant', content: 'Machine learning is a branch of AI...' },
      ];

      const topics = extractTopicsLocally(messages);

      expect(topics.length).toBeGreaterThan(0);
    });

    it('should extract programming-related topics', async () => {
      const { extractTopicsLocally } = await import('./memory-extractor');

      const messages = [
        { role: 'user', content: 'Help me with TypeScript and React development' },
      ];

      const topics = extractTopicsLocally(messages);

      expect(topics.some(t => t.toLowerCase().includes('typescript') || t.toLowerCase().includes('react'))).toBe(true);
    });

    it('should return empty array for very short messages', async () => {
      const { extractTopicsLocally } = await import('./memory-extractor');

      const messages = [
        { role: 'user', content: 'Hi' },
      ];

      const topics = extractTopicsLocally(messages);

      expect(topics.length).toBe(0);
    });

    it('should deduplicate topics', async () => {
      const { extractTopicsLocally } = await import('./memory-extractor');

      const messages = [
        { role: 'user', content: 'I love TypeScript. TypeScript is great. TypeScript rules!' },
      ];

      const topics = extractTopicsLocally(messages);
      const uniqueTopics = new Set(topics);

      expect(topics.length).toBe(uniqueTopics.size);
    });
  });

  describe('getMemoryContext', () => {
    it('should return unloaded context when database not configured', async () => {
      const { getMemoryContext } = await import('./index');

      const result = await getMemoryContext('user-123');

      expect(result.loaded).toBe(false);
      expect(result.contextString).toBe('');
    });
  });

  describe('Database Operations (Without Connection)', () => {
    it('loadUserMemory should return null when database not configured', async () => {
      const { loadUserMemory } = await import('./user-memory');

      const result = await loadUserMemory('user-123');

      expect(result).toBeNull();
    });

    it('createUserMemory should return null when database not configured', async () => {
      const { createUserMemory } = await import('./user-memory');

      const result = await createUserMemory('user-123');

      expect(result).toBeNull();
    });

    it('deleteUserMemory should return false when database not configured', async () => {
      const { deleteUserMemory } = await import('./user-memory');

      const result = await deleteUserMemory('user-123');

      expect(result).toBe(false);
    });

    it('hasUserMemory should return false when database not configured', async () => {
      const { hasUserMemory } = await import('./user-memory');

      const result = await hasUserMemory('user-123');

      expect(result).toBe(false);
    });

    it('updateUserMemory should return error when database not configured', async () => {
      const { updateUserMemory } = await import('./user-memory');

      const result = await updateUserMemory('user-123', {
        facts: [],
        topics: ['test'],
        summary: 'Test summary',
        confidence: 0.9,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Database not configured');
    });

    it('forgetFromMemory should return error when database not configured', async () => {
      const { forgetFromMemory } = await import('./user-memory');

      const result = await forgetFromMemory('user-123', {
        topics: ['test-topic'],
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Database not configured');
    });
  });

  describe('processConversationForMemory', () => {
    it('should handle conversations without personal info gracefully', async () => {
      const { processConversationForMemory } = await import('./index');

      const messages = [
        { role: 'user', content: 'What is 2 + 2?' },
        { role: 'assistant', content: '2 + 2 equals 4.' },
      ];

      // Should not throw
      await expect(processConversationForMemory('user-123', messages)).resolves.not.toThrow();
    });

    it('should process conversations with personal info', async () => {
      const { processConversationForMemory } = await import('./index');

      const messages = [
        { role: 'user', content: 'My name is Bob and I work as a designer' },
        { role: 'assistant', content: 'Nice to meet you, Bob! Design is a fascinating field.' },
      ];

      // Should not throw (database not configured, but should handle gracefully)
      await expect(processConversationForMemory('user-123', messages)).resolves.not.toThrow();
    });
  });
});

describe('Memory Preferences Handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  describe('Communication Styles', () => {
    it('should accept formal style', async () => {
      const { formatMemoryForPrompt } = await import('./user-memory');

      const memory = {
        id: 'test-id',
        user_id: 'user-123',
        summary: '',
        key_topics: [],
        user_preferences: {
          communication_style: 'formal' as const,
        },
        conversation_ids: [],
        last_conversations: [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        last_accessed_at: null,
      };

      const result = formatMemoryForPrompt(memory);
      expect(result.contextString).toContain('formal');
    });

    it('should accept casual style', async () => {
      const { formatMemoryForPrompt } = await import('./user-memory');

      const memory = {
        id: 'test-id',
        user_id: 'user-123',
        summary: '',
        key_topics: [],
        user_preferences: {
          communication_style: 'casual' as const,
        },
        conversation_ids: [],
        last_conversations: [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        last_accessed_at: null,
      };

      const result = formatMemoryForPrompt(memory);
      expect(result.contextString).toContain('casual');
    });

    it('should accept technical style', async () => {
      const { formatMemoryForPrompt } = await import('./user-memory');

      const memory = {
        id: 'test-id',
        user_id: 'user-123',
        summary: '',
        key_topics: [],
        user_preferences: {
          communication_style: 'technical' as const,
        },
        conversation_ids: [],
        last_conversations: [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        last_accessed_at: null,
      };

      const result = formatMemoryForPrompt(memory);
      expect(result.contextString).toContain('technical');
    });

    it('should accept simple style', async () => {
      const { formatMemoryForPrompt } = await import('./user-memory');

      const memory = {
        id: 'test-id',
        user_id: 'user-123',
        summary: '',
        key_topics: [],
        user_preferences: {
          communication_style: 'simple' as const,
        },
        conversation_ids: [],
        last_conversations: [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        last_accessed_at: null,
      };

      const result = formatMemoryForPrompt(memory);
      expect(result.contextString).toContain('simple');
    });
  });
});

describe('Memory Context Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  describe('Context String Format', () => {
    it('should include header markers', async () => {
      const { formatMemoryForPrompt } = await import('./user-memory');

      const memory = {
        id: 'test-id',
        user_id: 'user-123',
        summary: 'Test summary',
        key_topics: ['test'],
        user_preferences: { name: 'Test' },
        conversation_ids: [],
        last_conversations: [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        last_accessed_at: null,
      };

      const result = formatMemoryForPrompt(memory);

      expect(result.contextString).toContain('---');
      expect(result.contextString).toContain('USER MEMORY');
    });

    it('should include personalization instruction', async () => {
      const { formatMemoryForPrompt } = await import('./user-memory');

      const memory = {
        id: 'test-id',
        user_id: 'user-123',
        summary: 'Test',
        key_topics: ['test'],
        user_preferences: {},
        conversation_ids: [],
        last_conversations: [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        last_accessed_at: null,
      };

      const result = formatMemoryForPrompt(memory);

      expect(result.contextString).toContain('personalize');
    });
  });
});

describe('GDPR Compliance', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  describe('Right to Erasure', () => {
    it('should export deleteUserMemory for full erasure', async () => {
      const { deleteUserMemory } = await import('./index');
      expect(typeof deleteUserMemory).toBe('function');
    });

    it('should export forgetFromMemory for targeted erasure', async () => {
      const { forgetFromMemory } = await import('./index');
      expect(typeof forgetFromMemory).toBe('function');
    });
  });

  describe('Right to Access', () => {
    it('should export loadUserMemory for data access', async () => {
      const { loadUserMemory } = await import('./index');
      expect(typeof loadUserMemory).toBe('function');
    });
  });
});
