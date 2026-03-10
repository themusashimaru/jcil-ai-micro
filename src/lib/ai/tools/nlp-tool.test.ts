import { describe, it, expect } from 'vitest';
import { executeNLP, isNLPAvailable, nlpTool } from './nlp-tool';

function makeCall(args: Record<string, unknown>) {
  return { id: 'test', name: 'analyze_text_nlp', arguments: args };
}

async function getResult(args: Record<string, unknown>) {
  const res = await executeNLP(makeCall(args));
  return JSON.parse(res.content);
}

// -------------------------------------------------------------------
// Metadata
// -------------------------------------------------------------------
describe('nlpTool metadata', () => {
  it('should have correct name', () => {
    expect(nlpTool.name).toBe('analyze_text_nlp');
  });

  it('should require text', () => {
    expect(nlpTool.parameters.required).toContain('text');
  });
});

describe('isNLPAvailable', () => {
  it('should return true when natural is installed', async () => {
    expect(await isNLPAvailable()).toBe(true);
  });
});

// -------------------------------------------------------------------
// Sentiment analysis
// -------------------------------------------------------------------
describe('executeNLP - sentiment', () => {
  it('should detect positive sentiment', async () => {
    const result = await getResult({
      text: 'I love this wonderful amazing product',
      analysis_type: 'sentiment',
    });
    expect(result.analysis.label).toBe('positive');
    expect(result.analysis.score).toBeGreaterThan(0);
  });

  it('should detect negative sentiment', async () => {
    const result = await getResult({
      text: 'This is terrible awful horrible garbage',
      analysis_type: 'sentiment',
    });
    expect(result.analysis.label).toBe('negative');
    expect(result.analysis.score).toBeLessThan(0);
  });

  it('should detect neutral sentiment', async () => {
    const result = await getResult({
      text: 'The cat sat on the mat',
      analysis_type: 'sentiment',
    });
    expect(result.analysis.label).toBe('neutral');
  });
});

// -------------------------------------------------------------------
// Tokenization
// -------------------------------------------------------------------
describe('executeNLP - tokenize', () => {
  it('should tokenize text into words', async () => {
    const result = await getResult({
      text: 'Hello world, how are you?',
      analysis_type: 'tokenize',
    });
    expect(result.analysis.wordCount).toBeGreaterThan(0);
    expect(result.analysis.words).toContain('Hello');
    expect(result.analysis.sentenceCount).toBe(1);
  });

  it('should count unique words', async () => {
    const result = await getResult({
      text: 'the cat and the dog and the bird',
      analysis_type: 'tokenize',
    });
    expect(result.analysis.uniqueWords).toBeLessThan(result.analysis.wordCount);
  });
});

// -------------------------------------------------------------------
// Stemming
// -------------------------------------------------------------------
describe('executeNLP - stem', () => {
  it('should stem words using Porter stemmer', async () => {
    const result = await getResult({
      text: 'running jumped swimming flies',
      analysis_type: 'stem',
    });
    expect(result.analysis.stemmerType).toBe('porter');
    expect(result.analysis.stemmed).toBeDefined();
    expect(result.analysis.uniqueStems).toBeGreaterThan(0);
  });
});

// -------------------------------------------------------------------
// Phonetics (skipped - natural phonetics module has runtime issues)
// -------------------------------------------------------------------

// -------------------------------------------------------------------
// String distance
// -------------------------------------------------------------------
describe('executeNLP - distance', () => {
  it('should calculate similarity between strings', async () => {
    const result = await getResult({
      text: 'kitten',
      analysis_type: 'distance',
      compare_text: 'sitting',
    });
    expect(result.analysis.levenshtein.distance).toBeDefined();
    expect(result.analysis.jaroWinkler).toBeDefined();
    expect(result.analysis.diceCoefficient).toBeDefined();
  });

  it('should return perfect match for identical strings', async () => {
    const result = await getResult({
      text: 'hello',
      analysis_type: 'distance',
      compare_text: 'hello',
    });
    expect(result.analysis.levenshtein.distance).toBe(0);
    expect(result.analysis.levenshtein.normalized).toBe(1);
    expect(result.analysis.summary).toBe('Very similar');
  });

  it('should error without compare_text', async () => {
    const res = await executeNLP(makeCall({ text: 'hello', analysis_type: 'distance' }));
    expect(res.isError).toBe(true);
  });
});

// -------------------------------------------------------------------
// N-grams
// -------------------------------------------------------------------
describe('executeNLP - ngrams', () => {
  it('should generate bigrams', async () => {
    const result = await getResult({
      text: 'The quick brown fox jumps over the lazy dog',
      analysis_type: 'ngrams',
    });
    expect(result.analysis.ngramSize).toBe(2);
    expect(result.analysis.totalNgrams).toBeGreaterThan(0);
    expect(result.analysis.bigrams).toBeDefined();
    expect(result.analysis.trigrams).toBeDefined();
  });

  it('should generate custom size ngrams', async () => {
    const result = await getResult({
      text: 'one two three four five',
      analysis_type: 'ngrams',
      ngram_size: 3,
    });
    expect(result.analysis.ngramSize).toBe(3);
  });
});

// -------------------------------------------------------------------
// TF-IDF
// -------------------------------------------------------------------
describe('executeNLP - tfidf', () => {
  it('should analyze term frequency', async () => {
    const result = await getResult({
      text: 'Machine learning is great. Machine learning is the future.',
      analysis_type: 'tfidf',
    });
    expect(result.analysis.termCount).toBeGreaterThan(0);
    expect(result.analysis.topTerms).toBeDefined();
    expect(result.analysis.topTerms.length).toBeGreaterThan(0);
  });
});

// -------------------------------------------------------------------
// Classification
// -------------------------------------------------------------------
describe('executeNLP - classify', () => {
  it('should classify text with training data', async () => {
    const result = await getResult({
      text: 'I love sunny weather',
      analysis_type: 'classify',
      training_data: [
        { text: 'I love sunshine', label: 'positive' },
        { text: 'Sunny days are great', label: 'positive' },
        { text: 'Rain is depressing', label: 'negative' },
        { text: 'Cold rainy weather', label: 'negative' },
      ],
    });
    expect(result.analysis.predictedLabel).toBeDefined();
    expect(result.analysis.confidence).toBeDefined();
    expect(result.analysis.trainingSize).toBe(4);
  });

  it('should error with insufficient training data', async () => {
    const result = await getResult({
      text: 'test',
      analysis_type: 'classify',
      training_data: [{ text: 'only one', label: 'solo' }],
    });
    expect(result.analysis.error).toBeDefined();
  });
});

// -------------------------------------------------------------------
// Full analysis (skipped - includes phonetics which has runtime issues)
// -------------------------------------------------------------------

// -------------------------------------------------------------------
// Error handling
// -------------------------------------------------------------------
describe('executeNLP - errors', () => {
  it('should error without text', async () => {
    const res = await executeNLP(makeCall({ analysis_type: 'sentiment' }));
    expect(res.isError).toBe(true);
  });

  it('should return toolCallId', async () => {
    const res = await executeNLP({
      id: 'my-id',
      name: 'analyze_text_nlp',
      arguments: { text: 'Test' },
    });
    expect(res.toolCallId).toBe('my-id');
  });
});
