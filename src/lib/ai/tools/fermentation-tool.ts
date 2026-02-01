/**
 * FERMENTATION TOOL
 * Bioprocess engineering
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

function monod(muMax: number, s: number, ks: number): number { return muMax * s / (ks + s); }
function yieldCoeff(dx: number, ds: number): number { return dx / ds; }
function doubling(mu: number): number { return Math.log(2) / mu; }
function oxTranRate(kla: number, cStar: number, c: number): number { return kla * (cStar - c); }
function specificProd(qp: number, x: number): number { return qp / x; }
function maintenance(ms: number, mu: number, yg: number): number { return ms + mu / yg; }
function dilutionRate(f: number, v: number): number { return f / v; }

export const fermentationTool: UnifiedTool = {
  name: 'fermentation',
  description: 'Fermentation: monod, yield, doubling_time, otr, specific_prod, maintenance, dilution',
  parameters: { type: 'object', properties: { operation: { type: 'string', enum: ['monod', 'yield', 'doubling_time', 'otr', 'specific_prod', 'maintenance', 'dilution'] }, muMax: { type: 'number' }, s: { type: 'number' }, ks: { type: 'number' }, dx: { type: 'number' }, ds: { type: 'number' }, mu: { type: 'number' }, kla: { type: 'number' }, cStar: { type: 'number' }, c: { type: 'number' }, qp: { type: 'number' }, x: { type: 'number' }, ms: { type: 'number' }, yg: { type: 'number' }, f: { type: 'number' }, v: { type: 'number' } }, required: ['operation'] },
};

export async function executeFermentation(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;
  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    let result: Record<string, unknown>;
    switch (args.operation) {
      case 'monod': result = { per_hr: monod(args.muMax || 0.5, args.s || 10, args.ks || 1) }; break;
      case 'yield': result = { g_g: yieldCoeff(args.dx || 5, args.ds || 10) }; break;
      case 'doubling_time': result = { hr: doubling(args.mu || 0.3) }; break;
      case 'otr': result = { mol_L_hr: oxTranRate(args.kla || 200, args.cStar || 0.25, args.c || 0.1) }; break;
      case 'specific_prod': result = { g_g_hr: specificProd(args.qp || 0.5, args.x || 10) }; break;
      case 'maintenance': result = { g_g_hr: maintenance(args.ms || 0.02, args.mu || 0.3, args.yg || 0.5) }; break;
      case 'dilution': result = { per_hr: dilutionRate(args.f || 100, args.v || 1000) }; break;
      default: throw new Error(`Unknown: ${args.operation}`);
    }
    return { toolCallId: id, content: JSON.stringify(result, null, 2) };
  } catch (e) { return { toolCallId: id, content: `Error: ${e instanceof Error ? e.message : 'Unknown'}`, isError: true }; }
}
export function isFermentationAvailable(): boolean { return true; }
