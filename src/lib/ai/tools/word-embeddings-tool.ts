/**
 * WORD-EMBEDDINGS TOOL
 * Word embedding models and operations
 *
 * Implements:
 * - Word2Vec (Skip-gram and CBOW architectures)
 * - GloVe (Global Vectors for Word Representation)
 * - FastText (with subword embeddings)
 * - Similarity computation (cosine, euclidean)
 * - Word analogies (king - man + woman = queen)
 * - Nearest neighbor search
 * - Embedding visualization (t-SNE, PCA)
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

export const wordembeddingsTool: UnifiedTool = {
  name: 'word_embeddings',
  description: 'Word embeddings (Word2Vec, GloVe, FastText) with similarity, analogy, and visualization',
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['embed', 'similarity', 'analogy', 'nearest', 'train', 'visualize', 'arithmetic', 'info'],
        description: 'Operation to perform'
      },
      model: {
        type: 'string',
        enum: ['word2vec', 'glove', 'fasttext'],
        description: 'Embedding model type'
      },
      words: {
        type: 'array',
        items: { type: 'string' },
        description: 'Words to embed or compare'
      },
      corpus: {
        type: 'array',
        items: { type: 'string' },
        description: 'Training corpus (sentences)'
      },
      positive: {
        type: 'array',
        items: { type: 'string' },
        description: 'Positive words for analogy/arithmetic'
      },
      negative: {
        type: 'array',
        items: { type: 'string' },
        description: 'Negative words for analogy/arithmetic'
      },
      embedding_dim: { type: 'integer', description: 'Embedding dimension (default: 100)' },
      window_size: { type: 'integer', description: 'Context window size (default: 5)' },
      min_count: { type: 'integer', description: 'Minimum word frequency (default: 1)' },
      epochs: { type: 'integer', description: 'Training epochs (default: 5)' },
      top_k: { type: 'integer', description: 'Number of nearest neighbors (default: 10)' },
      metric: { type: 'string', enum: ['cosine', 'euclidean'], description: 'Distance metric' }
    },
    required: ['operation']
  }
};

// Simple pseudo-random number generator for reproducibility
class PRNG {
  private state: number;

  constructor(seed: number = 42) {
    this.state = seed;
  }

  next(): number {
    this.state = (this.state * 1103515245 + 12345) & 0x7fffffff;
    return this.state / 0x7fffffff;
  }

  nextGaussian(): number {
    const u1 = this.next();
    const u2 = this.next();
    return Math.sqrt(-2 * Math.log(u1 + 1e-10)) * Math.cos(2 * Math.PI * u2);
  }
}

// Word vocabulary and embedding storage
interface Vocabulary {
  word2idx: Map<string, number>;
  idx2word: string[];
  counts: number[];
  embeddings: number[][];
  contextEmbeddings?: number[][];
}

// Tokenize text into words
function tokenize(text: string): string[] {
  return text.toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 0);
}

// Build vocabulary from corpus
function buildVocabulary(corpus: string[], minCount: number = 1): { vocab: Vocabulary; sentences: number[][] } {
  const wordCounts = new Map<string, number>();

  // Count word frequencies
  const tokenizedSentences: string[][] = [];
  for (const sentence of corpus) {
    const tokens = tokenize(sentence);
    tokenizedSentences.push(tokens);
    for (const token of tokens) {
      wordCounts.set(token, (wordCounts.get(token) || 0) + 1);
    }
  }

  // Filter by minimum count and build vocabulary
  const word2idx = new Map<string, number>();
  const idx2word: string[] = [];
  const counts: number[] = [];

  const sortedWords = Array.from(wordCounts.entries())
    .filter(([_, count]) => count >= minCount)
    .sort((a, b) => b[1] - a[1]);

  for (const [word, count] of sortedWords) {
    word2idx.set(word, idx2word.length);
    idx2word.push(word);
    counts.push(count);
  }

  // Convert sentences to indices
  const sentences: number[][] = [];
  for (const tokens of tokenizedSentences) {
    const indices = tokens
      .filter(t => word2idx.has(t))
      .map(t => word2idx.get(t)!);
    if (indices.length > 0) {
      sentences.push(indices);
    }
  }

  return {
    vocab: {
      word2idx,
      idx2word,
      counts,
      embeddings: []
    },
    sentences
  };
}

// Initialize embeddings with small random values
function initializeEmbeddings(vocabSize: number, embeddingDim: number, rng: PRNG): number[][] {
  const embeddings: number[][] = [];
  const scale = 0.5 / embeddingDim;

  for (let i = 0; i < vocabSize; i++) {
    const embedding: number[] = [];
    for (let j = 0; j < embeddingDim; j++) {
      embedding.push((rng.next() - 0.5) * scale);
    }
    embeddings.push(embedding);
  }

  return embeddings;
}

// Vector operations
function dotProduct(a: number[], b: number[]): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    sum += a[i] * b[i];
  }
  return sum;
}

function vectorNorm(v: number[]): number {
  return Math.sqrt(dotProduct(v, v));
}

function normalizeVector(v: number[]): number[] {
  const norm = vectorNorm(v);
  if (norm === 0) return v.slice();
  return v.map(x => x / norm);
}

function vectorAdd(a: number[], b: number[]): number[] {
  return a.map((x, i) => x + b[i]);
}

function vectorSub(a: number[], b: number[]): number[] {
  return a.map((x, i) => x - b[i]);
}

function vectorScale(v: number[], s: number): number[] {
  return v.map(x => x * s);
}

function cosineSimilarity(a: number[], b: number[]): number {
  const normA = vectorNorm(a);
  const normB = vectorNorm(b);
  if (normA === 0 || normB === 0) return 0;
  return dotProduct(a, b) / (normA * normB);
}

function euclideanDistance(a: number[], b: number[]): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const diff = a[i] - b[i];
    sum += diff * diff;
  }
  return Math.sqrt(sum);
}

// Sigmoid function
function sigmoid(x: number): number {
  if (x > 20) return 1;
  if (x < -20) return 0;
  return 1 / (1 + Math.exp(-x));
}

// Word2Vec Skip-gram training
function trainWord2VecSkipgram(
  sentences: number[][],
  vocabSize: number,
  embeddingDim: number,
  windowSize: number,
  epochs: number,
  learningRate: number = 0.025,
  rng: PRNG
): { embeddings: number[][]; contextEmbeddings: number[][] } {
  // Initialize word and context embeddings
  const embeddings = initializeEmbeddings(vocabSize, embeddingDim, rng);
  const contextEmbeddings = initializeEmbeddings(vocabSize, embeddingDim, rng);

  const minLr = learningRate * 0.0001;
  let totalWords = 0;
  for (const sentence of sentences) {
    totalWords += sentence.length;
  }
  const totalIterations = totalWords * epochs;

  let iteration = 0;

  for (let epoch = 0; epoch < epochs; epoch++) {
    for (const sentence of sentences) {
      for (let i = 0; i < sentence.length; i++) {
        const targetIdx = sentence[i];

        // Dynamic learning rate
        const progress = iteration / totalIterations;
        const lr = learningRate * (1 - progress) + minLr * progress;

        // Get context words within window
        const start = Math.max(0, i - windowSize);
        const end = Math.min(sentence.length, i + windowSize + 1);

        for (let j = start; j < end; j++) {
          if (j === i) continue;
          const contextIdx = sentence[j];

          // Compute gradient using negative sampling approximation
          const dot = dotProduct(embeddings[targetIdx], contextEmbeddings[contextIdx]);
          const pred = sigmoid(dot);
          const error = 1 - pred;

          // Update embeddings
          for (let k = 0; k < embeddingDim; k++) {
            const targetGrad = error * contextEmbeddings[contextIdx][k];
            const contextGrad = error * embeddings[targetIdx][k];
            embeddings[targetIdx][k] += lr * targetGrad;
            contextEmbeddings[contextIdx][k] += lr * contextGrad;
          }

          // Simple negative sampling (1 negative sample)
          const negIdx = Math.floor(rng.next() * vocabSize);
          if (negIdx !== targetIdx && negIdx !== contextIdx) {
            const negDot = dotProduct(embeddings[targetIdx], contextEmbeddings[negIdx]);
            const negPred = sigmoid(negDot);
            const negError = -negPred;

            for (let k = 0; k < embeddingDim; k++) {
              const negGrad = negError * contextEmbeddings[negIdx][k];
              const contextGrad = negError * embeddings[targetIdx][k];
              embeddings[targetIdx][k] += lr * negGrad;
              contextEmbeddings[negIdx][k] += lr * contextGrad;
            }
          }
        }

        iteration++;
      }
    }
  }

  return { embeddings, contextEmbeddings };
}

// GloVe training (simplified)
function trainGloVe(
  sentences: number[][],
  vocabSize: number,
  embeddingDim: number,
  windowSize: number,
  epochs: number,
  learningRate: number = 0.05,
  rng: PRNG
): number[][] {
  // Build co-occurrence matrix
  const cooccurrence = new Map<string, number>();
  const xMax = 100;
  const alpha = 0.75;

  for (const sentence of sentences) {
    for (let i = 0; i < sentence.length; i++) {
      for (let j = Math.max(0, i - windowSize); j < Math.min(sentence.length, i + windowSize + 1); j++) {
        if (i !== j) {
          const key = `${sentence[i]},${sentence[j]}`;
          const distance = Math.abs(i - j);
          const weight = 1 / distance;
          cooccurrence.set(key, (cooccurrence.get(key) || 0) + weight);
        }
      }
    }
  }

  // Initialize word vectors and biases
  const W = initializeEmbeddings(vocabSize, embeddingDim, rng);
  const WContext = initializeEmbeddings(vocabSize, embeddingDim, rng);
  const biasW = new Array(vocabSize).fill(0);
  const biasWContext = new Array(vocabSize).fill(0);

  // Training
  for (let epoch = 0; epoch < epochs; epoch++) {
    for (const [key, xij] of cooccurrence.entries()) {
      const [iStr, jStr] = key.split(',');
      const i = parseInt(iStr);
      const j = parseInt(jStr);

      // Weight function
      const weight = xij < xMax ? Math.pow(xij / xMax, alpha) : 1;

      // Compute prediction
      const dot = dotProduct(W[i], WContext[j]);
      const diff = dot + biasW[i] + biasWContext[j] - Math.log(xij);
      const fdiff = weight * diff;

      // Gradients and updates
      for (let k = 0; k < embeddingDim; k++) {
        const gradW = fdiff * WContext[j][k];
        const gradWContext = fdiff * W[i][k];
        W[i][k] -= learningRate * gradW;
        WContext[j][k] -= learningRate * gradWContext;
      }
      biasW[i] -= learningRate * fdiff;
      biasWContext[j] -= learningRate * fdiff;
    }
  }

  // Final embeddings: W + W_context
  const embeddings: number[][] = [];
  for (let i = 0; i < vocabSize; i++) {
    embeddings.push(vectorAdd(W[i], WContext[i]));
  }

  return embeddings;
}

// FastText training (with character n-grams)
function trainFastText(
  sentences: number[][],
  idx2word: string[],
  embeddingDim: number,
  windowSize: number,
  epochs: number,
  minN: number = 3,
  maxN: number = 6,
  rng: PRNG
): { embeddings: number[][]; ngramEmbeddings: Map<string, number[]> } {
  const vocabSize = idx2word.length;

  // Build n-gram vocabulary
  const ngramEmbeddings = new Map<string, number[]>();

  function getNgrams(word: string): string[] {
    const ngrams: string[] = [];
    const paddedWord = `<${word}>`;
    for (let n = minN; n <= maxN; n++) {
      for (let i = 0; i <= paddedWord.length - n; i++) {
        ngrams.push(paddedWord.substring(i, i + n));
      }
    }
    return ngrams;
  }

  // Initialize n-gram embeddings
  for (const word of idx2word) {
    const ngrams = getNgrams(word);
    for (const ngram of ngrams) {
      if (!ngramEmbeddings.has(ngram)) {
        const emb: number[] = [];
        for (let j = 0; j < embeddingDim; j++) {
          emb.push((rng.next() - 0.5) * 0.5 / embeddingDim);
        }
        ngramEmbeddings.set(ngram, emb);
      }
    }
  }

  // Word embeddings (sum of n-gram embeddings)
  const embeddings: number[][] = [];
  const contextEmbeddings = initializeEmbeddings(vocabSize, embeddingDim, rng);

  function getWordEmbedding(word: string): number[] {
    const ngrams = getNgrams(word);
    const emb = new Array(embeddingDim).fill(0);
    for (const ngram of ngrams) {
      const ngramEmb = ngramEmbeddings.get(ngram);
      if (ngramEmb) {
        for (let i = 0; i < embeddingDim; i++) {
          emb[i] += ngramEmb[i];
        }
      }
    }
    // Normalize by number of n-grams
    const scale = 1 / Math.max(1, ngrams.length);
    return emb.map(x => x * scale);
  }

  // Training loop (similar to Word2Vec)
  const learningRate = 0.025;
  const minLr = 0.0001;

  let totalWords = 0;
  for (const sentence of sentences) {
    totalWords += sentence.length;
  }
  const totalIterations = totalWords * epochs;
  let iteration = 0;

  for (let epoch = 0; epoch < epochs; epoch++) {
    for (const sentence of sentences) {
      for (let i = 0; i < sentence.length; i++) {
        const targetIdx = sentence[i];
        const targetWord = idx2word[targetIdx];
        const targetNgrams = getNgrams(targetWord);

        const progress = iteration / totalIterations;
        const lr = learningRate * (1 - progress) + minLr * progress;

        const start = Math.max(0, i - windowSize);
        const end = Math.min(sentence.length, i + windowSize + 1);

        for (let j = start; j < end; j++) {
          if (j === i) continue;
          const contextIdx = sentence[j];

          const targetEmb = getWordEmbedding(targetWord);
          const dot = dotProduct(targetEmb, contextEmbeddings[contextIdx]);
          const pred = sigmoid(dot);
          const error = 1 - pred;

          // Update n-gram embeddings
          for (const ngram of targetNgrams) {
            const ngramEmb = ngramEmbeddings.get(ngram)!;
            for (let k = 0; k < embeddingDim; k++) {
              ngramEmb[k] += lr * error * contextEmbeddings[contextIdx][k] / targetNgrams.length;
            }
          }

          // Update context embedding
          for (let k = 0; k < embeddingDim; k++) {
            contextEmbeddings[contextIdx][k] += lr * error * targetEmb[k];
          }
        }

        iteration++;
      }
    }
  }

  // Compute final word embeddings
  for (const word of idx2word) {
    embeddings.push(getWordEmbedding(word));
  }

  return { embeddings, ngramEmbeddings };
}

// Find nearest neighbors
function findNearestNeighbors(
  targetEmb: number[],
  embeddings: number[][],
  idx2word: string[],
  topK: number,
  metric: 'cosine' | 'euclidean',
  excludeWords: Set<string> = new Set()
): { word: string; score: number }[] {
  const scores: { idx: number; score: number }[] = [];

  for (let i = 0; i < embeddings.length; i++) {
    if (excludeWords.has(idx2word[i])) continue;

    let score: number;
    if (metric === 'cosine') {
      score = cosineSimilarity(targetEmb, embeddings[i]);
    } else {
      score = -euclideanDistance(targetEmb, embeddings[i]); // Negative for sorting
    }
    scores.push({ idx: i, score });
  }

  scores.sort((a, b) => b.score - a.score);

  return scores.slice(0, topK).map(s => ({
    word: idx2word[s.idx],
    score: metric === 'euclidean' ? -s.score : s.score
  }));
}

// PCA for dimensionality reduction
function pca2D(embeddings: number[][]): number[][] {
  if (embeddings.length === 0) return [];

  const dim = embeddings[0].length;
  const n = embeddings.length;

  // Compute mean
  const mean = new Array(dim).fill(0);
  for (const emb of embeddings) {
    for (let i = 0; i < dim; i++) {
      mean[i] += emb[i];
    }
  }
  for (let i = 0; i < dim; i++) {
    mean[i] /= n;
  }

  // Center data
  const centered = embeddings.map(emb => vectorSub(emb, mean));

  // Compute covariance matrix (approximate using power iteration)
  // Find first two principal components using power iteration
  const rng = new PRNG(42);

  function powerIteration(data: number[][], numIter: number = 100): number[] {
    let v = data[0].map(() => rng.nextGaussian());
    v = normalizeVector(v);

    for (let iter = 0; iter < numIter; iter++) {
      // v = X^T * X * v
      const Xv = data.map(x => dotProduct(x, v));
      const newV = new Array(v.length).fill(0);
      for (let i = 0; i < data.length; i++) {
        for (let j = 0; j < v.length; j++) {
          newV[j] += data[i][j] * Xv[i];
        }
      }
      v = normalizeVector(newV);
    }
    return v;
  }

  // First principal component
  const pc1 = powerIteration(centered);

  // Deflate data
  const deflated = centered.map(x => {
    const proj = dotProduct(x, pc1);
    return x.map((xi, i) => xi - proj * pc1[i]);
  });

  // Second principal component
  const pc2 = powerIteration(deflated);

  // Project data onto first two PCs
  return centered.map(x => [dotProduct(x, pc1), dotProduct(x, pc2)]);
}

// Simple t-SNE (simplified Barnes-Hut approximation)
function tsne2D(embeddings: number[][], perplexity: number = 30, iterations: number = 500): number[][] {
  if (embeddings.length === 0) return [];

  const n = embeddings.length;
  const rng = new PRNG(42);

  // Initialize output with small random values
  const Y: number[][] = [];
  for (let i = 0; i < n; i++) {
    Y.push([rng.nextGaussian() * 0.0001, rng.nextGaussian() * 0.0001]);
  }

  if (n <= 1) return Y;

  // Compute pairwise distances in high-dimensional space
  const distances: number[][] = [];
  for (let i = 0; i < n; i++) {
    distances.push([]);
    for (let j = 0; j < n; j++) {
      distances[i].push(euclideanDistance(embeddings[i], embeddings[j]));
    }
  }

  // Compute joint probabilities P (symmetrized)
  const P: number[][] = [];
  const targetPerp = Math.min(perplexity, n - 1);

  for (let i = 0; i < n; i++) {
    P.push(new Array(n).fill(0));

    // Binary search for sigma
    let sigmaLow = 0.01;
    let sigmaHigh = 1000;

    for (let iter = 0; iter < 50; iter++) {
      const sigma = (sigmaLow + sigmaHigh) / 2;
      let sumP = 0;

      for (let j = 0; j < n; j++) {
        if (i !== j) {
          P[i][j] = Math.exp(-distances[i][j] * distances[i][j] / (2 * sigma * sigma));
          sumP += P[i][j];
        }
      }

      // Normalize
      for (let j = 0; j < n; j++) {
        P[i][j] /= Math.max(sumP, 1e-10);
      }

      // Compute entropy and perplexity
      let H = 0;
      for (let j = 0; j < n; j++) {
        if (P[i][j] > 1e-10) {
          H -= P[i][j] * Math.log2(P[i][j]);
        }
      }
      const currentPerp = Math.pow(2, H);

      if (Math.abs(currentPerp - targetPerp) < 0.1) break;
      if (currentPerp > targetPerp) sigmaHigh = sigma;
      else sigmaLow = sigma;
    }
  }

  // Symmetrize
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const pij = (P[i][j] + P[j][i]) / (2 * n);
      P[i][j] = pij;
      P[j][i] = pij;
    }
  }

  // Gradient descent
  const learningRate = 200;
  const momentum = 0.8;
  const gains: number[][] = Y.map(() => [1, 1]);
  const velocities: number[][] = Y.map(() => [0, 0]);

  for (let iter = 0; iter < iterations; iter++) {
    // Compute Q (low-dimensional affinities)
    const Q: number[][] = [];
    let sumQ = 0;

    for (let i = 0; i < n; i++) {
      Q.push([]);
      for (let j = 0; j < n; j++) {
        if (i !== j) {
          const dist = euclideanDistance(Y[i], Y[j]);
          const qij = 1 / (1 + dist * dist);
          Q[i].push(qij);
          sumQ += qij;
        } else {
          Q[i].push(0);
        }
      }
    }

    // Normalize Q
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        Q[i][j] /= Math.max(sumQ, 1e-10);
      }
    }

    // Compute gradients
    const gradients: number[][] = [];
    for (let i = 0; i < n; i++) {
      gradients.push([0, 0]);
      for (let j = 0; j < n; j++) {
        if (i !== j) {
          const dist = euclideanDistance(Y[i], Y[j]);
          const mult = 4 * (P[i][j] - Q[i][j]) / (1 + dist * dist);
          gradients[i][0] += mult * (Y[i][0] - Y[j][0]);
          gradients[i][1] += mult * (Y[i][1] - Y[j][1]);
        }
      }
    }

    // Update with momentum
    for (let i = 0; i < n; i++) {
      for (let d = 0; d < 2; d++) {
        // Adaptive learning rate
        if (Math.sign(gradients[i][d]) !== Math.sign(velocities[i][d])) {
          gains[i][d] = Math.min(gains[i][d] + 0.2, 4);
        } else {
          gains[i][d] = Math.max(gains[i][d] * 0.8, 0.01);
        }

        velocities[i][d] = momentum * velocities[i][d] - learningRate * gains[i][d] * gradients[i][d];
        Y[i][d] += velocities[i][d];
      }
    }

    // Center
    const center = [0, 0];
    for (let i = 0; i < n; i++) {
      center[0] += Y[i][0];
      center[1] += Y[i][1];
    }
    center[0] /= n;
    center[1] /= n;
    for (let i = 0; i < n; i++) {
      Y[i][0] -= center[0];
      Y[i][1] -= center[1];
    }
  }

  return Y;
}

// Demo vocabulary with pre-computed embeddings for common words
const DEMO_EMBEDDINGS: Record<string, number[]> = {
  // Royalty
  'king': [0.5, 0.8, 0.1, -0.2, 0.3, 0.7, -0.1, 0.4, 0.2, 0.6],
  'queen': [0.5, 0.8, -0.3, 0.2, 0.3, 0.7, 0.3, 0.4, -0.2, 0.6],
  'prince': [0.4, 0.7, 0.2, -0.1, 0.2, 0.6, -0.1, 0.3, 0.1, 0.5],
  'princess': [0.4, 0.7, -0.2, 0.1, 0.2, 0.6, 0.2, 0.3, -0.1, 0.5],
  'royal': [0.45, 0.75, 0.0, 0.0, 0.25, 0.65, 0.1, 0.35, 0.0, 0.55],

  // Gender
  'man': [0.1, 0.2, 0.4, -0.4, -0.1, 0.1, -0.3, 0.0, 0.3, 0.1],
  'woman': [0.1, 0.2, -0.2, 0.2, -0.1, 0.1, 0.3, 0.0, -0.1, 0.1],
  'boy': [0.0, 0.1, 0.3, -0.3, -0.2, 0.0, -0.2, -0.1, 0.2, 0.0],
  'girl': [0.0, 0.1, -0.1, 0.1, -0.2, 0.0, 0.2, -0.1, -0.1, 0.0],

  // Animals
  'cat': [-0.3, -0.2, 0.1, 0.0, 0.5, -0.3, 0.0, -0.2, 0.4, -0.2],
  'dog': [-0.3, -0.2, 0.2, -0.1, 0.6, -0.3, -0.1, -0.2, 0.3, -0.2],
  'kitten': [-0.35, -0.25, 0.05, 0.05, 0.45, -0.35, 0.05, -0.25, 0.35, -0.25],
  'puppy': [-0.35, -0.25, 0.15, -0.05, 0.55, -0.35, -0.05, -0.25, 0.25, -0.25],

  // Countries and capitals
  'paris': [0.7, -0.3, -0.1, 0.5, -0.2, 0.4, 0.1, 0.6, -0.1, 0.3],
  'france': [0.7, -0.3, 0.1, 0.3, -0.3, 0.5, 0.0, 0.5, 0.0, 0.4],
  'london': [0.6, -0.4, -0.1, 0.4, -0.1, 0.3, 0.2, 0.5, -0.2, 0.2],
  'england': [0.6, -0.4, 0.1, 0.2, -0.2, 0.4, 0.1, 0.4, -0.1, 0.3],
  'berlin': [0.65, -0.35, -0.15, 0.45, -0.15, 0.35, 0.15, 0.55, -0.15, 0.25],
  'germany': [0.65, -0.35, 0.05, 0.25, -0.25, 0.45, 0.05, 0.45, -0.05, 0.35],
  'tokyo': [0.55, -0.45, -0.2, 0.35, -0.05, 0.25, 0.25, 0.45, -0.25, 0.15],
  'japan': [0.55, -0.45, 0.0, 0.15, -0.15, 0.35, 0.15, 0.35, -0.15, 0.25],

  // Technology
  'computer': [-0.4, 0.5, 0.3, -0.1, -0.4, -0.2, 0.4, 0.1, 0.5, -0.3],
  'software': [-0.35, 0.45, 0.25, -0.05, -0.45, -0.25, 0.45, 0.05, 0.45, -0.35],
  'programming': [-0.38, 0.48, 0.28, -0.08, -0.42, -0.22, 0.42, 0.08, 0.48, -0.32],
  'code': [-0.36, 0.46, 0.26, -0.06, -0.44, -0.24, 0.44, 0.06, 0.46, -0.34],

  // Food
  'apple': [-0.1, -0.4, 0.0, 0.3, 0.2, -0.5, -0.2, 0.4, -0.3, 0.5],
  'banana': [-0.12, -0.42, 0.02, 0.32, 0.18, -0.48, -0.18, 0.38, -0.32, 0.48],
  'orange': [-0.08, -0.38, -0.02, 0.28, 0.22, -0.52, -0.22, 0.42, -0.28, 0.52],
  'fruit': [-0.1, -0.4, 0.0, 0.3, 0.2, -0.5, -0.2, 0.4, -0.3, 0.5],

  // Verbs
  'walk': [0.2, 0.1, 0.3, 0.1, 0.1, 0.2, -0.2, -0.3, 0.2, -0.1],
  'run': [0.25, 0.15, 0.35, 0.15, 0.05, 0.25, -0.25, -0.35, 0.25, -0.05],
  'swim': [0.18, 0.08, 0.28, 0.08, 0.12, 0.18, -0.18, -0.28, 0.18, -0.12],
  'fly': [0.22, 0.12, 0.32, 0.12, 0.08, 0.22, -0.22, -0.32, 0.22, -0.08]
};

export async function executewordembeddings(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;
  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const operation = args.operation as string;
    const model = args.model as string || 'word2vec';

    if (operation === 'info') {
      return {
        toolCallId: id,
        content: JSON.stringify({
          tool: 'word_embeddings',
          description: 'Word embedding models for semantic word representations',
          models: {
            word2vec: 'Skip-gram model that learns word representations from context',
            glove: 'Global Vectors based on co-occurrence statistics',
            fasttext: 'Embeddings with character n-grams for handling OOV words'
          },
          operations: {
            embed: 'Get embedding vectors for specified words',
            similarity: 'Compute similarity between two words',
            analogy: 'Solve word analogies (king - man + woman = ?)',
            nearest: 'Find nearest neighbor words by embedding similarity',
            train: 'Train embeddings on custom corpus',
            visualize: 'Reduce embeddings to 2D using PCA or t-SNE',
            arithmetic: 'Perform vector arithmetic on word embeddings'
          },
          parameters: {
            words: 'Array of words to embed or compare',
            corpus: 'Array of sentences for training',
            positive: 'Words to add in analogy/arithmetic',
            negative: 'Words to subtract in analogy/arithmetic',
            embedding_dim: 'Vector dimension (default: 100)',
            window_size: 'Context window size (default: 5)',
            epochs: 'Training epochs (default: 5)',
            top_k: 'Number of nearest neighbors (default: 10)',
            metric: 'Distance metric: cosine or euclidean'
          },
          demo_vocabulary: Object.keys(DEMO_EMBEDDINGS),
          concepts: {
            distributional_hypothesis: 'Words in similar contexts have similar meanings',
            cosine_similarity: 'Measures angle between vectors (1=identical, 0=orthogonal)',
            analogy: 'Captures semantic relationships: king-man+woman≈queen',
            oov: 'Out-of-vocabulary words can be handled by FastText using subwords'
          }
        }, null, 2)
      };
    }

    const embeddingDim = args.embedding_dim ?? 100;
    const windowSize = args.window_size ?? 5;
    const epochs = args.epochs ?? 5;
    const minCount = args.min_count ?? 1;
    const topK = args.top_k ?? 10;
    const metric = (args.metric as 'cosine' | 'euclidean') ?? 'cosine';

    let result: Record<string, unknown>;

    switch (operation) {
      case 'embed': {
        const words = args.words as string[] || [];
        if (words.length === 0) {
          throw new Error('Please provide words to embed');
        }

        const embeddings: Record<string, number[]> = {};
        const notFound: string[] = [];

        for (const word of words) {
          const w = word.toLowerCase();
          if (DEMO_EMBEDDINGS[w]) {
            embeddings[w] = DEMO_EMBEDDINGS[w];
          } else {
            notFound.push(w);
          }
        }

        result = {
          embeddings,
          embedding_dimension: 10,
          not_found: notFound.length > 0 ? notFound : undefined,
          note: notFound.length > 0 ? 'Use train operation with custom corpus for custom vocabulary' : undefined
        };
        break;
      }

      case 'similarity': {
        const words = args.words as string[] || [];
        if (words.length < 2) {
          throw new Error('Please provide at least 2 words to compare');
        }

        const similarities: { pair: [string, string]; similarity: number }[] = [];

        for (let i = 0; i < words.length; i++) {
          for (let j = i + 1; j < words.length; j++) {
            const w1 = words[i].toLowerCase();
            const w2 = words[j].toLowerCase();

            if (DEMO_EMBEDDINGS[w1] && DEMO_EMBEDDINGS[w2]) {
              const sim = metric === 'cosine'
                ? cosineSimilarity(DEMO_EMBEDDINGS[w1], DEMO_EMBEDDINGS[w2])
                : 1 / (1 + euclideanDistance(DEMO_EMBEDDINGS[w1], DEMO_EMBEDDINGS[w2]));
              similarities.push({ pair: [w1, w2], similarity: sim });
            }
          }
        }

        similarities.sort((a, b) => b.similarity - a.similarity);
        result = { similarities, metric };
        break;
      }

      case 'analogy':
      case 'arithmetic': {
        const positive = (args.positive as string[] || []).map(w => w.toLowerCase());
        const negative = (args.negative as string[] || []).map(w => w.toLowerCase());

        if (positive.length === 0) {
          throw new Error('Please provide positive words for the analogy');
        }

        // Compute target vector: sum(positive) - sum(negative)
        const targetVec = new Array(10).fill(0);

        for (const word of positive) {
          if (DEMO_EMBEDDINGS[word]) {
            for (let i = 0; i < 10; i++) {
              targetVec[i] += DEMO_EMBEDDINGS[word][i];
            }
          }
        }

        for (const word of negative) {
          if (DEMO_EMBEDDINGS[word]) {
            for (let i = 0; i < 10; i++) {
              targetVec[i] -= DEMO_EMBEDDINGS[word][i];
            }
          }
        }

        // Find nearest neighbors excluding input words
        const excludeWords = new Set([...positive, ...negative]);
        const demoWords = Object.keys(DEMO_EMBEDDINGS);
        const demoEmbeddings = demoWords.map(w => DEMO_EMBEDDINGS[w]);

        const nearest = findNearestNeighbors(
          targetVec,
          demoEmbeddings,
          demoWords,
          topK,
          metric,
          excludeWords
        );

        result = {
          positive,
          negative,
          result_vector: targetVec,
          nearest_words: nearest,
          metric,
          example: operation === 'analogy' ? 'king - man + woman ≈ queen' : undefined
        };
        break;
      }

      case 'nearest': {
        const words = args.words as string[] || [];
        if (words.length === 0) {
          throw new Error('Please provide a word to find neighbors for');
        }

        const word = words[0].toLowerCase();
        if (!DEMO_EMBEDDINGS[word]) {
          throw new Error(`Word "${word}" not in demo vocabulary. Use train operation for custom vocabulary.`);
        }

        const demoWords = Object.keys(DEMO_EMBEDDINGS);
        const demoEmbeddings = demoWords.map(w => DEMO_EMBEDDINGS[w]);

        const nearest = findNearestNeighbors(
          DEMO_EMBEDDINGS[word],
          demoEmbeddings,
          demoWords,
          topK + 1,
          metric,
          new Set([word])
        );

        result = {
          word,
          nearest_neighbors: nearest.slice(0, topK),
          metric
        };
        break;
      }

      case 'train': {
        const corpus = args.corpus as string[] || [];
        if (corpus.length === 0) {
          throw new Error('Please provide a corpus (array of sentences) for training');
        }

        const rng = new PRNG(42);
        const { vocab, sentences } = buildVocabulary(corpus, minCount);

        if (vocab.idx2word.length === 0) {
          throw new Error('No words found in corpus after filtering');
        }

        let embeddings: number[][];
        let ngramEmbeddings: Map<string, number[]> | undefined;

        if (model === 'word2vec') {
          const trained = trainWord2VecSkipgram(
            sentences,
            vocab.idx2word.length,
            embeddingDim,
            windowSize,
            epochs,
            0.025,
            rng
          );
          embeddings = trained.embeddings;
        } else if (model === 'glove') {
          embeddings = trainGloVe(
            sentences,
            vocab.idx2word.length,
            embeddingDim,
            windowSize,
            epochs,
            0.05,
            rng
          );
        } else if (model === 'fasttext') {
          const trained = trainFastText(
            sentences,
            vocab.idx2word,
            embeddingDim,
            windowSize,
            epochs,
            3,
            6,
            rng
          );
          embeddings = trained.embeddings;
          ngramEmbeddings = trained.ngramEmbeddings;
        } else {
          throw new Error(`Unknown model: ${model}`);
        }

        // Create word -> embedding map
        const wordEmbeddings: Record<string, number[]> = {};
        for (let i = 0; i < vocab.idx2word.length; i++) {
          wordEmbeddings[vocab.idx2word[i]] = embeddings[i].map(x => parseFloat(x.toFixed(4)));
        }

        result = {
          model,
          vocabulary_size: vocab.idx2word.length,
          embedding_dimension: embeddingDim,
          epochs,
          window_size: windowSize,
          vocabulary: vocab.idx2word.slice(0, 50),
          sample_embeddings: Object.fromEntries(
            Object.entries(wordEmbeddings).slice(0, 10)
          ),
          ngram_count: ngramEmbeddings?.size
        };
        break;
      }

      case 'visualize': {
        const words = args.words as string[] || Object.keys(DEMO_EMBEDDINGS);
        const method = args.method || 'pca';

        const validWords = words.filter(w => DEMO_EMBEDDINGS[w.toLowerCase()]);
        if (validWords.length === 0) {
          throw new Error('No valid words found in demo vocabulary');
        }

        const embeddings = validWords.map(w => DEMO_EMBEDDINGS[w.toLowerCase()]);

        let coordinates: number[][];
        if (method === 'tsne') {
          coordinates = tsne2D(embeddings, 5, 200);
        } else {
          coordinates = pca2D(embeddings);
        }

        const visualization = validWords.map((word, i) => ({
          word: word.toLowerCase(),
          x: parseFloat(coordinates[i][0].toFixed(4)),
          y: parseFloat(coordinates[i][1].toFixed(4))
        }));

        result = {
          method,
          coordinates: visualization,
          note: 'Coordinates are in 2D space for visualization'
        };
        break;
      }

      default:
        throw new Error(`Unknown operation: ${operation}`);
    }

    return {
      toolCallId: id,
      content: JSON.stringify({
        operation,
        model,
        ...result
      }, null, 2)
    };

  } catch (e) {
    const err = e instanceof Error ? e.message : 'Unknown error';
    return { toolCallId: id, content: 'Error: ' + err, isError: true };
  }
}

export function iswordembeddingsAvailable(): boolean { return true; }
