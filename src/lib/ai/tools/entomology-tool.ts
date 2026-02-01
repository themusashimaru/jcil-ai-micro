/**
 * ENTOMOLOGY TOOL
 * Insect science
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

function degreeDay(tmax: number, tmin: number, tbase: number): number { const tavg = (tmax + tmin) / 2; return Math.max(0, tavg - tbase); }
function populationGrowth(n0: number, r: number, t: number): number { return n0 * Math.exp(r * t); }
function survivalRate(n1: number, n0: number): number { return n1 / n0 * 100; }
function fecundity(eggs: number, females: number): number { return eggs / females; }
function sexRatio(females: number, males: number): number { return females / (females + males) * 100; }
function damageThreshold(pest: number, predator: number): number { return pest / (predator + 1); }
function trapCatch(caught: number, traps: number, days: number): number { return caught / (traps * days); }

export const entomologyTool: UnifiedTool = {
  name: 'entomology',
  description: 'Entomology: degree_day, population_growth, survival, fecundity, sex_ratio, damage_threshold, trap_catch',
  parameters: { type: 'object', properties: { operation: { type: 'string', enum: ['degree_day', 'population_growth', 'survival', 'fecundity', 'sex_ratio', 'damage_threshold', 'trap_catch'] }, tmax: { type: 'number' }, tmin: { type: 'number' }, tbase: { type: 'number' }, n0: { type: 'number' }, r: { type: 'number' }, t: { type: 'number' }, n1: { type: 'number' }, eggs: { type: 'number' }, females: { type: 'number' }, males: { type: 'number' }, pest: { type: 'number' }, predator: { type: 'number' }, caught: { type: 'number' }, traps: { type: 'number' }, days: { type: 'number' } }, required: ['operation'] },
};

export async function executeEntomology(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;
  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    let result: Record<string, unknown>;
    switch (args.operation) {
      case 'degree_day': result = { DD: degreeDay(args.tmax || 30, args.tmin || 15, args.tbase || 10) }; break;
      case 'population_growth': result = { N: populationGrowth(args.n0 || 100, args.r || 0.1, args.t || 30) }; break;
      case 'survival': result = { percent: survivalRate(args.n1 || 80, args.n0 || 100) }; break;
      case 'fecundity': result = { eggs_female: fecundity(args.eggs || 500, args.females || 10) }; break;
      case 'sex_ratio': result = { percent_female: sexRatio(args.females || 55, args.males || 45) }; break;
      case 'damage_threshold': result = { index: damageThreshold(args.pest || 100, args.predator || 20) }; break;
      case 'trap_catch': result = { per_trap_day: trapCatch(args.caught || 50, args.traps || 10, args.days || 5) }; break;
      default: throw new Error(`Unknown: ${args.operation}`);
    }
    return { toolCallId: id, content: JSON.stringify(result, null, 2) };
  } catch (e) { return { toolCallId: id, content: `Error: ${e instanceof Error ? e.message : 'Unknown'}`, isError: true }; }
}
export function isEntomologyAvailable(): boolean { return true; }
