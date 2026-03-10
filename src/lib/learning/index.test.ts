import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock logger
vi.mock('@/lib/logger', () => ({
  logger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

// Mock Supabase client
const mockInsert = vi.fn();
const mockUpdate = vi.fn();
const mockDelete = vi.fn();
const mockSelect = vi.fn();

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: mockSelect,
      insert: mockInsert,
      update: mockUpdate,
      delete: mockDelete,
    })),
  })),
}));

import {
  detectPreferences,
  recordPreference,
  observeAndLearn,
  loadPreferences,
  getLearningContext,
  deleteUserLearning,
} from './index';

describe('detectPreferences', () => {
  it('should return empty array for plain text', () => {
    expect(detectPreferences('Hello, how are you?')).toEqual([]);
  });

  it('should detect bullet format preference', () => {
    const result = detectPreferences('Can you give me a bulleted list?');
    expect(result).toContainEqual({ type: 'format_style', value: 'bullets' });
  });

  it('should detect step-by-step format preference', () => {
    const result = detectPreferences('Please explain step by step');
    expect(result).toContainEqual({ type: 'format_style', value: 'step-by-step' });
  });

  it('should detect table format preference', () => {
    const result = detectPreferences('Show it in table format');
    expect(result).toContainEqual({ type: 'format_style', value: 'tables' });
  });

  it('should detect concise length preference', () => {
    const result = detectPreferences('Keep it brief please');
    expect(result).toContainEqual({ type: 'response_length', value: 'concise' });
  });

  it('should detect detailed length preference', () => {
    const result = detectPreferences('I need a detailed explanation');
    expect(result).toContainEqual({ type: 'response_length', value: 'detailed' });
  });

  it('should detect simple length preference', () => {
    const result = detectPreferences('Explain like I am 5 eli5');
    expect(result).toContainEqual({ type: 'response_length', value: 'simple' });
  });

  it('should detect formal tone preference', () => {
    const result = detectPreferences('Please respond formally');
    expect(result).toContainEqual({ type: 'communication_tone', value: 'formal' });
  });

  it('should detect casual tone preference', () => {
    const result = detectPreferences('Be casual about it');
    expect(result).toContainEqual({ type: 'communication_tone', value: 'casual' });
  });

  it('should detect technical tone preference', () => {
    const result = detectPreferences('Explain technically');
    expect(result).toContainEqual({ type: 'communication_tone', value: 'technical' });
  });

  it('should detect code output preference', () => {
    const result = detectPreferences('Show me code examples');
    expect(result).toContainEqual({ type: 'output_preference', value: 'code-examples' });
  });

  it('should detect visual output preference', () => {
    const result = detectPreferences('Can you make a diagram?');
    expect(result).toContainEqual({ type: 'output_preference', value: 'visual' });
  });

  it('should detect software-engineering domain', () => {
    const result = detectPreferences('How do I set up a nextjs api?');
    expect(result).toContainEqual({ type: 'domain_expertise', value: 'software-engineering' });
  });

  it('should detect business domain', () => {
    const result = detectPreferences('What is the roi of this investment?');
    expect(result).toContainEqual({ type: 'domain_expertise', value: 'business' });
  });

  it('should detect finance domain', () => {
    const result = detectPreferences('How should I invest in stocks?');
    expect(result).toContainEqual({ type: 'domain_expertise', value: 'finance' });
  });

  it('should detect theology domain', () => {
    const result = detectPreferences('What does the bible say about prayer?');
    expect(result).toContainEqual({ type: 'domain_expertise', value: 'theology' });
  });

  it('should detect AI/ML domain', () => {
    const result = detectPreferences('How does machine learning work?');
    expect(result).toContainEqual({ type: 'domain_expertise', value: 'ai-ml' });
  });

  it('should detect multiple preferences in one message', () => {
    const result = detectPreferences('Give me a brief bullet list of react components');
    expect(result.length).toBeGreaterThanOrEqual(3);
    const types = result.map((r) => r.type);
    expect(types).toContain('format_style');
    expect(types).toContain('response_length');
    expect(types).toContain('domain_expertise');
  });

  it('should be case insensitive', () => {
    const result = detectPreferences('BULLET LIST BRIEFLY');
    expect(result.length).toBeGreaterThanOrEqual(2);
  });

  it('should handle empty string', () => {
    expect(detectPreferences('')).toEqual([]);
  });

  it('should detect tldr as concise', () => {
    const result = detectPreferences('Just give me the tldr');
    expect(result).toContainEqual({ type: 'response_length', value: 'concise' });
  });

  it('should detect in-depth as detailed', () => {
    const result = detectPreferences('I need an in-depth analysis');
    expect(result).toContainEqual({ type: 'response_length', value: 'detailed' });
  });

  it('should detect snippet as code-examples', () => {
    const result = detectPreferences('Show me a snippet of that');
    expect(result).toContainEqual({ type: 'output_preference', value: 'code-examples' });
  });

  it('should detect chart as visual', () => {
    const result = detectPreferences('Create a chart of sales data');
    expect(result).toContainEqual({ type: 'output_preference', value: 'visual' });
  });

  it('should detect crypto as finance', () => {
    const result = detectPreferences('Should I invest in crypto?');
    expect(result).toContainEqual({ type: 'domain_expertise', value: 'finance' });
  });

  it('should detect llm as ai-ml', () => {
    const result = detectPreferences('How do I build an llm application?');
    expect(result).toContainEqual({ type: 'domain_expertise', value: 'ai-ml' });
  });

  it('should detect sermon as theology', () => {
    const result = detectPreferences('Help me write a sermon');
    expect(result).toContainEqual({ type: 'domain_expertise', value: 'theology' });
  });

  it('should detect startup as business', () => {
    const result = detectPreferences('What is the best startup business model?');
    expect(result).toContainEqual({ type: 'domain_expertise', value: 'business' });
  });
});

describe('recordPreference', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return silently when supabase is not configured', async () => {
    const origUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const origKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;

    // Should not throw
    await expect(recordPreference('user1', 'format_style', 'bullets')).resolves.toBeUndefined();

    process.env.NEXT_PUBLIC_SUPABASE_URL = origUrl;
    process.env.SUPABASE_SERVICE_ROLE_KEY = origKey;
  });
});

describe('observeAndLearn', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return early for messages with no detected preferences', async () => {
    await expect(observeAndLearn('user1', 'Hello there')).resolves.toBeUndefined();
  });

  it('should not throw on error', async () => {
    // Even with broken supabase, should not throw
    await expect(observeAndLearn('user1', 'Give me a brief bullet list')).resolves.toBeUndefined();
  });
});

describe('loadPreferences', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return empty array when supabase is not configured', async () => {
    const origUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const origKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;

    const result = await loadPreferences('user1');
    expect(result).toEqual([]);

    process.env.NEXT_PUBLIC_SUPABASE_URL = origUrl;
    process.env.SUPABASE_SERVICE_ROLE_KEY = origKey;
  });
});

describe('getLearningContext', () => {
  it('should return empty context when no preferences loaded', async () => {
    const origUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const origKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;

    const result = await getLearningContext('user1');
    expect(result).toEqual({
      loaded: false,
      preferences: [],
      contextString: '',
    });

    process.env.NEXT_PUBLIC_SUPABASE_URL = origUrl;
    process.env.SUPABASE_SERVICE_ROLE_KEY = origKey;
  });
});

describe('deleteUserLearning', () => {
  it('should return false when supabase is not configured', async () => {
    const origUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const origKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;

    const result = await deleteUserLearning('user1');
    expect(result).toBe(false);

    process.env.NEXT_PUBLIC_SUPABASE_URL = origUrl;
    process.env.SUPABASE_SERVICE_ROLE_KEY = origKey;
  });
});
