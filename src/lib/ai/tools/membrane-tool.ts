/**
 * MEMBRANE SEPARATION TOOL
 * Membrane processes
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

function flux(j: number, a: number): number { return j / a; }
function rejection(cf: number, cp: number): number { return (1 - cp / cf) * 100; }
function osmoticPressure(c: number, r: number, t: number): number { return c * r * t; }
function waterPermeability(jw: number, dp: number, dpi: number): number { return jw / (dp - dpi); }
function solutePermeability(js: number, cs: number, cp: number): number { return js / (cs - cp); }
function concentration_pol(cw: number, cb: number, jw: number, k: number): number { return (cw - cb) * Math.exp(jw / k) + cb; }
function recovery(qp: number, qf: number): number { return qp / qf * 100; }

export const membraneTool: UnifiedTool = {
  name: 'membrane',
  description: 'Membrane: flux, rejection, osmotic_pressure, water_perm, solute_perm, conc_pol, recovery',
  parameters: { type: 'object', properties: { operation: { type: 'string', enum: ['flux', 'rejection', 'osmotic_pressure', 'water_perm', 'solute_perm', 'conc_pol', 'recovery'] }, j: { type: 'number' }, a: { type: 'number' }, cf: { type: 'number' }, cp: { type: 'number' }, c: { type: 'number' }, r: { type: 'number' }, t: { type: 'number' }, jw: { type: 'number' }, dp: { type: 'number' }, dpi: { type: 'number' }, js: { type: 'number' }, cs: { type: 'number' }, cw: { type: 'number' }, cb: { type: 'number' }, k: { type: 'number' }, qp: { type: 'number' }, qf: { type: 'number' } }, required: ['operation'] },
};

export async function executeMembrane(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;
  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    let result: Record<string, unknown>;
    switch (args.operation) {
      case 'flux': result = { L_m2_hr: flux(args.j || 100, args.a || 10) }; break;
      case 'rejection': result = { percent: rejection(args.cf || 1000, args.cp || 50) }; break;
      case 'osmotic_pressure': result = { bar: osmoticPressure(args.c || 0.5, args.r || 8.314, args.t || 298) / 1e5 }; break;
      case 'water_perm': result = { L_m2_hr_bar: waterPermeability(args.jw || 50, args.dp || 15, args.dpi || 5) }; break;
      case 'solute_perm': result = { m_s: solutePermeability(args.js || 0.1, args.cs || 1000, args.cp || 50) }; break;
      case 'conc_pol': result = { mg_L: concentration_pol(args.cw || 2000, args.cb || 1000, args.jw || 1e-5, args.k || 1e-5) }; break;
      case 'recovery': result = { percent: recovery(args.qp || 80, args.qf || 100) }; break;
      default: throw new Error(`Unknown: ${args.operation}`);
    }
    return { toolCallId: id, content: JSON.stringify(result, null, 2) };
  } catch (e) { return { toolCallId: id, content: `Error: ${e instanceof Error ? e.message : 'Unknown'}`, isError: true }; }
}
export function isMembraneAvailable(): boolean { return true; }
