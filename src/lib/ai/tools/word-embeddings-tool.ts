/**
 * WORD-EMBEDDINGS TOOL
 * Word vector operations and embedding algorithms
 * Implements Word2Vec-style operations and semantic similarity
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

export const wordembeddingsTool: UnifiedTool = {
  name: 'word_embeddings',
  description: 'Word embeddings (Word2Vec, GloVe, FastText)',
  parameters: {
    type: 'object',
    properties: {
      operation: { type: 'string', enum: ['embed', 'similarity', 'analogy', 'nearest', 'cluster', 'info'], description: 'Operation' },
      words: { type: 'array', items: { type: 'string' }, description: 'Words to process' },
      word1: { type: 'string', description: 'First word for similarity' },
      word2: { type: 'string', description: 'Second word for similarity' },
      positive: { type: 'array', items: { type: 'string' }, description: 'Positive words for analogy' },
      negative: { type: 'array', items: { type: 'string' }, description: 'Negative words for analogy' },
      model: { type: 'string', enum: ['word2vec', 'glove', 'fasttext'], description: 'Embedding model' },
      dimension: { type: 'number', description: 'Embedding dimension' },
      top_n: { type: 'number', description: 'Number of results to return' }
    },
    required: ['operation']
  }
};

// Simple pre-computed embeddings for demonstration
// In production, these would be loaded from trained models
const DEMO_EMBEDDINGS: { [word: string]: number[] } = {
  // Royalty
  'king': [0.8, 0.3, -0.2, 0.5, 0.1, -0.4, 0.6, 0.2],
  'queen': [0.7, 0.4, 0.6, 0.5, 0.1, -0.3, 0.5, 0.3],
  'prince': [0.6, 0.2, -0.1, 0.4, 0.2, -0.3, 0.5, 0.1],
  'princess': [0.5, 0.3, 0.5, 0.4, 0.2, -0.2, 0.4, 0.2],
  'man': [0.5, 0.1, -0.4, 0.3, 0.0, -0.2, 0.2, 0.1],
  'woman': [0.4, 0.2, 0.4, 0.3, 0.0, -0.1, 0.1, 0.2],
  'boy': [0.4, 0.0, -0.3, 0.2, 0.3, -0.1, 0.1, 0.0],
  'girl': [0.3, 0.1, 0.3, 0.2, 0.3, 0.0, 0.0, 0.1],

  // Geography
  'paris': [0.1, 0.8, 0.2, -0.3, 0.5, 0.4, -0.2, 0.6],
  'france': [0.2, 0.7, 0.1, -0.2, 0.4, 0.5, -0.1, 0.5],
  'london': [0.1, 0.7, 0.3, -0.2, 0.4, 0.3, -0.2, 0.5],
  'england': [0.2, 0.6, 0.2, -0.1, 0.3, 0.4, -0.1, 0.4],
  'berlin': [0.1, 0.6, 0.2, -0.3, 0.5, 0.3, -0.3, 0.5],
  'germany': [0.2, 0.5, 0.1, -0.2, 0.4, 0.4, -0.2, 0.4],
  'tokyo': [0.0, 0.7, 0.4, -0.4, 0.6, 0.2, -0.3, 0.6],
  'japan': [0.1, 0.6, 0.3, -0.3, 0.5, 0.3, -0.2, 0.5],

  // Animals
  'dog': [-0.2, -0.3, -0.1, 0.6, 0.4, 0.5, 0.3, -0.2],
  'cat': [-0.3, -0.2, 0.1, 0.5, 0.3, 0.4, 0.2, -0.1],
  'puppy': [-0.1, -0.2, -0.2, 0.5, 0.5, 0.4, 0.2, -0.2],
  'kitten': [-0.2, -0.1, 0.0, 0.4, 0.4, 0.3, 0.1, -0.1],
  'wolf': [-0.3, -0.4, -0.2, 0.7, 0.2, 0.6, 0.4, -0.3],
  'lion': [-0.4, -0.3, -0.1, 0.8, 0.1, 0.7, 0.5, -0.2],

  // Technology
  'computer': [0.1, 0.0, -0.2, -0.4, 0.7, 0.1, 0.8, 0.5],
  'software': [0.2, 0.1, -0.1, -0.5, 0.6, 0.0, 0.7, 0.6],
  'programming': [0.3, 0.0, -0.2, -0.4, 0.7, 0.1, 0.6, 0.7],
  'algorithm': [0.2, 0.1, -0.1, -0.3, 0.8, 0.2, 0.5, 0.6],
  'data': [0.1, 0.2, 0.0, -0.3, 0.6, 0.2, 0.6, 0.5],

  // Food
  'apple': [-0.1, 0.2, 0.3, 0.2, -0.3, 0.6, -0.2, -0.4],
  'banana': [-0.2, 0.1, 0.4, 0.1, -0.4, 0.5, -0.3, -0.3],
  'orange': [-0.1, 0.2, 0.3, 0.2, -0.3, 0.5, -0.2, -0.4],
  'food': [0.0, 0.1, 0.2, 0.1, -0.2, 0.7, -0.1, -0.3],

  // Actions
  'run': [0.3, -0.2, -0.3, 0.2, -0.1, 0.3, 0.1, -0.5],
  'walk': [0.2, -0.1, -0.2, 0.1, -0.2, 0.2, 0.0, -0.4],
  'swim': [0.2, -0.3, -0.1, 0.3, -0.1, 0.4, 0.1, -0.5],
  'fly': [0.3, -0.2, -0.2, 0.4, 0.0, 0.3, 0.2, -0.4],

  // Emotions
  'happy': [0.4, 0.3, 0.5, 0.1, -0.4, 0.2, -0.3, 0.3],
  'sad': [-0.3, -0.2, 0.4, 0.0, -0.3, 0.1, -0.4, 0.2],
  'angry': [-0.2, -0.3, 0.2, 0.2, -0.2, 0.3, -0.2, 0.1],
  'love': [0.5, 0.4, 0.6, 0.1, -0.3, 0.3, -0.2, 0.4]
};

// Vocabulary list
const VOCABULARY = Object.keys(DEMO_EMBEDDINGS);

// Vector operations
function dotProduct(a: number[], b: number[]): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    sum += a[i] * b[i];
  }
  return sum;
}

function magnitude(v: number[]): number {
  return Math.sqrt(dotProduct(v, v));
}

function normalize(v: number[]): number[] {
  const mag = magnitude(v);
  if (mag === 0) return v;
  return v.map(x => x / mag);
}

function cosineSimilarity(a: number[], b: number[]): number {
  const magA = magnitude(a);
  const magB = magnitude(b);
  if (magA === 0 || magB === 0) return 0;
  return dotProduct(a, b) / (magA * magB);
}

function euclideanDistance(a: number[], b: number[]): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const diff = a[i] - b[i];
    sum += diff * diff;
  }
  return Math.sqrt(sum);
}

function vectorAdd(a: number[], b: number[]): number[] {
  return a.map((x, i) => x + b[i]);
}

function vectorSubtract(a: number[], b: number[]): number[] {
  return a.map((x, i) => x - b[i]);
}

function vectorScale(v: number[], s: number): number[] {
  return v.map(x => x * s);
}

// Get embedding for a word (with fallback for unknown words)
function getEmbedding(word: string): number[] | null {
  const lower = word.toLowerCase();
  return DEMO_EMBEDDINGS[lower] || null;
}

// Generate random embedding for OOV words (simulates subword handling)
function generateOOVEmbedding(word: string, dimension: number = 8): number[] {
  // Simple hash-based pseudo-random embedding
  let hash = 0;
  for (let i = 0; i < word.length; i++) {
    hash = ((hash << 5) - hash) + word.charCodeAt(i);
    hash = hash & hash;
  }

  const embedding: number[] = [];
  for (let i = 0; i < dimension; i++) {
    // Use hash to seed pseudo-random values
    const seed = (hash * (i + 1)) & 0x7FFFFFFF;
    embedding.push((seed % 1000) / 500 - 1);  // Range [-1, 1]
  }

  return normalize(embedding);
}

// Find nearest neighbors
function findNearest(targetVector: number[], topN: number = 10, exclude: Set<string> = new Set()): { word: string; similarity: number }[] {
  const similarities: { word: string; similarity: number }[] = [];

  for (const word of VOCABULARY) {
    if (exclude.has(word)) continue;
    const embedding = DEMO_EMBEDDINGS[word];
    const sim = cosineSimilarity(targetVector, embedding);
    similarities.push({ word, similarity: sim });
  }

  return similarities
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, topN);
}

// Word analogy: king - man + woman = ?
function solveAnalogy(positive: string[], negative: string[], topN: number = 5): { word: string; similarity: number }[] {
  // Build target vector: sum of positive - sum of negative
  let targetVector = Array(8).fill(0);

  const usedWords = new Set<string>();

  for (const word of positive) {
    const embedding = getEmbedding(word);
    if (embedding) {
      targetVector = vectorAdd(targetVector, embedding);
      usedWords.add(word.toLowerCase());
    }
  }

  for (const word of negative) {
    const embedding = getEmbedding(word);
    if (embedding) {
      targetVector = vectorSubtract(targetVector, embedding);
      usedWords.add(word.toLowerCase());
    }
  }

  return findNearest(targetVector, topN, usedWords);
}

// Simple K-means clustering
function clusterWords(words: string[], k: number = 3): { clusters: { centroid: number; words: string[] }[]; iterations: number } {
  // Get embeddings
  const embeddings: { word: string; vector: number[] }[] = [];
  for (const word of words) {
    const emb = getEmbedding(word) || generateOOVEmbedding(word);
    embeddings.push({ word, vector: emb });
  }

  if (embeddings.length < k) k = embeddings.length;

  // Initialize centroids randomly
  const centroids: number[][] = [];
  const usedIndices = new Set<number>();
  while (centroids.length < k) {
    const idx = Math.floor(Math.random() * embeddings.length);
    if (!usedIndices.has(idx)) {
      usedIndices.add(idx);
      centroids.push([...embeddings[idx].vector]);
    }
  }

  // K-means iterations
  let assignments: number[] = Array(embeddings.length).fill(0);
  let iterations = 0;
  const maxIterations = 100;

  while (iterations < maxIterations) {
    // Assign to nearest centroid
    const newAssignments: number[] = [];
    for (const emb of embeddings) {
      let bestCluster = 0;
      let bestDist = Infinity;
      for (let c = 0; c < k; c++) {
        const dist = euclideanDistance(emb.vector, centroids[c]);
        if (dist < bestDist) {
          bestDist = dist;
          bestCluster = c;
        }
      }
      newAssignments.push(bestCluster);
    }

    // Check convergence
    if (JSON.stringify(assignments) === JSON.stringify(newAssignments)) {
      break;
    }
    assignments = newAssignments;

    // Update centroids
    for (let c = 0; c < k; c++) {
      const clusterVectors = embeddings.filter((_, i) => assignments[i] === c).map(e => e.vector);
      if (clusterVectors.length > 0) {
        centroids[c] = clusterVectors[0].map((_, dim) =>
          clusterVectors.reduce((sum, v) => sum + v[dim], 0) / clusterVectors.length
        );
      }
    }

    iterations++;
  }

  // Build result
  const clusters: { centroid: number; words: string[] }[] = [];
  for (let c = 0; c < k; c++) {
    const clusterWords = embeddings.filter((_, i) => assignments[i] === c).map(e => e.word);
    clusters.push({ centroid: c, words: clusterWords });
  }

  return { clusters, iterations };
}

export async function executewordembeddings(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;
  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const operation = args.operation || 'info';

    if (operation === 'info') {
      const info = {
        tool: 'word-embeddings',
        description: 'Dense vector representations capturing semantic meaning',

        models: {
          word2vec: {
            paper: 'Mikolov et al., 2013',
            architecture: ['CBOW', 'Skip-gram'],
            description: 'Predicts word from context (CBOW) or context from word (Skip-gram)',
            training: 'Negative sampling or hierarchical softmax'
          },
          glove: {
            paper: 'Pennington et al., 2014',
            description: 'Global Vectors - learns from word co-occurrence matrix',
            advantage: 'Captures global corpus statistics'
          },
          fasttext: {
            paper: 'Bojanowski et al., 2017',
            description: 'Extends Word2Vec with subword (character n-gram) information',
            advantage: 'Handles OOV words via subword composition'
          }
        },

        properties: {
          dimensionality: 'Typically 50-300 dimensions',
          semanticRelations: 'Similar words have similar vectors',
          linearRelationships: 'king - man + woman ≈ queen',
          clustering: 'Related words form clusters in vector space'
        },

        operations: {
          embed: 'Get embedding vector for words',
          similarity: 'Compute cosine similarity between words',
          analogy: 'Solve word analogies (a:b :: c:?)',
          nearest: 'Find nearest neighbors in embedding space',
          cluster: 'Cluster words using K-means'
        },

        metrics: {
          cosineSimilarity: 'sim(a,b) = (a·b)/(||a||×||b||)',
          euclideanDistance: 'd(a,b) = √(Σ(aᵢ-bᵢ)²)'
        },

        demoVocabulary: VOCABULARY.slice(0, 20),
        totalVocabulary: VOCABULARY.length
      };

      return { toolCallId: id, content: JSON.stringify(info, null, 2) };
    }

    const model = args.model || 'word2vec';
    const dimension = args.dimension || 8;

    if (operation === 'embed') {
      const words = args.words || ['king', 'queen', 'man', 'woman'];

      const embeddings = words.map((word: string) => {
        const emb = getEmbedding(word);
        const isOOV = !emb;
        const vector = emb || generateOOVEmbedding(word, dimension);

        return {
          word,
          vector: vector.map(v => Number(v.toFixed(4))),
          magnitude: Number(magnitude(vector).toFixed(4)),
          isOOV,
          note: isOOV ? 'Out-of-vocabulary - generated from subwords' : undefined
        };
      });

      const output = {
        operation: 'embed',
        model,
        dimension,

        embeddings,

        visualization: {
          note: 'First 2 dimensions (for 2D plotting):',
          coordinates: embeddings.map(e => ({
            word: e.word,
            x: e.vector[0],
            y: e.vector[1]
          }))
        },

        usage: 'These vectors can be used for similarity calculations, clustering, and downstream NLP tasks'
      };

      return { toolCallId: id, content: JSON.stringify(output, null, 2) };
    }

    if (operation === 'similarity') {
      const word1 = args.word1 || 'king';
      const word2 = args.word2 || 'queen';

      const emb1 = getEmbedding(word1) || generateOOVEmbedding(word1, dimension);
      const emb2 = getEmbedding(word2) || generateOOVEmbedding(word2, dimension);

      const cosSim = cosineSimilarity(emb1, emb2);
      const eucDist = euclideanDistance(emb1, emb2);

      // Also compute pairwise similarities if more words provided
      const words = args.words || [word1, word2];
      const pairwise: { pair: string; similarity: number }[] = [];

      for (let i = 0; i < words.length; i++) {
        for (let j = i + 1; j < words.length; j++) {
          const e1 = getEmbedding(words[i]) || generateOOVEmbedding(words[i], dimension);
          const e2 = getEmbedding(words[j]) || generateOOVEmbedding(words[j], dimension);
          pairwise.push({
            pair: `${words[i]} - ${words[j]}`,
            similarity: Number(cosineSimilarity(e1, e2).toFixed(4))
          });
        }
      }

      pairwise.sort((a, b) => b.similarity - a.similarity);

      const output = {
        operation: 'similarity',
        word1,
        word2,

        metrics: {
          cosineSimilarity: Number(cosSim.toFixed(4)),
          euclideanDistance: Number(eucDist.toFixed(4)),
          interpretation: cosSim > 0.8
            ? 'Very similar (semantically related)'
            : cosSim > 0.5
            ? 'Moderately similar'
            : cosSim > 0.2
            ? 'Weakly similar'
            : cosSim > 0
            ? 'Slightly related'
            : 'Dissimilar or opposite'
        },

        pairwiseSimilarities: pairwise.slice(0, 10),

        formula: 'cosine_similarity = (A·B) / (||A|| × ||B||)'
      };

      return { toolCallId: id, content: JSON.stringify(output, null, 2) };
    }

    if (operation === 'analogy') {
      // Classic: king - man + woman = queen
      const positive = args.positive || ['king', 'woman'];
      const negative = args.negative || ['man'];
      const topN = args.top_n || 5;

      const results = solveAnalogy(positive, negative, topN);

      const output = {
        operation: 'analogy',

        query: {
          positive: positive.join(' + '),
          negative: negative.join(' + '),
          equation: `${positive.join(' + ')} - ${negative.join(' - ')} = ?`
        },

        results: results.map((r, i) => ({
          rank: i + 1,
          word: r.word,
          similarity: Number(r.similarity.toFixed(4))
        })),

        interpretation: results.length > 0
          ? `Best answer: "${results[0].word}" (similarity: ${results[0].similarity.toFixed(3)})`
          : 'No results found',

        examples: {
          'king - man + woman': 'queen (gender analogy)',
          'paris - france + germany': 'berlin (capital analogy)',
          'puppy - dog + cat': 'kitten (age analogy)'
        }
      };

      return { toolCallId: id, content: JSON.stringify(output, null, 2) };
    }

    if (operation === 'nearest') {
      const words = args.words || ['computer'];
      const topN = args.top_n || 10;

      const results = words.map((word: string) => {
        const embedding = getEmbedding(word) || generateOOVEmbedding(word, dimension);
        const neighbors = findNearest(embedding, topN + 1, new Set([word.toLowerCase()])).slice(0, topN);

        return {
          queryWord: word,
          neighbors: neighbors.map((n, i) => ({
            rank: i + 1,
            word: n.word,
            similarity: Number(n.similarity.toFixed(4))
          }))
        };
      });

      const output = {
        operation: 'nearest_neighbors',
        model,

        results,

        usage: 'Nearest neighbors reveal semantic relationships - similar words have similar vectors',

        vocabulary: {
          total: VOCABULARY.length,
          note: 'Demo vocabulary for educational purposes'
        }
      };

      return { toolCallId: id, content: JSON.stringify(output, null, 2) };
    }

    if (operation === 'cluster') {
      const words = args.words || ['king', 'queen', 'prince', 'princess', 'dog', 'cat', 'puppy', 'kitten', 'computer', 'software', 'programming', 'algorithm'];
      const k = args.k || 3;

      const { clusters, iterations } = clusterWords(words, k);

      // Compute cluster characteristics
      const clusterInfo = clusters.map((c, i) => {
        // Get centroid's nearest vocab word
        const allEmbeddings = c.words.map(w => getEmbedding(w) || generateOOVEmbedding(w, dimension));
        const centroidVector = allEmbeddings[0].map((_, dim) =>
          allEmbeddings.reduce((sum, v) => sum + v[dim], 0) / allEmbeddings.length
        );

        return {
          clusterId: i,
          size: c.words.length,
          words: c.words,
          theme: c.words.length > 0
            ? inferTheme(c.words)
            : 'empty'
        };
      });

      const output = {
        operation: 'clustering',
        algorithm: 'K-means',
        k,
        iterations,

        clusters: clusterInfo,

        summary: {
          totalWords: words.length,
          numClusters: clusters.length,
          convergence: iterations < 100 ? 'Converged' : 'Max iterations reached'
        },

        interpretation: 'Words are grouped by semantic similarity in embedding space'
      };

      return { toolCallId: id, content: JSON.stringify(output, null, 2) };
    }

    return { toolCallId: id, content: `Unknown operation: ${operation}`, isError: true };

  } catch (e) {
    const err = e instanceof Error ? e.message : 'Unknown error';
    return { toolCallId: id, content: 'Error: ' + err, isError: true };
  }
}

// Helper to infer cluster theme
function inferTheme(words: string[]): string {
  const themes: { [key: string]: string[] } = {
    'royalty': ['king', 'queen', 'prince', 'princess'],
    'gender': ['man', 'woman', 'boy', 'girl'],
    'geography': ['paris', 'france', 'london', 'england', 'berlin', 'germany', 'tokyo', 'japan'],
    'animals': ['dog', 'cat', 'puppy', 'kitten', 'wolf', 'lion'],
    'technology': ['computer', 'software', 'programming', 'algorithm', 'data'],
    'food': ['apple', 'banana', 'orange', 'food'],
    'actions': ['run', 'walk', 'swim', 'fly'],
    'emotions': ['happy', 'sad', 'angry', 'love']
  };

  for (const [theme, themeWords] of Object.entries(themes)) {
    const overlap = words.filter(w => themeWords.includes(w.toLowerCase())).length;
    if (overlap >= words.length * 0.5) {
      return theme;
    }
  }

  return 'mixed';
}

export function iswordembeddingsAvailable(): boolean { return true; }
