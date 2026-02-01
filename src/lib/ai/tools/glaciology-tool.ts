/**
 * GLACIOLOGY TOOL
 * Glacier and ice science
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

function iceVelocity(tau: number, n: number, a: number): number { return 2 * a * Math.pow(tau, n); }
function massBalance(accumulation: number, ablation: number): number { return accumulation - ablation; }
function iceDensity(depth: number): number { return 917 - 550 * Math.exp(-depth / 30); }
function crevassDepth(rho: number, stress: number): number { return 2 * stress / (rho * 9.81); }
function glacierLength(ela: number, slope: number, balance: number): number { return (ela - balance * 1000) / slope; }
function calvingRate(depth: number, temp: number): number { return 0.1 * depth * (temp + 2); }
function iceAge(depth: number, accumulation: number): number { return depth / accumulation; }

export const glaciologyTool: UnifiedTool = {
  name: 'glaciology',
  description: 'Glaciology: ice_velocity, mass_balance, ice_density, crevasse, glacier_length, calving, ice_age',
  parameters: { type: 'object', properties: { operation: { type: 'string', enum: ['ice_velocity', 'mass_balance', 'ice_density', 'crevasse', 'glacier_length', 'calving', 'ice_age'] }, tau: { type: 'number' }, n: { type: 'number' }, a: { type: 'number' }, accumulation: { type: 'number' }, ablation: { type: 'number' }, depth: { type: 'number' }, rho: { type: 'number' }, stress: { type: 'number' }, ela: { type: 'number' }, slope: { type: 'number' }, balance: { type: 'number' }, temp: { type: 'number' } }, required: ['operation'] },
};

export async function executeGlaciology(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;
  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    let result: Record<string, unknown>;
    switch (args.operation) {
      case 'ice_velocity': result = { m_yr: iceVelocity(args.tau || 100000, args.n || 3, args.a || 1e-16) * 3.15e7 }; break;
      case 'mass_balance': result = { m_we: massBalance(args.accumulation || 2, args.ablation || 1.5) }; break;
      case 'ice_density': result = { kg_m3: iceDensity(args.depth || 50) }; break;
      case 'crevasse': result = { m: crevassDepth(args.rho || 900, args.stress || 100000) }; break;
      case 'glacier_length': result = { km: glacierLength(args.ela || 3000, args.slope || 0.1, args.balance || 0) / 1000 }; break;
      case 'calving': result = { m_yr: calvingRate(args.depth || 100, args.temp || 0) }; break;
      case 'ice_age': result = { years: iceAge(args.depth || 100, args.accumulation || 0.25) }; break;
      default: throw new Error(`Unknown: ${args.operation}`);
    }
    return { toolCallId: id, content: JSON.stringify(result, null, 2) };
  } catch (e) { return { toolCallId: id, content: `Error: ${e instanceof Error ? e.message : 'Unknown'}`, isError: true }; }
}
export function isGlaciologyAvailable(): boolean { return true; }
