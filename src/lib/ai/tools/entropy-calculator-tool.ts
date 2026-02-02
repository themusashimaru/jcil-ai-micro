/**
 * ENTROPY-CALCULATOR TOOL
 * Information theory calculations
 *
 * Implements:
 * - Shannon entropy
 * - Joint entropy
 * - Conditional entropy
 * - Mutual information
 * - KL divergence (relative entropy)
 * - Cross entropy
 * - Channel capacity
 * - Data compression bounds
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

export const entropycalculatorTool: UnifiedTool = {
  name: 'entropy_calculator',
  description: 'Calculate Shannon entropy, mutual information, KL divergence, and other information-theoretic measures',
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['entropy', 'joint_entropy', 'conditional_entropy', 'mutual_info', 'kl_divergence', 'cross_entropy', 'channel_capacity', 'compression_bound', 'info'],
        description: 'Operation to perform'
      },
      distribution: {
        type: 'array',
        items: { type: 'number' },
        description: 'Probability distribution P(X) for entropy calculations'
      },
      distribution_q: {
        type: 'array',
        items: { type: 'number' },
        description: 'Second distribution Q(X) for KL divergence or cross entropy'
      },
      joint_distribution: {
        type: 'array',
        items: {
          type: 'array',
          items: { type: 'number' }
        },
        description: 'Joint probability distribution P(X,Y) as 2D array'
      },
      data: {
        type: 'string',
        description: 'String data to analyze for entropy estimation'
      },
      base: {
        type: 'string',
        enum: ['2', 'e', '10'],
        description: 'Logarithm base: 2 (bits), e (nats), 10 (dits). Default: 2'
      },
      noise_probability: {
        type: 'number',
        description: 'Error probability for binary symmetric channel'
      }
    },
    required: ['operation']
  }
};

// Logarithm function with specified base
function logBase(x: number, base: '2' | 'e' | '10'): number {
  if (x <= 0) return 0;
  switch (base) {
    case '2': return Math.log2(x);
    case 'e': return Math.log(x);
    case '10': return Math.log10(x);
    default: return Math.log2(x);
  }
}

// Validate probability distribution
function validateDistribution(dist: number[]): { valid: boolean; error?: string } {
  if (!dist || dist.length === 0) {
    return { valid: false, error: 'Distribution cannot be empty' };
  }

  for (let i = 0; i < dist.length; i++) {
    if (dist[i] < 0 || dist[i] > 1) {
      return { valid: false, error: `Probability at index ${i} (${dist[i]}) must be between 0 and 1` };
    }
  }

  const sum = dist.reduce((a, b) => a + b, 0);
  if (Math.abs(sum - 1) > 0.001) {
    return { valid: false, error: `Distribution must sum to 1, got ${sum.toFixed(4)}` };
  }

  return { valid: true };
}

// Shannon entropy H(X)
function shannonEntropy(distribution: number[], base: '2' | 'e' | '10' = '2'): number {
  let entropy = 0;
  for (const p of distribution) {
    if (p > 0) {
      entropy -= p * logBase(p, base);
    }
  }
  return entropy;
}

// Joint entropy H(X,Y)
function jointEntropy(jointDist: number[][], base: '2' | 'e' | '10' = '2'): number {
  let entropy = 0;
  for (const row of jointDist) {
    for (const p of row) {
      if (p > 0) {
        entropy -= p * logBase(p, base);
      }
    }
  }
  return entropy;
}

// Marginal distributions from joint
function getMarginals(jointDist: number[][]): { px: number[]; py: number[] } {
  const rows = jointDist.length;
  const cols = jointDist[0]?.length || 0;

  const px: number[] = [];
  const py: number[] = new Array(cols).fill(0);

  for (let i = 0; i < rows; i++) {
    let rowSum = 0;
    for (let j = 0; j < cols; j++) {
      rowSum += jointDist[i][j];
      py[j] += jointDist[i][j];
    }
    px.push(rowSum);
  }

  return { px, py };
}

// Conditional entropy H(Y|X)
function conditionalEntropy(jointDist: number[][], base: '2' | 'e' | '10' = '2'): number {
  const { px } = getMarginals(jointDist);
  const Hxy = jointEntropy(jointDist, base);
  const Hx = shannonEntropy(px, base);
  return Hxy - Hx;
}

// Mutual information I(X;Y)
function mutualInformation(jointDist: number[][], base: '2' | 'e' | '10' = '2'): number {
  const { px, py } = getMarginals(jointDist);
  const Hx = shannonEntropy(px, base);
  const Hy = shannonEntropy(py, base);
  const Hxy = jointEntropy(jointDist, base);
  return Hx + Hy - Hxy;
}

// KL divergence D_KL(P||Q)
function klDivergence(p: number[], q: number[], base: '2' | 'e' | '10' = '2'): number {
  if (p.length !== q.length) {
    throw new Error('Distributions must have the same length');
  }

  let kl = 0;
  for (let i = 0; i < p.length; i++) {
    if (p[i] > 0) {
      if (q[i] === 0) {
        return Infinity; // KL divergence is infinite if Q(x)=0 but P(x)>0
      }
      kl += p[i] * logBase(p[i] / q[i], base);
    }
  }
  return kl;
}

// Cross entropy H(P,Q)
function crossEntropy(p: number[], q: number[], base: '2' | 'e' | '10' = '2'): number {
  if (p.length !== q.length) {
    throw new Error('Distributions must have the same length');
  }

  let ce = 0;
  for (let i = 0; i < p.length; i++) {
    if (p[i] > 0 && q[i] > 0) {
      ce -= p[i] * logBase(q[i], base);
    } else if (p[i] > 0 && q[i] === 0) {
      return Infinity;
    }
  }
  return ce;
}

// Binary entropy function H_b(p)
function binaryEntropy(p: number, base: '2' | 'e' | '10' = '2'): number {
  if (p <= 0 || p >= 1) {
    return 0;
  }
  return -p * logBase(p, base) - (1 - p) * logBase(1 - p, base);
}

// Channel capacity for binary symmetric channel
function bscChannelCapacity(errorProb: number, base: '2' | 'e' | '10' = '2'): number {
  // C = 1 - H_b(p) for BSC
  return (base === '2' ? 1 : logBase(2, base)) - binaryEntropy(errorProb, base);
}

// Estimate entropy from data
function estimateEntropyFromData(data: string, base: '2' | 'e' | '10' = '2'): {
  entropy: number;
  entropyRate: number;
  distribution: Record<string, number>;
  symbolCount: number;
  uniqueSymbols: number;
} {
  const counts: Record<string, number> = {};
  const total = data.length;

  for (const char of data) {
    counts[char] = (counts[char] || 0) + 1;
  }

  const distribution: Record<string, number> = {};
  let entropy = 0;

  for (const [char, count] of Object.entries(counts)) {
    const p = count / total;
    distribution[char] = p;
    if (p > 0) {
      entropy -= p * logBase(p, base);
    }
  }

  // Entropy rate (per symbol)
  const maxEntropy = logBase(Object.keys(counts).length, base);
  const entropyRate = maxEntropy > 0 ? entropy / maxEntropy : 0;

  return {
    entropy,
    entropyRate,
    distribution,
    symbolCount: total,
    uniqueSymbols: Object.keys(counts).length
  };
}

// Compression bound based on entropy
function compressionBound(data: string, base: '2' | 'e' | '10' = '2'): {
  originalBits: number;
  entropyBits: number;
  compressionRatio: number;
  redundancy: number;
  minBytesNeeded: number;
} {
  const total = data.length;
  const originalBits = total * 8; // Assuming 8 bits per character

  const { entropy } = estimateEntropyFromData(data, '2');
  const entropyBits = entropy * total;

  const compressionRatio = entropyBits / originalBits;
  const redundancy = 1 - compressionRatio;

  return {
    originalBits,
    entropyBits,
    compressionRatio,
    redundancy,
    minBytesNeeded: Math.ceil(entropyBits / 8)
  };
}

export async function executeentropycalculator(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;
  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const operation = args.operation as string;
    const base = (args.base as '2' | 'e' | '10') || '2';

    if (operation === 'info') {
      return {
        toolCallId: id,
        content: JSON.stringify({
          tool: 'entropy_calculator',
          description: 'Information theory calculations based on Shannon entropy',
          operations: {
            entropy: 'Calculate Shannon entropy H(X) of a probability distribution',
            joint_entropy: 'Calculate joint entropy H(X,Y) from joint distribution',
            conditional_entropy: 'Calculate conditional entropy H(Y|X)',
            mutual_info: 'Calculate mutual information I(X;Y)',
            kl_divergence: 'Calculate Kullback-Leibler divergence D_KL(P||Q)',
            cross_entropy: 'Calculate cross entropy H(P,Q)',
            channel_capacity: 'Calculate capacity of binary symmetric channel',
            compression_bound: 'Estimate theoretical compression limit for data'
          },
          parameters: {
            distribution: 'Probability distribution P(X) as array summing to 1',
            distribution_q: 'Second distribution Q(X) for divergence calculations',
            joint_distribution: '2D array for joint probability P(X,Y)',
            data: 'String data for entropy estimation',
            base: "Logarithm base: '2' (bits), 'e' (nats), '10' (dits)",
            noise_probability: 'Error probability p for BSC channel'
          },
          formulas: {
            entropy: 'H(X) = -Σ P(x) log P(x)',
            joint_entropy: 'H(X,Y) = -Σ P(x,y) log P(x,y)',
            conditional: 'H(Y|X) = H(X,Y) - H(X)',
            mutual_info: 'I(X;Y) = H(X) + H(Y) - H(X,Y)',
            kl_divergence: 'D_KL(P||Q) = Σ P(x) log(P(x)/Q(x))',
            cross_entropy: 'H(P,Q) = -Σ P(x) log Q(x) = H(P) + D_KL(P||Q)',
            bsc_capacity: 'C = 1 - H_b(p) where H_b is binary entropy'
          },
          units: {
            bits: "base 2 (most common, unit = 'bit')",
            nats: "base e (natural, unit = 'nat')",
            dits: "base 10 (decimal, unit = 'dit' or 'hartley')"
          }
        }, null, 2)
      };
    }

    let result: Record<string, unknown>;

    switch (operation) {
      case 'entropy': {
        if (args.data) {
          const estimated = estimateEntropyFromData(args.data as string, base);
          result = {
            entropy: estimated.entropy,
            entropy_rate: estimated.entropyRate,
            symbol_count: estimated.symbolCount,
            unique_symbols: estimated.uniqueSymbols,
            distribution: estimated.distribution,
            unit: base === '2' ? 'bits' : base === 'e' ? 'nats' : 'dits',
            max_entropy: logBase(estimated.uniqueSymbols, base),
            efficiency: estimated.entropy / logBase(estimated.uniqueSymbols, base)
          };
        } else {
          const dist = args.distribution as number[];
          const validation = validateDistribution(dist);
          if (!validation.valid) {
            throw new Error(validation.error);
          }

          const entropy = shannonEntropy(dist, base);
          const maxEntropy = logBase(dist.length, base);

          result = {
            entropy,
            max_entropy: maxEntropy,
            efficiency: entropy / maxEntropy,
            redundancy: 1 - entropy / maxEntropy,
            unit: base === '2' ? 'bits' : base === 'e' ? 'nats' : 'dits',
            perplexity: Math.pow(base === '2' ? 2 : base === 'e' ? Math.E : 10, entropy)
          };
        }
        break;
      }

      case 'joint_entropy': {
        const jointDist = args.joint_distribution as number[][];
        if (!jointDist || jointDist.length === 0) {
          throw new Error('Joint distribution required');
        }

        const { px, py } = getMarginals(jointDist);
        const Hxy = jointEntropy(jointDist, base);
        const Hx = shannonEntropy(px, base);
        const Hy = shannonEntropy(py, base);

        result = {
          joint_entropy: Hxy,
          marginal_x_entropy: Hx,
          marginal_y_entropy: Hy,
          marginal_x: px,
          marginal_y: py,
          unit: base === '2' ? 'bits' : base === 'e' ? 'nats' : 'dits'
        };
        break;
      }

      case 'conditional_entropy': {
        const jointDist = args.joint_distribution as number[][];
        if (!jointDist || jointDist.length === 0) {
          throw new Error('Joint distribution required');
        }

        const { px, py } = getMarginals(jointDist);
        const HyGivenX = conditionalEntropy(jointDist, base);
        const Hxy = jointEntropy(jointDist, base);
        const Hx = shannonEntropy(px, base);

        // H(X|Y) = H(X,Y) - H(Y)
        const Hy = shannonEntropy(py, base);
        const HxGivenY = Hxy - Hy;

        result = {
          'H(Y|X)': HyGivenX,
          'H(X|Y)': HxGivenY,
          'H(X,Y)': Hxy,
          'H(X)': Hx,
          'H(Y)': Hy,
          unit: base === '2' ? 'bits' : base === 'e' ? 'nats' : 'dits',
          note: 'H(Y|X) = H(X,Y) - H(X), always <= H(Y)'
        };
        break;
      }

      case 'mutual_info': {
        const jointDist = args.joint_distribution as number[][];
        if (!jointDist || jointDist.length === 0) {
          throw new Error('Joint distribution required');
        }

        const { px, py } = getMarginals(jointDist);
        const mi = mutualInformation(jointDist, base);
        const Hx = shannonEntropy(px, base);
        const Hy = shannonEntropy(py, base);

        result = {
          mutual_information: mi,
          'H(X)': Hx,
          'H(Y)': Hy,
          normalized_mi: mi / Math.min(Hx, Hy),
          unit: base === '2' ? 'bits' : base === 'e' ? 'nats' : 'dits',
          interpretation: mi > 0.1 ? 'Variables share significant information' : 'Variables are nearly independent',
          note: 'I(X;Y) = H(X) + H(Y) - H(X,Y) = H(X) - H(X|Y)'
        };
        break;
      }

      case 'kl_divergence': {
        const p = args.distribution as number[];
        const q = args.distribution_q as number[];

        if (!p || !q) {
          throw new Error('Both distributions P and Q required');
        }

        const pValidation = validateDistribution(p);
        const qValidation = validateDistribution(q);

        if (!pValidation.valid) throw new Error(`P: ${pValidation.error}`);
        if (!qValidation.valid) throw new Error(`Q: ${qValidation.error}`);

        const klPQ = klDivergence(p, q, base);
        const klQP = klDivergence(q, p, base);
        const jsDivergence = 0.5 * klDivergence(p, p.map((pi, i) => (pi + q[i]) / 2), base) +
                            0.5 * klDivergence(q, p.map((pi, i) => (pi + q[i]) / 2), base);

        result = {
          'D_KL(P||Q)': klPQ,
          'D_KL(Q||P)': klQP,
          'JS_divergence': jsDivergence,
          asymmetric: Math.abs(klPQ - klQP) > 0.001,
          unit: base === '2' ? 'bits' : base === 'e' ? 'nats' : 'dits',
          note: 'KL divergence is asymmetric. JS divergence is symmetric.'
        };
        break;
      }

      case 'cross_entropy': {
        const p = args.distribution as number[];
        const q = args.distribution_q as number[];

        if (!p || !q) {
          throw new Error('Both distributions P and Q required');
        }

        const pValidation = validateDistribution(p);
        const qValidation = validateDistribution(q);

        if (!pValidation.valid) throw new Error(`P: ${pValidation.error}`);
        if (!qValidation.valid) throw new Error(`Q: ${qValidation.error}`);

        const ce = crossEntropy(p, q, base);
        const hp = shannonEntropy(p, base);
        const kl = klDivergence(p, q, base);

        result = {
          cross_entropy: ce,
          entropy_p: hp,
          kl_divergence: kl,
          verification: Math.abs(ce - (hp + kl)) < 0.0001,
          unit: base === '2' ? 'bits' : base === 'e' ? 'nats' : 'dits',
          note: 'Cross entropy H(P,Q) = H(P) + D_KL(P||Q)'
        };
        break;
      }

      case 'channel_capacity': {
        const noiseProb = args.noise_probability as number;

        if (noiseProb === undefined || noiseProb < 0 || noiseProb > 1) {
          throw new Error('Noise probability must be between 0 and 1');
        }

        const capacity = bscChannelCapacity(noiseProb, base);
        const binaryEntr = binaryEntropy(noiseProb, base);

        result = {
          channel_type: 'Binary Symmetric Channel (BSC)',
          error_probability: noiseProb,
          capacity,
          binary_entropy: binaryEntr,
          max_capacity: base === '2' ? 1 : logBase(2, base),
          efficiency: capacity / (base === '2' ? 1 : logBase(2, base)),
          unit: base === '2' ? 'bits per channel use' : base === 'e' ? 'nats' : 'dits',
          note: noiseProb === 0.5 ? 'Channel capacity is 0 at p=0.5 (maximum uncertainty)' : undefined
        };
        break;
      }

      case 'compression_bound': {
        const data = args.data as string;
        if (!data) {
          throw new Error('Data string required for compression analysis');
        }

        const bounds = compressionBound(data, base);
        const { entropy, uniqueSymbols } = estimateEntropyFromData(data, base);

        result = {
          original_size_bits: bounds.originalBits,
          entropy_lower_bound_bits: bounds.entropyBits,
          theoretical_min_bytes: bounds.minBytesNeeded,
          compression_ratio: bounds.compressionRatio,
          redundancy: bounds.redundancy,
          entropy_per_symbol: entropy,
          alphabet_size: uniqueSymbols,
          max_entropy_per_symbol: logBase(uniqueSymbols, base),
          note: 'No lossless compressor can compress below the entropy bound on average'
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
        base,
        ...result
      }, null, 2)
    };

  } catch (e) {
    const err = e instanceof Error ? e.message : 'Unknown error';
    return { toolCallId: id, content: 'Error: ' + err, isError: true };
  }
}

export function isentropycalculatorAvailable(): boolean { return true; }
