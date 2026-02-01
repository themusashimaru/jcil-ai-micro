/**
 * PETROLEUM TOOL
 * Oil and gas engineering
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

function apiGravity(sg: number): number { return 141.5 / sg - 131.5; }
function flowRate(k: number, h: number, dp: number, mu: number, re: number, rw: number): number { return 2 * Math.PI * k * h * dp / (mu * Math.log(re / rw)); }
function gor(qg: number, qo: number): number { return qg / qo; }
function waterCut(qw: number, qt: number): number { return qw / qt * 100; }
function bottomholePressure(ps: number, rho: number, h: number): number { return ps + rho * 9.81 * h / 1000; }
function oip(area: number, h: number, phi: number, sw: number, bo: number): number { return area * h * phi * (1 - sw) / bo * 6.29; }
function pipePressureDrop(f: number, l: number, rho: number, v: number, d: number): number { return f * l * rho * v * v / (2 * d); }

export const petroleumTool: UnifiedTool = {
  name: 'petroleum',
  description: 'Petroleum: api_gravity, flow_rate, gor, water_cut, bhp, oil_in_place, pressure_drop',
  parameters: { type: 'object', properties: { operation: { type: 'string', enum: ['api_gravity', 'flow_rate', 'gor', 'water_cut', 'bhp', 'oil_in_place', 'pressure_drop'] }, sg: { type: 'number' }, k: { type: 'number' }, h: { type: 'number' }, dp: { type: 'number' }, mu: { type: 'number' }, re: { type: 'number' }, rw: { type: 'number' }, qg: { type: 'number' }, qo: { type: 'number' }, qw: { type: 'number' }, qt: { type: 'number' }, ps: { type: 'number' }, rho: { type: 'number' }, area: { type: 'number' }, phi: { type: 'number' }, sw: { type: 'number' }, bo: { type: 'number' }, f: { type: 'number' }, l: { type: 'number' }, v: { type: 'number' }, d: { type: 'number' } }, required: ['operation'] },
};

export async function executePetroleum(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;
  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    let result: Record<string, unknown>;
    switch (args.operation) {
      case 'api_gravity': result = { api: apiGravity(args.sg || 0.85) }; break;
      case 'flow_rate': result = { m3_day: flowRate(args.k || 100e-15, args.h || 10, args.dp || 5e6, args.mu || 0.001, args.re || 500, args.rw || 0.1) * 86400 }; break;
      case 'gor': result = { scf_bbl: gor(args.qg || 500, args.qo || 100) }; break;
      case 'water_cut': result = { percent: waterCut(args.qw || 30, args.qt || 100) }; break;
      case 'bhp': result = { psi: bottomholePressure(args.ps || 2000, args.rho || 850, args.h || 2000) }; break;
      case 'oil_in_place': result = { MMbbl: oip(args.area || 1e6, args.h || 20, args.phi || 0.2, args.sw || 0.25, args.bo || 1.2) / 1e6 }; break;
      case 'pressure_drop': result = { Pa: pipePressureDrop(args.f || 0.02, args.l || 1000, args.rho || 850, args.v || 2, args.d || 0.1) }; break;
      default: throw new Error(`Unknown: ${args.operation}`);
    }
    return { toolCallId: id, content: JSON.stringify(result, null, 2) };
  } catch (e) { return { toolCallId: id, content: `Error: ${e instanceof Error ? e.message : 'Unknown'}`, isError: true }; }
}
export function isPetroleumAvailable(): boolean { return true; }
