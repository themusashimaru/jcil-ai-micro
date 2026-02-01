// ============================================================================
// COMPRESSION ALGORITHMS TOOL - TIER GODMODE
// ============================================================================
// Educational demonstrations of compression algorithms: Huffman coding,
// Run-Length Encoding, LZ77, and more.
// Pure TypeScript implementation for learning and visualization.
// ============================================================================

/* eslint-disable @typescript-eslint/no-unused-vars */
import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// ============================================================================
// TYPES
// ============================================================================

interface HuffmanNode {
  char?: string;
  freq: number;
  left?: HuffmanNode;
  right?: HuffmanNode;
}

interface CompressionResult {
  original_size: number;
  compressed_size: number;
  compression_ratio: number;
  space_savings: string;
}

// ============================================================================
// RUN-LENGTH ENCODING (RLE)
// ============================================================================

function rleEncode(input: string): { encoded: string; steps: string[] } {
  const steps: string[] = [];
  let encoded = '';
  let i = 0;

  while (i < input.length) {
    const char = input[i];
    let count = 1;

    while (i + count < input.length && input[i + count] === char && count < 255) {
      count++;
    }

    encoded += count > 1 ? `${count}${char}` : char;
    steps.push(`Found ${count}x '${char}' → encoded as '${count > 1 ? count + char : char}'`);
    i += count;
  }

  return { encoded, steps };
}

function rleDecode(encoded: string): { decoded: string; steps: string[] } {
  const steps: string[] = [];
  let decoded = '';
  let i = 0;

  while (i < encoded.length) {
    // Check if starts with number
    let numStr = '';
    while (i < encoded.length && /\d/.test(encoded[i])) {
      numStr += encoded[i];
      i++;
    }

    if (numStr && i < encoded.length) {
      const count = parseInt(numStr, 10);
      const char = encoded[i];
      decoded += char.repeat(count);
      steps.push(`'${numStr}${char}' → '${char}' repeated ${count} times`);
      i++;
    } else if (i < encoded.length) {
      decoded += encoded[i];
      steps.push(`'${encoded[i]}' → single character`);
      i++;
    }
  }

  return { decoded, steps };
}

// ============================================================================
// HUFFMAN CODING
// ============================================================================

function buildHuffmanTree(text: string): { root: HuffmanNode; frequencies: Map<string, number> } {
  // Count frequencies
  const frequencies = new Map<string, number>();
  for (const char of text) {
    frequencies.set(char, (frequencies.get(char) || 0) + 1);
  }

  // Create leaf nodes
  const nodes: HuffmanNode[] = Array.from(frequencies.entries()).map(([char, freq]) => ({
    char,
    freq,
  }));

  // Build tree
  while (nodes.length > 1) {
    // Sort by frequency
    nodes.sort((a, b) => a.freq - b.freq);

    // Take two smallest
    const left = nodes.shift()!;
    const right = nodes.shift()!;

    // Create parent node
    const parent: HuffmanNode = {
      freq: left.freq + right.freq,
      left,
      right,
    };

    nodes.push(parent);
  }

  return { root: nodes[0] || { freq: 0 }, frequencies };
}

function buildHuffmanCodes(
  node: HuffmanNode,
  code: string = '',
  codes: Map<string, string> = new Map()
): Map<string, string> {
  if (node.char !== undefined) {
    codes.set(node.char, code || '0');
  } else {
    if (node.left) buildHuffmanCodes(node.left, code + '0', codes);
    if (node.right) buildHuffmanCodes(node.right, code + '1', codes);
  }
  return codes;
}

function huffmanEncode(text: string): {
  encoded: string;
  codes: Record<string, string>;
  tree_structure: string;
  original_bits: number;
  compressed_bits: number;
} {
  if (!text) {
    return {
      encoded: '',
      codes: {},
      tree_structure: 'Empty input',
      original_bits: 0,
      compressed_bits: 0,
    };
  }

  const { root, frequencies: _frequencies } = buildHuffmanTree(text);
  const codes = buildHuffmanCodes(root);

  let encoded = '';
  for (const char of text) {
    encoded += codes.get(char);
  }

  // Build tree visualization
  function visualizeTree(node: HuffmanNode, prefix: string = '', isLeft: boolean = true): string {
    if (!node) return '';
    let result = '';

    if (node.char !== undefined) {
      const displayChar = node.char === ' ' ? '␣' : node.char === '\n' ? '↵' : node.char;
      result += `${prefix}${isLeft ? '├── ' : '└── '}[${displayChar}] (${node.freq})\n`;
    } else {
      result += `${prefix}${isLeft ? '├── ' : '└── '}(${node.freq})\n`;
    }

    const newPrefix = prefix + (isLeft ? '│   ' : '    ');
    if (node.left) result += visualizeTree(node.left, newPrefix, true);
    if (node.right) result += visualizeTree(node.right, newPrefix, false);

    return result;
  }

  return {
    encoded,
    codes: Object.fromEntries(codes),
    tree_structure: visualizeTree(root),
    original_bits: text.length * 8,
    compressed_bits: encoded.length,
  };
}

function huffmanDecode(encoded: string, codes: Record<string, string>): string {
  // Reverse the codes map
  const reverseCodes = new Map<string, string>();
  for (const [char, code] of Object.entries(codes)) {
    reverseCodes.set(code, char);
  }

  let decoded = '';
  let currentCode = '';

  for (const bit of encoded) {
    currentCode += bit;
    if (reverseCodes.has(currentCode)) {
      decoded += reverseCodes.get(currentCode);
      currentCode = '';
    }
  }

  return decoded;
}

// ============================================================================
// LZ77 COMPRESSION
// ============================================================================

interface LZ77Token {
  offset: number;
  length: number;
  next: string;
}

function lz77Encode(
  text: string,
  windowSize: number = 32,
  lookaheadSize: number = 16
): { tokens: LZ77Token[]; steps: string[] } {
  const tokens: LZ77Token[] = [];
  const steps: string[] = [];
  let pos = 0;

  while (pos < text.length) {
    let bestOffset = 0;
    let bestLength = 0;

    // Search window
    const windowStart = Math.max(0, pos - windowSize);
    const window = text.substring(windowStart, pos);
    const lookahead = text.substring(pos, pos + lookaheadSize);

    // Find longest match in window
    for (let i = 0; i < window.length; i++) {
      let matchLength = 0;
      while (
        matchLength < lookahead.length &&
        window[i + matchLength] === lookahead[matchLength]
      ) {
        matchLength++;
        // Allow match to extend into lookahead (for repeated patterns)
        if (i + matchLength >= window.length) break;
      }

      if (matchLength > bestLength) {
        bestLength = matchLength;
        bestOffset = window.length - i;
      }
    }

    const nextChar = text[pos + bestLength] || '';
    tokens.push({ offset: bestOffset, length: bestLength, next: nextChar });

    if (bestLength > 0) {
      steps.push(
        `Position ${pos}: Found match at offset ${bestOffset}, length ${bestLength}, next='${nextChar}' → (${bestOffset},${bestLength},'${nextChar}')`
      );
    } else {
      steps.push(`Position ${pos}: No match, literal '${nextChar}' → (0,0,'${nextChar}')`);
    }

    pos += bestLength + 1;
  }

  return { tokens, steps };
}

function lz77Decode(tokens: LZ77Token[]): string {
  let decoded = '';

  for (const token of tokens) {
    if (token.offset > 0 && token.length > 0) {
      const start = decoded.length - token.offset;
      for (let i = 0; i < token.length; i++) {
        decoded += decoded[start + i];
      }
    }
    if (token.next) {
      decoded += token.next;
    }
  }

  return decoded;
}

// ============================================================================
// BURROWS-WHEELER TRANSFORM
// ============================================================================

function bwtEncode(text: string): { transformed: string; index: number; rotations: string[] } {
  // Add end-of-string marker
  const marked = text + '$';
  const rotations: string[] = [];

  // Generate all rotations
  for (let i = 0; i < marked.length; i++) {
    rotations.push(marked.slice(i) + marked.slice(0, i));
  }

  // Sort rotations
  const sorted = [...rotations].sort();

  // Find original string index
  const index = sorted.indexOf(marked);

  // Get last column
  const transformed = sorted.map((r) => r[r.length - 1]).join('');

  return {
    transformed,
    index,
    rotations: sorted.slice(0, Math.min(10, sorted.length)), // Show first 10
  };
}

function bwtDecode(transformed: string, index: number): string {
  const n = transformed.length;

  // Build sorted first column
  const firstColumn = [...transformed].sort();

  // Build transformation vector
  const count = new Map<string, number>();
  const ranks: number[] = [];

  for (const char of transformed) {
    const rank = count.get(char) || 0;
    ranks.push(rank);
    count.set(char, rank + 1);
  }

  // Count occurrences in first column
  const firstCount = new Map<string, number>();
  const firstRanks: number[] = [];

  for (const char of firstColumn) {
    const rank = firstCount.get(char) || 0;
    firstRanks.push(rank);
    firstCount.set(char, rank + 1);
  }

  // Build LF mapping
  const lf: number[] = new Array(n);
  for (let i = 0; i < n; i++) {
    const char = transformed[i];
    const rank = ranks[i];

    // Find position in first column with same char and rank
    for (let j = 0; j < n; j++) {
      if (firstColumn[j] === char && firstRanks[j] === rank) {
        lf[i] = j;
        break;
      }
    }
  }

  // Decode
  let result = '';
  let pos = index;

  for (let i = 0; i < n - 1; i++) {
    result = transformed[pos] + result;
    pos = lf[pos];
  }

  return result;
}

// ============================================================================
// SHANNON-FANO CODING
// ============================================================================

function shannonFanoEncode(text: string): {
  codes: Record<string, string>;
  encoded: string;
  tree_structure: string;
} {
  // Count frequencies
  const frequencies: [string, number][] = [];
  const freq = new Map<string, number>();

  for (const char of text) {
    freq.set(char, (freq.get(char) || 0) + 1);
  }

  for (const [char, count] of freq) {
    frequencies.push([char, count]);
  }

  // Sort by frequency descending
  frequencies.sort((a, b) => b[1] - a[1]);

  const codes = new Map<string, string>();

  function divide(symbols: [string, number][], prefix: string, tree: string[]): void {
    if (symbols.length === 0) return;

    if (symbols.length === 1) {
      codes.set(symbols[0][0], prefix || '0');
      tree.push(`${'  '.repeat(prefix.length)}[${symbols[0][0]}] = ${prefix || '0'}`);
      return;
    }

    // Find split point (closest to half total frequency)
    const total = symbols.reduce((sum, s) => sum + s[1], 0);
    let runningSum = 0;
    let splitIndex = 0;
    let minDiff = Infinity;

    for (let i = 0; i < symbols.length - 1; i++) {
      runningSum += symbols[i][1];
      const diff = Math.abs(total - 2 * runningSum);
      if (diff < minDiff) {
        minDiff = diff;
        splitIndex = i + 1;
      }
    }

    tree.push(`${'  '.repeat(prefix.length)}Split: ${symbols.slice(0, splitIndex).map(s => s[0]).join('')} | ${symbols.slice(splitIndex).map(s => s[0]).join('')}`);

    divide(symbols.slice(0, splitIndex), prefix + '0', tree);
    divide(symbols.slice(splitIndex), prefix + '1', tree);
  }

  const treeLines: string[] = [];
  divide(frequencies, '', treeLines);

  let encoded = '';
  for (const char of text) {
    encoded += codes.get(char);
  }

  return {
    codes: Object.fromEntries(codes),
    encoded,
    tree_structure: treeLines.join('\n'),
  };
}

// ============================================================================
// COMPRESSION ANALYSIS
// ============================================================================

function analyzeCompression(original: string, compressed: string): CompressionResult {
  const originalSize = original.length;
  const compressedSize = compressed.length;
  const ratio = compressedSize / originalSize;
  const savings = ((1 - ratio) * 100).toFixed(1);

  return {
    original_size: originalSize,
    compressed_size: compressedSize,
    compression_ratio: Math.round(ratio * 1000) / 1000,
    space_savings: `${savings}%`,
  };
}

function calculateEntropy(text: string): number {
  const freq = new Map<string, number>();
  for (const char of text) {
    freq.set(char, (freq.get(char) || 0) + 1);
  }

  let entropy = 0;
  const n = text.length;

  for (const count of freq.values()) {
    const p = count / n;
    entropy -= p * Math.log2(p);
  }

  return entropy;
}

// ============================================================================
// TOOL DEFINITION
// ============================================================================

export const compressionAlgoTool: UnifiedTool = {
  name: 'compression_algo',
  description: `Educational compression algorithm demonstrations.

Operations:

Run-Length Encoding (RLE):
- rle_encode: Compress repeated characters
- rle_decode: Decompress RLE data

Huffman Coding:
- huffman_encode: Variable-length prefix-free coding
- huffman_decode: Decode Huffman-encoded data

LZ77:
- lz77_encode: Sliding window compression
- lz77_decode: Decode LZ77 tokens

Burrows-Wheeler Transform:
- bwt_encode: Transform for better compression
- bwt_decode: Reverse BWT

Shannon-Fano:
- shannon_fano: Top-down probability coding

Analysis:
- entropy: Calculate information entropy
- compare: Compare multiple algorithms

These are educational implementations showing how compression works.`,

  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: [
          'rle_encode', 'rle_decode',
          'huffman_encode', 'huffman_decode',
          'lz77_encode', 'lz77_decode',
          'bwt_encode', 'bwt_decode',
          'shannon_fano',
          'entropy', 'compare',
        ],
        description: 'Compression operation',
      },
      text: { type: 'string', description: 'Text to compress/decompress' },
      encoded: { type: 'string', description: 'Encoded data for decoding' },
      codes: { type: 'object', description: 'Huffman codes for decoding' },
      tokens: { type: 'array', description: 'LZ77 tokens for decoding' },
      index: { type: 'number', description: 'BWT index for decoding' },
      window_size: { type: 'number', description: 'LZ77 window size' },
      show_steps: { type: 'boolean', description: 'Show step-by-step process' },
    },
    required: ['operation'],
  },
};

// ============================================================================
// EXECUTOR
// ============================================================================

export async function executeCompressionAlgo(
  toolCall: UnifiedToolCall
): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;

  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const { operation, text, show_steps } = args;

    let result: Record<string, unknown>;

    switch (operation) {
      case 'rle_encode': {
        if (!text) throw new Error('text required');
        const { encoded, steps } = rleEncode(text);
        result = {
          operation: 'rle_encode',
          input: text,
          encoded,
          ...analyzeCompression(text, encoded),
          steps: show_steps ? steps : undefined,
          explanation: 'Run-Length Encoding replaces sequences of repeated characters with count+character',
        };
        break;
      }

      case 'rle_decode': {
        const encoded = args.encoded || text;
        if (!encoded) throw new Error('encoded text required');
        const { decoded, steps } = rleDecode(encoded);
        result = {
          operation: 'rle_decode',
          encoded,
          decoded,
          steps: show_steps ? steps : undefined,
        };
        break;
      }

      case 'huffman_encode': {
        if (!text) throw new Error('text required');
        const huffResult = huffmanEncode(text);
        result = {
          operation: 'huffman_encode',
          input: text,
          encoded: huffResult.encoded,
          codes: huffResult.codes,
          tree: huffResult.tree_structure,
          original_bits: huffResult.original_bits,
          compressed_bits: huffResult.compressed_bits,
          compression_ratio: (huffResult.compressed_bits / huffResult.original_bits).toFixed(3),
          explanation: 'Huffman coding assigns shorter codes to more frequent characters',
        };
        break;
      }

      case 'huffman_decode': {
        const encoded = args.encoded;
        const codes = args.codes;
        if (!encoded || !codes) throw new Error('encoded and codes required');
        const decoded = huffmanDecode(encoded, codes);
        result = {
          operation: 'huffman_decode',
          encoded,
          codes,
          decoded,
        };
        break;
      }

      case 'lz77_encode': {
        if (!text) throw new Error('text required');
        const windowSize = args.window_size || 32;
        const { tokens, steps } = lz77Encode(text, windowSize);
        result = {
          operation: 'lz77_encode',
          input: text,
          tokens: tokens.map((t) => `(${t.offset},${t.length},'${t.next}')`),
          token_count: tokens.length,
          original_length: text.length,
          steps: show_steps ? steps : undefined,
          explanation: 'LZ77 replaces repeated sequences with (offset, length) references to earlier occurrences',
        };
        break;
      }

      case 'lz77_decode': {
        const tokens = args.tokens as LZ77Token[];
        if (!tokens) throw new Error('tokens required');
        const decoded = lz77Decode(tokens);
        result = {
          operation: 'lz77_decode',
          tokens,
          decoded,
        };
        break;
      }

      case 'bwt_encode': {
        if (!text) throw new Error('text required');
        if (text.length > 50) throw new Error('Text too long for BWT demo (max 50 chars)');
        const bwtResult = bwtEncode(text);
        result = {
          operation: 'bwt_encode',
          input: text,
          transformed: bwtResult.transformed,
          index: bwtResult.index,
          rotations_sample: bwtResult.rotations,
          explanation: 'BWT groups similar characters together, making subsequent compression more effective',
        };
        break;
      }

      case 'bwt_decode': {
        const transformed = args.encoded || args.text;
        const index = args.index;
        if (!transformed || index === undefined) throw new Error('transformed text and index required');
        const decoded = bwtDecode(transformed, index);
        result = {
          operation: 'bwt_decode',
          transformed,
          index,
          decoded,
        };
        break;
      }

      case 'shannon_fano': {
        if (!text) throw new Error('text required');
        const sfResult = shannonFanoEncode(text);
        result = {
          operation: 'shannon_fano',
          input: text,
          codes: sfResult.codes,
          encoded: sfResult.encoded,
          tree: sfResult.tree_structure,
          original_bits: text.length * 8,
          compressed_bits: sfResult.encoded.length,
          explanation: 'Shannon-Fano divides symbols into groups of approximately equal probability',
        };
        break;
      }

      case 'entropy': {
        if (!text) throw new Error('text required');
        const entropy = calculateEntropy(text);
        const freq = new Map<string, number>();
        for (const char of text) {
          freq.set(char, (freq.get(char) || 0) + 1);
        }
        result = {
          operation: 'entropy',
          input: text,
          entropy_bits_per_symbol: entropy.toFixed(4),
          theoretical_minimum_bits: Math.ceil(text.length * entropy),
          original_bits: text.length * 8,
          character_frequencies: Object.fromEntries(
            [...freq.entries()].map(([c, f]) => [c === ' ' ? '(space)' : c, f])
          ),
          unique_characters: freq.size,
          explanation: `Shannon entropy measures information content. Theoretical minimum is ${(entropy).toFixed(2)} bits per character.`,
        };
        break;
      }

      case 'compare': {
        if (!text) throw new Error('text required');

        const rle = rleEncode(text);
        const huffman = huffmanEncode(text);
        const lz77 = lz77Encode(text);
        const entropy = calculateEntropy(text);

        result = {
          operation: 'compare',
          input: text,
          input_length: text.length,
          theoretical_entropy: `${entropy.toFixed(2)} bits/symbol`,
          algorithms: {
            rle: {
              compressed_length: rle.encoded.length,
              ratio: (rle.encoded.length / text.length).toFixed(3),
              best_for: 'Repeated characters (e.g., AAAABBBB)',
            },
            huffman: {
              compressed_bits: huffman.compressed_bits,
              ratio: (huffman.compressed_bits / (text.length * 8)).toFixed(3),
              best_for: 'Unequal character frequencies',
            },
            lz77: {
              token_count: lz77.tokens.length,
              best_for: 'Repeated substrings (e.g., the cat sat...)',
            },
          },
          recommendation: entropy < 4
            ? 'Low entropy - Huffman or arithmetic coding recommended'
            : 'Higher entropy - LZ-family algorithms may be better',
        };
        break;
      }

      default:
        throw new Error(`Unknown operation: ${operation}`);
    }

    return {
      toolCallId: id,
      content: JSON.stringify(result, null, 2),
    };
  } catch (error) {
    return {
      toolCallId: id,
      content: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      isError: true,
    };
  }
}

export function isCompressionAlgoAvailable(): boolean {
  return true;
}
