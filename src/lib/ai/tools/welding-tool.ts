/**
 * WELDING TOOL
 * Welding engineering calculations
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

function heatInput(v: number, i: number, s: number, eff: number): number { return (60 * v * i * eff) / (s * 1000); }
function coolingRate(t: number, t0: number, thickness: number, k: number): number { return 2 * Math.PI * k * Math.pow((t - t0) / thickness, 2); }
function preheatTemp(ce: number): number { return ce < 0.4 ? 0 : (ce - 0.4) * 500; }
function carbonEquivalent(c: number, mn: number, cr: number, mo: number, v: number, ni: number, cu: number): number { return c + mn/6 + (cr+mo+v)/5 + (ni+cu)/15; }
function weldMetal(area: number, length: number, density: number): number { return area * length * density / 1000; }
function electrodeConsumption(weld: number, eff: number): number { return weld / eff; }
function interpassTemp(preheat: number, heatInput: number): number { return preheat + heatInput * 10; }

export const weldingTool: UnifiedTool = {
  name: 'welding',
  description: 'Welding: heat_input, cooling_rate, preheat, carbon_equivalent, weld_metal, electrode, interpass',
  parameters: { type: 'object', properties: { operation: { type: 'string', enum: ['heat_input', 'cooling_rate', 'preheat', 'carbon_equivalent', 'weld_metal', 'electrode', 'interpass'] }, v: { type: 'number' }, i: { type: 'number' }, s: { type: 'number' }, eff: { type: 'number' }, t: { type: 'number' }, t0: { type: 'number' }, thickness: { type: 'number' }, k: { type: 'number' }, ce: { type: 'number' }, c: { type: 'number' }, mn: { type: 'number' }, cr: { type: 'number' }, mo: { type: 'number' }, ni: { type: 'number' }, cu: { type: 'number' }, area: { type: 'number' }, length: { type: 'number' }, density: { type: 'number' }, weld: { type: 'number' }, preheat: { type: 'number' }, heatInput: { type: 'number' } }, required: ['operation'] },
};

export async function executeWelding(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;
  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    let result: Record<string, unknown>;
    switch (args.operation) {
      case 'heat_input': result = { kJ_mm: heatInput(args.v || 25, args.i || 200, args.s || 5, args.eff || 0.8) }; break;
      case 'cooling_rate': result = { C_s: coolingRate(args.t || 800, args.t0 || 20, args.thickness || 10, args.k || 40) }; break;
      case 'preheat': result = { celsius: preheatTemp(args.ce || 0.45) }; break;
      case 'carbon_equivalent': result = { CE: carbonEquivalent(args.c || 0.2, args.mn || 1, args.cr || 0.5, args.mo || 0.2, args.v || 0.05, args.ni || 0.5, args.cu || 0.2) }; break;
      case 'weld_metal': result = { kg: weldMetal(args.area || 50, args.length || 1000, args.density || 7.85) }; break;
      case 'electrode': result = { kg: electrodeConsumption(args.weld || 10, args.eff || 0.65) }; break;
      case 'interpass': result = { celsius: interpassTemp(args.preheat || 100, args.heatInput || 1.5) }; break;
      default: throw new Error(`Unknown: ${args.operation}`);
    }
    return { toolCallId: id, content: JSON.stringify(result, null, 2) };
  } catch (e) { return { toolCallId: id, content: `Error: ${e instanceof Error ? e.message : 'Unknown'}`, isError: true }; }
}
export function isWeldingAvailable(): boolean { return true; }
