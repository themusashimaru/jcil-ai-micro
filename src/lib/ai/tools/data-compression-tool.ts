/**
 * DATA COMPRESSION TOOL
 * Compression algorithms: RLE, LZ77, Huffman encoding
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// Run-Length Encoding
function rleEncode(input: string): string {
  if (!input) return '';
  let result = '';
  let count = 1;

  for (let i = 1; i <= input.length; i++) {
    if (i < input.length && input[i] === input[i - 1]) {
      count++;
    } else {
      result += count > 1 ? `${count}${input[i - 1]}` : input[i - 1];
      count = 1;
    }
  }

  return result;
}

function rleDecode(input: string): string {
  let result = '';
  let count = '';

  for (const char of input) {
    if (/\d/.test(char)) {
      count += char;
    } else {
      const num = parseInt(count) || 1;
      result += char.repeat(num);
      count = '';
    }
  }

  return result;
}

// Simple LZ77-like encoding
function lz77Encode(input: string, windowSize: number = 32, lookAheadSize: number = 16): Array<[number, number, string]> {
  const result: Array<[number, number, string]> = [];
  let pos = 0;

  while (pos < input.length) {
    let bestLength = 0;
    let bestOffset = 0;

    const windowStart = Math.max(0, pos - windowSize);
    const window = input.slice(windowStart, pos);
    const lookAhead = input.slice(pos, pos + lookAheadSize);

    for (let offset = 1; offset <= window.length; offset++) {
      let length = 0;
      while (length < lookAhead.length && window[window.length - offset + (length % offset)] === lookAhead[length]) {
        length++;
      }
      if (length > bestLength) {
        bestLength = length;
        bestOffset = offset;
      }
    }

    if (bestLength > 2) {
      result.push([bestOffset, bestLength, input[pos + bestLength] || '']);
      pos += bestLength + 1;
    } else {
      result.push([0, 0, input[pos]]);
      pos++;
    }
  }

  return result;
}

function lz77Decode(encoded: Array<[number, number, string]>): string {
  let result = '';

  for (const [offset, length, char] of encoded) {
    if (offset > 0 && length > 0) {
      const start = result.length - offset;
      for (let i = 0; i < length; i++) {
        result += result[start + (i % offset)];
      }
    }
    if (char) result += char;
  }

  return result;
}

// Huffman encoding
interface HuffmanNode { char?: string; freq: number; left?: HuffmanNode; right?: HuffmanNode; }

function buildHuffmanTree(text: string): HuffmanNode | null {
  const freq: Record<string, number> = {};
  for (const char of text) {
    freq[char] = (freq[char] || 0) + 1;
  }

  const nodes: HuffmanNode[] = Object.entries(freq).map(([char, f]) => ({ char, freq: f }));

  while (nodes.length > 1) {
    nodes.sort((a, b) => a.freq - b.freq);
    const left = nodes.shift()!;
    const right = nodes.shift()!;
    nodes.push({ freq: left.freq + right.freq, left, right });
  }

  return nodes[0] || null;
}

function buildHuffmanCodes(node: HuffmanNode | null, prefix: string = '', codes: Record<string, string> = {}): Record<string, string> {
  if (!node) return codes;

  if (node.char !== undefined) {
    codes[node.char] = prefix || '0';
  } else {
    if (node.left) buildHuffmanCodes(node.left, prefix + '0', codes);
    if (node.right) buildHuffmanCodes(node.right, prefix + '1', codes);
  }

  return codes;
}

function huffmanEncode(text: string): { encoded: string; codes: Record<string, string>; tree: HuffmanNode | null } {
  const tree = buildHuffmanTree(text);
  const codes = buildHuffmanCodes(tree);
  const encoded = text.split('').map(c => codes[c]).join('');
  return { encoded, codes, tree };
}

function huffmanDecode(encoded: string, codes: Record<string, string>): string {
  const reverseMap: Record<string, string> = {};
  for (const [char, code] of Object.entries(codes)) {
    reverseMap[code] = char;
  }

  let result = '';
  let current = '';

  for (const bit of encoded) {
    current += bit;
    if (reverseMap[current]) {
      result += reverseMap[current];
      current = '';
    }
  }

  return result;
}

// Delta encoding (for numeric sequences)
function deltaEncode(numbers: number[]): number[] {
  if (numbers.length === 0) return [];
  const result = [numbers[0]];
  for (let i = 1; i < numbers.length; i++) {
    result.push(numbers[i] - numbers[i - 1]);
  }
  return result;
}

function deltaDecode(encoded: number[]): number[] {
  if (encoded.length === 0) return [];
  const result = [encoded[0]];
  for (let i = 1; i < encoded.length; i++) {
    result.push(result[i - 1] + encoded[i]);
  }
  return result;
}

// Dictionary encoding
function dictionaryEncode(words: string[]): { encoded: number[]; dictionary: Record<number, string> } {
  const dictionary: Record<number, string> = {};
  const wordToId: Record<string, number> = {};
  let nextId = 0;

  const encoded = words.map(word => {
    if (wordToId[word] === undefined) {
      wordToId[word] = nextId;
      dictionary[nextId] = word;
      nextId++;
    }
    return wordToId[word];
  });

  return { encoded, dictionary };
}

function dictionaryDecode(encoded: number[], dictionary: Record<number, string>): string[] {
  return encoded.map(id => dictionary[id] || '');
}

function analyzeCompression(original: string, compressed: string | Array<unknown>): Record<string, unknown> {
  const originalSize = original.length;
  let compressedSize: number;

  if (typeof compressed === 'string') {
    compressedSize = compressed.length;
  } else {
    compressedSize = JSON.stringify(compressed).length;
  }

  const ratio = compressedSize / originalSize;
  const savings = ((1 - ratio) * 100).toFixed(2);

  return {
    originalSize,
    compressedSize,
    compressionRatio: ratio.toFixed(4),
    spaceSavings: `${savings}%`,
    effective: ratio < 1
  };
}

export const dataCompressionTool: UnifiedTool = {
  name: 'data_compression',
  description: 'Data Compression: rle, lz77, huffman, delta, dictionary, analyze',
  parameters: {
    type: 'object',
    properties: {
      operation: { type: 'string', enum: ['rle_encode', 'rle_decode', 'lz77_encode', 'lz77_decode', 'huffman_encode', 'huffman_decode', 'delta_encode', 'delta_decode', 'dictionary_encode', 'dictionary_decode', 'analyze', 'algorithms'] },
      input: { type: 'string' },
      encoded: { type: 'array' },
      numbers: { type: 'array' },
      words: { type: 'array' },
      codes: { type: 'object' },
      dictionary: { type: 'object' }
    },
    required: ['operation']
  }
};

export async function executeDataCompression(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;
  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    let result: Record<string, unknown>;

    const input = args.input || 'AAABBBCCCDDDEEEFFF';

    switch (args.operation) {
      case 'rle_encode':
        const rleEncoded = rleEncode(input);
        result = { original: input, encoded: rleEncoded, analysis: analyzeCompression(input, rleEncoded) };
        break;
      case 'rle_decode':
        result = { encoded: input, decoded: rleDecode(input) };
        break;
      case 'lz77_encode':
        const lzEncoded = lz77Encode(input);
        result = { original: input, encoded: lzEncoded, analysis: analyzeCompression(input, lzEncoded) };
        break;
      case 'lz77_decode':
        const lzInput = args.encoded || [[0, 0, 'a'], [0, 0, 'b'], [2, 2, 'c']];
        result = { encoded: lzInput, decoded: lz77Decode(lzInput) };
        break;
      case 'huffman_encode':
        const huffResult = huffmanEncode(input);
        result = {
          original: input,
          encoded: huffResult.encoded,
          codes: huffResult.codes,
          analysis: analyzeCompression(input, huffResult.encoded)
        };
        break;
      case 'huffman_decode':
        if (!args.encoded || !args.codes) throw new Error('Encoded string and codes required');
        result = { encoded: args.encoded, decoded: huffmanDecode(args.encoded, args.codes) };
        break;
      case 'delta_encode':
        const nums = args.numbers || [10, 12, 15, 18, 22, 27];
        result = { original: nums, encoded: deltaEncode(nums) };
        break;
      case 'delta_decode':
        const deltaInput = args.encoded || [10, 2, 3, 3, 4, 5];
        result = { encoded: deltaInput, decoded: deltaDecode(deltaInput) };
        break;
      case 'dictionary_encode':
        const words = args.words || ['the', 'quick', 'brown', 'fox', 'the', 'lazy', 'dog', 'the'];
        const dictResult = dictionaryEncode(words);
        result = { original: words, ...dictResult };
        break;
      case 'dictionary_decode':
        if (!args.encoded || !args.dictionary) throw new Error('Encoded array and dictionary required');
        result = { encoded: args.encoded, decoded: dictionaryDecode(args.encoded, args.dictionary) };
        break;
      case 'analyze':
        const compressed = args.encoded || rleEncode(input);
        result = analyzeCompression(input, compressed);
        break;
      case 'algorithms':
        result = {
          algorithms: [
            { name: 'RLE', description: 'Run-Length Encoding - good for repeated characters', bestFor: 'Images with solid colors' },
            { name: 'LZ77', description: 'Dictionary-based sliding window', bestFor: 'General text compression' },
            { name: 'Huffman', description: 'Variable-length prefix codes', bestFor: 'Text with frequency patterns' },
            { name: 'Delta', description: 'Stores differences between values', bestFor: 'Sequential numeric data' },
            { name: 'Dictionary', description: 'Maps words to IDs', bestFor: 'Repeated word patterns' }
          ]
        };
        break;
      default:
        throw new Error(`Unknown operation: ${args.operation}`);
    }

    return { toolCallId: id, content: JSON.stringify(result, null, 2) };
  } catch (e) {
    return { toolCallId: id, content: `Error: ${e instanceof Error ? e.message : 'Unknown'}`, isError: true };
  }
}

export function isDataCompressionAvailable(): boolean { return true; }
