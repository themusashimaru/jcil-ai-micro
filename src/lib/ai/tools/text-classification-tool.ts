/**
 * TEXT-CLASSIFICATION TOOL
 * Complete text classification and categorization toolkit
 *
 * This implementation provides:
 * - Naive Bayes classifier (Multinomial and Bernoulli)
 * - TF-IDF feature extraction
 * - Text preprocessing (tokenization, stemming, stopwords)
 * - Training, prediction, and evaluation
 * - Multi-class classification
 * - Pre-trained sentiment and spam detection models
 *
 * Applications:
 * - Sentiment analysis
 * - Spam detection
 * - Topic classification
 * - Intent recognition
 * - Document categorization
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// ============================================================================
// TEXT PREPROCESSING
// ============================================================================

// Common English stopwords
const STOPWORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of',
  'with', 'by', 'from', 'up', 'about', 'into', 'through', 'during', 'before',
  'after', 'above', 'below', 'between', 'under', 'again', 'further', 'then',
  'once', 'here', 'there', 'when', 'where', 'why', 'how', 'all', 'each',
  'few', 'more', 'most', 'other', 'some', 'such', 'no', 'nor', 'not', 'only',
  'own', 'same', 'so', 'than', 'too', 'very', 'can', 'will', 'just', 'should',
  'now', 'i', 'me', 'my', 'myself', 'we', 'our', 'ours', 'ourselves', 'you',
  'your', 'yours', 'yourself', 'yourselves', 'he', 'him', 'his', 'himself',
  'she', 'her', 'hers', 'herself', 'it', 'its', 'itself', 'they', 'them',
  'their', 'theirs', 'themselves', 'what', 'which', 'who', 'whom', 'this',
  'that', 'these', 'those', 'am', 'is', 'are', 'was', 'were', 'be', 'been',
  'being', 'have', 'has', 'had', 'having', 'do', 'does', 'did', 'doing',
  'would', 'could', 'ought', 'im', 'youre', 'hes', 'shes', 'its', 'were',
  'theyre', 'ive', 'youve', 'weve', 'theyve', 'id', 'youd', 'hed', 'shed',
  'wed', 'theyd', 'ill', 'youll', 'hell', 'shell', 'well', 'theyll', 'isnt',
  'arent', 'wasnt', 'werent', 'hasnt', 'havent', 'hadnt', 'doesnt', 'dont',
  'didnt', 'wont', 'wouldnt', 'shant', 'shouldnt', 'cant', 'cannot', 'couldnt',
  'mustnt', 'lets', 'thats', 'whos', 'whats', 'heres', 'theres', 'whens',
  'wheres', 'whys', 'hows', 'because', 'as', 'until', 'while', 'although',
  'though', 'if', 'unless', 'since', 'also'
]);

// Simple Porter-like stemmer
function stem(word: string): string {
  // Simple suffix removal rules
  const suffixes = [
    'ingly', 'edly', 'ness', 'ment', 'tion', 'sion', 'able', 'ible',
    'ful', 'less', 'ous', 'ive', 'ing', 'ed', 'er', 'ly', 's'
  ];

  word = word.toLowerCase();

  for (const suffix of suffixes) {
    if (word.length > suffix.length + 2 && word.endsWith(suffix)) {
      return word.slice(0, -suffix.length);
    }
  }

  return word;
}

/**
 * Tokenize and preprocess text
 */
function preprocess(
  text: string,
  options: {
    lowercase?: boolean;
    removeStopwords?: boolean;
    stemWords?: boolean;
    minLength?: number;
  } = {}
): string[] {
  /* eslint-disable @typescript-eslint/no-unused-vars */
  const {
    lowercase: _lowercase = true,
    /* eslint-enable @typescript-eslint/no-unused-vars */
    removeStopwords = true,
    stemWords = false,
    minLength = 2
  } = options;

  // Convert to lowercase and split into words
  let tokens = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length >= minLength);

  // Remove stopwords
  if (removeStopwords) {
    tokens = tokens.filter(t => !STOPWORDS.has(t));
  }

  // Apply stemming
  if (stemWords) {
    tokens = tokens.map(stem);
  }

  return tokens;
}

// ============================================================================
// TF-IDF VECTORIZER
// ============================================================================

// eslint-disable-next-line @typescript-eslint/no-unused-vars
interface TFIDFModel {
  vocabulary: Map<string, number>;
  idf: Map<string, number>;
  documentCount: number;
}

function buildVocabulary(documents: string[][], maxFeatures?: number): Map<string, number> {
  const wordFreq = new Map<string, number>();

  // Count word frequencies across all documents
  for (const doc of documents) {
    const uniqueWords = new Set(doc);
    for (const word of uniqueWords) {
      wordFreq.set(word, (wordFreq.get(word) || 0) + 1);
    }
  }

  // Sort by frequency and take top features
  const sorted = Array.from(wordFreq.entries())
    .sort((a, b) => b[1] - a[1]);

  const vocab = new Map<string, number>();
  const limit = maxFeatures || sorted.length;

  for (let i = 0; i < Math.min(limit, sorted.length); i++) {
    vocab.set(sorted[i][0], i);
  }

  return vocab;
}

function computeIDF(documents: string[][], vocabulary: Map<string, number>): Map<string, number> {
  const N = documents.length;
  const idf = new Map<string, number>();

  for (const word of vocabulary.keys()) {
    const docCount = documents.filter(doc => doc.includes(word)).length;
    // Smoothed IDF
    idf.set(word, Math.log((N + 1) / (docCount + 1)) + 1);
  }

  return idf;
}

function computeTFIDF(
  tokens: string[],
  vocabulary: Map<string, number>,
  idf: Map<string, number>
): number[] {
  const vector = new Array(vocabulary.size).fill(0);

  // Compute TF
  const tf = new Map<string, number>();
  for (const token of tokens) {
    tf.set(token, (tf.get(token) || 0) + 1);
  }

  // Normalize TF and multiply by IDF
  const maxTF = Math.max(...tf.values(), 1);

  for (const [word, idx] of vocabulary.entries()) {
    const termFreq = (tf.get(word) || 0) / maxTF;
    const inverseDocFreq = idf.get(word) || 0;
    vector[idx] = termFreq * inverseDocFreq;
  }

  return vector;
}

// ============================================================================
// NAIVE BAYES CLASSIFIER
// ============================================================================

interface NaiveBayesModel {
  type: 'multinomial' | 'bernoulli';
  classes: string[];
  classPriors: Map<string, number>;
  featureLikelihoods: Map<string, Map<string, number>>;
  vocabulary: Map<string, number>;
  idf: Map<string, number>;
  smoothing: number;
}

/**
 * Train Multinomial Naive Bayes classifier
 */
function trainMultinomialNB(
  texts: string[],
  labels: string[],
  options: {
    smoothing?: number;
    maxFeatures?: number;
  } = {}
): NaiveBayesModel {
  const { smoothing = 1.0, maxFeatures = 5000 } = options;

  // Preprocess all documents
  const documents = texts.map(t => preprocess(t, { stemWords: true }));

  // Build vocabulary
  const vocabulary = buildVocabulary(documents, maxFeatures);
  const idf = computeIDF(documents, vocabulary);

  // Get unique classes
  const classes = [...new Set(labels)];

  // Compute class priors
  const classPriors = new Map<string, number>();
  const classCounts = new Map<string, number>();

  for (const label of labels) {
    classCounts.set(label, (classCounts.get(label) || 0) + 1);
  }

  for (const cls of classes) {
    classPriors.set(cls, Math.log((classCounts.get(cls) || 0) / labels.length));
  }

  // Compute feature likelihoods P(word|class)
  const featureLikelihoods = new Map<string, Map<string, number>>();
  const classWordCounts = new Map<string, Map<string, number>>();
  const classTotalWords = new Map<string, number>();

  for (const cls of classes) {
    classWordCounts.set(cls, new Map());
    classTotalWords.set(cls, 0);
  }

  // Count word occurrences per class
  for (let i = 0; i < documents.length; i++) {
    const label = labels[i];
    const wordCounts = classWordCounts.get(label)!;

    for (const word of documents[i]) {
      if (vocabulary.has(word)) {
        wordCounts.set(word, (wordCounts.get(word) || 0) + 1);
        classTotalWords.set(label, (classTotalWords.get(label) || 0) + 1);
      }
    }
  }

  // Compute smoothed log-likelihoods
  const vocabSize = vocabulary.size;

  for (const cls of classes) {
    const wordCounts = classWordCounts.get(cls)!;
    const totalWords = classTotalWords.get(cls) || 0;
    const likelihoods = new Map<string, number>();

    for (const word of vocabulary.keys()) {
      const count = wordCounts.get(word) || 0;
      // Laplace smoothing
      const prob = (count + smoothing) / (totalWords + smoothing * vocabSize);
      likelihoods.set(word, Math.log(prob));
    }

    featureLikelihoods.set(cls, likelihoods);
  }

  return {
    type: 'multinomial',
    classes,
    classPriors,
    featureLikelihoods,
    vocabulary,
    idf,
    smoothing
  };
}

/**
 * Predict class for new text
 */
function predictNB(
  text: string,
  model: NaiveBayesModel
): { prediction: string; probabilities: Map<string, number>; confidence: number } {
  const tokens = preprocess(text, { stemWords: true });

  const logProbs = new Map<string, number>();

  for (const cls of model.classes) {
    let logProb = model.classPriors.get(cls) || 0;
    const likelihoods = model.featureLikelihoods.get(cls)!;

    for (const token of tokens) {
      if (model.vocabulary.has(token)) {
        logProb += likelihoods.get(token) || Math.log(model.smoothing / model.vocabulary.size);
      }
    }

    logProbs.set(cls, logProb);
  }

  // Convert to probabilities using log-sum-exp trick
  const maxLogProb = Math.max(...logProbs.values());
  const sumExp = Array.from(logProbs.values())
    .reduce((sum, lp) => sum + Math.exp(lp - maxLogProb), 0);

  const probabilities = new Map<string, number>();
  let maxProb = 0;
  let prediction = model.classes[0];

  for (const [cls, logProb] of logProbs) {
    const prob = Math.exp(logProb - maxLogProb) / sumExp;
    probabilities.set(cls, prob);

    if (prob > maxProb) {
      maxProb = prob;
      prediction = cls;
    }
  }

  return { prediction, probabilities, confidence: maxProb };
}

// ============================================================================
// PRE-TRAINED MODELS
// ============================================================================

// Sentiment analysis training data
const SENTIMENT_DATA = {
  positive: [
    'great excellent amazing wonderful fantastic love happy joy',
    'awesome beautiful brilliant best perfect incredible delightful',
    'outstanding superb magnificent terrific fabulous marvelous',
    'pleased satisfied glad thankful grateful appreciative',
    'exciting thrilling impressive remarkable extraordinary'
  ],
  negative: [
    'terrible horrible awful bad worst hate angry sad',
    'disappointing frustrating annoying irritating unpleasant',
    'poor mediocre substandard inferior inadequate unsatisfactory',
    'upset worried concerned troubled distressed unhappy',
    'boring dull tedious tiresome monotonous dreary'
  ]
};

// Spam detection training data
const SPAM_DATA = {
  spam: [
    'free money winner congratulations prize claim click here now',
    'urgent act immediately limited offer exclusive deal discount',
    'buy cheap pills medication prescription pharmacy online',
    'million dollars inheritance bank transfer wire send payment',
    'click link verify account password login credentials update'
  ],
  ham: [
    'meeting tomorrow conference room schedule appointment',
    'project update progress report deadline deliverable',
    'question regarding document file attachment please review',
    'thank you for your email response follow up',
    'team collaboration discussion feedback improvement'
  ]
};

function createPretrainedModel(
  data: Record<string, string[]>,
  _name: string
): NaiveBayesModel {
  const texts: string[] = [];
  const labels: string[] = [];

  for (const [label, samples] of Object.entries(data)) {
    for (const sample of samples) {
      texts.push(sample);
      labels.push(label);
    }
  }

  const model = trainMultinomialNB(texts, labels, { maxFeatures: 500 });
  return model;
}

// ============================================================================
// EVALUATION METRICS
// ============================================================================

interface ClassificationMetrics {
  accuracy: number;
  precision: Map<string, number>;
  recall: Map<string, number>;
  f1Score: Map<string, number>;
  confusionMatrix: Map<string, Map<string, number>>;
}

function evaluateClassifier(
  predictions: string[],
  actual: string[],
  classes: string[]
): ClassificationMetrics {
  // Initialize confusion matrix
  const confusionMatrix = new Map<string, Map<string, number>>();
  for (const cls of classes) {
    confusionMatrix.set(cls, new Map());
    for (const cls2 of classes) {
      confusionMatrix.get(cls)!.set(cls2, 0);
    }
  }

  // Fill confusion matrix
  let correct = 0;
  for (let i = 0; i < predictions.length; i++) {
    const pred = predictions[i];
    const act = actual[i];
    confusionMatrix.get(act)!.set(pred, (confusionMatrix.get(act)!.get(pred) || 0) + 1);
    if (pred === act) correct++;
  }

  const accuracy = correct / predictions.length;

  // Compute precision, recall, F1 for each class
  const precision = new Map<string, number>();
  const recall = new Map<string, number>();
  const f1Score = new Map<string, number>();

  for (const cls of classes) {
    const tp = confusionMatrix.get(cls)!.get(cls) || 0;
    let fp = 0, fn = 0;

    for (const other of classes) {
      if (other !== cls) {
        fp += confusionMatrix.get(other)!.get(cls) || 0;
        fn += confusionMatrix.get(cls)!.get(other) || 0;
      }
    }

    const p = tp / (tp + fp) || 0;
    const r = tp / (tp + fn) || 0;
    const f1 = 2 * p * r / (p + r) || 0;

    precision.set(cls, p);
    recall.set(cls, r);
    f1Score.set(cls, f1);
  }

  return { accuracy, precision, recall, f1Score, confusionMatrix };
}

// ============================================================================
// TOOL INTERFACE
// ============================================================================

// Cache for pre-trained models
const modelCache = new Map<string, NaiveBayesModel>();

export const textclassificationTool: UnifiedTool = {
  name: 'text_classification',
  description: 'Text classification using Naive Bayes and TF-IDF',
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['classify', 'train', 'predict', 'evaluate', 'sentiment', 'spam', 'preprocess', 'tfidf', 'info'],
        description: 'Operation to perform'
      },
      text: {
        type: 'string',
        description: 'Text to classify or preprocess'
      },
      texts: {
        type: 'array',
        items: { type: 'string' },
        description: 'Array of texts for training or batch prediction'
      },
      labels: {
        type: 'array',
        items: { type: 'string' },
        description: 'Array of labels for training'
      },
      model_name: {
        type: 'string',
        description: 'Name to save/load model'
      },
      classifier: {
        type: 'string',
        enum: ['naive_bayes', 'multinomial_nb'],
        description: 'Classifier type'
      },
      smoothing: {
        type: 'number',
        description: 'Laplace smoothing parameter (default: 1.0)'
      },
      max_features: {
        type: 'number',
        description: 'Maximum vocabulary size'
      },
      remove_stopwords: {
        type: 'boolean',
        description: 'Remove common stopwords'
      },
      stem: {
        type: 'boolean',
        description: 'Apply word stemming'
      }
    },
    required: ['operation']
  }
};

export async function executetextclassification(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;

  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const {
      operation,
      text,
      texts,
      labels,
      model_name,
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      classifier: _classifier = 'naive_bayes',
      smoothing = 1.0,
      max_features = 5000,
      remove_stopwords = true,
      stem: stemWords = true
    } = args;

    // Info operation
    if (operation === 'info') {
      const info = {
        name: 'Text Classification Tool',
        description: 'Classify text using machine learning',
        operations: {
          classify: 'Classify text using trained or pre-trained model',
          train: 'Train a new classifier on labeled data',
          predict: 'Batch prediction on multiple texts',
          evaluate: 'Evaluate classifier performance',
          sentiment: 'Analyze sentiment (positive/negative)',
          spam: 'Detect spam vs legitimate messages',
          preprocess: 'Tokenize and preprocess text',
          tfidf: 'Compute TF-IDF features'
        },
        classifiers: {
          naive_bayes: 'Multinomial Naive Bayes - fast, effective for text',
          multinomial_nb: 'Same as naive_bayes'
        },
        preprocessing: {
          tokenization: 'Split text into words',
          lowercase: 'Convert to lowercase',
          stopwordRemoval: 'Remove common words (the, is, at, etc.)',
          stemming: 'Reduce words to root form (running -> run)'
        },
        pretrainedModels: {
          sentiment: 'Positive/negative sentiment analysis',
          spam: 'Spam detection'
        },
        metrics: ['accuracy', 'precision', 'recall', 'f1Score', 'confusionMatrix']
      };
      return { toolCallId: id, content: JSON.stringify(info, null, 2) };
    }

    // Preprocess operation
    if (operation === 'preprocess') {
      if (!text) {
        return { toolCallId: id, content: 'Error: text required for preprocess', isError: true };
      }

      const tokens = preprocess(text, {
        removeStopwords: remove_stopwords,
        stemWords
      });

      const result = {
        operation: 'preprocess',
        input: {
          text: text.slice(0, 200) + (text.length > 200 ? '...' : ''),
          length: text.length
        },
        output: {
          tokens,
          tokenCount: tokens.length,
          uniqueTokens: [...new Set(tokens)].length
        },
        options: {
          removeStopwords: remove_stopwords,
          stemming: stemWords
        }
      };

      return { toolCallId: id, content: JSON.stringify(result, null, 2) };
    }

    // TF-IDF operation
    if (operation === 'tfidf') {
      if (!texts || !Array.isArray(texts)) {
        return { toolCallId: id, content: 'Error: texts array required for tfidf', isError: true };
      }

      const documents = texts.map(t => preprocess(t, { stemWords }));
      const vocabulary = buildVocabulary(documents, max_features);
      const idf = computeIDF(documents, vocabulary);

      const vectors = documents.map(doc => computeTFIDF(doc, vocabulary, idf));

      const result = {
        operation: 'tfidf',
        input: {
          documentCount: texts.length,
          averageLength: Math.round(texts.reduce((s, t) => s + t.length, 0) / texts.length)
        },
        output: {
          vocabularySize: vocabulary.size,
          topFeatures: Array.from(vocabulary.entries())
            .sort((a, b) => (idf.get(b[0]) || 0) - (idf.get(a[0]) || 0))
            .slice(0, 20)
            .map(([word, idx]) => ({
              word,
              index: idx,
              idf: Math.round((idf.get(word) || 0) * 1000) / 1000
            })),
          vectorDimensions: vocabulary.size,
          sampleVector: vectors[0]?.slice(0, 10).map(v => Math.round(v * 1000) / 1000)
        }
      };

      return { toolCallId: id, content: JSON.stringify(result, null, 2) };
    }

    // Sentiment analysis
    if (operation === 'sentiment') {
      if (!text) {
        return { toolCallId: id, content: 'Error: text required for sentiment analysis', isError: true };
      }

      // Get or create sentiment model
      if (!modelCache.has('sentiment')) {
        modelCache.set('sentiment', createPretrainedModel(SENTIMENT_DATA, 'sentiment'));
      }

      const model = modelCache.get('sentiment')!;
      const { prediction, probabilities, confidence } = predictNB(text, model);

      const result = {
        operation: 'sentiment',
        input: {
          text: text.slice(0, 200) + (text.length > 200 ? '...' : '')
        },
        output: {
          sentiment: prediction,
          confidence: Math.round(confidence * 1000) / 1000,
          probabilities: Object.fromEntries(
            Array.from(probabilities.entries()).map(([k, v]) => [k, Math.round(v * 1000) / 1000])
          )
        },
        interpretation: prediction === 'positive'
          ? 'The text expresses positive sentiment'
          : 'The text expresses negative sentiment'
      };

      return { toolCallId: id, content: JSON.stringify(result, null, 2) };
    }

    // Spam detection
    if (operation === 'spam') {
      if (!text) {
        return { toolCallId: id, content: 'Error: text required for spam detection', isError: true };
      }

      // Get or create spam model
      if (!modelCache.has('spam')) {
        modelCache.set('spam', createPretrainedModel(SPAM_DATA, 'spam'));
      }

      const model = modelCache.get('spam')!;
      const { prediction, probabilities, confidence } = predictNB(text, model);

      const result = {
        operation: 'spam',
        input: {
          text: text.slice(0, 200) + (text.length > 200 ? '...' : '')
        },
        output: {
          classification: prediction,
          isSpam: prediction === 'spam',
          confidence: Math.round(confidence * 1000) / 1000,
          probabilities: Object.fromEntries(
            Array.from(probabilities.entries()).map(([k, v]) => [k, Math.round(v * 1000) / 1000])
          )
        },
        interpretation: prediction === 'spam'
          ? 'The text appears to be spam or unsolicited'
          : 'The text appears to be legitimate'
      };

      return { toolCallId: id, content: JSON.stringify(result, null, 2) };
    }

    // Train operation
    if (operation === 'train') {
      if (!texts || !labels) {
        return { toolCallId: id, content: 'Error: texts and labels arrays required for training', isError: true };
      }

      if (texts.length !== labels.length) {
        return { toolCallId: id, content: `Error: texts (${texts.length}) and labels (${labels.length}) must have same length`, isError: true };
      }

      const model = trainMultinomialNB(texts, labels, {
        smoothing,
        maxFeatures: max_features
      });

      // Save model if name provided
      if (model_name) {
        modelCache.set(model_name, model);
      }

      const result = {
        operation: 'train',
        input: {
          documentCount: texts.length,
          classDistribution: Object.fromEntries(
            model.classes.map(cls => [
              cls,
              labels.filter(l => l === cls).length
            ])
          )
        },
        model: {
          type: model.type,
          classes: model.classes,
          vocabularySize: model.vocabulary.size,
          smoothing: model.smoothing
        },
        ...(model_name ? { savedAs: model_name } : {}),
        notes: [
          'Model trained using Multinomial Naive Bayes',
          'Use classify or predict operations to make predictions',
          model_name ? `Model saved as "${model_name}"` : 'Provide model_name to save for later use'
        ]
      };

      return { toolCallId: id, content: JSON.stringify(result, null, 2) };
    }

    // Classify single text
    if (operation === 'classify') {
      if (!text) {
        return { toolCallId: id, content: 'Error: text required for classification', isError: true };
      }

      // Get model
      let model: NaiveBayesModel | undefined;
      if (model_name) {
        model = modelCache.get(model_name);
        if (!model) {
          return { toolCallId: id, content: `Error: Model "${model_name}" not found. Train a model first.`, isError: true };
        }
      } else {
        // Use sentiment model as default
        if (!modelCache.has('sentiment')) {
          modelCache.set('sentiment', createPretrainedModel(SENTIMENT_DATA, 'sentiment'));
        }
        model = modelCache.get('sentiment')!;
      }

      const { prediction, probabilities, confidence } = predictNB(text, model);

      const result = {
        operation: 'classify',
        input: {
          text: text.slice(0, 200) + (text.length > 200 ? '...' : '')
        },
        output: {
          prediction,
          confidence: Math.round(confidence * 1000) / 1000,
          probabilities: Object.fromEntries(
            Array.from(probabilities.entries()).map(([k, v]) => [k, Math.round(v * 1000) / 1000])
          )
        },
        model: model_name || 'sentiment (default)'
      };

      return { toolCallId: id, content: JSON.stringify(result, null, 2) };
    }

    // Batch prediction
    if (operation === 'predict') {
      if (!texts || !Array.isArray(texts)) {
        return { toolCallId: id, content: 'Error: texts array required for predict', isError: true };
      }

      // Get model
      let model: NaiveBayesModel | undefined;
      if (model_name) {
        model = modelCache.get(model_name);
        if (!model) {
          return { toolCallId: id, content: `Error: Model "${model_name}" not found`, isError: true };
        }
      } else {
        if (!modelCache.has('sentiment')) {
          modelCache.set('sentiment', createPretrainedModel(SENTIMENT_DATA, 'sentiment'));
        }
        model = modelCache.get('sentiment')!;
      }

      const predictions = texts.map(t => {
        const { prediction, confidence } = predictNB(t, model!);
        return { text: t.slice(0, 50) + (t.length > 50 ? '...' : ''), prediction, confidence: Math.round(confidence * 1000) / 1000 };
      });

      const classCounts = new Map<string, number>();
      for (const p of predictions) {
        classCounts.set(p.prediction, (classCounts.get(p.prediction) || 0) + 1);
      }

      const result = {
        operation: 'predict',
        input: {
          textCount: texts.length
        },
        output: {
          predictions: predictions.slice(0, 20).concat(predictions.length > 20 ? [{ text: '...', prediction: '', confidence: 0 }] : []),
          summary: {
            classCounts: Object.fromEntries(classCounts),
            averageConfidence: Math.round(predictions.reduce((s, p) => s + p.confidence, 0) / predictions.length * 1000) / 1000
          }
        },
        model: model_name || 'sentiment (default)'
      };

      return { toolCallId: id, content: JSON.stringify(result, null, 2) };
    }

    // Evaluate classifier
    if (operation === 'evaluate') {
      if (!texts || !labels) {
        return { toolCallId: id, content: 'Error: texts and labels required for evaluation', isError: true };
      }

      // Get model
      let model: NaiveBayesModel | undefined;
      if (model_name) {
        model = modelCache.get(model_name);
        if (!model) {
          return { toolCallId: id, content: `Error: Model "${model_name}" not found`, isError: true };
        }
      } else {
        return { toolCallId: id, content: 'Error: model_name required for evaluation', isError: true };
      }

      const predictions = texts.map(t => predictNB(t, model!).prediction);
      const metrics = evaluateClassifier(predictions, labels, model.classes);

      const result = {
        operation: 'evaluate',
        input: {
          testSamples: texts.length,
          classes: model.classes
        },
        metrics: {
          accuracy: Math.round(metrics.accuracy * 1000) / 1000,
          perClass: model.classes.map(cls => ({
            class: cls,
            precision: Math.round((metrics.precision.get(cls) || 0) * 1000) / 1000,
            recall: Math.round((metrics.recall.get(cls) || 0) * 1000) / 1000,
            f1Score: Math.round((metrics.f1Score.get(cls) || 0) * 1000) / 1000
          })),
          confusionMatrix: Object.fromEntries(
            Array.from(metrics.confusionMatrix.entries()).map(([k, v]) => [
              k,
              Object.fromEntries(v)
            ])
          )
        },
        interpretation: {
          accuracy: metrics.accuracy > 0.9 ? 'Excellent' : metrics.accuracy > 0.8 ? 'Good' : metrics.accuracy > 0.7 ? 'Fair' : 'Poor',
          notes: [
            `Correctly classified ${Math.round(metrics.accuracy * texts.length)} of ${texts.length} samples`,
            'Precision: How many predicted positives are actually positive',
            'Recall: How many actual positives were predicted correctly'
          ]
        }
      };

      return { toolCallId: id, content: JSON.stringify(result, null, 2) };
    }

    return { toolCallId: id, content: `Error: Unknown operation '${operation}'`, isError: true };

  } catch (e) {
    const err = e instanceof Error ? e.message : 'Unknown error';
    return { toolCallId: id, content: `Error: ${err}`, isError: true };
  }
}

export function istextclassificationAvailable(): boolean {
  return true;
}
