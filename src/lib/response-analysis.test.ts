import { describe, it, expect, vi } from 'vitest';
import {
  analyzeResponse,
  isConfirmation,
  isDecline,
  extractOriginalQuestion,
  generateSearchQuery,
} from './response-analysis';

// Mock logger
vi.mock('@/lib/logger', () => ({
  logger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

// -------------------------------------------------------------------
// analyzeResponse
// -------------------------------------------------------------------
describe('analyzeResponse', () => {
  describe('knowledge cutoff detection', () => {
    it('should detect "my knowledge cutoff" mentions', () => {
      const result = analyzeResponse(
        'My knowledge cutoff is in early 2024, so I cannot provide the latest data on that.'
      );
      expect(result.triggerType).toBe('knowledge_cutoff');
      expect(result.suggestedAction).toBe('search');
      expect(result.confidence).toBe('high');
    });

    it('should detect "trained up to" patterns', () => {
      const result = analyzeResponse(
        'I was trained on data up to April 2024, so recent events may not be covered.'
      );
      expect(result.triggerType).toBe('knowledge_cutoff');
      expect(result.suggestedAction).toBe('search');
    });

    it('should detect "cannot access current" patterns', () => {
      const result = analyzeResponse(
        "I can't access current information or real-time data about that topic."
      );
      expect(result.triggerType).toBe('knowledge_cutoff');
      expect(result.suggestedAction).toBe('search');
    });

    it('should detect "information may be out of date"', () => {
      const result = analyzeResponse(
        'My information may be out of date on this rapidly changing topic.'
      );
      expect(result.triggerType).toBe('knowledge_cutoff');
      expect(result.suggestedAction).toBe('search');
    });

    it('should detect "last trained in" patterns', () => {
      const result = analyzeResponse('I was last trained in 2024 and things may have changed.');
      expect(result.triggerType).toBe('knowledge_cutoff');
      expect(result.suggestedAction).toBe('search');
    });

    it('should include matched phrase', () => {
      const result = analyzeResponse('My knowledge cutoff is in 2024.');
      expect(result.matchedPhrase).toBeTruthy();
    });

    it('should include suggested prompt', () => {
      const result = analyzeResponse('My training data only goes to early 2024.');
      expect(result.suggestedPrompt).toContain('search');
    });
  });

  describe('outdated info detection', () => {
    it('should detect "things may have changed"', () => {
      const result = analyzeResponse(
        'Based on what I know, things may have changed significantly since then.'
      );
      expect(result.triggerType).toBe('outdated_info');
      expect(result.suggestedAction).toBe('search');
      expect(result.confidence).toBe('medium');
    });

    it('should detect "check official sources"', () => {
      const result = analyzeResponse(
        'For the most current information, check official sources for updates.'
      );
      expect(result.triggerType).toBe('outdated_info');
      expect(result.suggestedAction).toBe('search');
    });

    it('should detect "recommend checking latest"', () => {
      const result = analyzeResponse(
        'I recommend checking the latest documentation for any changes.'
      );
      expect(result.triggerType).toBe('outdated_info');
      expect(result.suggestedAction).toBe('search');
    });
  });

  describe('developer info patterns', () => {
    it('should detect "API may have been changed"', () => {
      const result = analyzeResponse(
        'The API endpoint may have been changed or deprecated since then.'
      );
      expect(result.triggerType).toBe('outdated_info');
      expect(result.suggestedAction).toBe('search');
      expect(result.confidence).toBe('high');
    });

    it('should detect "check official documentation"', () => {
      const result = analyzeResponse(
        'Please refer to the official documentation for the latest API reference.'
      );
      expect(result.triggerType).toBe('outdated_info');
      expect(result.suggestedAction).toBe('search');
    });

    it('should detect "model names may have changed"', () => {
      const result = analyzeResponse('The model names may have changed since I was last updated.');
      expect(result.triggerType).toBe('outdated_info');
      expect(result.suggestedAction).toBe('search');
    });

    it('should detect "breaking changes may have occurred"', () => {
      const result = analyzeResponse(
        'Breaking changes may have occurred in the latest version of the framework.'
      );
      expect(result.triggerType).toBe('outdated_info');
      expect(result.suggestedAction).toBe('search');
    });
  });

  describe('uncertainty detection', () => {
    it('should detect "I\'m not sure"', () => {
      const result = analyzeResponse(
        "I'm not entirely sure about the exact figures, but it was around 50%."
      );
      expect(result.triggerType).toBe('uncertainty');
      expect(result.suggestedAction).toBe('factcheck');
      expect(result.confidence).toBe('medium');
    });

    it('should detect "you should verify"', () => {
      const result = analyzeResponse(
        'You should verify this information before making any decisions.'
      );
      expect(result.triggerType).toBe('uncertainty');
      expect(result.suggestedAction).toBe('factcheck');
    });

    it('should detect "I believe"', () => {
      const result = analyzeResponse(
        'I believe this is correct but I cannot be completely certain.'
      );
      expect(result.triggerType).toBe('uncertainty');
      expect(result.suggestedAction).toBe('factcheck');
    });

    it('should detect "to the best of my knowledge"', () => {
      const result = analyzeResponse(
        'To the best of my knowledge, the company was founded in 2015.'
      );
      expect(result.triggerType).toBe('uncertainty');
      expect(result.suggestedAction).toBe('factcheck');
    });
  });

  describe('no trigger', () => {
    it('should return none for confident responses', () => {
      const result = analyzeResponse(
        'Python is a high-level, interpreted programming language. It was created by Guido van Rossum and first released in 1991.'
      );
      expect(result.triggerType).toBe('none');
      expect(result.suggestedAction).toBe('none');
    });

    it('should return none for empty input', () => {
      const result = analyzeResponse('');
      expect(result.triggerType).toBe('none');
    });

    it('should return none for null input', () => {
      const result = analyzeResponse(null as unknown as string);
      expect(result.triggerType).toBe('none');
    });

    it('should return none for very short input', () => {
      const result = analyzeResponse('Yes.');
      expect(result.triggerType).toBe('none');
    });
  });

  describe('priority order', () => {
    it('should prioritize knowledge cutoff over uncertainty', () => {
      const result = analyzeResponse(
        "My knowledge cutoff is in 2024. I'm not sure about the details. You should verify this."
      );
      expect(result.triggerType).toBe('knowledge_cutoff');
    });

    it('should prioritize outdated info over uncertainty', () => {
      const result = analyzeResponse(
        'Things may have changed since then. I believe the answer is X.'
      );
      expect(result.triggerType).toBe('outdated_info');
    });
  });
});

// -------------------------------------------------------------------
// isConfirmation
// -------------------------------------------------------------------
describe('isConfirmation', () => {
  it('should detect "yes" variants', () => {
    expect(isConfirmation('yes')).toBe(true);
    expect(isConfirmation('yeah')).toBe(true);
    expect(isConfirmation('yep')).toBe(true);
    expect(isConfirmation('yes please')).toBe(true);
    expect(isConfirmation('yes, search for it')).toBe(true);
  });

  it('should detect "sure" and "ok"', () => {
    expect(isConfirmation('sure')).toBe(true);
    expect(isConfirmation('ok')).toBe(true);
    expect(isConfirmation('okay')).toBe(true);
  });

  it('should detect action phrases', () => {
    expect(isConfirmation('go ahead')).toBe(true);
    expect(isConfirmation('do it')).toBe(true);
    expect(isConfirmation('sounds good')).toBe(true);
    expect(isConfirmation("let's do it")).toBe(true);
    expect(isConfirmation('that would be great')).toBe(true);
  });

  it('should detect search requests', () => {
    expect(isConfirmation('please search for it')).toBe(true);
    expect(isConfirmation('search for the latest data')).toBe(true);
  });

  it('should return false for non-confirmations', () => {
    expect(isConfirmation('no')).toBe(false);
    expect(isConfirmation('tell me about X')).toBe(false);
    expect(isConfirmation('what is Python')).toBe(false);
  });

  it('should handle empty/null input', () => {
    expect(isConfirmation('')).toBe(false);
    expect(isConfirmation(null as unknown as string)).toBe(false);
    expect(isConfirmation(undefined as unknown as string)).toBe(false);
  });
});

// -------------------------------------------------------------------
// isDecline
// -------------------------------------------------------------------
describe('isDecline', () => {
  it('should detect "no" variants', () => {
    expect(isDecline('no')).toBe(true);
    expect(isDecline('nope')).toBe(true);
    expect(isDecline('nah')).toBe(true);
    expect(isDecline('no thanks')).toBe(true);
    expect(isDecline("no, that's ok")).toBe(true);
  });

  it('should detect polite declines', () => {
    expect(isDecline("that's okay")).toBe(true);
    expect(isDecline("it's fine")).toBe(true);
    expect(isDecline("don't worry")).toBe(true);
    expect(isDecline("don't bother")).toBe(true);
    expect(isDecline('not now')).toBe(true);
  });

  it('should detect dismissals', () => {
    expect(isDecline('never mind')).toBe(true);
    expect(isDecline('nevermind')).toBe(true);
    expect(isDecline('skip')).toBe(true);
    expect(isDecline("I'm good")).toBe(true);
  });

  it('should return false for non-declines', () => {
    expect(isDecline('yes')).toBe(false);
    expect(isDecline('tell me more')).toBe(false);
  });

  it('should handle empty/null input', () => {
    expect(isDecline('')).toBe(false);
    expect(isDecline(null as unknown as string)).toBe(false);
  });
});

// -------------------------------------------------------------------
// extractOriginalQuestion
// -------------------------------------------------------------------
describe('extractOriginalQuestion', () => {
  it('should extract last user message longer than 15 chars', () => {
    const messages = [
      { role: 'user', content: 'What is the current price of Bitcoin?' },
      { role: 'assistant', content: 'I am not sure about the current price...' },
    ];
    expect(extractOriginalQuestion(messages)).toBe('What is the current price of Bitcoin?');
  });

  it('should skip short user messages', () => {
    const messages = [
      { role: 'user', content: 'Tell me about climate change impacts on agriculture.' },
      { role: 'assistant', content: 'Climate change has many effects...' },
      { role: 'user', content: 'yes' },
    ];
    expect(extractOriginalQuestion(messages)).toBe(
      'Tell me about climate change impacts on agriculture.'
    );
  });

  it('should return null for no user messages', () => {
    const messages = [{ role: 'assistant', content: 'Hello!' }];
    expect(extractOriginalQuestion(messages)).toBeNull();
  });

  it('should return null for empty array', () => {
    expect(extractOriginalQuestion([])).toBeNull();
  });

  it('should return null when all user messages are too short', () => {
    const messages = [
      { role: 'user', content: 'ok' },
      { role: 'user', content: 'yes' },
    ];
    expect(extractOriginalQuestion(messages)).toBeNull();
  });
});

// -------------------------------------------------------------------
// generateSearchQuery
// -------------------------------------------------------------------
describe('generateSearchQuery', () => {
  it('should remove conversational prefixes', () => {
    expect(generateSearchQuery('can you tell me about AI')).toBe('about AI');
    expect(generateSearchQuery('please explain quantum computing')).toBe('quantum computing');
    expect(generateSearchQuery('hey what is machine learning')).toBe('machine learning');
  });

  it('should remove question words', () => {
    expect(generateSearchQuery('what is climate change')).toBe('climate change');
    expect(generateSearchQuery('who is the president')).toBe('the president');
  });

  it('should remove trailing question marks', () => {
    expect(generateSearchQuery('what is Python???')).toBe('Python');
  });

  it('should limit length to 200 characters', () => {
    const long = 'a '.repeat(200);
    expect(generateSearchQuery(long).length).toBeLessThanOrEqual(200);
  });

  it('should return empty for empty input', () => {
    expect(generateSearchQuery('')).toBe('');
  });

  it('should trim result', () => {
    expect(generateSearchQuery('  hello world  ')).toBe('hello world');
  });
});
