/**
 * INFORMATION THEORY TOOL
 *
 * Shannon information theory: entropy, mutual information,
 * coding theory, and compression bounds.
 *
 * Part of TIER ADVANCED SCIENCE - Ultimate Tool Arsenal
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// ============================================================================
// ENTROPY CALCULATIONS
// ============================================================================

function shannonEntropy(probabilities: number[]): number {
  return -probabilities
    .filter(p => p > 0)
    .reduce((sum, p) => sum + p * Math.log2(p), 0);
}

function jointEntropy(jointProbs: number[][]): number {
  let entropy = 0;
  for (const row of jointProbs) {
    for (const p of row) {
      if (p > 0) {
        entropy -= p * Math.log2(p);
      }
    }
  }
  return entropy;
}

function conditionalEntropy(jointProbs: number[][]): number {
  // H(Y|X) = H(X,Y) - H(X)
  const marginalX = jointProbs.map(row => row.reduce((a, b) => a + b, 0));
  return jointEntropy(jointProbs) - shannonEntropy(marginalX);
}

function mutualInformation(jointProbs: number[][]): number {
  // I(X;Y) = H(X) + H(Y) - H(X,Y)
  const marginalX = jointProbs.map(row => row.reduce((a, b) => a + b, 0));
  const marginalY: number[] = [];
  for (let j = 0; j < jointProbs[0].length; j++) {
    marginalY.push(jointProbs.reduce((sum, row) => sum + row[j], 0));
  }
  return shannonEntropy(marginalX) + shannonEntropy(marginalY) - jointEntropy(jointProbs);
}

function relativeEntropy(p: number[], q: number[]): number {
  // KL divergence D(P||Q)
  let kl = 0;
  for (let i = 0; i < p.length; i++) {
    if (p[i] > 0 && q[i] > 0) {
      kl += p[i] * Math.log2(p[i] / q[i]);
    }
  }
  return kl;
}

function crossEntropy(p: number[], q: number[]): number {
  // H(P,Q) = H(P) + D(P||Q)
  return shannonEntropy(p) + relativeEntropy(p, q);
}

// ============================================================================
// TEXT ANALYSIS
// ============================================================================

function getCharacterProbabilities(text: string): Map<string, number> {
  const freq = new Map<string, number>();
  for (const char of text) {
    freq.set(char, (freq.get(char) || 0) + 1);
  }
  const probs = new Map<string, number>();
  for (const [char, count] of freq) {
    probs.set(char, count / text.length);
  }
  return probs;
}

function textEntropy(text: string): number {
  const probs = getCharacterProbabilities(text);
  return shannonEntropy([...probs.values()]);
}

function redundancy(text: string, alphabetSize: number): number {
  const maxEntropy = Math.log2(alphabetSize);
  const actualEntropy = textEntropy(text);
  return 1 - actualEntropy / maxEntropy;
}

// ============================================================================
// CODING THEORY
// ============================================================================

function huffmanCodes(probabilities: { symbol: string; prob: number }[]): Map<string, string> {
  interface Node {
    prob: number;
    symbol?: string;
    left?: Node;
    right?: Node;
  }

  // Build tree
  const nodes: Node[] = probabilities.map(p => ({ prob: p.prob, symbol: p.symbol }));

  while (nodes.length > 1) {
    nodes.sort((a, b) => a.prob - b.prob);
    const left = nodes.shift()!;
    const right = nodes.shift()!;
    nodes.push({ prob: left.prob + right.prob, left, right });
  }

  // Generate codes
  const codes = new Map<string, string>();
  const traverse = (node: Node, code: string) => {
    if (node.symbol !== undefined) {
      codes.set(node.symbol, code || '0');
    } else {
      if (node.left) traverse(node.left, code + '0');
      if (node.right) traverse(node.right, code + '1');
    }
  };

  if (nodes.length > 0) {
    traverse(nodes[0], '');
  }

  return codes;
}

function averageCodeLength(codes: Map<string, string>, probs: Map<string, number>): number {
  let avg = 0;
  for (const [symbol, code] of codes) {
    avg += (probs.get(symbol) || 0) * code.length;
  }
  return avg;
}

// ============================================================================
// CHANNEL CAPACITY
// ============================================================================

function binarySymmetricChannel(errorProb: number): number {
  // C = 1 - H(p)
  if (errorProb <= 0 || errorProb >= 1) return 1;
  return 1 + errorProb * Math.log2(errorProb) + (1 - errorProb) * Math.log2(1 - errorProb);
}

function binaryErasureChannel(erasureProb: number): number {
  // C = 1 - erasure_prob
  return Math.max(0, 1 - erasureProb);
}

function awgnChannelCapacity(snrDb: number): number {
  // C = 0.5 * log2(1 + SNR)
  const snr = Math.pow(10, snrDb / 10);
  return 0.5 * Math.log2(1 + snr);
}

// ============================================================================
// COMPRESSION BOUNDS
// ============================================================================

function optimalCompressionBits(text: string): number {
  return text.length * textEntropy(text);
}

export function compressionRatio(original: number, compressed: number): number {
  return original / compressed;
}

// ============================================================================
// VISUALIZATION
// ============================================================================

function visualizeDistribution(probs: Map<string, number>): string {
  const sorted = [...probs.entries()].sort((a, b) => b[1] - a[1]);
  const maxProb = Math.max(...probs.values());
  const barWidth = 40;

  const lines: string[] = ['Probability Distribution:'];
  for (const [symbol, prob] of sorted.slice(0, 15)) {
    const bar = '█'.repeat(Math.round(prob / maxProb * barWidth));
    const displaySymbol = symbol === ' ' ? '␣' : symbol === '\n' ? '↵' : symbol;
    lines.push(`${displaySymbol.padEnd(3)} │${bar} ${(prob * 100).toFixed(1)}%`);
  }
  if (sorted.length > 15) {
    lines.push(`... and ${sorted.length - 15} more symbols`);
  }

  return lines.join('\n');
}

function visualizeHuffmanTree(codes: Map<string, string>): string {
  const sorted = [...codes.entries()].sort((a, b) => a[1].length - b[1].length);
  const lines: string[] = ['Huffman Codes:'];
  for (const [symbol, code] of sorted) {
    const displaySymbol = symbol === ' ' ? '␣' : symbol === '\n' ? '↵' : symbol;
    const tree = code.split('').map(b => b === '0' ? '├' : '└').join('');
    lines.push(`${displaySymbol.padEnd(3)} → ${code.padEnd(12)} ${tree}`);
  }
  return lines.join('\n');
}

// ============================================================================
// TOOL DEFINITION
// ============================================================================

export const informationTheoryTool: UnifiedTool = {
  name: 'information_theory',
  description: `Shannon information theory calculations.

Operations:
- entropy: Calculate Shannon entropy of distribution/text
- mutual_info: Mutual information between variables
- kl_divergence: Kullback-Leibler divergence
- huffman: Generate Huffman codes
- channel_capacity: BSC, BEC, AWGN channel capacity
- compression: Optimal compression bounds
- analyze_text: Full information-theoretic text analysis`,

  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['entropy', 'mutual_info', 'kl_divergence', 'huffman', 'channel_capacity', 'compression', 'analyze_text'],
        description: 'Information theory operation',
      },
      text: { type: 'string', description: 'Text to analyze' },
      probabilities: { type: 'string', description: 'Probability distribution as JSON array' },
      joint_probs: { type: 'string', description: 'Joint probability matrix as JSON' },
      p: { type: 'string', description: 'Distribution P as JSON array' },
      q: { type: 'string', description: 'Distribution Q as JSON array' },
      channel_type: { type: 'string', description: 'Channel: bsc, bec, awgn' },
      error_prob: { type: 'number', description: 'Error/erasure probability' },
      snr_db: { type: 'number', description: 'SNR in dB for AWGN' },
    },
    required: ['operation'],
  },
};

// ============================================================================
// EXECUTOR
// ============================================================================

export async function executeInformationTheory(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;

  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const { operation } = args;

    let result: Record<string, unknown>;

    switch (operation) {
      case 'entropy': {
        if (args.text) {
          const entropy = textEntropy(args.text);
          const probs = getCharacterProbabilities(args.text);
          result = {
            operation: 'entropy',
            entropy_bits: Math.round(entropy * 1000) / 1000,
            bits_per_char: Math.round(entropy * 1000) / 1000,
            total_bits: Math.round(args.text.length * entropy),
            unique_symbols: probs.size,
            max_entropy: Math.round(Math.log2(probs.size) * 1000) / 1000,
            efficiency: Math.round(entropy / Math.log2(probs.size) * 100) + '%',
            distribution: visualizeDistribution(probs),
          };
        } else {
          const probs: number[] = JSON.parse(args.probabilities || '[0.5, 0.5]');
          const entropy = shannonEntropy(probs);
          result = {
            operation: 'entropy',
            probabilities: probs,
            entropy_bits: Math.round(entropy * 1000) / 1000,
            max_entropy: Math.round(Math.log2(probs.length) * 1000) / 1000,
          };
        }
        break;
      }

      case 'mutual_info': {
        const joint: number[][] = JSON.parse(args.joint_probs || '[[0.3, 0.1], [0.1, 0.5]]');
        const mi = mutualInformation(joint);
        const hXY = jointEntropy(joint);
        const hYgivenX = conditionalEntropy(joint);
        result = {
          operation: 'mutual_info',
          joint_distribution: joint,
          mutual_information: Math.round(mi * 1000) / 1000,
          joint_entropy: Math.round(hXY * 1000) / 1000,
          conditional_entropy_Y_given_X: Math.round(hYgivenX * 1000) / 1000,
        };
        break;
      }

      case 'kl_divergence': {
        const p: number[] = JSON.parse(args.p || '[0.5, 0.5]');
        const q: number[] = JSON.parse(args.q || '[0.4, 0.6]');
        const kl = relativeEntropy(p, q);
        const cross = crossEntropy(p, q);
        result = {
          operation: 'kl_divergence',
          P: p,
          Q: q,
          kl_divergence_P_Q: Math.round(kl * 1000) / 1000,
          cross_entropy_P_Q: Math.round(cross * 1000) / 1000,
          entropy_P: Math.round(shannonEntropy(p) * 1000) / 1000,
        };
        break;
      }

      case 'huffman': {
        const text = args.text || 'hello world';
        const probs = getCharacterProbabilities(text);
        const probArray = [...probs.entries()].map(([symbol, prob]) => ({ symbol, prob }));
        const codes = huffmanCodes(probArray);
        const avgLen = averageCodeLength(codes, probs);
        const entropy = textEntropy(text);
        result = {
          operation: 'huffman',
          text_sample: text.slice(0, 50),
          entropy: Math.round(entropy * 1000) / 1000,
          average_code_length: Math.round(avgLen * 1000) / 1000,
          efficiency: Math.round(entropy / avgLen * 100) + '%',
          encoded_bits: Math.round(text.length * avgLen),
          original_bits: text.length * 8,
          compression_ratio: Math.round(8 / avgLen * 100) / 100,
          codes: visualizeHuffmanTree(codes),
        };
        break;
      }

      case 'channel_capacity': {
        const { channel_type = 'bsc', error_prob = 0.1, snr_db = 10 } = args;
        let capacity: number;
        let details: Record<string, unknown> = {};

        switch (channel_type) {
          case 'bsc':
            capacity = binarySymmetricChannel(error_prob);
            details = { channel: 'Binary Symmetric Channel', error_probability: error_prob };
            break;
          case 'bec':
            capacity = binaryErasureChannel(error_prob);
            details = { channel: 'Binary Erasure Channel', erasure_probability: error_prob };
            break;
          case 'awgn':
            capacity = awgnChannelCapacity(snr_db);
            details = { channel: 'AWGN Channel', snr_db, snr_linear: Math.pow(10, snr_db / 10) };
            break;
          default:
            throw new Error(`Unknown channel: ${channel_type}`);
        }

        result = {
          operation: 'channel_capacity',
          ...details,
          capacity_bits_per_use: Math.round(capacity * 1000) / 1000,
          max_reliable_rate: Math.round(capacity * 1000) / 1000,
        };
        break;
      }

      case 'compression': {
        const text = args.text || 'this is a test of compression bounds';
        const entropy = textEntropy(text);
        const optimalBits = optimalCompressionBits(text);
        const originalBits = text.length * 8;
        result = {
          operation: 'compression',
          text_length: text.length,
          entropy_per_char: Math.round(entropy * 1000) / 1000,
          theoretical_minimum_bits: Math.round(optimalBits),
          original_bits_ascii: originalBits,
          max_compression_ratio: Math.round(originalBits / optimalBits * 100) / 100,
          space_savings: Math.round((1 - optimalBits / originalBits) * 100) + '%',
        };
        break;
      }

      case 'analyze_text': {
        const text = args.text || 'The quick brown fox jumps over the lazy dog.';
        const probs = getCharacterProbabilities(text);
        const entropy = textEntropy(text);
        const red = redundancy(text, 95); // Printable ASCII
        const probArray = [...probs.entries()].map(([symbol, prob]) => ({ symbol, prob }));
        const codes = huffmanCodes(probArray);
        const avgLen = averageCodeLength(codes, probs);

        result = {
          operation: 'analyze_text',
          text_preview: text.slice(0, 100) + (text.length > 100 ? '...' : ''),
          length: text.length,
          unique_symbols: probs.size,
          entropy_bits_per_char: Math.round(entropy * 1000) / 1000,
          max_entropy: Math.round(Math.log2(probs.size) * 1000) / 1000,
          redundancy: Math.round(red * 100) + '%',
          huffman_avg_length: Math.round(avgLen * 1000) / 1000,
          compression_potential: Math.round(8 / avgLen * 100) / 100 + 'x',
          theoretical_minimum_size: Math.round(text.length * entropy / 8) + ' bytes',
          distribution: visualizeDistribution(probs),
        };
        break;
      }

      default:
        throw new Error(`Unknown operation: ${operation}`);
    }

    return { toolCallId: id, content: JSON.stringify(result, null, 2) };
  } catch (error) {
    return { toolCallId: id, content: `Information Theory Error: ${error instanceof Error ? error.message : 'Unknown'}`, isError: true };
  }
}

export function isInformationTheoryAvailable(): boolean { return true; }
