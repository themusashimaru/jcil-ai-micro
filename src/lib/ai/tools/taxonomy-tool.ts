/**
 * TAXONOMY TOOL
 * Biological classification
 */
/* eslint-disable @typescript-eslint/no-unused-vars */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

const RANKS = ['domain', 'kingdom', 'phylum', 'class', 'order', 'family', 'genus', 'species'] as const;
const KINGDOMS = { animalia: 1500000, plantae: 400000, fungi: 148000, protista: 80000, bacteria: 10000, archaea: 500 };

function binomialName(genus: string, species: string): string { return `${genus.charAt(0).toUpperCase()}${genus.slice(1).toLowerCase()} ${species.toLowerCase()}`; }
function rankIndex(rank: string): number { return RANKS.indexOf(rank as typeof RANKS[number]); }
function taxonomicDistance(rank1: string, rank2: string): number { return Math.abs(rankIndex(rank1) - rankIndex(rank2)); }
function speciesRichness(area: number, z: number): number { return Math.pow(area, z); }
function shannonIndex(abundances: number[]): number { const total = abundances.reduce((a, b) => a + b, 0); return -abundances.reduce((h, n) => n > 0 ? h + (n/total) * Math.log(n/total) : h, 0); }
function simpsonIndex(abundances: number[]): number { const n = abundances.reduce((a, b) => a + b, 0); return 1 - abundances.reduce((d, ni) => d + (ni * (ni - 1)) / (n * (n - 1)), 0); }

export const taxonomyTool: UnifiedTool = {
  name: 'taxonomy',
  description: 'Taxonomy: binomial, ranks, diversity_indices, species_richness',
  parameters: { type: 'object', properties: { operation: { type: 'string', enum: ['binomial', 'ranks', 'diversity', 'richness'] }, genus: { type: 'string' }, species: { type: 'string' }, abundances: { type: 'array', items: { type: 'number' } }, area: { type: 'number' }, z: { type: 'number' } }, required: ['operation'] },
};

export async function executeTaxonomy(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;
  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    let result: Record<string, unknown>;
    switch (args.operation) {
      case 'binomial': result = { name: binomialName(args.genus || 'Homo', args.species || 'sapiens') }; break;
      case 'ranks': result = { ranks: RANKS, kingdoms: KINGDOMS }; break;
      case 'diversity': { const ab = args.abundances || [10, 20, 30]; result = { shannon: shannonIndex(ab).toFixed(4), simpson: simpsonIndex(ab).toFixed(4) }; break; }
      case 'richness': result = { species: speciesRichness(args.area || 100, args.z || 0.25).toFixed(2) }; break;
      default: throw new Error(`Unknown: ${args.operation}`);
    }
    return { toolCallId: id, content: JSON.stringify(result, null, 2) };
  } catch (e) { return { toolCallId: id, content: `Error: ${e instanceof Error ? e.message : 'Unknown'}`, isError: true }; }
}
export function isTaxonomyAvailable(): boolean { return true; }

void taxonomicDistance;
