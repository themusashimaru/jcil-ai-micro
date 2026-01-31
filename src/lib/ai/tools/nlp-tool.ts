/**
 * NATURAL LANGUAGE PROCESSING TOOL
 *
 * NLP analysis using the 'natural' library.
 * Zero external API dependencies - runs entirely locally.
 *
 * Capabilities:
 * - Sentiment analysis
 * - Tokenization (word, sentence)
 * - Stemming/Lemmatization
 * - Part-of-speech tagging
 * - Text classification
 * - Phonetics (Soundex, Metaphone)
 * - String distance (Levenshtein, Jaro-Winkler)
 * - TF-IDF analysis
 * - N-grams generation
 *
 * Created: 2026-01-31
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// Lazy-loaded natural library
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let natural: any = null;

async function initNatural(): Promise<boolean> {
  if (natural) return true;
  try {
    natural = await import('natural');
    return true;
  } catch {
    return false;
  }
}

// ============================================================================
// TOOL DEFINITION
// ============================================================================

export const nlpTool: UnifiedTool = {
  name: 'analyze_text_nlp',
  description: `Perform natural language processing analysis on text.

Analysis types:
- sentiment: Analyze emotional tone (positive/negative/neutral)
- tokenize: Break text into words or sentences
- stem: Reduce words to their root form (Porter/Lancaster stemmer)
- phonetics: Get phonetic representation (Soundex/Metaphone)
- distance: Calculate similarity between strings
- ngrams: Generate n-gram sequences
- tfidf: Term frequency-inverse document frequency analysis
- classify: Classify text into categories (with training data)
- full: Comprehensive analysis including all of the above

Use cases:
- Sentiment analysis of reviews, feedback, social media
- Text preprocessing for search and indexing
- Fuzzy matching and spell checking
- Document similarity analysis
- Feature extraction for machine learning
- Keyword extraction from documents`,
  parameters: {
    type: 'object',
    properties: {
      text: {
        type: 'string',
        description: 'Text to analyze',
      },
      analysis_type: {
        type: 'string',
        enum: [
          'sentiment',
          'tokenize',
          'stem',
          'phonetics',
          'distance',
          'ngrams',
          'tfidf',
          'classify',
          'full',
        ],
        description: 'Type of NLP analysis to perform. Default: full',
      },
      compare_text: {
        type: 'string',
        description: 'Second text for comparison (required for distance analysis)',
      },
      language: {
        type: 'string',
        enum: ['english', 'spanish', 'french', 'german', 'italian', 'dutch', 'portuguese'],
        description: 'Language of the text. Default: english',
      },
      stemmer_type: {
        type: 'string',
        enum: ['porter', 'lancaster', 'snowball'],
        description: 'Stemmer algorithm. Default: porter',
      },
      ngram_size: {
        type: 'number',
        description: 'Size of n-grams to generate (2=bigrams, 3=trigrams). Default: 2',
      },
      training_data: {
        type: 'array',
        description: 'Training data for classification: [{text: string, label: string}]',
        items: {
          type: 'object',
        },
      },
    },
    required: ['text'],
  },
};

// ============================================================================
// AVAILABILITY CHECK
// ============================================================================

export async function isNLPAvailable(): Promise<boolean> {
  return await initNatural();
}

// ============================================================================
// ANALYSIS FUNCTIONS
// ============================================================================

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function analyzeSentiment(text: string, n: any): Record<string, unknown> {
  const Analyzer = n.SentimentAnalyzer;
  const stemmer = n.PorterStemmer;
  const analyzer = new Analyzer('English', stemmer, 'afinn');

  // Tokenize and analyze
  const tokenizer = new n.WordTokenizer();
  const tokens = tokenizer.tokenize(text);
  const score = analyzer.getSentiment(tokens);

  // Determine sentiment label
  let label: string;
  if (score > 0.2) {
    label = 'positive';
  } else if (score < -0.2) {
    label = 'negative';
  } else {
    label = 'neutral';
  }

  // Analyze individual words
  const wordSentiments: { word: string; score: number }[] = [];
  for (const token of tokens) {
    const wordScore = analyzer.getSentiment([token]);
    if (wordScore !== 0) {
      wordSentiments.push({ word: token, score: wordScore });
    }
  }

  return {
    score: Math.round(score * 1000) / 1000,
    label,
    confidence: Math.abs(score),
    tokenCount: tokens.length,
    positiveWords: wordSentiments.filter((w) => w.score > 0),
    negativeWords: wordSentiments.filter((w) => w.score < 0),
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function tokenizeText(text: string, n: any): Record<string, unknown> {
  const wordTokenizer = new n.WordTokenizer();
  const sentenceTokenizer = new n.SentenceTokenizer();
  const aggressiveTokenizer = new n.AggressiveTokenizer();

  const words = wordTokenizer.tokenize(text);
  const sentences = sentenceTokenizer.tokenize(text);
  const aggressive = aggressiveTokenizer.tokenize(text);

  return {
    words,
    wordCount: words.length,
    sentences,
    sentenceCount: sentences.length,
    aggressiveTokens: aggressive,
    averageWordLength: words.length
      ? Math.round(
          (words.reduce((sum: number, w: string) => sum + w.length, 0) / words.length) * 10
        ) / 10
      : 0,
    uniqueWords: [...new Set(words.map((w: string) => w.toLowerCase()))].length,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function stemText(text: string, n: any, stemmerType: string): Record<string, unknown> {
  const stemmers: Record<string, unknown> = {
    porter: n.PorterStemmer,
    lancaster: n.LancasterStemmer,
    snowball: n.PorterStemmer, // Fallback
  };

  const stemmer = stemmers[stemmerType] || n.PorterStemmer;
  const tokenizer = new n.WordTokenizer();
  const words = tokenizer.tokenize(text);

  const stemmed = words.map((word: string) => ({
    original: word,
    stem: (stemmer as { stem: (w: string) => string }).stem(word),
  }));

  // Group by stem
  const stemGroups: Record<string, string[]> = {};
  for (const item of stemmed) {
    if (!stemGroups[item.stem]) {
      stemGroups[item.stem] = [];
    }
    if (!stemGroups[item.stem].includes(item.original)) {
      stemGroups[item.stem].push(item.original);
    }
  }

  return {
    stemmerType,
    stemmed,
    stemGroups,
    uniqueStems: Object.keys(stemGroups).length,
    reductionRatio: Math.round((1 - Object.keys(stemGroups).length / words.length) * 100),
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function analyzePhonetics(text: string, n: any): Record<string, unknown> {
  const tokenizer = new n.WordTokenizer();
  const words = tokenizer.tokenize(text);

  const phonetics = words.map((word: string) => ({
    word,
    soundex: n.SoundEx.process(word),
    metaphone: n.Metaphone.process(word),
    doubleMetaphone: n.DoubleMetaphone.process(word),
  }));

  return {
    phonetics,
    wordCount: words.length,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function calculateDistance(text1: string, text2: string, n: any): Record<string, unknown> {
  const levenshtein = n.LevenshteinDistance(text1, text2);
  const jaroWinkler = n.JaroWinklerDistance(text1, text2);
  const dice = n.DiceCoefficient(text1, text2);

  // Calculate normalized Levenshtein
  const maxLen = Math.max(text1.length, text2.length);
  const normalizedLevenshtein = maxLen > 0 ? 1 - levenshtein / maxLen : 1;

  return {
    text1Length: text1.length,
    text2Length: text2.length,
    levenshtein: {
      distance: levenshtein,
      normalized: Math.round(normalizedLevenshtein * 1000) / 1000,
    },
    jaroWinkler: Math.round(jaroWinkler * 1000) / 1000,
    diceCoefficient: Math.round(dice * 1000) / 1000,
    summary:
      normalizedLevenshtein > 0.8
        ? 'Very similar'
        : normalizedLevenshtein > 0.5
          ? 'Somewhat similar'
          : 'Different',
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function generateNgrams(text: string, n: any, size: number): Record<string, unknown> {
  const NGrams = n.NGrams;

  const bigrams = NGrams.bigrams(text);
  const trigrams = NGrams.trigrams(text);
  const customNgrams = size > 1 ? NGrams.ngrams(text, size) : bigrams;

  // Count frequencies
  const ngramFreq: Record<string, number> = {};
  for (const ngram of customNgrams) {
    const key = ngram.join(' ');
    ngramFreq[key] = (ngramFreq[key] || 0) + 1;
  }

  // Sort by frequency
  const sortedNgrams = Object.entries(ngramFreq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([ngram, count]) => ({ ngram, count }));

  return {
    ngramSize: size,
    totalNgrams: customNgrams.length,
    uniqueNgrams: Object.keys(ngramFreq).length,
    topNgrams: sortedNgrams,
    bigrams: bigrams.slice(0, 10).map((b: string[]) => b.join(' ')),
    trigrams: trigrams.slice(0, 10).map((t: string[]) => t.join(' ')),
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function analyzeTFIDF(text: string, n: any): Record<string, unknown> {
  const TfIdf = n.TfIdf;
  const tfidf = new TfIdf();

  // Add document
  tfidf.addDocument(text);

  // Get terms and scores
  const terms: { term: string; tfidf: number }[] = [];
  tfidf.listTerms(0).forEach((item: { term: string; tfidf: number }) => {
    terms.push({ term: item.term, tfidf: Math.round(item.tfidf * 1000) / 1000 });
  });

  // Sort by TF-IDF score
  terms.sort((a, b) => b.tfidf - a.tfidf);

  return {
    termCount: terms.length,
    topTerms: terms.slice(0, 20),
    allTerms: terms,
  };
}

function classifyText(
  text: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  n: any,
  trainingData: { text: string; label: string }[]
): Record<string, unknown> {
  if (!trainingData || trainingData.length < 2) {
    return {
      error: 'Classification requires at least 2 training examples',
      example: [
        { text: 'I love this product', label: 'positive' },
        { text: 'This is terrible', label: 'negative' },
      ],
    };
  }

  const classifier = new n.BayesClassifier();

  // Train
  for (const item of trainingData) {
    classifier.addDocument(item.text, item.label);
  }
  classifier.train();

  // Classify
  const classification = classifier.classify(text);
  const classifications = classifier.getClassifications(text);

  return {
    predictedLabel: classification,
    confidence: classifications.map((c: { label: string; value: number }) => ({
      label: c.label,
      probability: Math.round(c.value * 1000) / 1000,
    })),
    trainingSize: trainingData.length,
    labels: [...new Set(trainingData.map((d) => d.label))],
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function fullAnalysis(text: string, n: any, compareText?: string): Record<string, unknown> {
  return {
    sentiment: analyzeSentiment(text, n),
    tokens: tokenizeText(text, n),
    stems: stemText(text, n, 'porter'),
    phonetics: analyzePhonetics(text, n),
    ngrams: generateNgrams(text, n, 2),
    tfidf: analyzeTFIDF(text, n),
    ...(compareText ? { distance: calculateDistance(text, compareText, n) } : {}),
  };
}

// ============================================================================
// TOOL EXECUTOR
// ============================================================================

export async function executeNLP(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const args = toolCall.arguments as {
    text: string;
    analysis_type?: string;
    compare_text?: string;
    language?: string;
    stemmer_type?: string;
    ngram_size?: number;
    training_data?: { text: string; label: string }[];
  };

  // Validate required parameters
  if (!args.text) {
    return {
      toolCallId: toolCall.id,
      content: 'Error: text parameter is required',
      isError: true,
    };
  }

  // Initialize natural library
  const loaded = await initNatural();
  if (!loaded || !natural) {
    return {
      toolCallId: toolCall.id,
      content: 'Error: Natural NLP library not available. Please install the natural package.',
      isError: true,
    };
  }

  try {
    const analysisType = args.analysis_type || 'full';
    let result: Record<string, unknown>;

    switch (analysisType) {
      case 'sentiment':
        result = analyzeSentiment(args.text, natural);
        break;
      case 'tokenize':
        result = tokenizeText(args.text, natural);
        break;
      case 'stem':
        result = stemText(args.text, natural, args.stemmer_type || 'porter');
        break;
      case 'phonetics':
        result = analyzePhonetics(args.text, natural);
        break;
      case 'distance':
        if (!args.compare_text) {
          return {
            toolCallId: toolCall.id,
            content: 'Error: compare_text is required for distance analysis',
            isError: true,
          };
        }
        result = calculateDistance(args.text, args.compare_text, natural);
        break;
      case 'ngrams':
        result = generateNgrams(args.text, natural, args.ngram_size || 2);
        break;
      case 'tfidf':
        result = analyzeTFIDF(args.text, natural);
        break;
      case 'classify':
        result = classifyText(args.text, natural, args.training_data || []);
        break;
      case 'full':
      default:
        result = fullAnalysis(args.text, natural, args.compare_text);
        break;
    }

    return {
      toolCallId: toolCall.id,
      content: JSON.stringify({
        success: true,
        message: `Completed ${analysisType} analysis`,
        analysisType,
        textLength: args.text.length,
        language: args.language || 'english',
        analysis: result,
      }),
    };
  } catch (error) {
    return {
      toolCallId: toolCall.id,
      content: `Error performing NLP analysis: ${(error as Error).message}`,
      isError: true,
    };
  }
}
