/**
 * ADSORPTION TOOL
 * Surface adsorption
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

function langmuir(qm: number, kl: number, c: number): number { return qm * kl * c / (1 + kl * c); }
function freundlich(kf: number, c: number, n: number): number { return kf * Math.pow(c, 1/n); }
function bet(vm: number, c: number, p: number, p0: number): number { return vm * c * (p/p0) / ((1 - p/p0) * (1 + (c-1) * p/p0)); }
function dubininRadush(w0: number, e: number, r: number, t: number, p0: number, p: number): number { return w0 * Math.exp(-Math.pow(r * t * Math.log(p0/p) / e, 2)); }
function breakthrough(l: number, v: number, q: number, c: number): number { return l * q / (v * c); }
function massTransferZone(tb: number, te: number, v: number): number { return v * (te - tb); }
function capacity(m: number, v: number, ci: number, cf: number): number { return v * (ci - cf) / m; }

export const adsorptionTool: UnifiedTool = {
  name: 'adsorption',
  description: 'Adsorption: langmuir, freundlich, bet, dubinin, breakthrough, mtz, capacity',
  parameters: { type: 'object', properties: { operation: { type: 'string', enum: ['langmuir', 'freundlich', 'bet', 'dubinin', 'breakthrough', 'mtz', 'capacity'] }, qm: { type: 'number' }, kl: { type: 'number' }, c: { type: 'number' }, kf: { type: 'number' }, n: { type: 'number' }, vm: { type: 'number' }, p: { type: 'number' }, p0: { type: 'number' }, w0: { type: 'number' }, e: { type: 'number' }, r: { type: 'number' }, t: { type: 'number' }, l: { type: 'number' }, v: { type: 'number' }, q: { type: 'number' }, tb: { type: 'number' }, te: { type: 'number' }, m: { type: 'number' }, ci: { type: 'number' }, cf: { type: 'number' } }, required: ['operation'] },
};

export async function executeAdsorption(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;
  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    let result: Record<string, unknown>;
    switch (args.operation) {
      case 'langmuir': result = { mg_g: langmuir(args.qm || 100, args.kl || 0.1, args.c || 10) }; break;
      case 'freundlich': result = { mg_g: freundlich(args.kf || 10, args.c || 10, args.n || 2) }; break;
      case 'bet': result = { cm3_g: bet(args.vm || 50, args.c || 100, args.p || 0.3, args.p0 || 1) }; break;
      case 'dubinin': result = { cm3_g: dubininRadush(args.w0 || 0.5, args.e || 20000, args.r || 8.314, args.t || 298, args.p0 || 1, args.p || 0.5) }; break;
      case 'breakthrough': result = { min: breakthrough(args.l || 1, args.v || 10, args.q || 50, args.c || 100) }; break;
      case 'mtz': result = { cm: massTransferZone(args.tb || 60, args.te || 90, args.v || 5) }; break;
      case 'capacity': result = { mg_g: capacity(args.m || 10, args.v || 1000, args.ci || 100, args.cf || 10) }; break;
      default: throw new Error(`Unknown: ${args.operation}`);
    }
    return { toolCallId: id, content: JSON.stringify(result, null, 2) };
  } catch (e) { return { toolCallId: id, content: `Error: ${e instanceof Error ? e.message : 'Unknown'}`, isError: true }; }
}
export function isAdsorptionAvailable(): boolean { return true; }
