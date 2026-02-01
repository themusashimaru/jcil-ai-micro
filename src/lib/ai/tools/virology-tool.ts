/**
 * VIROLOGY TOOL
 * Virus science
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

function tcid50(dilution: number, wells: number, positive: number): number { return dilution * Math.pow(10, (positive / wells - 0.5)); }
function plaqueFormingUnit(plaques: number, volume: number, dilution: number): number { return plaques / (volume * dilution); }
function viralLoad(copies: number, volume: number): number { return copies / volume; }
function basicReproduction(beta: number, s: number, gamma: number): number { return beta * s / gamma; }
function infectionRate(new_: number, susceptible: number, infected: number): number { return new_ / (susceptible * infected); }
function serialInterval(onset1: number, onset2: number): number { return onset2 - onset1; }
function attackRate(cases: number, population: number): number { return cases / population * 100; }

export const virologyTool: UnifiedTool = {
  name: 'virology',
  description: 'Virology: tcid50, pfu, viral_load, R0, infection_rate, serial_interval, attack_rate',
  parameters: { type: 'object', properties: { operation: { type: 'string', enum: ['tcid50', 'pfu', 'viral_load', 'R0', 'infection_rate', 'serial_interval', 'attack_rate'] }, dilution: { type: 'number' }, wells: { type: 'number' }, positive: { type: 'number' }, plaques: { type: 'number' }, volume: { type: 'number' }, copies: { type: 'number' }, beta: { type: 'number' }, s: { type: 'number' }, gamma: { type: 'number' }, new_cases: { type: 'number' }, susceptible: { type: 'number' }, infected: { type: 'number' }, onset1: { type: 'number' }, onset2: { type: 'number' }, cases: { type: 'number' }, population: { type: 'number' } }, required: ['operation'] },
};

export async function executeVirology(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;
  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    let result: Record<string, unknown>;
    switch (args.operation) {
      case 'tcid50': result = { TCID50_mL: tcid50(args.dilution || 1e-5, args.wells || 8, args.positive || 6) }; break;
      case 'pfu': result = { PFU_mL: plaqueFormingUnit(args.plaques || 50, args.volume || 0.1, args.dilution || 1e-6) }; break;
      case 'viral_load': result = { copies_mL: viralLoad(args.copies || 1e6, args.volume || 0.001) }; break;
      case 'R0': result = { R0: basicReproduction(args.beta || 0.5, args.s || 0.99, args.gamma || 0.2) }; break;
      case 'infection_rate': result = { beta: infectionRate(args.new_cases || 100, args.susceptible || 10000, args.infected || 50) }; break;
      case 'serial_interval': result = { days: serialInterval(args.onset1 || 0, args.onset2 || 5) }; break;
      case 'attack_rate': result = { percent: attackRate(args.cases || 500, args.population || 10000) }; break;
      default: throw new Error(`Unknown: ${args.operation}`);
    }
    return { toolCallId: id, content: JSON.stringify(result, null, 2) };
  } catch (e) { return { toolCallId: id, content: `Error: ${e instanceof Error ? e.message : 'Unknown'}`, isError: true }; }
}
export function isVirologyAvailable(): boolean { return true; }
