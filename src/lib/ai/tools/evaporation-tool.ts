/**
 * EVAPORATION TOOL
 * Industrial evaporation
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

function heatDuty(m: number, hv: number): number { return m * hv; }
function boilingPointRise(c: number, kb: number): number { return kb * c; }
function steamEconomy(mv: number, ms: number): number { return mv / ms; }
function overallCoeff(q: number, a: number, dt: number): number { return q / (a * dt); }
function multiEffect(n: number, hv: number, hs: number): number { return n * hv / hs; }
function flashEvap(tf: number, tp: number, cp: number, hv: number): number { return cp * (tf - tp) / hv; }
function concentration(ci: number, mi: number, mf: number): number { return ci * mi / mf; }

export const evaporationTool: UnifiedTool = {
  name: 'evaporation',
  description: 'Evaporation: heat_duty, bpr, economy, overall_u, multi_effect, flash, concentration',
  parameters: { type: 'object', properties: { operation: { type: 'string', enum: ['heat_duty', 'bpr', 'economy', 'overall_u', 'multi_effect', 'flash', 'concentration'] }, m: { type: 'number' }, hv: { type: 'number' }, c: { type: 'number' }, kb: { type: 'number' }, mv: { type: 'number' }, ms: { type: 'number' }, q: { type: 'number' }, a: { type: 'number' }, dt: { type: 'number' }, n: { type: 'number' }, hs: { type: 'number' }, tf: { type: 'number' }, tp: { type: 'number' }, cp: { type: 'number' }, ci: { type: 'number' }, mi: { type: 'number' }, mf: { type: 'number' } }, required: ['operation'] },
};

export async function executeEvaporation(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;
  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    let result: Record<string, unknown>;
    switch (args.operation) {
      case 'heat_duty': result = { kW: heatDuty(args.m || 1, args.hv || 2260000) / 1000 }; break;
      case 'bpr': result = { K: boilingPointRise(args.c || 0.5, args.kb || 0.5) }; break;
      case 'economy': result = { ratio: steamEconomy(args.mv || 0.9, args.ms || 1) }; break;
      case 'overall_u': result = { W_m2K: overallCoeff(args.q || 1000000, args.a || 100, args.dt || 20) }; break;
      case 'multi_effect': result = { economy: multiEffect(args.n || 3, args.hv || 2260000, args.hs || 2700000) }; break;
      case 'flash': result = { fraction: flashEvap(args.tf || 120, args.tp || 100, args.cp || 4200, args.hv || 2260000) }; break;
      case 'concentration': result = { percent: concentration(args.ci || 10, args.mi || 1000, args.mf || 100) }; break;
      default: throw new Error(`Unknown: ${args.operation}`);
    }
    return { toolCallId: id, content: JSON.stringify(result, null, 2) };
  } catch (e) { return { toolCallId: id, content: `Error: ${e instanceof Error ? e.message : 'Unknown'}`, isError: true }; }
}
export function isEvaporationAvailable(): boolean { return true; }
