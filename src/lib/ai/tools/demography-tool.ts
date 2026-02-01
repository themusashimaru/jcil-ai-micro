/**
 * DEMOGRAPHY TOOL
 * Population science
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

function populationGrowth(p0: number, r: number, t: number): number { return p0 * Math.exp(r * t); }
function doublingTime(r: number): number { return Math.log(2) / r; }
function fertilityRate(births: number, women: number): number { return births / women * 1000; }
function mortalityRate(deaths: number, population: number): number { return deaths / population * 1000; }
function lifeExpectancy(lx: number[], ages: number[]): number { return lx.reduce((sum, l, i) => sum + l * (ages[i + 1] || ages[i] + 1), 0) / lx[0]; }
function migrationRate(immigrants: number, emigrants: number, pop: number): number { return (immigrants - emigrants) / pop * 1000; }
function dependencyRatio(young: number, old: number, working: number): number { return (young + old) / working * 100; }

export const demographyTool: UnifiedTool = {
  name: 'demography',
  description: 'Demography: growth, doubling_time, fertility, mortality, life_expectancy, migration, dependency',
  parameters: { type: 'object', properties: { operation: { type: 'string', enum: ['growth', 'doubling_time', 'fertility', 'mortality', 'life_expectancy', 'migration', 'dependency'] }, p0: { type: 'number' }, r: { type: 'number' }, t: { type: 'number' }, births: { type: 'number' }, women: { type: 'number' }, deaths: { type: 'number' }, population: { type: 'number' }, lx: { type: 'array' }, ages: { type: 'array' }, immigrants: { type: 'number' }, emigrants: { type: 'number' }, pop: { type: 'number' }, young: { type: 'number' }, old: { type: 'number' }, working: { type: 'number' } }, required: ['operation'] },
};

export async function executeDemography(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;
  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    let result: Record<string, unknown>;
    switch (args.operation) {
      case 'growth': result = { population: populationGrowth(args.p0 || 1e6, args.r || 0.02, args.t || 10) }; break;
      case 'doubling_time': result = { years: doublingTime(args.r || 0.02) }; break;
      case 'fertility': result = { per_1000: fertilityRate(args.births || 15000, args.women || 250000) }; break;
      case 'mortality': result = { per_1000: mortalityRate(args.deaths || 10000, args.population || 1e6) }; break;
      case 'life_expectancy': result = { years: lifeExpectancy(args.lx || [100000, 99000, 98000, 95000], args.ages || [0, 1, 5, 10]) }; break;
      case 'migration': result = { per_1000: migrationRate(args.immigrants || 5000, args.emigrants || 2000, args.pop || 1e6) }; break;
      case 'dependency': result = { ratio: dependencyRatio(args.young || 200000, args.old || 150000, args.working || 650000) }; break;
      default: throw new Error(`Unknown: ${args.operation}`);
    }
    return { toolCallId: id, content: JSON.stringify(result, null, 2) };
  } catch (e) { return { toolCallId: id, content: `Error: ${e instanceof Error ? e.message : 'Unknown'}`, isError: true }; }
}
export function isDemographyAvailable(): boolean { return true; }
