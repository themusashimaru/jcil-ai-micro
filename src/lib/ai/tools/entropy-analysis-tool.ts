/**
 * ENTROPY ANALYSIS TOOL
 * Randomness and entropy analysis
 */
/* eslint-disable @typescript-eslint/no-unused-vars */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

function shannonEntropy(data: string): number {
  const freq: Record<string, number> = {};
  for (const c of data) freq[c] = (freq[c] || 0) + 1;
  const len = data.length;
  return -Object.values(freq).reduce((h, f) => h + (f/len) * Math.log2(f/len), 0);
}

function maxEntropy(alphabetSize: number): number {
  return Math.log2(alphabetSize);
}

function entropyRatio(data: string, alphabetSize: number): number {
  return shannonEntropy(data) / maxEntropy(alphabetSize);
}

function isRandomLooking(data: string): { random: boolean; entropy: number; threshold: number } {
  const entropy = shannonEntropy(data);
  const threshold = 4.5; // bytes considered "random" above this
  return { random: entropy >= threshold, entropy, threshold };
}

function chiSquare(data: string): number {
  const expected = data.length / 256;
  const freq = new Array(256).fill(0);
  for (let i = 0; i < data.length; i++) freq[data.charCodeAt(i)]++;
  return freq.reduce((chi, f) => chi + Math.pow(f - expected, 2) / expected, 0);
}

function bytesNeededForSecurity(bits: number): number {
  return Math.ceil(bits / 8);
}

export const entropyAnalysisTool: UnifiedTool = {
  name: 'entropy_analysis',
  description: 'Entropy analysis: shannon, max_entropy, ratio, is_random, chi_square',
  parameters: { type: 'object', properties: { operation: { type: 'string', enum: ['shannon', 'max_entropy', 'ratio', 'is_random', 'chi_square', 'bytes_needed'] }, data: { type: 'string' }, alphabet_size: { type: 'number' }, bits: { type: 'number' } }, required: ['operation'] },
};

export async function executeEntropyAnalysis(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;
  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    let result: Record<string, unknown>;
    switch (args.operation) {
      case 'shannon': result = { entropy_bits: shannonEntropy(args.data || '').toFixed(4) }; break;
      case 'max_entropy': result = { max_bits: maxEntropy(args.alphabet_size || 256).toFixed(4) }; break;
      case 'ratio': result = { ratio: entropyRatio(args.data || '', args.alphabet_size || 256).toFixed(4) }; break;
      case 'is_random': result = isRandomLooking(args.data || ''); break;
      case 'chi_square': result = { chi_square: chiSquare(args.data || '').toFixed(2) }; break;
      case 'bytes_needed': result = { bytes: bytesNeededForSecurity(args.bits || 128) }; break;
      default: throw new Error(`Unknown: ${args.operation}`);
    }
    return { toolCallId: id, content: JSON.stringify(result, null, 2) };
  } catch (e) { return { toolCallId: id, content: `Error: ${e instanceof Error ? e.message : 'Unknown'}`, isError: true }; }
}
export function isEntropyAnalysisAvailable(): boolean { return true; }
