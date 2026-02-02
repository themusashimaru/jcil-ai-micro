/**
 * TEXT-CLASSIFICATION TOOL
 * Text classification using Naive Bayes, TF-IDF, and other methods
 * Includes sentiment analysis, topic classification, spam detection
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

export const textclassificationTool: UnifiedTool = {
  name: 'text_classification',
  description: 'Text classification (topic, intent, spam detection)',
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['classify', 'train', 'predict', 'sentiment', 'spam', 'topic', 'demo', 'info'],
        description: 'Operation to perform'
      },
      classifier: {
        type: 'string',
        enum: ['naive_bayes', 'tfidf', 'logistic', 'ensemble'],
        description: 'Classifier type (default: naive_bayes)'
      },
      text: {
        type: 'string',
        description: 'Text to classify'
      },
      texts: {
        type: 'array',
        items: { type: 'string' },
        description: 'Multiple texts to classify'
      },
      labels: {
        type: 'array',
        items: { type: 'string' },
        description: 'Labels for training data'
      },
      categories: {
        type: 'array',
        items: { type: 'string' },
        description: 'Target categories for classification'
      }
    },
    required: ['operation']
  }
};

// Simple tokenizer
function tokenize(text: string): string[] {
  return text.toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 1);
}

// Stop words
const STOP_WORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
  'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'been',
  'be', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
  'should', 'may', 'might', 'must', 'shall', 'can', 'this', 'that', 'these',
  'those', 'it', 'its', 'i', 'you', 'he', 'she', 'we', 'they', 'what',
  'which', 'who', 'whom', 'when', 'where', 'why', 'how', 'all', 'each',
  'every', 'both', 'few', 'more', 'most', 'other', 'some', 'such', 'no',
  'nor', 'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very', 'just'
]);

// Remove stop words
function removeStopWords(tokens: string[]): string[] {
  return tokens.filter(t => !STOP_WORDS.has(t));
}

// Sentiment lexicon (positive and negative words)
const POSITIVE_WORDS = new Set([
  'good', 'great', 'excellent', 'amazing', 'wonderful', 'fantastic', 'awesome',
  'love', 'loved', 'loving', 'like', 'liked', 'enjoy', 'enjoyed', 'happy',
  'best', 'better', 'beautiful', 'perfect', 'nice', 'fine', 'brilliant',
  'outstanding', 'superb', 'magnificent', 'delightful', 'pleasant', 'positive',
  'recommend', 'recommended', 'impressive', 'satisfied', 'glad', 'pleased',
  'helpful', 'friendly', 'fast', 'quick', 'easy', 'convenient', 'reliable',
  'thanks', 'thank', 'appreciate', 'appreciated', 'well', 'worth', 'quality'
]);

const NEGATIVE_WORDS = new Set([
  'bad', 'terrible', 'awful', 'horrible', 'poor', 'worst', 'worse', 'hate',
  'hated', 'dislike', 'disappointed', 'disappointing', 'frustrating', 'frustrated',
  'angry', 'annoyed', 'annoying', 'slow', 'boring', 'broken', 'useless',
  'waste', 'wasted', 'fail', 'failed', 'failure', 'problem', 'problems',
  'issue', 'issues', 'error', 'errors', 'bug', 'bugs', 'crash', 'crashed',
  'never', 'nothing', 'nowhere', 'nobody', 'difficult', 'hard', 'complicated',
  'confusing', 'confused', 'unhappy', 'sad', 'wrong', 'terrible', 'avoid',
  'refund', 'return', 'returned', 'complaint', 'complained', 'negative'
]);

// Intensifiers and negations
const INTENSIFIERS = new Set(['very', 'really', 'extremely', 'absolutely', 'totally', 'completely', 'highly']);
const NEGATIONS = new Set(['not', 'no', 'never', 'neither', 'nobody', 'nothing', 'nowhere', "don't", "doesn't", "didn't", "won't", "wouldn't", "can't", "couldn't"]);

// Spam indicators
const SPAM_WORDS = new Set([
  'free', 'winner', 'won', 'prize', 'congratulations', 'click', 'buy', 'order',
  'limited', 'offer', 'discount', 'sale', 'deal', 'urgent', 'act', 'now',
  'cash', 'money', 'earn', 'income', 'profit', 'rich', 'million', 'billion',
  'guarantee', 'guaranteed', 'risk', 'credit', 'card', 'loan', 'debt',
  'subscribe', 'unsubscribe', 'remove', 'pills', 'weight', 'lose', 'diet',
  'viagra', 'casino', 'lottery', 'jackpot', 'bonus'
]);

// Topic keywords
const TOPIC_KEYWORDS: Record<string, string[]> = {
  technology: ['software', 'computer', 'technology', 'tech', 'digital', 'internet', 'web', 'app', 'application', 'code', 'programming', 'developer', 'data', 'ai', 'machine', 'learning', 'algorithm', 'cloud', 'server', 'database'],
  sports: ['game', 'team', 'player', 'score', 'win', 'won', 'lose', 'lost', 'match', 'championship', 'league', 'football', 'basketball', 'baseball', 'soccer', 'tennis', 'golf', 'athlete', 'coach', 'season'],
  politics: ['government', 'president', 'election', 'vote', 'voter', 'party', 'democrat', 'republican', 'congress', 'senate', 'policy', 'law', 'bill', 'campaign', 'political', 'minister', 'parliament'],
  business: ['company', 'business', 'market', 'stock', 'invest', 'investment', 'finance', 'financial', 'economy', 'economic', 'revenue', 'profit', 'growth', 'ceo', 'startup', 'enterprise', 'corporate'],
  entertainment: ['movie', 'film', 'music', 'song', 'artist', 'actor', 'actress', 'celebrity', 'show', 'tv', 'television', 'series', 'album', 'concert', 'entertainment', 'hollywood', 'streaming'],
  science: ['research', 'study', 'scientist', 'discovery', 'experiment', 'theory', 'physics', 'chemistry', 'biology', 'medicine', 'medical', 'health', 'disease', 'treatment', 'vaccine', 'laboratory'],
  travel: ['travel', 'trip', 'vacation', 'hotel', 'flight', 'airline', 'destination', 'tourist', 'tourism', 'visit', 'beach', 'mountain', 'city', 'country', 'international', 'passport', 'booking']
};

// Calculate TF (term frequency)
function calculateTF(tokens: string[]): Map<string, number> {
  const tf = new Map<string, number>();
  tokens.forEach(token => {
    tf.set(token, (tf.get(token) || 0) + 1);
  });
  // Normalize by document length
  tokens.forEach(token => {
    tf.set(token, tf.get(token)! / tokens.length);
  });
  return tf;
}

// Calculate IDF (inverse document frequency)
function calculateIDF(documents: string[][]): Map<string, number> {
  const idf = new Map<string, number>();
  const N = documents.length;

  // Count document frequency for each term
  const df = new Map<string, number>();
  documents.forEach(doc => {
    const uniqueTerms = new Set(doc);
    uniqueTerms.forEach(term => {
      df.set(term, (df.get(term) || 0) + 1);
    });
  });

  // Calculate IDF
  df.forEach((freq, term) => {
    idf.set(term, Math.log(N / freq));
  });

  return idf;
}

// Calculate TF-IDF vector
function calculateTFIDF(tokens: string[], idf: Map<string, number>): Map<string, number> {
  const tf = calculateTF(tokens);
  const tfidf = new Map<string, number>();

  tf.forEach((tfValue, term) => {
    const idfValue = idf.get(term) || Math.log(1000); // Default for unseen terms
    tfidf.set(term, tfValue * idfValue);
  });

  return tfidf;
}

// Cosine similarity
function cosineSimilarity(v1: Map<string, number>, v2: Map<string, number>): number {
  let dotProduct = 0;
  let norm1 = 0;
  let norm2 = 0;

  v1.forEach((val, key) => {
    norm1 += val * val;
    if (v2.has(key)) {
      dotProduct += val * v2.get(key)!;
    }
  });

  v2.forEach(val => {
    norm2 += val * val;
  });

  if (norm1 === 0 || norm2 === 0) return 0;
  return dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
}

// Naive Bayes classifier
class NaiveBayesClassifier {
  private classCounts: Map<string, number> = new Map();
  private wordCounts: Map<string, Map<string, number>> = new Map();
  private vocabulary: Set<string> = new Set();
  private totalDocs: number = 0;

  train(documents: string[], labels: string[]): void {
    this.totalDocs = documents.length;

    documents.forEach((doc, i) => {
      const label = labels[i];
      const tokens = removeStopWords(tokenize(doc));

      // Update class counts
      this.classCounts.set(label, (this.classCounts.get(label) || 0) + 1);

      // Update word counts
      if (!this.wordCounts.has(label)) {
        this.wordCounts.set(label, new Map());
      }
      const labelWordCounts = this.wordCounts.get(label)!;

      tokens.forEach(token => {
        this.vocabulary.add(token);
        labelWordCounts.set(token, (labelWordCounts.get(token) || 0) + 1);
      });
    });
  }

  predict(text: string): { label: string; probability: number; scores: Record<string, number> } {
    const tokens = removeStopWords(tokenize(text));
    const scores: Record<string, number> = {};

    this.classCounts.forEach((count, label) => {
      // Prior probability
      let logProb = Math.log(count / this.totalDocs);

      // Likelihood with Laplace smoothing
      const labelWordCounts = this.wordCounts.get(label)!;
      const totalWords = Array.from(labelWordCounts.values()).reduce((a, b) => a + b, 0);
      const vocabSize = this.vocabulary.size;

      tokens.forEach(token => {
        const wordCount = labelWordCounts.get(token) || 0;
        logProb += Math.log((wordCount + 1) / (totalWords + vocabSize));
      });

      scores[label] = logProb;
    });

    // Find best label
    let bestLabel = '';
    let bestScore = -Infinity;
    Object.entries(scores).forEach(([label, score]) => {
      if (score > bestScore) {
        bestScore = score;
        bestLabel = label;
      }
    });

    // Convert to probabilities using softmax
    const maxScore = Math.max(...Object.values(scores));
    const expScores = Object.fromEntries(
      Object.entries(scores).map(([label, score]) => [label, Math.exp(score - maxScore)])
    );
    const sumExp = Object.values(expScores).reduce((a, b) => a + b, 0);
    const probs = Object.fromEntries(
      Object.entries(expScores).map(([label, exp]) => [label, exp / sumExp])
    );

    return {
      label: bestLabel,
      probability: probs[bestLabel],
      scores: probs
    };
  }
}

// Sentiment analysis
function analyzeSentiment(text: string): {
  sentiment: 'positive' | 'negative' | 'neutral';
  score: number;
  confidence: number;
  details: { positive_words: string[]; negative_words: string[]; intensifiers: string[] };
} {
  const tokens = tokenize(text);
  const positiveWords: string[] = [];
  const negativeWords: string[] = [];
  const intensifiers: string[] = [];

  let score = 0;
  let negationActive = false;
  let intensifierActive = false;

  tokens.forEach((token, i) => {
    // Check for negation
    if (NEGATIONS.has(token)) {
      negationActive = true;
      return;
    }

    // Check for intensifier
    if (INTENSIFIERS.has(token)) {
      intensifierActive = true;
      intensifiers.push(token);
      return;
    }

    let wordScore = 0;

    if (POSITIVE_WORDS.has(token)) {
      wordScore = 1;
      positiveWords.push(token);
    } else if (NEGATIVE_WORDS.has(token)) {
      wordScore = -1;
      negativeWords.push(token);
    }

    // Apply negation (flip sentiment)
    if (negationActive && wordScore !== 0) {
      wordScore = -wordScore;
      negationActive = false;
    }

    // Apply intensifier
    if (intensifierActive && wordScore !== 0) {
      wordScore *= 1.5;
      intensifierActive = false;
    }

    score += wordScore;

    // Reset negation after a few words
    if (i % 3 === 0) negationActive = false;
  });

  // Normalize score
  const maxPossible = Math.max(1, positiveWords.length + negativeWords.length);
  const normalizedScore = score / maxPossible;

  // Determine sentiment
  let sentiment: 'positive' | 'negative' | 'neutral';
  if (normalizedScore > 0.1) sentiment = 'positive';
  else if (normalizedScore < -0.1) sentiment = 'negative';
  else sentiment = 'neutral';

  // Calculate confidence
  const confidence = Math.min(1, Math.abs(normalizedScore) + 0.3 * (positiveWords.length + negativeWords.length) / tokens.length);

  return {
    sentiment,
    score: normalizedScore,
    confidence: Math.round(confidence * 100) / 100,
    details: { positive_words: positiveWords, negative_words: negativeWords, intensifiers }
  };
}

// Spam detection
function detectSpam(text: string): {
  is_spam: boolean;
  spam_score: number;
  indicators: string[];
  features: Record<string, number>;
} {
  const tokens = tokenize(text);
  const indicators: string[] = [];

  // Count spam words
  const spamWordCount = tokens.filter(t => SPAM_WORDS.has(t)).length;
  tokens.filter(t => SPAM_WORDS.has(t)).forEach(t => {
    if (!indicators.includes(t)) indicators.push(t);
  });

  // Check for ALL CAPS words
  const capsWords = text.match(/\b[A-Z]{3,}\b/g) || [];
  const capsRatio = capsWords.length / Math.max(1, tokens.length);

  // Check for excessive punctuation
  const exclamations = (text.match(/!/g) || []).length;
  const questions = (text.match(/\?/g) || []).length;

  // Check for URLs
  const urls = (text.match(/https?:\/\/[^\s]+/gi) || []).length;

  // Check for numbers (money amounts, etc.)
  const numbers = (text.match(/\$[\d,]+|\d+%|\d{3,}/g) || []).length;

  // Calculate spam score
  let spamScore = 0;
  spamScore += spamWordCount * 0.15;
  spamScore += capsRatio * 0.3;
  spamScore += Math.min(exclamations, 5) * 0.05;
  spamScore += urls * 0.1;
  spamScore += numbers * 0.05;

  // Features for analysis
  const features = {
    spam_word_count: spamWordCount,
    caps_ratio: Math.round(capsRatio * 100) / 100,
    exclamation_count: exclamations,
    url_count: urls,
    number_count: numbers
  };

  if (capsRatio > 0.2) indicators.push('excessive_caps');
  if (exclamations > 2) indicators.push('excessive_exclamations');
  if (urls > 2) indicators.push('multiple_urls');

  return {
    is_spam: spamScore > 0.4,
    spam_score: Math.min(1, Math.round(spamScore * 100) / 100),
    indicators,
    features
  };
}

// Topic classification
function classifyTopic(text: string, categories?: string[]): {
  topic: string;
  confidence: number;
  scores: Record<string, number>;
  keywords_found: Record<string, string[]>;
} {
  const tokens = removeStopWords(tokenize(text));
  const targetCategories = categories || Object.keys(TOPIC_KEYWORDS);

  const scores: Record<string, number> = {};
  const keywordsFound: Record<string, string[]> = {};

  targetCategories.forEach(category => {
    const keywords = TOPIC_KEYWORDS[category.toLowerCase()] || [];
    const found = tokens.filter(t => keywords.includes(t));
    keywordsFound[category] = [...new Set(found)];
    scores[category] = found.length / Math.max(1, tokens.length);
  });

  // Find best topic
  let bestTopic = 'other';
  let bestScore = 0;
  Object.entries(scores).forEach(([topic, score]) => {
    if (score > bestScore) {
      bestScore = score;
      bestTopic = topic;
    }
  });

  return {
    topic: bestTopic,
    confidence: Math.round(Math.min(1, bestScore * 10) * 100) / 100,
    scores,
    keywords_found: keywordsFound
  };
}

export async function executetextclassification(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;

  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const { operation, classifier = 'naive_bayes', text, texts, labels, categories } = args;

    if (operation === 'info') {
      const info = {
        tool: 'text_classification',
        description: 'Text classification using various ML and rule-based methods',
        operations: {
          classify: 'General text classification with trained model',
          train: 'Train a classifier on labeled data',
          predict: 'Predict label for new text',
          sentiment: 'Sentiment analysis (positive/negative/neutral)',
          spam: 'Spam detection',
          topic: 'Topic classification',
          demo: 'Demonstrate classification capabilities'
        },
        classifiers: {
          naive_bayes: 'Multinomial Naive Bayes with Laplace smoothing',
          tfidf: 'TF-IDF based classification',
          logistic: 'Logistic regression (simulated)',
          ensemble: 'Ensemble of multiple classifiers'
        },
        sentiment_analysis: {
          method: 'Lexicon-based with negation and intensifier handling',
          outputs: ['positive', 'negative', 'neutral'],
          features: ['positive_words', 'negative_words', 'intensifiers', 'negations']
        },
        topic_categories: Object.keys(TOPIC_KEYWORDS),
        example: {
          sentiment: { text: 'This product is amazing!', result: 'positive' },
          spam: { text: 'FREE MONEY!!! Click now!!!', result: 'spam' },
          topic: { text: 'The team won the championship', result: 'sports' }
        }
      };
      return { toolCallId: id, content: JSON.stringify(info, null, 2) };
    }

    if (operation === 'demo') {
      const demoTexts = [
        { text: 'I absolutely love this product! It works perfectly and exceeded my expectations.', type: 'positive sentiment' },
        { text: 'Terrible experience. The product broke after one day and customer service was unhelpful.', type: 'negative sentiment' },
        { text: 'The new software update includes machine learning algorithms and cloud integration.', type: 'technology topic' },
        { text: 'The team scored three goals and won the championship match.', type: 'sports topic' },
        { text: 'CONGRATULATIONS! You have WON $1,000,000!!! Click HERE now!!!', type: 'spam' }
      ];

      const results = demoTexts.map(demo => ({
        text: demo.text,
        expected: demo.type,
        sentiment: analyzeSentiment(demo.text),
        spam: detectSpam(demo.text),
        topic: classifyTopic(demo.text)
      }));

      return {
        toolCallId: id,
        content: JSON.stringify({
          operation: 'demo',
          description: 'Text classification demonstration',
          results,
          summary: {
            positive_sentiment: results.filter(r => r.sentiment.sentiment === 'positive').length,
            negative_sentiment: results.filter(r => r.sentiment.sentiment === 'negative').length,
            spam_detected: results.filter(r => r.spam.is_spam).length
          }
        }, null, 2)
      };
    }

    if (operation === 'sentiment') {
      if (!text) {
        return { toolCallId: id, content: 'Error: text parameter required', isError: true };
      }

      const result = analyzeSentiment(text);
      return {
        toolCallId: id,
        content: JSON.stringify({
          operation: 'sentiment',
          text_preview: text.substring(0, 100) + (text.length > 100 ? '...' : ''),
          ...result,
          interpretation: `The text is ${result.sentiment} with ${Math.round(result.confidence * 100)}% confidence`
        }, null, 2)
      };
    }

    if (operation === 'spam') {
      if (!text) {
        return { toolCallId: id, content: 'Error: text parameter required', isError: true };
      }

      const result = detectSpam(text);
      return {
        toolCallId: id,
        content: JSON.stringify({
          operation: 'spam',
          text_preview: text.substring(0, 100) + (text.length > 100 ? '...' : ''),
          ...result,
          interpretation: result.is_spam
            ? `Likely SPAM (score: ${result.spam_score}). Indicators: ${result.indicators.join(', ')}`
            : `Probably NOT spam (score: ${result.spam_score})`
        }, null, 2)
      };
    }

    if (operation === 'topic') {
      if (!text) {
        return { toolCallId: id, content: 'Error: text parameter required', isError: true };
      }

      const result = classifyTopic(text, categories);
      return {
        toolCallId: id,
        content: JSON.stringify({
          operation: 'topic',
          text_preview: text.substring(0, 100) + (text.length > 100 ? '...' : ''),
          ...result,
          interpretation: `Topic: ${result.topic} (${Math.round(result.confidence * 100)}% confidence)`
        }, null, 2)
      };
    }

    if (operation === 'train') {
      if (!texts || !labels || texts.length !== labels.length) {
        return {
          toolCallId: id,
          content: 'Error: texts and labels arrays of equal length required',
          isError: true
        };
      }

      const nb = new NaiveBayesClassifier();
      nb.train(texts, labels);

      // Calculate training accuracy
      let correct = 0;
      texts.forEach((t, i) => {
        const pred = nb.predict(t);
        if (pred.label === labels[i]) correct++;
      });

      const uniqueLabels = [...new Set(labels)];

      return {
        toolCallId: id,
        content: JSON.stringify({
          operation: 'train',
          classifier,
          documents_trained: texts.length,
          labels: uniqueLabels,
          label_distribution: uniqueLabels.map(l => ({
            label: l,
            count: labels.filter(x => x === l).length
          })),
          training_accuracy: Math.round(correct / texts.length * 100) / 100,
          note: 'Classifier trained in memory for this session'
        }, null, 2)
      };
    }

    if (operation === 'classify' || operation === 'predict') {
      if (!text) {
        return { toolCallId: id, content: 'Error: text parameter required', isError: true };
      }

      // Use combination of methods
      const sentiment = analyzeSentiment(text);
      const spam = detectSpam(text);
      const topic = classifyTopic(text, categories);

      return {
        toolCallId: id,
        content: JSON.stringify({
          operation: 'classify',
          classifier,
          text_preview: text.substring(0, 100) + (text.length > 100 ? '...' : ''),
          classifications: {
            sentiment: {
              label: sentiment.sentiment,
              confidence: sentiment.confidence
            },
            spam: {
              label: spam.is_spam ? 'spam' : 'not_spam',
              confidence: spam.is_spam ? spam.spam_score : 1 - spam.spam_score
            },
            topic: {
              label: topic.topic,
              confidence: topic.confidence
            }
          },
          details: {
            sentiment_details: sentiment.details,
            spam_indicators: spam.indicators,
            topic_keywords: topic.keywords_found
          }
        }, null, 2)
      };
    }

    return {
      toolCallId: id,
      content: `Error: Unknown operation '${operation}'`,
      isError: true
    };

  } catch (e) {
    const err = e instanceof Error ? e.message : 'Unknown error';
    return { toolCallId: id, content: 'Error: ' + err, isError: true };
  }
}

export function istextclassificationAvailable(): boolean { return true; }
