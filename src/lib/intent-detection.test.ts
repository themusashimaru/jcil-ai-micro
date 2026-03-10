/**
 * INTENT DETECTION TESTS
 *
 * Comprehensive tests for the intent detection utility.
 * Tests cover search, fact-check, and research detection with various inputs.
 */

import { describe, it, expect } from 'vitest';
import {
  detectIntent,
  shouldAutoRoute,
  getIntentDescription,
  isExplicitToolRequest,
  type IntentDetectionResult,
} from './intent-detection';

describe('Intent Detection', () => {
  // ========================================
  // SEARCH INTENT DETECTION
  // ========================================
  describe('Search Intent', () => {
    describe('High Confidence', () => {
      it('should detect explicit search requests', () => {
        const queries = [
          'search for the latest news on AI',
          'google machine learning tutorials',
          'look up weather in New York',
          'find information about Bitcoin',
          'search the web for climate change data',
        ];

        queries.forEach((query) => {
          const result = detectIntent(query);
          expect(result.intent).toBe('search');
          expect(result.confidence).toBe('high');
        });
      });

      it('should detect time/date queries', () => {
        const queries = [
          'what time is it',
          "what's the date today",
          'what time is it in Tokyo',
          'current time',
          "today's date",
        ];

        queries.forEach((query) => {
          const result = detectIntent(query);
          expect(result.intent).toBe('search');
          expect(result.confidence).toBe('high');
        });
      });

      it('should detect current information requests', () => {
        const queries = [
          "what's the current price of gold",
          'what are the latest headlines',
          'news about the election',
          'weather forecast for tomorrow',
          'stock price of Apple',
        ];

        queries.forEach((query) => {
          const result = detectIntent(query);
          expect(result.intent).toBe('search');
          expect(result.confidence).toBe('high');
        });
      });
    });

    describe('Medium Confidence', () => {
      it('should detect location queries', () => {
        const result = detectIntent('where can I find a good restaurant');
        expect(result.intent).toBe('search');
        expect(result.confidence).toBe('medium');
      });

      it('should detect how-to-find queries', () => {
        const result = detectIntent('how do I get to the airport');
        expect(result.intent).toBe('search');
        expect(result.confidence).toBe('medium');
      });
    });
  });

  // ========================================
  // FACT CHECK INTENT DETECTION
  // ========================================
  describe('Fact Check Intent', () => {
    describe('High Confidence', () => {
      it('should detect explicit fact check requests', () => {
        const queries = [
          'fact check this claim about vaccines',
          'verify if this story is true',
          'is it true that the earth is flat',
          'is this statement accurate',
          'can you verify this information',
        ];

        queries.forEach((query) => {
          const result = detectIntent(query);
          expect(result.intent).toBe('factcheck');
          expect(result.confidence).toBe('high');
        });
      });

      it('should detect true/false questions', () => {
        const queries = [
          'true or false: humans only use 10% of their brain',
          'real or fake: this viral photo',
          'is this actually true',
        ];

        queries.forEach((query) => {
          const result = detectIntent(query);
          expect(result.intent).toBe('factcheck');
          expect(result.confidence).toBe('high');
        });
      });

      it('should detect misinformation keywords', () => {
        const queries = ['debunk this myth about 5G', 'is this a hoax', 'check for misinformation'];

        queries.forEach((query) => {
          const result = detectIntent(query);
          expect(result.intent).toBe('factcheck');
          expect(result.confidence).toBe('high');
        });
      });
    });

    describe('Medium Confidence', () => {
      it('should detect indirect verification requests', () => {
        const queries = [
          'did the president really say that',
          'someone told me that coffee is bad for you',
          'is it correct that sugar causes cancer',
        ];

        queries.forEach((query) => {
          const result = detectIntent(query);
          expect(result.intent).toBe('factcheck');
          expect(result.confidence).toBe('medium');
        });
      });
    });
  });

  // ========================================
  // RESEARCH INTENT DETECTION
  // ========================================
  describe('Research Intent', () => {
    describe('High Confidence', () => {
      it('should detect explicit research requests', () => {
        const queries = [
          'research the history of artificial intelligence',
          'investigate the causes of climate change',
          'analyze the impact of social media on mental health',
          'study the effects of meditation',
          'explore the topic of quantum computing',
        ];

        queries.forEach((query) => {
          const result = detectIntent(query);
          expect(result.intent).toBe('research');
          expect(result.confidence).toBe('high');
        });
      });

      it('should detect in-depth analysis requests', () => {
        const queries = [
          'in-depth analysis of cryptocurrency markets',
          'comprehensive overview of machine learning',
          'pros and cons of remote work',
          'compare electric cars vs hybrid cars',
        ];

        queries.forEach((query) => {
          const result = detectIntent(query);
          expect(result.intent).toBe('research');
          expect(result.confidence).toBe('high');
        });
      });

      it('should detect history/background requests', () => {
        const queries = [
          'what is the history of the internet',
          'explain the background of the conflict',
          'what is the origin of language',
          'explain in detail how vaccines work',
        ];

        queries.forEach((query) => {
          const result = detectIntent(query);
          expect(result.intent).toBe('research');
          expect(result.confidence).toBe('high');
        });
      });
    });

    describe('Medium Confidence', () => {
      it('should detect how/why explanation requests', () => {
        const queries = [
          'how does photosynthesis work',
          'why is the sky blue',
          'what causes earthquakes',
        ];

        queries.forEach((query) => {
          const result = detectIntent(query);
          expect(result.intent).toBe('research');
          expect(result.confidence).toBe('medium');
        });
      });

      it('should detect impact/effect questions', () => {
        const queries = [
          'impact of globalization on local economies',
          'effect of sleep deprivation on health',
          'consequences of deforestation',
        ];

        queries.forEach((query) => {
          const result = detectIntent(query);
          expect(result.intent).toBe('research');
          expect(result.confidence).toBe('medium');
        });
      });
    });
  });

  // ========================================
  // NO INTENT DETECTION
  // ========================================
  describe('No Intent (Regular Chat)', () => {
    it('should return none for simple greetings', () => {
      const queries = ['hello', 'hi there', 'good morning', 'how are you'];

      queries.forEach((query) => {
        const result = detectIntent(query);
        expect(result.intent).toBe('none');
      });
    });

    it('should return none for general questions', () => {
      const queries = [
        'write a poem about love',
        'help me with my homework',
        'translate this to Spanish',
        'what do you think about art',
      ];

      queries.forEach((query) => {
        const result = detectIntent(query);
        expect(result.intent).toBe('none');
      });
    });

    it('should return none for coding requests', () => {
      const queries = [
        'write a function to sort an array',
        'debug this code',
        'explain this Python script',
        'refactor this function',
      ];

      queries.forEach((query) => {
        const result = detectIntent(query);
        expect(result.intent).toBe('none');
      });
    });
  });

  // ========================================
  // INPUT VALIDATION
  // ========================================
  describe('Input Validation', () => {
    it('should handle empty input', () => {
      expect(detectIntent('').intent).toBe('none');
      expect(detectIntent('  ').intent).toBe('none');
    });

    it('should handle null/undefined gracefully', () => {
      expect(detectIntent(null as unknown as string).intent).toBe('none');
      expect(detectIntent(undefined as unknown as string).intent).toBe('none');
    });

    it('should handle very short input', () => {
      expect(detectIntent('hi').intent).toBe('none');
      expect(detectIntent('a').intent).toBe('none');
    });

    it('should handle very long input', () => {
      const longInput = 'search for '.repeat(500);
      const result = detectIntent(longInput);
      // Should still detect intent even with long input
      expect(result.intent).toBe('search');
    });

    it('should handle special characters', () => {
      const result = detectIntent('search for <script>alert("xss")</script>');
      expect(result.intent).toBe('search');
    });
  });

  // ========================================
  // AUTO-ROUTING DECISION
  // ========================================
  describe('shouldAutoRoute', () => {
    it('should return true for high confidence', () => {
      const result: IntentDetectionResult = {
        intent: 'search',
        confidence: 'high',
      };
      expect(shouldAutoRoute(result)).toBe(true);
    });

    it('should return false for medium confidence by default', () => {
      const result: IntentDetectionResult = {
        intent: 'search',
        confidence: 'medium',
      };
      expect(shouldAutoRoute(result)).toBe(false);
    });

    it('should return true for medium confidence when allowed', () => {
      const result: IntentDetectionResult = {
        intent: 'search',
        confidence: 'medium',
      };
      expect(shouldAutoRoute(result, true)).toBe(true);
    });

    it('should return false for low confidence', () => {
      const result: IntentDetectionResult = {
        intent: 'none',
        confidence: 'low',
      };
      expect(shouldAutoRoute(result)).toBe(false);
      expect(shouldAutoRoute(result, true)).toBe(false);
    });

    it('should return false for none intent', () => {
      const result: IntentDetectionResult = {
        intent: 'none',
        confidence: 'high',
      };
      expect(shouldAutoRoute(result)).toBe(false);
    });
  });

  // ========================================
  // HELPER FUNCTIONS
  // ========================================
  describe('getIntentDescription', () => {
    it('should return correct descriptions', () => {
      expect(getIntentDescription('search')).toContain('Searching');
      expect(getIntentDescription('factcheck')).toContain('Fact-checking');
      expect(getIntentDescription('research')).toContain('research');
      expect(getIntentDescription('none')).toBe('');
    });
  });

  describe('isExplicitToolRequest', () => {
    it('should detect explicit search at start', () => {
      expect(isExplicitToolRequest('search for AI news')).toBe('search');
      expect(isExplicitToolRequest('google machine learning')).toBe('search');
      expect(isExplicitToolRequest('lookup weather')).toBe('search');
    });

    it('should detect explicit fact check at start', () => {
      expect(isExplicitToolRequest('fact check this claim')).toBe('factcheck');
      expect(isExplicitToolRequest('verify this statement')).toBe('factcheck');
    });

    it('should detect explicit research at start', () => {
      expect(isExplicitToolRequest('research quantum computing')).toBe('research');
      expect(isExplicitToolRequest('investigate climate change')).toBe('research');
    });

    it('should return none for non-explicit requests', () => {
      expect(isExplicitToolRequest('what is the weather')).toBe('none');
      expect(isExplicitToolRequest('help me understand')).toBe('none');
    });
  });

  // ========================================
  // EDGE CASES
  // ========================================
  describe('Edge Cases', () => {
    it('should handle case insensitivity', () => {
      expect(detectIntent('SEARCH FOR NEWS').intent).toBe('search');
      expect(detectIntent('Fact Check This').intent).toBe('factcheck');
      expect(detectIntent('RESEARCH The Topic').intent).toBe('research');
    });

    it('should handle mixed whitespace', () => {
      expect(detectIntent('search   for    news').intent).toBe('search');
      expect(detectIntent('fact\t\tcheck this').intent).toBe('factcheck');
    });

    it('should handle punctuation', () => {
      expect(detectIntent('what time is it?').intent).toBe('search');
      expect(detectIntent('is this true?!').intent).toBe('factcheck');
    });

    it('should not be fooled by embedded keywords', () => {
      // "search" appears but not as a command
      const result = detectIntent('I did a lot of research yesterday');
      // This should NOT trigger research because it's past tense/narrative
      expect(result.confidence).not.toBe('high');
    });
  });
});
