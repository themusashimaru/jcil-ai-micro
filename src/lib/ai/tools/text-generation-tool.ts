/**
 * TEXT-GENERATION TOOL
 * Language model text generation with various sampling strategies
 *
 * Implements:
 * - N-gram language models
 * - Multiple sampling strategies (greedy, top-k, top-p, temperature)
 * - Beam search decoding
 * - Text completion and continuation
 * - Perplexity calculation
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// =============================================================================
// Types and interfaces
// =============================================================================

interface NGramModel {
  n: number;
  counts: Map<string, Map<string, number>>;
  vocabSize: number;
  vocabulary: Set<string>;
}

interface GenerationConfig {
  maxLength: number;
  temperature: number;
  topK: number;
  topP: number;
  strategy: 'greedy' | 'top_k' | 'top_p' | 'temperature' | 'beam_search';
  beamWidth: number;
  stopTokens: string[];
  repetitionPenalty: number;
}

interface GenerationResult {
  text: string;
  tokens: string[];
  logProbability: number;
  perplexity: number;
  strategy: string;
}

// =============================================================================
// Training corpus for n-gram model
// =============================================================================

const TRAINING_CORPUS = `
The quick brown fox jumps over the lazy dog.
A journey of a thousand miles begins with a single step.
To be or not to be that is the question.
All that glitters is not gold.
The early bird catches the worm.
Actions speak louder than words.
Beauty is in the eye of the beholder.
Better late than never.
Birds of a feather flock together.
A picture is worth a thousand words.
Don't count your chickens before they hatch.
Every cloud has a silver lining.
Fortune favors the bold.
Good things come to those who wait.
Honesty is the best policy.
It takes two to tango.
Knowledge is power.
Laughter is the best medicine.
Money can't buy happiness.
No pain no gain.
Practice makes perfect.
Rome wasn't built in a day.
The pen is mightier than the sword.
Time heals all wounds.
When in Rome do as the Romans do.
You can't judge a book by its cover.
A friend in need is a friend indeed.
An apple a day keeps the doctor away.
Curiosity killed the cat.
Don't put all your eggs in one basket.
The grass is always greener on the other side.
Two heads are better than one.
Where there's smoke there's fire.
The best things in life are free.
Love makes the world go round.
Once upon a time in a land far away there lived a king.
The sun was shining brightly in the clear blue sky.
She walked slowly through the forest listening to the birds.
He opened the door and stepped into the darkness.
The rain began to fall gently on the roof.
They sat together by the fire sharing stories of old.
The city was alive with the sounds of traffic and people.
I believe that anything is possible if you try hard enough.
We should always be kind to one another.
The future is full of possibilities and wonder.
Learning new things helps us grow and improve.
Nature provides us with everything we need to survive.
Technology has changed the way we live and work.
Art and music bring joy to our lives.
Books can transport us to different worlds and times.
Dreams are the seeds of reality.
The universe is vast and full of mysteries.
Science helps us understand the world around us.
History teaches us lessons for the future.
`;

// =============================================================================
// N-gram model implementation
// =============================================================================

function tokenizeForNGram(text: string): string[] {
  return text.toLowerCase()
    .replace(/[^a-z\s]/g, '')
    .split(/\s+/)
    .filter(t => t.length > 0);
}

function buildNGramModel(corpus: string, n: number = 3): NGramModel {
  const tokens = tokenizeForNGram(corpus);
  const counts = new Map<string, Map<string, number>>();
  const vocabulary = new Set<string>(tokens);

  // Add special tokens
  vocabulary.add('<START>');
  vocabulary.add('<END>');

  // Build n-gram counts
  for (let i = 0; i <= tokens.length - n; i++) {
    const context = tokens.slice(i, i + n - 1).join(' ');
    const nextWord = tokens[i + n - 1] || '<END>';

    if (!counts.has(context)) {
      counts.set(context, new Map());
    }
    const contextCounts = counts.get(context)!;
    contextCounts.set(nextWord, (contextCounts.get(nextWord) || 0) + 1);
  }

  return {
    n,
    counts,
    vocabSize: vocabulary.size,
    vocabulary
  };
}

function getNextWordProbabilities(
  model: NGramModel,
  context: string[],
  smoothing: number = 0.1
): Map<string, number> {
  const contextStr = context.slice(-(model.n - 1)).join(' ');
  const contextCounts = model.counts.get(contextStr);

  const probabilities = new Map<string, number>();
  let totalCount = 0;

  if (contextCounts) {
    for (const [_, count] of contextCounts) {
      totalCount += count;
    }
  }

  // Add-k smoothing
  const smoothedTotal = totalCount + smoothing * model.vocabSize;

  for (const word of model.vocabulary) {
    const count = contextCounts?.get(word) || 0;
    const prob = (count + smoothing) / smoothedTotal;
    probabilities.set(word, prob);
  }

  return probabilities;
}

// =============================================================================
// Sampling strategies
// =============================================================================

function sampleGreedy(probabilities: Map<string, number>): string {
  let maxProb = -Infinity;
  let maxWord = '';

  for (const [word, prob] of probabilities) {
    if (prob > maxProb) {
      maxProb = prob;
      maxWord = word;
    }
  }

  return maxWord;
}

function sampleTopK(probabilities: Map<string, number>, k: number): string {
  // Sort by probability
  const sorted = [...probabilities.entries()].sort((a, b) => b[1] - a[1]);

  // Take top k
  const topK = sorted.slice(0, k);

  // Normalize probabilities
  const totalProb = topK.reduce((sum, [_, p]) => sum + p, 0);
  const normalized = topK.map(([w, p]) => [w, p / totalProb] as [string, number]);

  // Sample
  const rand = Math.random();
  let cumulative = 0;

  for (const [word, prob] of normalized) {
    cumulative += prob;
    if (rand < cumulative) {
      return word;
    }
  }

  return normalized[normalized.length - 1][0];
}

function sampleTopP(probabilities: Map<string, number>, p: number): string {
  // Sort by probability
  const sorted = [...probabilities.entries()].sort((a, b) => b[1] - a[1]);

  // Find nucleus (smallest set with cumulative prob >= p)
  let cumulative = 0;
  const nucleus: Array<[string, number]> = [];

  for (const [word, prob] of sorted) {
    nucleus.push([word, prob]);
    cumulative += prob;
    if (cumulative >= p) {
      break;
    }
  }

  // Normalize and sample
  const totalProb = nucleus.reduce((sum, [_, pr]) => sum + pr, 0);
  const normalized = nucleus.map(([w, pr]) => [w, pr / totalProb] as [string, number]);

  const rand = Math.random();
  cumulative = 0;

  for (const [word, prob] of normalized) {
    cumulative += prob;
    if (rand < cumulative) {
      return word;
    }
  }

  return normalized[normalized.length - 1][0];
}

function sampleTemperature(probabilities: Map<string, number>, temperature: number): string {
  // Apply temperature scaling
  const scaledProbs = new Map<string, number>();
  let totalScaled = 0;

  for (const [word, prob] of probabilities) {
    const scaled = Math.pow(prob, 1 / temperature);
    scaledProbs.set(word, scaled);
    totalScaled += scaled;
  }

  // Normalize
  for (const [word, scaled] of scaledProbs) {
    scaledProbs.set(word, scaled / totalScaled);
  }

  // Sample
  const rand = Math.random();
  let cumulative = 0;

  for (const [word, prob] of scaledProbs) {
    cumulative += prob;
    if (rand < cumulative) {
      return word;
    }
  }

  return [...scaledProbs.keys()][scaledProbs.size - 1];
}

// =============================================================================
// Beam search
// =============================================================================

interface BeamCandidate {
  tokens: string[];
  logProb: number;
  finished: boolean;
}

function beamSearch(
  model: NGramModel,
  startTokens: string[],
  maxLength: number,
  beamWidth: number,
  stopTokens: string[]
): BeamCandidate[] {
  let beams: BeamCandidate[] = [{
    tokens: [...startTokens],
    logProb: 0,
    finished: false
  }];

  for (let step = 0; step < maxLength; step++) {
    const allCandidates: BeamCandidate[] = [];

    for (const beam of beams) {
      if (beam.finished) {
        allCandidates.push(beam);
        continue;
      }

      const probs = getNextWordProbabilities(model, beam.tokens);

      // Get top candidates
      const sorted = [...probs.entries()].sort((a, b) => b[1] - a[1]);
      const topCandidates = sorted.slice(0, beamWidth * 2);

      for (const [word, prob] of topCandidates) {
        const newLogProb = beam.logProb + Math.log(prob + 1e-10);
        const newTokens = [...beam.tokens, word];
        const finished = stopTokens.includes(word) || word === '<END>';

        allCandidates.push({
          tokens: newTokens,
          logProb: newLogProb,
          finished
        });
      }
    }

    // Keep top beams
    beams = allCandidates
      .sort((a, b) => b.logProb - a.logProb)
      .slice(0, beamWidth);

    // Check if all beams finished
    if (beams.every(b => b.finished)) {
      break;
    }
  }

  return beams;
}

// =============================================================================
// Main generation function
// =============================================================================

function generateText(
  model: NGramModel,
  prompt: string,
  config: GenerationConfig
): GenerationResult {
  const startTokens = tokenizeForNGram(prompt);
  const tokens = [...startTokens];
  let totalLogProb = 0;

  if (config.strategy === 'beam_search') {
    const beams = beamSearch(model, startTokens, config.maxLength, config.beamWidth, config.stopTokens);
    const best = beams[0];

    return {
      text: best.tokens.join(' '),
      tokens: best.tokens,
      logProbability: best.logProb,
      perplexity: Math.exp(-best.logProb / best.tokens.length),
      strategy: 'beam_search'
    };
  }

  // Regular sampling strategies
  const generatedTokens: string[] = [];
  const seenTokens = new Map<string, number>();

  for (let i = 0; i < config.maxLength; i++) {
    let probs = getNextWordProbabilities(model, tokens);

    // Apply repetition penalty
    if (config.repetitionPenalty > 1) {
      for (const [word, prob] of probs) {
        const occurrences = seenTokens.get(word) || 0;
        if (occurrences > 0) {
          probs.set(word, prob / Math.pow(config.repetitionPenalty, occurrences));
        }
      }
    }

    let nextToken: string;

    switch (config.strategy) {
      case 'greedy':
        nextToken = sampleGreedy(probs);
        break;
      case 'top_k':
        nextToken = sampleTopK(probs, config.topK);
        break;
      case 'top_p':
        nextToken = sampleTopP(probs, config.topP);
        break;
      case 'temperature':
      default:
        nextToken = sampleTemperature(probs, config.temperature);
    }

    // Check stop conditions
    if (config.stopTokens.includes(nextToken) || nextToken === '<END>') {
      break;
    }

    generatedTokens.push(nextToken);
    tokens.push(nextToken);
    totalLogProb += Math.log((probs.get(nextToken) || 1e-10));
    seenTokens.set(nextToken, (seenTokens.get(nextToken) || 0) + 1);
  }

  const allTokens = [...startTokens, ...generatedTokens];

  return {
    text: allTokens.join(' '),
    tokens: allTokens,
    logProbability: totalLogProb,
    perplexity: generatedTokens.length > 0 ?
      Math.exp(-totalLogProb / generatedTokens.length) : 0,
    strategy: config.strategy
  };
}

// =============================================================================
// Perplexity calculation
// =============================================================================

function calculatePerplexity(model: NGramModel, text: string): number {
  const tokens = tokenizeForNGram(text);
  let totalLogProb = 0;
  let count = 0;

  for (let i = model.n - 1; i < tokens.length; i++) {
    const context = tokens.slice(i - model.n + 1, i);
    const word = tokens[i];
    const probs = getNextWordProbabilities(model, context);
    const prob = probs.get(word) || 1e-10;
    totalLogProb += Math.log(prob);
    count++;
  }

  return count > 0 ? Math.exp(-totalLogProb / count) : Infinity;
}

// =============================================================================
// Pre-built model
// =============================================================================

let cachedModel: NGramModel | null = null;

function getModel(): NGramModel {
  if (!cachedModel) {
    cachedModel = buildNGramModel(TRAINING_CORPUS, 3);
  }
  return cachedModel;
}

// =============================================================================
// Sampling strategy information
// =============================================================================

interface SamplingStrategyInfo {
  name: string;
  description: string;
  parameters: string[];
  characteristics: string[];
  useCase: string;
}

const SAMPLING_STRATEGIES: Record<string, SamplingStrategyInfo> = {
  'greedy': {
    name: 'Greedy Decoding',
    description: 'Always selects the token with the highest probability',
    parameters: [],
    characteristics: [
      'Deterministic output',
      'Fast execution',
      'May produce repetitive text',
      'No exploration of alternatives'
    ],
    useCase: 'When you need reproducible, deterministic output'
  },
  'top_k': {
    name: 'Top-K Sampling',
    description: 'Samples from the K most probable tokens',
    parameters: ['k (number of top tokens to consider)'],
    characteristics: [
      'Limits vocabulary to top K options',
      'Prevents sampling unlikely tokens',
      'Fixed truncation regardless of distribution',
      'Moderate diversity'
    ],
    useCase: 'When you want controlled randomness with fixed truncation'
  },
  'top_p': {
    name: 'Top-P (Nucleus) Sampling',
    description: 'Samples from the smallest set of tokens whose cumulative probability exceeds P',
    parameters: ['p (cumulative probability threshold)'],
    characteristics: [
      'Dynamically sized vocabulary',
      'Adapts to probability distribution',
      'Better diversity than top-k',
      'More natural-sounding output'
    ],
    useCase: 'When you want adaptive, natural-sounding generation'
  },
  'temperature': {
    name: 'Temperature Sampling',
    description: 'Scales logits by temperature before sampling',
    parameters: ['temperature (scaling factor)'],
    characteristics: [
      'T < 1: sharper distribution (more deterministic)',
      'T > 1: flatter distribution (more random)',
      'T = 1: unmodified distribution',
      'Smooth control over randomness'
    ],
    useCase: 'When you want fine-grained control over output diversity'
  },
  'beam_search': {
    name: 'Beam Search',
    description: 'Explores multiple hypotheses in parallel, keeping the best K at each step',
    parameters: ['beam_width (number of hypotheses)'],
    characteristics: [
      'Considers global sequence probability',
      'More coherent long-form output',
      'Computationally expensive',
      'May produce generic text'
    ],
    useCase: 'When you need high-quality, coherent sequences'
  }
};

// =============================================================================
// Tool definition
// =============================================================================

export const textgenerationTool: UnifiedTool = {
  name: 'text_generation',
  description: `Language model text generation with various sampling strategies.

Operations:
- generate: Generate text continuation from prompt
- complete: Complete a partial sentence
- beam_search: Generate with beam search decoding
- perplexity: Calculate perplexity of text
- strategies: Get information about sampling strategies
- vocabulary: Get model vocabulary statistics
- info: Documentation and usage information

Sampling Strategies:
- greedy: Always pick highest probability token
- top_k: Sample from top K tokens
- top_p: Sample from nucleus (cumulative probability P)
- temperature: Scale probabilities by temperature
- beam_search: Explore multiple hypotheses

Features:
- N-gram language model
- Multiple sampling strategies
- Repetition penalty
- Perplexity calculation`,
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['generate', 'complete', 'beam_search', 'perplexity', 'strategies', 'vocabulary', 'info'],
        description: 'Operation to perform'
      },
      prompt: {
        type: 'string',
        description: 'Text prompt to continue'
      },
      text: {
        type: 'string',
        description: 'Text for perplexity calculation'
      },
      sampling: {
        type: 'string',
        enum: ['greedy', 'top_k', 'top_p', 'temperature'],
        description: 'Sampling strategy'
      },
      maxLength: {
        type: 'number',
        description: 'Maximum number of tokens to generate (default: 20)'
      },
      temperature: {
        type: 'number',
        description: 'Temperature for sampling (default: 1.0)'
      },
      topK: {
        type: 'number',
        description: 'K value for top-k sampling (default: 10)'
      },
      topP: {
        type: 'number',
        description: 'P value for top-p sampling (default: 0.9)'
      },
      beamWidth: {
        type: 'number',
        description: 'Beam width for beam search (default: 5)'
      },
      repetitionPenalty: {
        type: 'number',
        description: 'Penalty for repeated tokens (default: 1.2)'
      },
      strategy: {
        type: 'string',
        description: 'Specific strategy to get info about'
      }
    },
    required: ['operation']
  }
};

export async function executetextgeneration(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;

  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const {
      operation,
      prompt,
      text,
      sampling,
      maxLength = 20,
      temperature = 1.0,
      topK = 10,
      topP = 0.9,
      beamWidth = 5,
      repetitionPenalty = 1.2,
      strategy
    } = args;

    let result: Record<string, unknown>;

    switch (operation) {
      case 'generate': {
        if (!prompt) {
          throw new Error('prompt parameter is required for generate operation');
        }

        const model = getModel();
        const config: GenerationConfig = {
          maxLength,
          temperature,
          topK,
          topP,
          strategy: sampling || 'temperature',
          beamWidth,
          stopTokens: ['<END>'],
          repetitionPenalty
        };

        const generated = generateText(model, prompt, config);

        result = {
          operation: 'generate',
          prompt,
          generated: generated.text,
          newTokens: generated.tokens.slice(tokenizeForNGram(prompt).length),
          tokenCount: generated.tokens.length,
          logProbability: generated.logProbability,
          perplexity: generated.perplexity,
          config: {
            strategy: config.strategy,
            maxLength: config.maxLength,
            temperature: config.temperature,
            topK: config.topK,
            topP: config.topP,
            repetitionPenalty: config.repetitionPenalty
          }
        };
        break;
      }

      case 'complete': {
        if (!prompt) {
          throw new Error('prompt parameter is required for complete operation');
        }

        const model = getModel();
        const config: GenerationConfig = {
          maxLength: maxLength || 10,
          temperature: temperature || 0.7,
          topK,
          topP,
          strategy: 'top_p',
          beamWidth,
          stopTokens: ['<END>'],
          repetitionPenalty: repetitionPenalty || 1.0
        };

        const generated = generateText(model, prompt, config);

        result = {
          operation: 'complete',
          prompt,
          completion: generated.tokens.slice(tokenizeForNGram(prompt).length).join(' '),
          fullText: generated.text,
          perplexity: generated.perplexity
        };
        break;
      }

      case 'beam_search': {
        if (!prompt) {
          throw new Error('prompt parameter is required for beam_search operation');
        }

        const model = getModel();
        const startTokens = tokenizeForNGram(prompt);
        const beams = beamSearch(model, startTokens, maxLength, beamWidth, ['<END>']);

        result = {
          operation: 'beam_search',
          prompt,
          beamWidth,
          hypotheses: beams.map((beam, i) => ({
            rank: i + 1,
            text: beam.tokens.join(' '),
            logProbability: beam.logProb,
            perplexity: Math.exp(-beam.logProb / beam.tokens.length),
            finished: beam.finished
          }))
        };
        break;
      }

      case 'perplexity': {
        if (!text) {
          throw new Error('text parameter is required for perplexity operation');
        }

        const model = getModel();
        const ppl = calculatePerplexity(model, text);
        const tokens = tokenizeForNGram(text);

        result = {
          operation: 'perplexity',
          text,
          perplexity: ppl,
          tokenCount: tokens.length,
          interpretation: ppl < 50 ? 'Good fit to model' :
                         ppl < 200 ? 'Moderate fit' :
                         ppl < 1000 ? 'Poor fit' : 'Very poor fit',
          note: 'Lower perplexity indicates text is more likely under the model'
        };
        break;
      }

      case 'strategies': {
        if (strategy) {
          const strategyLower = strategy.toLowerCase();
          const strategyInfo = SAMPLING_STRATEGIES[strategyLower];

          if (!strategyInfo) {
            result = {
              operation: 'strategies',
              error: `Unknown strategy: ${strategy}`,
              availableStrategies: Object.keys(SAMPLING_STRATEGIES)
            };
          } else {
            result = {
              operation: 'strategies',
              strategy: strategyLower,
              ...strategyInfo
            };
          }
        } else {
          result = {
            operation: 'strategies',
            description: 'Sampling strategies for text generation',
            strategies: Object.entries(SAMPLING_STRATEGIES).map(([name, info]) => ({
              name,
              fullName: info.name,
              description: info.description,
              useCase: info.useCase
            })),
            comparison: {
              determinism: 'greedy > beam_search > top_k > top_p > temperature',
              diversity: 'temperature > top_p > top_k > beam_search > greedy',
              quality: 'beam_search > top_p > top_k > temperature > greedy (typically)'
            }
          };
        }
        break;
      }

      case 'vocabulary': {
        const model = getModel();

        // Get top contexts
        const contextStats: Array<{ context: string; uniqueNext: number; totalCount: number }> = [];
        for (const [context, nextWords] of model.counts) {
          let total = 0;
          for (const [_, count] of nextWords) {
            total += count;
          }
          contextStats.push({
            context,
            uniqueNext: nextWords.size,
            totalCount: total
          });
        }
        contextStats.sort((a, b) => b.totalCount - a.totalCount);

        result = {
          operation: 'vocabulary',
          modelType: `${model.n}-gram`,
          vocabularySize: model.vocabSize,
          uniqueContexts: model.counts.size,
          topContexts: contextStats.slice(0, 10),
          sampleVocabulary: [...model.vocabulary].slice(0, 50)
        };
        break;
      }

      case 'info':
      default: {
        result = {
          operation: 'info',
          tool: 'text_generation',
          description: 'Language model text generation with multiple sampling strategies',
          modelType: 'N-gram language model (trigram)',
          operations: {
            generate: 'Generate text continuation from prompt',
            complete: 'Complete a partial sentence (optimized settings)',
            beam_search: 'Generate with beam search for multiple hypotheses',
            perplexity: 'Calculate perplexity of text under model',
            strategies: 'Get information about sampling strategies',
            vocabulary: 'Get model vocabulary and statistics'
          },
          samplingStrategies: Object.keys(SAMPLING_STRATEGIES),
          parameters: {
            maxLength: 'Maximum tokens to generate (default: 20)',
            temperature: 'Randomness control (default: 1.0)',
            topK: 'Top-K truncation (default: 10)',
            topP: 'Nucleus probability threshold (default: 0.9)',
            beamWidth: 'Beam search width (default: 5)',
            repetitionPenalty: 'Penalty for repeated tokens (default: 1.2)'
          },
          tips: [
            'Use lower temperature (0.3-0.7) for more focused output',
            'Use higher temperature (1.2-1.5) for more creative output',
            'Top-p sampling often gives more natural results than top-k',
            'Beam search is best for coherent, high-quality sequences',
            'Repetition penalty > 1.0 helps avoid loops'
          ],
          example: {
            usage: '{"operation": "generate", "prompt": "the quick brown", "sampling": "top_p", "maxLength": 10}'
          }
        };
      }
    }

    return { toolCallId: id, content: JSON.stringify(result, null, 2) };
  } catch (e) {
    const err = e instanceof Error ? e.message : 'Unknown error';
    return { toolCallId: id, content: 'Error: ' + err, isError: true };
  }
}

export function istextgenerationAvailable(): boolean { return true; }
