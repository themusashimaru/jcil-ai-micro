/**
 * GENETICS TOOL
 * Genetic calculations
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

function hardyWeinberg(p: number): {p2: number, _2pq: number, q2: number} { const q = 1 - p; return { p2: p * p, _2pq: 2 * p * q, q2: q * q }; }
function heritability(vg: number, vp: number): number { return vg / vp; }
function inbreeding(n: number, generations: number): number { return 1 - Math.pow(1 - 1 / (2 * n), generations); }
function chiSquare(observed: number[], expected: number[]): number { return observed.reduce((sum, o, i) => sum + Math.pow(o - expected[i], 2) / expected[i], 0); }
function selectionResponse(h2: number, s: number): number { return h2 * s; }
function mutationRate(mutations: number, gametes: number): number { return mutations / gametes; }
function recombinationFreq(recombinants: number, total: number): number { return recombinants / total * 100; }

export const geneticsTool: UnifiedTool = {
  name: 'genetics',
  description: 'Genetics: hardy_weinberg, heritability, inbreeding, chi_square, selection, mutation_rate, recombination',
  parameters: { type: 'object', properties: { operation: { type: 'string', enum: ['hardy_weinberg', 'heritability', 'inbreeding', 'chi_square', 'selection', 'mutation_rate', 'recombination'] }, p: { type: 'number' }, vg: { type: 'number' }, vp: { type: 'number' }, n: { type: 'number' }, generations: { type: 'number' }, observed: { type: 'array' }, expected: { type: 'array' }, h2: { type: 'number' }, s: { type: 'number' }, mutations: { type: 'number' }, gametes: { type: 'number' }, recombinants: { type: 'number' }, total: { type: 'number' } }, required: ['operation'] },
};

export async function executeGenetics(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;
  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    let result: Record<string, unknown>;
    switch (args.operation) {
      case 'hardy_weinberg': result = hardyWeinberg(args.p || 0.6); break;
      case 'heritability': result = { h2: heritability(args.vg || 40, args.vp || 100) }; break;
      case 'inbreeding': result = { F: inbreeding(args.n || 50, args.generations || 10) }; break;
      case 'chi_square': result = { chi2: chiSquare(args.observed || [90, 210], args.expected || [100, 200]) }; break;
      case 'selection': result = { R: selectionResponse(args.h2 || 0.4, args.s || 10) }; break;
      case 'mutation_rate': result = { rate: mutationRate(args.mutations || 5, args.gametes || 1e6) }; break;
      case 'recombination': result = { percent: recombinationFreq(args.recombinants || 15, args.total || 100) }; break;
      default: throw new Error(`Unknown: ${args.operation}`);
    }
    return { toolCallId: id, content: JSON.stringify(result, null, 2) };
  } catch (e) { return { toolCallId: id, content: `Error: ${e instanceof Error ? e.message : 'Unknown'}`, isError: true }; }
}
export function isGeneticsAvailable(): boolean { return true; }
