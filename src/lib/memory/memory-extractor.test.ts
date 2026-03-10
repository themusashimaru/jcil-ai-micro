import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/logger', () => ({
  logger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

vi.mock('@/lib/anthropic/client', () => ({
  createAnthropicCompletion: vi.fn(),
  CLAUDE_HAIKU: 'claude-3-haiku-mock',
}));

import {
  extractMemoryFromConversation,
  shouldExtractMemory,
  extractTopicsLocally,
} from './memory-extractor';
import { createAnthropicCompletion } from '@/lib/anthropic/client';

const mockCompletion = vi.mocked(createAnthropicCompletion);

// -------------------------------------------------------------------
// shouldExtractMemory (pure logic - no AI)
// -------------------------------------------------------------------
describe('shouldExtractMemory', () => {
  it('should return false for empty messages', () => {
    expect(shouldExtractMemory([])).toBe(false);
  });

  it('should return false for null/undefined', () => {
    expect(shouldExtractMemory(null as unknown as [])).toBe(false);
  });

  it('should return false for single message', () => {
    expect(shouldExtractMemory([{ role: 'user', content: 'Hello' }])).toBe(false);
  });

  it('should return false for short user messages', () => {
    const msgs = [
      { role: 'user', content: 'Hi' },
      { role: 'assistant', content: 'Hello there! How can I help you today?' },
    ];
    expect(shouldExtractMemory(msgs)).toBe(false);
  });

  it('should return true when user shares their name', () => {
    const msgs = [
      { role: 'user', content: 'my name is John and I am building an app today that is cool' },
      { role: 'assistant', content: 'Nice to meet you John!' },
    ];
    expect(shouldExtractMemory(msgs)).toBe(true);
  });

  it('should return true when user mentions work', () => {
    const msgs = [
      { role: 'user', content: 'i work at a tech startup as a software engineer and its great' },
      { role: 'assistant', content: 'That sounds exciting!' },
    ];
    expect(shouldExtractMemory(msgs)).toBe(true);
  });

  it('should return true when user mentions family', () => {
    const msgs = [
      { role: 'user', content: 'my wife and I are planning a trip to Japan for our anniversary' },
      { role: 'assistant', content: 'That sounds wonderful!' },
    ];
    expect(shouldExtractMemory(msgs)).toBe(true);
  });

  it('should return true when user mentions preferences', () => {
    const msgs = [
      {
        role: 'user',
        content: 'i like coding in typescript and prefer functional programming style',
      },
      { role: 'assistant', content: 'Great choice!' },
    ];
    expect(shouldExtractMemory(msgs)).toBe(true);
  });

  it('should return true when user mentions goals', () => {
    const msgs = [
      {
        role: 'user',
        content: 'i want to learn machine learning and build an AI product this year soon',
      },
      { role: 'assistant', content: 'That is a great goal!' },
    ];
    expect(shouldExtractMemory(msgs)).toBe(true);
  });

  it('should return true when user mentions studying', () => {
    const msgs = [
      {
        role: 'user',
        content: 'i studied computer science at MIT and graduated recently last year',
      },
      { role: 'assistant', content: 'That is a great school!' },
    ];
    expect(shouldExtractMemory(msgs)).toBe(true);
  });

  it('should return true for "call me" pattern', () => {
    const msgs = [
      {
        role: 'user',
        content: 'please call me Alex and I prefer casual conversation when chatting',
      },
      { role: 'assistant', content: 'Sure thing, Alex!' },
    ];
    expect(shouldExtractMemory(msgs)).toBe(true);
  });

  it('should return true for "I am" pattern', () => {
    const msgs = [
      {
        role: 'user',
        content: 'I am a designer working on a new portfolio for my client projects',
      },
      { role: 'assistant', content: 'That sounds great!' },
    ];
    expect(shouldExtractMemory(msgs)).toBe(true);
  });

  it('should return false for generic questions', () => {
    const msgs = [
      { role: 'user', content: 'What is the capital of France? Can you tell me about it today?' },
      { role: 'assistant', content: 'The capital of France is Paris.' },
    ];
    expect(shouldExtractMemory(msgs)).toBe(false);
  });

  it('should return true when user mentions living location', () => {
    const msgs = [
      {
        role: 'user',
        content: 'i live in San Francisco and love the weather here in the bay area',
      },
      { role: 'assistant', content: 'SF is a great city!' },
    ];
    expect(shouldExtractMemory(msgs)).toBe(true);
  });
});

// -------------------------------------------------------------------
// extractTopicsLocally (pure logic - no AI)
// -------------------------------------------------------------------
describe('extractTopicsLocally', () => {
  it('should return empty for empty messages', () => {
    expect(extractTopicsLocally([])).toEqual([]);
  });

  it('should detect scripture topic', () => {
    const msgs = [{ role: 'user', content: 'What does the bible say about love?' }];
    const topics = extractTopicsLocally(msgs);
    expect(topics).toContain('scripture');
  });

  it('should detect prayer topic', () => {
    const msgs = [{ role: 'user', content: 'Help me write a prayer for healing' }];
    const topics = extractTopicsLocally(msgs);
    expect(topics).toContain('prayer');
  });

  it('should detect faith topic', () => {
    const msgs = [{ role: 'user', content: 'I want to grow my faith in God' }];
    const topics = extractTopicsLocally(msgs);
    expect(topics).toContain('faith');
  });

  it('should detect programming topic', () => {
    const msgs = [{ role: 'user', content: 'How do I write better code in Python?' }];
    const topics = extractTopicsLocally(msgs);
    expect(topics).toContain('programming');
  });

  it('should detect business topic', () => {
    const msgs = [{ role: 'user', content: 'Help me plan my startup idea' }];
    const topics = extractTopicsLocally(msgs);
    expect(topics).toContain('business');
  });

  it('should detect health topic', () => {
    const msgs = [{ role: 'user', content: 'What is a good diet for losing weight?' }];
    const topics = extractTopicsLocally(msgs);
    expect(topics).toContain('health');
  });

  it('should detect family topic', () => {
    const msgs = [{ role: 'user', content: 'Tips for parenting a teenager' }];
    const topics = extractTopicsLocally(msgs);
    expect(topics).toContain('family');
  });

  it('should detect education topic', () => {
    const msgs = [{ role: 'user', content: 'Best ways to study for exams' }];
    const topics = extractTopicsLocally(msgs);
    expect(topics).toContain('education');
  });

  it('should detect career topic', () => {
    const msgs = [{ role: 'user', content: 'How to advance in my career path' }];
    const topics = extractTopicsLocally(msgs);
    expect(topics).toContain('career');
  });

  it('should detect finance topic', () => {
    const msgs = [{ role: 'user', content: 'How should I invest my money wisely?' }];
    const topics = extractTopicsLocally(msgs);
    expect(topics).toContain('finance');
  });

  it('should detect travel topic', () => {
    const msgs = [{ role: 'user', content: 'Planning a vacation to Europe this summer' }];
    const topics = extractTopicsLocally(msgs);
    expect(topics).toContain('travel');
  });

  it('should detect cooking topic', () => {
    const msgs = [{ role: 'user', content: 'What is a good recipe for pasta?' }];
    const topics = extractTopicsLocally(msgs);
    expect(topics).toContain('cooking');
  });

  it('should detect writing topic', () => {
    const msgs = [{ role: 'user', content: 'Help me write a short story for class' }];
    const topics = extractTopicsLocally(msgs);
    expect(topics).toContain('writing');
  });

  it('should detect music topic', () => {
    const msgs = [{ role: 'user', content: 'Who is the best artist of all time?' }];
    const topics = extractTopicsLocally(msgs);
    expect(topics).toContain('music');
  });

  it('should detect multiple topics', () => {
    const msgs = [{ role: 'user', content: 'I study at university and work on code in my career' }];
    const topics = extractTopicsLocally(msgs);
    expect(topics.length).toBeGreaterThanOrEqual(2);
  });

  it('should limit to 5 topics', () => {
    const msgs = [
      {
        role: 'user',
        content:
          'I pray and study the bible for my faith while cooking food and writing about music and travel with my family doing exercise for health at my job career while managing my finance and budget at my startup business',
      },
    ];
    const topics = extractTopicsLocally(msgs);
    expect(topics.length).toBeLessThanOrEqual(5);
  });

  it('should handle non-string content', () => {
    const msgs = [{ role: 'user', content: 123 as unknown as string }];
    const topics = extractTopicsLocally(msgs);
    expect(topics).toEqual([]);
  });

  it('should analyze both user and assistant messages', () => {
    const msgs = [
      { role: 'user', content: 'tell me something' },
      { role: 'assistant', content: 'Here is a bible verse for you about prayer' },
    ];
    const topics = extractTopicsLocally(msgs);
    expect(topics).toContain('scripture');
    expect(topics).toContain('prayer');
  });
});

// -------------------------------------------------------------------
// extractMemoryFromConversation (with AI mock)
// -------------------------------------------------------------------
describe('extractMemoryFromConversation', () => {
  it('should return default extraction for empty messages', async () => {
    const result = await extractMemoryFromConversation([]);
    expect(result).toEqual({
      facts: [],
      topics: [],
      summary: '',
      confidence: 0,
    });
  });

  it('should return default extraction for single message', async () => {
    const result = await extractMemoryFromConversation([{ role: 'user', content: 'Hello' }]);
    expect(result).toEqual({
      facts: [],
      topics: [],
      summary: '',
      confidence: 0,
    });
  });

  it('should return default extraction for short conversation', async () => {
    const result = await extractMemoryFromConversation([
      { role: 'user', content: 'Hi' },
      { role: 'assistant', content: 'Hello!' },
    ]);
    // Conversation text is under 100 chars
    expect(result.facts).toEqual([]);
  });

  it('should call AI for sufficiently long conversations', async () => {
    mockCompletion.mockResolvedValueOnce({
      text: JSON.stringify({
        facts: [
          {
            category: 'personal',
            fact: 'User is named John',
            key: 'name',
            value: 'John',
            confidence: 0.95,
          },
        ],
        topics: ['introduction', 'engineering'],
        summary: 'User introduced themselves as John, a software engineer.',
      }),
    } as never);

    const result = await extractMemoryFromConversation([
      {
        role: 'user',
        content:
          'My name is John and I am a software engineer working at a tech company in San Francisco. I have been working there for 3 years now.',
      },
      {
        role: 'assistant',
        content:
          'Nice to meet you John! It sounds like you have some great experience in software engineering. How can I help you today?',
      },
    ]);

    expect(result.facts.length).toBe(1);
    expect(result.facts[0].category).toBe('personal');
    expect(result.facts[0].value).toBe('John');
    expect(result.topics).toEqual(['introduction', 'engineering']);
    expect(result.summary).toContain('John');
  });

  it('should handle empty AI response', async () => {
    mockCompletion.mockResolvedValueOnce({ text: '' } as never);

    const longMsg = 'A'.repeat(200);
    const result = await extractMemoryFromConversation([
      { role: 'user', content: longMsg },
      { role: 'assistant', content: longMsg },
    ]);

    expect(result.facts).toEqual([]);
  });

  it('should handle AI error gracefully', async () => {
    mockCompletion.mockRejectedValueOnce(new Error('API error'));

    const longMsg = 'A'.repeat(200);
    const result = await extractMemoryFromConversation([
      { role: 'user', content: longMsg },
      { role: 'assistant', content: longMsg },
    ]);

    expect(result.facts).toEqual([]);
    expect(result.confidence).toBe(0);
  });

  it('should handle invalid JSON from AI', async () => {
    mockCompletion.mockResolvedValueOnce({
      text: 'This is not JSON at all',
    } as never);

    const longMsg = 'A'.repeat(200);
    const result = await extractMemoryFromConversation([
      { role: 'user', content: longMsg },
      { role: 'assistant', content: longMsg },
    ]);

    expect(result.facts).toEqual([]);
  });

  it('should handle markdown-wrapped JSON from AI', async () => {
    const jsonResponse = JSON.stringify({
      facts: [
        {
          category: 'work',
          fact: 'Works at Google',
          key: 'employer',
          value: 'Google',
          confidence: 0.9,
        },
      ],
      topics: ['career'],
      summary: 'Discussed work at Google',
    });

    mockCompletion.mockResolvedValueOnce({
      text: '```json\n' + jsonResponse + '\n```',
    } as never);

    const longMsg = 'A'.repeat(200);
    const result = await extractMemoryFromConversation([
      { role: 'user', content: longMsg },
      { role: 'assistant', content: longMsg },
    ]);

    expect(result.facts.length).toBe(1);
    expect(result.facts[0].value).toBe('Google');
  });

  it('should sanitize extracted facts', async () => {
    mockCompletion.mockResolvedValueOnce({
      text: JSON.stringify({
        facts: [
          {
            category: 'INVALID_CATEGORY',
            fact: 'Some fact',
            key: 'k',
            value: 'v',
            confidence: 2.0, // Over 1.0
          },
        ],
        topics: ['t1'],
        summary: 'Summary text',
      }),
    } as never);

    const longMsg = 'A'.repeat(200);
    const result = await extractMemoryFromConversation([
      { role: 'user', content: longMsg },
      { role: 'assistant', content: longMsg },
    ]);

    // Invalid category should be normalized to 'other'
    expect(result.facts[0].category).toBe('other');
    // Confidence should be clamped to 1.0
    expect(result.facts[0].confidence).toBe(1);
  });

  it('should filter out invalid facts', async () => {
    mockCompletion.mockResolvedValueOnce({
      text: JSON.stringify({
        facts: [
          { category: 'personal', fact: '' }, // Empty fact
          null, // Null entry
          { category: 'work', fact: 'Valid fact', key: 'k', value: 'v', confidence: 0.8 },
        ],
        topics: [],
        summary: '',
      }),
    } as never);

    const longMsg = 'A'.repeat(200);
    const result = await extractMemoryFromConversation([
      { role: 'user', content: longMsg },
      { role: 'assistant', content: longMsg },
    ]);

    expect(result.facts.length).toBe(1);
    expect(result.facts[0].fact).toBe('Valid fact');
  });
});
