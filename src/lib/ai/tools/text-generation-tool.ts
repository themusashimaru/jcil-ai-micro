/**
 * TEXT-GENERATION TOOL
 * Language model text generation with various sampling strategies
 * Implements n-gram models, Markov chains, and sampling methods
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

export const textgenerationTool: UnifiedTool = {
  name: 'text_generation',
  description: 'Language model text generation with various sampling strategies',
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['generate', 'complete', 'beam_search', 'train', 'demo', 'info'],
        description: 'Operation to perform'
      },
      sampling: {
        type: 'string',
        enum: ['greedy', 'top_k', 'top_p', 'temperature', 'beam'],
        description: 'Sampling strategy (default: top_p)'
      },
      prompt: {
        type: 'string',
        description: 'Prompt text to continue from'
      },
      training_text: {
        type: 'string',
        description: 'Text to train the language model on'
      },
      n: {
        type: 'number',
        description: 'N-gram order (default: 3)'
      },
      max_length: {
        type: 'number',
        description: 'Maximum tokens to generate (default: 50)'
      },
      temperature: {
        type: 'number',
        description: 'Temperature for sampling (default: 1.0)'
      },
      top_k: {
        type: 'number',
        description: 'Top-k tokens to consider (default: 40)'
      },
      top_p: {
        type: 'number',
        description: 'Nucleus sampling probability (default: 0.9)'
      },
      beam_width: {
        type: 'number',
        description: 'Beam width for beam search (default: 5)'
      }
    },
    required: ['operation']
  }
};

// Simple tokenizer
function tokenize(text: string): string[] {
  // Split on whitespace and punctuation, keeping punctuation as tokens
  return text.match(/[\w']+|[.,!?;:'"()\-]/g) || [];
}

// Detokenize
function detokenize(tokens: string[]): string {
  return tokens.join(' ')
    .replace(/ ([.,!?;:'")]) /g, '$1 ')
    .replace(/ ([.,!?;:'")])/g, '$1')
    .replace(/\( /g, '(')
    .replace(/" /g, '"')
    .replace(/ "/g, '"');
}

// N-gram language model
class NGramModel {
  private ngrams: Map<string, Map<string, number>> = new Map();
  private vocabulary: Set<string> = new Set();
  private n: number;
  private totalCounts: Map<string, number> = new Map();

  constructor(n: number = 3) {
    this.n = n;
  }

  train(text: string): void {
    const tokens = ['<s>', '<s>', ...tokenize(text), '</s>'];

    // Build vocabulary
    tokens.forEach(t => this.vocabulary.add(t));

    // Build n-grams
    for (let i = this.n - 1; i < tokens.length; i++) {
      const context = tokens.slice(i - this.n + 1, i).join(' ');
      const word = tokens[i];

      if (!this.ngrams.has(context)) {
        this.ngrams.set(context, new Map());
      }

      const contextMap = this.ngrams.get(context)!;
      contextMap.set(word, (contextMap.get(word) || 0) + 1);
      this.totalCounts.set(context, (this.totalCounts.get(context) || 0) + 1);
    }
  }

  // Get probability distribution for next token
  getNextTokenDistribution(context: string[]): Map<string, number> {
    const contextKey = context.slice(-this.n + 1).join(' ');
    const distribution = new Map<string, number>();

    const contextCounts = this.ngrams.get(contextKey);
    if (!contextCounts) {
      // Fall back to uniform distribution
      const prob = 1 / this.vocabulary.size;
      this.vocabulary.forEach(w => distribution.set(w, prob));
      return distribution;
    }

    const total = this.totalCounts.get(contextKey) || 1;
    contextCounts.forEach((count, word) => {
      distribution.set(word, count / total);
    });

    return distribution;
  }

  // Sample next token using different strategies
  sampleNext(
    context: string[],
    strategy: string = 'top_p',
    params: { temperature?: number; top_k?: number; top_p?: number } = {}
  ): string {
    const { temperature = 1.0, top_k = 40, top_p = 0.9 } = params;
    let distribution = this.getNextTokenDistribution(context);

    // Apply temperature
    if (temperature !== 1.0) {
      const tempDist = new Map<string, number>();
      let sum = 0;
      distribution.forEach((prob, word) => {
        const scaled = Math.pow(prob, 1 / temperature);
        tempDist.set(word, scaled);
        sum += scaled;
      });
      tempDist.forEach((prob, word) => tempDist.set(word, prob / sum));
      distribution = tempDist;
    }

    // Sort by probability
    const sorted = Array.from(distribution.entries()).sort((a, b) => b[1] - a[1]);

    if (strategy === 'greedy') {
      return sorted[0]?.[0] || '</s>';
    }

    if (strategy === 'top_k') {
      const topK = sorted.slice(0, top_k);
      const sum = topK.reduce((s, [, p]) => s + p, 0);
      const normalized = topK.map(([w, p]) => [w, p / sum] as [string, number]);
      return this.sampleFromDistribution(normalized);
    }

    if (strategy === 'top_p' || strategy === 'nucleus') {
      let cumProb = 0;
      const nucleus: [string, number][] = [];
      for (const [word, prob] of sorted) {
        nucleus.push([word, prob]);
        cumProb += prob;
        if (cumProb >= top_p) break;
      }
      const sum = nucleus.reduce((s, [, p]) => s + p, 0);
      const normalized = nucleus.map(([w, p]) => [w, p / sum] as [string, number]);
      return this.sampleFromDistribution(normalized);
    }

    // Default: sample from full distribution
    return this.sampleFromDistribution(sorted);
  }

  private sampleFromDistribution(dist: [string, number][]): string {
    const r = Math.random();
    let cumProb = 0;
    for (const [word, prob] of dist) {
      cumProb += prob;
      if (r < cumProb) return word;
    }
    return dist[dist.length - 1]?.[0] || '</s>';
  }

  // Generate text
  generate(
    prompt: string,
    maxLength: number = 50,
    strategy: string = 'top_p',
    params: { temperature?: number; top_k?: number; top_p?: number } = {}
  ): { tokens: string[]; text: string; log_probs: number[] } {
    let context = ['<s>', '<s>', ...tokenize(prompt)];
    const generated: string[] = [];
    const logProbs: number[] = [];

    for (let i = 0; i < maxLength; i++) {
      const nextToken = this.sampleNext(context, strategy, params);

      if (nextToken === '</s>') break;

      // Calculate log probability
      const dist = this.getNextTokenDistribution(context);
      const prob = dist.get(nextToken) || 1e-10;
      logProbs.push(Math.log(prob));

      generated.push(nextToken);
      context.push(nextToken);
    }

    return {
      tokens: generated,
      text: detokenize(generated),
      log_probs: logProbs
    };
  }

  // Beam search generation
  beamSearch(
    prompt: string,
    maxLength: number = 50,
    beamWidth: number = 5
  ): { beams: Array<{ tokens: string[]; text: string; score: number }> } {
    interface Beam {
      context: string[];
      tokens: string[];
      score: number;
    }

    let beams: Beam[] = [{
      context: ['<s>', '<s>', ...tokenize(prompt)],
      tokens: [],
      score: 0
    }];

    for (let i = 0; i < maxLength; i++) {
      const candidates: Beam[] = [];

      for (const beam of beams) {
        const dist = this.getNextTokenDistribution(beam.context);
        const sorted = Array.from(dist.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, beamWidth);

        for (const [word, prob] of sorted) {
          if (word === '</s>') {
            candidates.push({
              context: [...beam.context, word],
              tokens: beam.tokens,
              score: beam.score
            });
          } else {
            candidates.push({
              context: [...beam.context, word],
              tokens: [...beam.tokens, word],
              score: beam.score + Math.log(prob + 1e-10)
            });
          }
        }
      }

      // Keep top beams
      beams = candidates
        .sort((a, b) => b.score - a.score)
        .slice(0, beamWidth);

      // Check if all beams ended
      if (beams.every(b => b.tokens.length === 0 || b.context[b.context.length - 1] === '</s>')) {
        break;
      }
    }

    return {
      beams: beams.map(b => ({
        tokens: b.tokens,
        text: detokenize(b.tokens),
        score: b.score
      }))
    };
  }

  getStats(): { vocabulary_size: number; ngram_count: number; n: number } {
    return {
      vocabulary_size: this.vocabulary.size,
      ngram_count: this.ngrams.size,
      n: this.n
    };
  }
}

// Default training corpus for demo
const DEFAULT_CORPUS = `
The quick brown fox jumps over the lazy dog. The dog was sleeping peacefully in the sun.
A journey of a thousand miles begins with a single step. Every step brings you closer to your destination.
In the beginning was the word, and the word was with code. Programming is the art of thinking clearly.
The best way to predict the future is to create it. Innovation distinguishes between a leader and a follower.
To be or not to be, that is the question. Whether tis nobler in the mind to suffer the slings and arrows.
It was the best of times, it was the worst of times. It was the age of wisdom, it was the age of foolishness.
All happy families are alike; each unhappy family is unhappy in its own way. Life is a journey.
The only thing we have to fear is fear itself. Courage is not the absence of fear, but action in spite of fear.
Ask not what your country can do for you, ask what you can do for your country. Service is the rent we pay.
I have a dream that one day this nation will rise up. Dreams are the seeds of change.
`;

// Global model for session
let globalModel: NGramModel | null = null;

export async function executetextgeneration(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;

  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const {
      operation,
      sampling = 'top_p',
      prompt,
      training_text,
      n = 3,
      max_length = 50,
      temperature = 1.0,
      top_k = 40,
      top_p = 0.9,
      beam_width = 5
    } = args;

    if (operation === 'info') {
      const info = {
        tool: 'text_generation',
        description: 'Language model text generation with various sampling strategies',
        operations: {
          generate: 'Generate text continuation from a prompt',
          complete: 'Complete a partial sentence or text',
          beam_search: 'Generate text using beam search decoding',
          train: 'Train an n-gram language model on custom text',
          demo: 'Demonstrate text generation capabilities'
        },
        sampling_strategies: {
          greedy: 'Always pick the most probable next token',
          top_k: 'Sample from top-k most probable tokens',
          top_p: 'Nucleus sampling - sample from smallest set with cumulative prob >= p',
          temperature: 'Scale logits by temperature before sampling',
          beam: 'Beam search for optimal sequence'
        },
        parameters: {
          n: 'N-gram order (2=bigram, 3=trigram, etc.)',
          max_length: 'Maximum tokens to generate',
          temperature: '< 1.0 = more focused, > 1.0 = more random',
          top_k: 'Number of top tokens to consider',
          top_p: 'Cumulative probability threshold (0.9 typical)',
          beam_width: 'Number of beams to maintain'
        },
        model: {
          type: 'N-gram language model',
          smoothing: 'Uniform fallback for unseen contexts',
          training: 'Count-based maximum likelihood estimation'
        }
      };
      return { toolCallId: id, content: JSON.stringify(info, null, 2) };
    }

    if (operation === 'demo') {
      // Train on default corpus
      const model = new NGramModel(3);
      model.train(DEFAULT_CORPUS);

      const prompts = ['The quick', 'In the beginning', 'The best way'];
      const demos = prompts.map(p => ({
        prompt: p,
        greedy: model.generate(p, 20, 'greedy').text,
        top_p: model.generate(p, 20, 'top_p', { top_p: 0.9 }).text,
        top_k: model.generate(p, 20, 'top_k', { top_k: 10 }).text,
        high_temp: model.generate(p, 20, 'temperature', { temperature: 1.5 }).text,
        low_temp: model.generate(p, 20, 'temperature', { temperature: 0.5 }).text
      }));

      // Beam search demo
      const beamDemo = model.beamSearch('The best', 15, 3);

      return {
        toolCallId: id,
        content: JSON.stringify({
          operation: 'demo',
          description: 'Text generation demonstration with different sampling strategies',
          model_stats: model.getStats(),
          generations: demos,
          beam_search_demo: {
            prompt: 'The best',
            beams: beamDemo.beams.map((b, i) => ({
              rank: i + 1,
              text: b.text,
              score: Math.round(b.score * 100) / 100
            }))
          },
          explanation: {
            greedy: 'Always picks highest probability - deterministic but repetitive',
            top_p: 'Samples from most likely tokens covering 90% probability mass',
            top_k: 'Samples uniformly from top 10 tokens',
            high_temp: 'Temperature 1.5 - more creative/random',
            low_temp: 'Temperature 0.5 - more focused/conservative'
          }
        }, null, 2)
      };
    }

    if (operation === 'train') {
      if (!training_text) {
        return { toolCallId: id, content: 'Error: training_text parameter required', isError: true };
      }

      globalModel = new NGramModel(n);
      globalModel.train(training_text);

      const stats = globalModel.getStats();
      const tokens = tokenize(training_text);

      return {
        toolCallId: id,
        content: JSON.stringify({
          operation: 'train',
          success: true,
          model_order: n,
          training_tokens: tokens.length,
          vocabulary_size: stats.vocabulary_size,
          unique_contexts: stats.ngram_count,
          sample_generation: globalModel.generate(tokens.slice(0, 3).join(' '), 15, 'top_p').text
        }, null, 2)
      };
    }

    // Ensure we have a model
    if (!globalModel) {
      globalModel = new NGramModel(n);
      globalModel.train(DEFAULT_CORPUS);
    }

    if (operation === 'generate' || operation === 'complete') {
      if (!prompt) {
        return { toolCallId: id, content: 'Error: prompt parameter required', isError: true };
      }

      const result = globalModel.generate(prompt, max_length, sampling, {
        temperature,
        top_k,
        top_p
      });

      // Calculate perplexity
      const avgLogProb = result.log_probs.reduce((a, b) => a + b, 0) / Math.max(1, result.log_probs.length);
      const perplexity = Math.exp(-avgLogProb);

      return {
        toolCallId: id,
        content: JSON.stringify({
          operation,
          prompt,
          sampling_strategy: sampling,
          parameters: { temperature, top_k, top_p },
          generated_text: result.text,
          full_text: prompt + ' ' + result.text,
          tokens_generated: result.tokens.length,
          tokens: result.tokens,
          metrics: {
            avg_log_prob: Math.round(avgLogProb * 1000) / 1000,
            perplexity: Math.round(perplexity * 100) / 100
          }
        }, null, 2)
      };
    }

    if (operation === 'beam_search') {
      if (!prompt) {
        return { toolCallId: id, content: 'Error: prompt parameter required', isError: true };
      }

      const result = globalModel.beamSearch(prompt, max_length, beam_width);

      return {
        toolCallId: id,
        content: JSON.stringify({
          operation: 'beam_search',
          prompt,
          beam_width,
          max_length,
          beams: result.beams.map((b, i) => ({
            rank: i + 1,
            generated_text: b.text,
            full_text: prompt + ' ' + b.text,
            tokens: b.tokens,
            log_probability: Math.round(b.score * 1000) / 1000,
            normalized_score: Math.round(b.score / Math.max(1, b.tokens.length) * 1000) / 1000
          })),
          best_completion: result.beams[0]?.text || ''
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

export function istextgenerationAvailable(): boolean { return true; }
